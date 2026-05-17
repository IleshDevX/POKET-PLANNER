import React, { useMemo, useState, useRef } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Bar,
  ComposedChart,
  Legend,
  Line,
} from "recharts";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { exportToCSV } from "@/lib/export";

type Point = { date: string; value: number; prev?: number };

const sampleUsage = (period: "daily" | "weekly" | "monthly") => {
  const points: Point[] = [];
  const count = period === "daily" ? 30 : period === "weekly" ? 24 : 12;
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now);
    if (period === "daily") date.setDate(now.getDate() - i);
    if (period === "weekly") date.setDate(now.getDate() - i * 7);
    if (period === "monthly") date.setMonth(now.getMonth() - i);
    const base = 200 + Math.round(Math.sin(i / 3) * 60 + Math.random() * 40);
    points.push({ date: date.toISOString(), value: base });
  }
  return points;
};

const samplePerformance = (period: "daily" | "weekly" | "monthly") => {
  const points: Point[] = [];
  const count = period === "daily" ? 30 : period === "weekly" ? 24 : 12;
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now);
    if (period === "daily") date.setDate(now.getDate() - i);
    if (period === "weekly") date.setDate(now.getDate() - i * 7);
    if (period === "monthly") date.setMonth(now.getMonth() - i);
    const revenue = 10000 + Math.round(Math.cos(i / 2) * 2500 + Math.random() * 2000);
    const prev = revenue - Math.round(Math.random() * 2000 - 800);
    points.push({ date: date.toISOString(), value: revenue, prev });
  }
  return points;
};

const formatDateLabel = (iso: string, period: string) => {
  const d = new Date(iso);
  if (period === "daily") return format(d, "MMM d");
  if (period === "weekly") return format(d, "MMM d");
  return format(d, "MMM yyyy");
};

const calcChange = (points: Point[]) => {
  if (points.length < 2) return 0;
  const last = points[points.length - 1].value;
  const prev = points[points.length - 2].value || 0;
  return prev === 0 ? 0 : Math.round(((last - prev) / Math.abs(prev)) * 100);
};

const detectAnomaly = (points: Point[]) => {
  const values = points.map((p) => p.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  const last = values[values.length - 1];
  if (last > mean + 2 * std) return { type: "spike", value: last };
  if (last < mean - 2 * std) return { type: "drop", value: last };
  return null;
};

const Overview: React.FC = () => {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const usage = useMemo(() => sampleUsage(period), [period]);
  const performance = useMemo(() => samplePerformance(period), [period]);
  const chartRef = useRef<HTMLDivElement | null>(null);

  const usageChange = calcChange(usage);
  const perfChange = calcChange(performance);
  const usageAnomaly = detectAnomaly(usage);
  const perfAnomaly = detectAnomaly(performance);

  const handleExportCSV = (which: "usage" | "performance") => {
    const data = which === "usage" ? usage : performance;
    exportToCSV(data.map((d) => ({ date: d.date, value: d.value })), `${which}-${period}.csv`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">High level metrics and system insights</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md bg-muted px-2 py-1">
            <button
              onClick={() => setPeriod("daily")}
              className={cn(
                "px-3 py-1 text-sm rounded",
                period === "daily" ? "bg-primary text-white" : "text-muted-foreground"
              )}
            >
              Daily
            </button>
            <button
              onClick={() => setPeriod("weekly")}
              className={cn(
                "px-3 py-1 text-sm rounded",
                period === "weekly" ? "bg-primary text-white" : "text-muted-foreground"
              )}
            >
              Weekly
            </button>
            <button
              onClick={() => setPeriod("monthly")}
              className={cn(
                "px-3 py-1 text-sm rounded",
                period === "monthly" ? "bg-primary text-white" : "text-muted-foreground"
              )}
            >
              Monthly
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <motion.section
          ref={chartRef}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="col-span-12 lg:col-span-7 rounded-2xl bg-card p-4 shadow"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-medium">Usage Analytics</h3>
              <p className="text-sm text-muted-foreground">API calls / Active users over time</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => handleExportCSV("usage")}>Export CSV</Button>
            </div>
          </div>

          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={usage} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="usageGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#60A5FA" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.06} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.06} />
                <XAxis dataKey="date" tickFormatter={(d) => formatDateLabel(d, period)} />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => [value, "Usage"]}
                  labelFormatter={(label) => formatDateLabel(label as string, period)}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#60A5FA"
                  strokeWidth={2}
                  fill="url(#usageGrad)"
                  dot={{ r: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm">
            <div>
              <span className="font-medium">Change:</span> <span className={usageChange >= 0 ? "text-green-400" : "text-rose-400"}>{usageChange}%</span>
              {usageAnomaly && <span className="ml-3 text-xs text-amber-300">Anomaly: {usageAnomaly.type}</span>}
            </div>
            <div className="text-muted-foreground">Peak: {Math.max(...usage.map((p) => p.value))}</div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="col-span-12 lg:col-span-5 rounded-2xl bg-card p-4 shadow"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-medium">Revenue & Growth</h3>
              <p className="text-sm text-muted-foreground">Monthly revenue with previous period comparison</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => handleExportCSV("performance")}>Export CSV</Button>
            </div>
          </div>

          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={performance} margin={{ top: 8, right: 6, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.06} />
                <XAxis dataKey="date" tickFormatter={(d) => formatDateLabel(d, period)} />
                <YAxis />
                <Tooltip
                  formatter={(value: number, name: string) => [value, name === "value" ? "Revenue" : name]}
                  labelFormatter={(label) => formatDateLabel(label as string, period)}
                />
                <Legend verticalAlign="top" />
                <Bar
                  dataKey="value"
                  barSize={14}
                  radius={[8, 8, 8, 8]}
                  fill="#34D399"
                  isAnimationActive={true}
                />
                <Line
                  type="monotone"
                  dataKey="prev"
                  stroke="#60A5FA"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm">
            <div>
              <span className="font-medium">Revenue change:</span>
              <span className={perfChange >= 0 ? "text-green-400 ml-2" : "text-rose-400 ml-2"}>{perfChange}%</span>
              {perfAnomaly && <span className="ml-3 text-xs text-amber-300">Anomaly: {perfAnomaly.type}</span>}
            </div>
            <div className="text-muted-foreground">Total: ₹{performance.reduce((a, b) => a + b.value, 0)}</div>
          </div>
        </motion.section>
      </div>
    </div>
  );
};

export default Overview;
