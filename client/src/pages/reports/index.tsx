import { useMemo, useRef, useState } from "react";
import {
  format, isWithinInterval, parseISO, startOfDay, endOfDay,
  startOfWeek, subDays, addDays, addWeeks, addMonths, addYears,
} from "date-fns";
import {
  Area, AreaChart, CartesianGrid, Cell, ComposedChart,
  Legend, Pie, PieChart, ResponsiveContainer, Scatter, Bar,
  Tooltip as RechartsTooltip, XAxis, YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import { DateRange } from "react-day-picker";
import { CalendarDays, Download, FileText, TrendingDown, TrendingUp } from "lucide-react";

import PageLayout from "@/components/page-layout";
import ScheduleReportDrawer from "./_component/schedule-report-drawer";
import ReportTable from "./_component/report-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-currency";
import { generateReportPDF, exportExpenseRowsCSV, ExpenseExportRow } from "@/lib/report-export";
import { useChartAnalyticsQuery, useExpensePieChartBreakdownQuery, useSummaryAnalyticsQuery } from "@/features/analytics/analyticsAPI";
import { useGenerateReportQuery, useGetAllReportsQuery } from "@/features/report/reportAPI";
import { useGetAllTransactionsQuery } from "@/features/transaction/transactionAPI";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const PERIOD_OPTIONS = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
] as const;

type ReportPeriod = (typeof PERIOD_OPTIONS)[number]["value"];

type TrendPoint = { bucket: string; date: string; income: number; expenses: number };

const defaultRange = (): DateRange => ({
  from: startOfDay(subDays(new Date(), 364)),
  to: endOfDay(new Date()),
});

const toISOStringRange = (range: DateRange) => ({
  from: range.from ? startOfDay(range.from).toISOString() : undefined,
  to: range.to ? endOfDay(range.to).toISOString() : undefined,
});

const rangeLabel = (range: DateRange) => {
  if (!range.from) return "Select date range";
  const start = format(range.from, "MMM dd, yyyy");
  const end = range.to ? format(range.to, "MMM dd, yyyy") : "Present";
  return `${start} – ${end}`;
};

const resolveBucket = (date: Date, period: ReportPeriod) => {
  if (period === "day") return format(date, "MMM d");
  if (period === "week") return format(startOfWeek(date, { weekStartsOn: 1 }), "MMM d");
  if (period === "month") return format(date, "MMM yyyy");
  return format(date, "yyyy");
};

const groupTrendData = (
  data: Array<{ date: string; income: number; expenses: number }>,
  period: ReportPeriod,
  from: Date,
  to: Date
): TrendPoint[] => {
  // First aggregate actual data into buckets
  const bucketMap = new Map<string, TrendPoint>();
  data.forEach((item) => {
    const date = parseISO(item.date);
    const bucket = resolveBucket(date, period);
    const existing = bucketMap.get(bucket) ?? { bucket, date: item.date, income: 0, expenses: 0 };
    existing.income += item.income;
    existing.expenses += item.expenses;
    bucketMap.set(bucket, existing);
  });

  // Generate all expected buckets in range and fill missing with zeros
  const allBuckets: TrendPoint[] = [];
  let cursor = new Date(from);
  while (cursor <= to) {
    const bucket = resolveBucket(cursor, period);
    if (!allBuckets.find((p) => p.bucket === bucket)) {
      allBuckets.push(
        bucketMap.get(bucket) ?? { bucket, date: cursor.toISOString(), income: 0, expenses: 0 }
      );
    }
    if (period === "day") cursor = addDays(cursor, 1);
    else if (period === "week") cursor = addWeeks(cursor, 1);
    else if (period === "month") cursor = addMonths(cursor, 1);
    else cursor = addYears(cursor, 1);
  }

  return allBuckets;
};

const groupMonthlyData = (data: Array<{ date: string; income: number; expenses: number }>) => {
  const map = new Map<string, { month: string; date: string; income: number; expenses: number }>();
  data.forEach((item) => {
    const date = parseISO(item.date);
    const bucket = format(date, "MMM yyyy");
    const existing = map.get(bucket) ?? { month: bucket, date: item.date, income: 0, expenses: 0 };
    existing.income += item.income;
    existing.expenses += item.expenses;
    map.set(bucket, existing);
  });
  return Array.from(map.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

const getAnomalies = (points: TrendPoint[]) => {
  if (points.length < 3) return [];
  const values = points.map((p) => p.expenses);
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  const std = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
  return points.filter((p) => p.expenses > mean + std * 1.5);
};

// Compute trend insight label for a data point
const getTrendInsight = (
  value: number,
  allValues: number[],
  prevValue?: number
): { label: string; color: string } => {
  if (allValues.length < 2) return { label: "Not enough data", color: "#94a3b8" };
  const mean = allValues.reduce((a, v) => a + v, 0) / allValues.length;
  const std  = Math.sqrt(allValues.reduce((a, v) => a + (v - mean) ** 2, 0) / allValues.length);
  const spike = mean + std * 1.5;
  if (value > spike)          return { label: "⚠ Spike detected",      color: "#ef4444" };
  if (value > mean * 1.15)    return { label: "↑ Above average",       color: "#f97316" };
  if (value < mean * 0.85)    return { label: "↓ Below average",       color: "#10b981" };
  if (prevValue !== undefined && value > prevValue * 1.2)
                               return { label: "↑ Sharp increase",      color: "#f59e0b" };
  if (prevValue !== undefined && value < prevValue * 0.8)
                               return { label: "↓ Sharp decrease",      color: "#22d3ee" };
  return                              { label: "● Normal trend",        color: "#94a3b8" };
};

type TooltipValueType = number | string | Array<number | string>;
type TooltipNameType = number | string;

// Custom styled tooltip for Area/Composed charts
const ChartTooltip = ({
  active, payload, label, allExpenses, allIncome,
}: TooltipProps<TooltipValueType, TooltipNameType> & { allExpenses: number[]; allIncome: number[] }) => {
  if (!active || !payload?.length) return null;

  const entries = payload ?? [];
  const expEntry = entries.find((p) => p.dataKey === "expenses" || p.name === "expenses");
  const incEntry = entries.find((p) => p.dataKey === "income" || p.name === "income");
  const prevIdx = allExpenses.length - 1; // approximate; full history used for avg
  const prevExp = prevIdx > 0 ? allExpenses[prevIdx - 1] : undefined;
  const prevInc = prevIdx > 0 ? allIncome[prevIdx - 1] : undefined;
  const expValue = Number(expEntry?.value ?? 0);
  const incValue = Number(incEntry?.value ?? 0);
  const expInsight = expEntry
    ? getTrendInsight(expValue, allExpenses, prevExp)
    : null;
  const incInsight = incEntry
    ? getTrendInsight(incValue, allIncome, prevInc)
    : null;

  return (
    <div className="rounded-xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur-sm text-sm min-w-[200px]">
      <p className="font-semibold text-foreground mb-2">Period: {label}</p>
      {incEntry && (
        <div className="mb-1">
          <span className="text-emerald-500 font-medium">Income : </span>
          <span className="text-foreground tabular-nums">{formatCurrency(incValue)}</span>
          {incInsight && <p className="text-[11px] mt-0.5" style={{ color: incInsight.color }}>{incInsight.label}</p>}
        </div>
      )}
      {expEntry && (
        <div>
          <span className="text-orange-500 font-medium">Expenses : </span>
          <span className="text-foreground tabular-nums">{formatCurrency(expValue)}</span>
          {expInsight && <p className="text-[11px] mt-0.5" style={{ color: expInsight.color }}>{expInsight.label}</p>}
        </div>
      )}
    </div>
  );
};

// Custom tooltip for monthly comparison bar chart
const BarChartTooltip = ({
  active, payload, label, allExpenses, allIncome,
}: TooltipProps<TooltipValueType, TooltipNameType> & { allExpenses: number[]; allIncome: number[] }) => {
  if (!active || !payload?.length) return null;
  const entries = payload ?? [];
  const expEntry = entries.find((p) => p.dataKey === "expenses" || p.name === "expenses");
  const incEntry = entries.find((p) => p.dataKey === "income" || p.name === "income");
  const expValue = Number(expEntry?.value ?? 0);
  const incValue = Number(incEntry?.value ?? 0);
  const expInsight = expEntry ? getTrendInsight(expValue, allExpenses) : null;
  const incInsight = incEntry ? getTrendInsight(incValue, allIncome)   : null;
  return (
    <div className="rounded-xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur-sm text-sm min-w-[200px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {incEntry && (
        <div className="mb-1">
          <span className="text-emerald-500 font-medium">Income : </span>
          <span className="tabular-nums">{formatCurrency(incValue)}</span>
          {incInsight && <p className="text-[11px] mt-0.5" style={{ color: incInsight.color }}>{incInsight.label}</p>}
        </div>
      )}
      {expEntry && (
        <div>
          <span className="text-orange-500 font-medium">Expenses : </span>
          <span className="tabular-nums">{formatCurrency(expValue)}</span>
          {expInsight && <p className="text-[11px] mt-0.5" style={{ color: expInsight.color }}>{expInsight.label}</p>}
        </div>
      )}
    </div>
  );
};

// Custom tooltip for Pie chart
const PieChartTooltip = ({
  active, payload,
}: TooltipProps<TooltipValueType, TooltipNameType>) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const pct = typeof (entry.payload as { percentage?: number } | undefined)?.percentage === "number"
    ? (entry.payload as { percentage?: number }).percentage!
    : 0;
  const value = Number(entry.value ?? 0);
  const name = typeof entry.name === "string" ? entry.name : String(entry.name ?? "");

  const getPieInsight = (p: number): { label: string; color: string } => {
    if (p >= 30)  return { label: " ⚠  Top category — major spend",    color: "#ef4444" };
    if (p >= 20)  return { label: " ↑  Above average share",            color: "#f97316" };
    if (p >= 10)  return { label: " ●  Moderate share",                 color: "#f59e0b" };
    if (p >= 5)   return { label: " ↓  Below average share",            color: "#10b981" };
    return               { label: " ●  Minor category",                 color: "#94a3b8" };
  };

  const insight = getPieInsight(pct);

  return (
    <div className="rounded-xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur-sm text-sm min-w-[180px]">
      <p className="font-semibold text-foreground capitalize mb-2">{name}</p>
      <div className="mb-1">
        <span className="text-muted-foreground">Amount : </span>
        <span className="font-medium tabular-nums">{formatCurrency(value)}</span>
      </div>
      <div className="mb-1.5">
        <span className="text-muted-foreground">Share : </span>
        <span className="font-medium">{pct}%</span>
      </div>
      <p className="text-[11px]" style={{ color: insight.color }}>{insight.label}</p>
    </div>
  );
};

const PIE_COLORS = ["#6366f1", "#14b8a6", "#f97316", "#8b5cf6", "#ef4444", "#10b981"];

// ── Metric Card ────────────────────────────────────────────────────────────────
const MetricCard = ({
  title, value, subtitle, trend, tone = "neutral", isLoading,
}: {
  title: string; value: string; subtitle: string;
  trend?: string; tone?: "neutral" | "positive" | "negative"; isLoading?: boolean;
}) => {
  if (isLoading) {
    return (
      <Card className="!border-none !gap-0 !bg-white/5">
        <CardHeader className="!pb-4"><Skeleton className="h-4 w-28 bg-white/20" /></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-9 w-36 bg-white/20" />
          <Skeleton className="h-3.5 w-40 bg-white/20" />
        </CardContent>
      </Card>
    );
  }
  const toneClass = tone === "positive" ? "text-emerald-400" : tone === "negative" ? "text-red-400" : "text-gray-400";
  const TrendIcon = tone === "positive" ? TrendingUp : TrendingDown;
  return (
    <Card className="!border-none !gap-0 !bg-white/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 !pb-4">
        <CardTitle className="text-sm text-gray-400 font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-3xl font-bold text-white">{value}</div>
        <div className="flex items-center gap-1.5 text-xs">
          {trend && (
            <span className={cn("flex items-center gap-0.5", toneClass)}>
              <TrendIcon className="size-3" />{trend}
            </span>
          )}
          <span className="text-gray-400">{trend ? `• ${subtitle}` : subtitle}</span>
        </div>
      </CardContent>
    </Card>
  );
};

// ── Date Range Picker ──────────────────────────────────────────────────────────
const RangePicker = ({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white font-normal">
          <CalendarDays className="h-4 w-4 opacity-70" />
          <span className="text-sm">{rangeLabel(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="center">
        <Calendar
          mode="range" numberOfMonths={2} selected={value}
          onSelect={(r) => { onChange(r ?? value); if (r?.from && r?.to) setOpen(false); }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Reports() {
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange());
  const [pdfLoading, setPdfLoading] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const reportRef = useRef<HTMLDivElement | null>(null);

  const analyticsArgs = useMemo(() => {
    const { from, to } = toISOStringRange(dateRange);
    return { from: from ?? new Date().toISOString(), to: to ?? new Date().toISOString() };
  }, [dateRange]);

  const summaryQuery   = useSummaryAnalyticsQuery(analyticsArgs);
  const chartQuery     = useChartAnalyticsQuery(analyticsArgs);
  const pieQuery       = useExpensePieChartBreakdownQuery(analyticsArgs);
  const reportQuery    = useGenerateReportQuery(analyticsArgs);
  const reportsQuery   = useGetAllReportsQuery({ pageNumber: 1, pageSize: 10 });
  const transactionsQuery = useGetAllTransactionsQuery({ pageNumber: 1, pageSize: 1000, type: "EXPENSE" });

  const summary   = summaryQuery.data?.data;
  const chartData = chartQuery.data?.data.chartData ?? [];
  const pieData   = pieQuery.data?.data.breakdown ?? [];
  const generatedInsights = reportQuery.data?.insights ?? [];

  const rangeFrom = dateRange.from ?? subDays(new Date(), 364);
  const rangeTo   = dateRange.to   ?? new Date();

  const trendData        = useMemo(() => groupTrendData(chartData, period, rangeFrom, rangeTo), [chartData, period, dateRange]);
  const monthlyComparison = useMemo(() => groupMonthlyData(chartData), [chartData]);
  const anomalies        = useMemo(() => getAnomalies(trendData), [trendData]);

  const filteredExpenses = useMemo(() => {
    const all = transactionsQuery.data?.transations ?? [];
    if (!dateRange.from || !dateRange.to) return all;
    return all.filter((t) =>
      isWithinInterval(parseISO(t.date), { start: startOfDay(dateRange.from!), end: endOfDay(dateRange.to!) })
    );
  }, [dateRange.from, dateRange.to, transactionsQuery.data]);

  const rawExpenseRows: ExpenseExportRow[] = useMemo(() =>
    filteredExpenses.map((t) => ({
      Date: format(parseISO(t.date), "yyyy-MM-dd"),
      Category: t.category, Amount: t.amount,
      Description: t.description || t.title,
    })), [filteredExpenses]);

  const totalExpenses  = summary?.totalExpenses ?? 0;
  const totalIncome    = summary?.totalIncome ?? 0;
  const savings        = Math.max(totalIncome - totalExpenses, 0);
  const avgSpending    = filteredExpenses.length ? totalExpenses / filteredExpenses.length : 0;
  const highestExpense = filteredExpenses.reduce(
    (h, c) => (c.amount > (h?.amount ?? 0) ? c : h), filteredExpenses[0]
  );
  const changePercent  = summary?.percentageChange?.expenses ?? 0;
  const changeTone     = changePercent > 0 ? "negative" : changePercent < 0 ? "positive" : "neutral";
  const changeTrend    = `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}% vs prev`;
  const topCategory    = pieData[0];

  const localInsights = useMemo(() => {
    const out: string[] = [];
    if (changePercent > 0) out.push(`Spending ↑ ${changePercent.toFixed(1)}% vs previous period.`);
    else if (changePercent < 0) out.push(`Spending ↓ ${Math.abs(changePercent).toFixed(1)}% vs previous period.`);
    if (topCategory) out.push(`${topCategory.name} is your top expense at ${topCategory.percentage}%.`);
    if (highestExpense) out.push(`Highest expense: ${formatCurrency(highestExpense.amount)} on ${format(parseISO(highestExpense.date), "MMM dd, yyyy")}.`);
    if (savings > 0) out.push(`You saved ${formatCurrency(savings)} this period.`);
    return out;
  }, [changePercent, highestExpense, savings, topCategory]);

  const mergedInsights = Array.from(new Set([...(generatedInsights.length ? generatedInsights : []), ...localInsights])).slice(0, 5);

  // Pre-compute arrays for insight tooltips
  const allExpensesArr = useMemo(() => trendData.map((d) => d.expenses), [trendData]);
  const allIncomeArr   = useMemo(() => trendData.map((d) => d.income),   [trendData]);
  const monthlyExpArr  = useMemo(() => monthlyComparison.map((d) => d.expenses), [monthlyComparison]);
  const monthlyIncArr  = useMemo(() => monthlyComparison.map((d) => d.income),   [monthlyComparison]);

  const handleExportCSV = () => { setCsvLoading(true); try { exportExpenseRowsCSV(rawExpenseRows, `expense-${format(new Date(), "yyyyMMdd")}.csv`); } finally { setCsvLoading(false); } };

  const handleExportPDF = () => {
    setPdfLoading(true);
    try {
      generateReportPDF(
        {
          dateRangeLabel: dateRange
            ? `${format(dateRange.from!, "dd MMM yyyy")} – ${format(dateRange.to ?? dateRange.from!, "dd MMM yyyy")}`
            : "All Time",
          period,
          kpis: {
            totalExpenses,
            highestExpense: {
              amount:   highestExpense?.amount   ?? 0,
              category: highestExpense?.category ?? "N/A",
            },
            avgPerTransaction: avgSpending,
            savings,
            changePercent,
          },
          categories: pieData.map((c) => ({
            name:       c.name,
            value:      c.value,
            percentage: c.percentage,
          })),
          monthlyData: monthlyComparison.map((d) => ({
            month:    d.month,
            expenses: d.expenses,
            income:   d.income,
          })),
          insights: mergedInsights,
        },
        `expense-report-${format(new Date(), "yyyyMMdd")}.pdf`
      );
      toast.success("PDF downloaded successfully!");
    } catch (err) {
      console.error("[PDF] failed:", err);
      toast.error("PDF export failed. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  };

  const isSummaryLoading = summaryQuery.isFetching;
  const isChartLoading   = chartQuery.isFetching;
  const isPieLoading     = pieQuery.isFetching;

  return (
    <PageLayout
      addMarginTop
      renderPageHeader={
        <div className="w-full space-y-6">
          {/* Title + actions row */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl lg:text-4xl font-medium">Expense Analysis Report</h2>
              <p className="text-white/60 text-sm">Analyze trends, category mix, and savings for the selected period</p>
            </div>
            <ScheduleReportDrawer />
          </div>

          {/* KPI Cards in dark banner — same pattern as Dashboard */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard title="Total Expenses" value={formatCurrency(totalExpenses)} subtitle="Selected range" trend={changeTrend} tone={changeTone} isLoading={isSummaryLoading} />
            <MetricCard title="Highest Expense" value={formatCurrency(highestExpense?.amount ?? 0)} subtitle={highestExpense?.category ?? "No data"} tone="negative" isLoading={isSummaryLoading} />
            <MetricCard title="Average per Txn" value={formatCurrency(avgSpending)} subtitle="Per expense transaction" tone="neutral" isLoading={isSummaryLoading} />
            <MetricCard title="Savings" value={formatCurrency(savings)} subtitle="Income minus expenses" tone={savings >= 0 ? "positive" : "negative"} trend={savings >= 0 ? "On track" : "Overspent"} isLoading={isSummaryLoading} />
          </div>
        </div>
      }
    >
      <div className="space-y-6">

        {/* ── Filter Bar ── */}
        <Card className="!shadow-none border border-gray-100 dark:border-border">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Period Toggle */}
              <div className="inline-flex items-center rounded-lg bg-muted p-1 gap-0.5">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPeriod(opt.value)}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-md transition-all font-medium",
                      period === opt.value
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Date Range + Export */}
              <div className="flex flex-wrap items-center gap-2">
                <RangePicker value={dateRange} onChange={setDateRange} />
                <Button
                  variant="outline" size="sm"
                  className="gap-1.5 border-dashed"
                  onClick={handleExportCSV} disabled={csvLoading}
                >
                  {csvLoading ? <FileText className="h-4 w-4 animate-pulse" /> : <Download className="h-4 w-4" />}
                  CSV
                </Button>
                <Button
                  size="sm" className="gap-1.5 bg-primary hover:bg-primary/90"
                  onClick={handleExportPDF} disabled={pdfLoading}
                >
                  {pdfLoading ? <FileText className="h-4 w-4 animate-pulse" /> : <Download className="h-4 w-4" />}
                  PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div id="report-export-content" ref={reportRef} className="space-y-6">
          {/* ── Charts Row ── */}
          <div className="grid gap-6 xl:grid-cols-2">

            {/* Trend Chart */}
            <Card className="!shadow-none border border-gray-100 dark:border-border">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="text-base">Expense Trend</CardTitle>
                <CardDescription>Grouped by {period} for selected date range</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  {isChartLoading ? (
                    <Skeleton className="h-full w-full rounded-xl" />
                  ) : trendData.every((d) => d.expenses === 0 && d.income === 0) ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data for this range.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="bucket" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(Number(v), { compact: true })} tick={{ fontSize: 11 }} />
                        <RechartsTooltip
                          cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "4 2" }}
                          content={(props) => (
                            <ChartTooltip
                              {...props}
                              allExpenses={allExpensesArr}
                              allIncome={allIncomeArr}
                            />
                          )}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="income" stroke="#10b981" fill="url(#incGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                        <Area type="monotone" dataKey="expenses" stroke="#f97316" fill="url(#expGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                        {anomalies.length > 0 && <Scatter data={anomalies} fill="#ef4444" shape="circle" />}
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pie Chart */}
            <Card className="!shadow-none border border-gray-100 dark:border-border">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="text-base">Category Distribution</CardTitle>
                <CardDescription>Where your money went across categories</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[240px]">
                  {isPieLoading ? (
                    <Skeleton className="h-full w-full rounded-xl" />
                  ) : pieData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No expense categories found.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <RechartsTooltip
                          content={(props) => <PieChartTooltip {...props} />}
                        />
                        <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={65} outerRadius={100} paddingAngle={3}>
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Legend verticalAlign="bottom" formatter={(v) => <span className="text-xs capitalize">{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="mt-3 grid gap-1.5">
                  {pieData.slice(0, 5).map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="capitalize">{item.name}</span>
                      </div>
                      <span className="text-muted-foreground tabular-nums">{formatCurrency(item.value)} · {item.percentage}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Monthly Comparison + Insights ── */}
          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2 !shadow-none border border-gray-100 dark:border-border">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="text-base">Monthly Comparison</CardTitle>
                <CardDescription>Income vs expenses grouped by month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {isChartLoading ? (
                    <Skeleton className="h-full w-full rounded-xl" />
                  ) : monthlyComparison.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No chart data available.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={monthlyComparison} margin={{ top: 10, right: 8, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} interval={Math.max(0, Math.floor(monthlyComparison.length / 6) - 1)} />
                        <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(Number(v), { compact: true })} tick={{ fontSize: 11 }} />
                        <RechartsTooltip
                          cursor={{ fill: "rgba(148,163,184,0.06)" }}
                          content={(props) => (
                            <BarChartTooltip
                              {...props}
                              allExpenses={monthlyExpArr}
                              allIncome={monthlyIncArr}
                            />
                          )}
                        />
                        <Legend />
                        <Bar dataKey="expenses" fill="#f97316" radius={[6, 6, 0, 0]} barSize={16} />
                        <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} barSize={16} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Insights */}
            <Card className="!shadow-none border border-gray-100 dark:border-border">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="text-base">Insights</CardTitle>
                <CardDescription>AI + auto observations for this period</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl bg-muted/60 p-4 space-y-2.5">
                  {reportQuery.isFetching ? (
                    <p className="text-sm text-muted-foreground">Generating insights…</p>
                  ) : mergedInsights.length > 0 ? (
                    mergedInsights.map((ins) => (
                      <p key={ins} className="text-sm leading-relaxed text-foreground/90">• {ins}</p>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No insights for this range yet.</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <div className="rounded-xl bg-muted/40 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Report status</p>
                    <p className="mt-0.5 text-sm font-medium">{reportsQuery.data?.reports?.[0]?.status ?? "No history"}</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Latest period</p>
                    <p className="mt-0.5 text-sm font-medium">{reportsQuery.data?.reports?.[0]?.period ?? "No history"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Report History ── */}
          <Card className="!shadow-none border border-gray-100 dark:border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Report History</CardTitle>
              <CardDescription>Scheduled emails and generated reports for this account</CardDescription>
            </CardHeader>
            <CardContent>
              <ReportTable />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}
