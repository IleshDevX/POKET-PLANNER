import { jsPDF } from "jspdf";
import { unparse } from "papaparse";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type ExpenseExportRow = {
  Date: string;
  Category: string;
  Amount: number;
  Description: string;
};

export interface PDFReportData {
  dateRangeLabel: string;
  period: string;
  kpis: {
    totalExpenses: number;
    highestExpense: { amount: number; category: string };
    avgPerTransaction: number;
    savings: number;
    changePercent: number;
  };
  categories: Array<{ name: string; value: number; percentage: number }>;
  monthlyData: Array<{ month: string; expenses: number; income: number }>;
  insights: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV export (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export const exportExpenseRowsCSV = (
  rows: ExpenseExportRow[],
  filename = "expense-report.csv"
) => {
  if (!rows.length) return;
  const csv = unparse(rows, {
    quotes: true,
    delimiter: ",",
    columns: ["Date", "Category", "Amount", "Description"],
  });
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
type RGB = [number, number, number];

const sanitizePDFText = (value: string): string =>
  value
    .replaceAll("\u00A0", " ") // nbsp
    .replaceAll("₹", "Rs.")
    .replaceAll("↑", "up")
    .replaceAll("↓", "down")
    .replaceAll("→", "->")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("…", "...")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("‘", "'")
    .replaceAll("’", "'")
    // jsPDF built-in fonts are WinAnsi/ASCII-ish; drop any remaining non-ASCII.
    .replace(/[^\x20-\x7E]/g, "");

const t = (value: unknown): string => sanitizePDFText(String(value ?? ""));

const NAVY:    RGB = [13,  27,  54];
const BLUE:    RGB = [59,  130, 246];
const DARK:    RGB = [17,  24,  39];
const MUTED:   RGB = [107, 114, 128];
const BORDER:  RGB = [229, 231, 235];
const WHITE:   RGB = [255, 255, 255];
const GREEN:   RGB = [16,  185, 129];
const RED:     RGB = [239, 68,  68];
const BG_LIGHT:RGB = [248, 250, 252];
const BG_ROW:  RGB = [241, 245, 249];

const sf = (p: jsPDF, c: RGB) => p.setFillColor(c[0], c[1], c[2]);
const st = (p: jsPDF, c: RGB) => p.setTextColor(c[0], c[1], c[2]);
const sd = (p: jsPDF, c: RGB) => p.setDrawColor(c[0], c[1], c[2]);

/** Format number as compact INR string (ASCII-safe, no ₹ symbol). */
const inr = (n: number): string => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 10_00_000) return `${sign}Rs.${(abs / 10_00_000).toFixed(1)}L`;
  if (abs >= 1_000)     return `${sign}Rs.${(abs / 1_000).toFixed(1)}K`;
  return `${sign}Rs.${abs.toFixed(0)}`;
};

const PW   = 210;   // A4 page width  (mm)
const PH   = 297;   // A4 page height (mm)
const ML   = 12;    // margin left
const MR   = PW - 12;
const CW   = MR - ML;
const ROW  = 7;     // standard row height
const FOOT = 12;    // footer height reserved

/** Add a new page and return the reset y. */
const newPage = (pdf: jsPDF): number => {
  pdf.addPage();
  return 14;
};

/** Ensure there is at least `needed` mm before the bottom footer. */
const guard = (pdf: jsPDF, y: number, needed: number): number =>
  y + needed > PH - FOOT ? newPage(pdf) : y;

/** Section header bar — navy background, white bold label. */
const sectionHeader = (pdf: jsPDF, y: number, label: string): number => {
  y = guard(pdf, y, 10);
  sf(pdf, NAVY); pdf.rect(ML, y, CW, 8, "F");
  st(pdf, WHITE); pdf.setFontSize(8); pdf.setFont("helvetica", "bold");
  pdf.text(label, ML + 3, y + 5.5);
  return y + 11;
};

/** Draw a horizontal divider line. */
const divider = (pdf: jsPDF, y: number): number => {
  sd(pdf, BORDER); pdf.setLineWidth(0.2);
  pdf.line(ML, y, MR, y);
  return y + 3;
};

// ─────────────────────────────────────────────────────────────────────────────
// Main PDF generator  (synchronous — jsPDF is not async)
// ─────────────────────────────────────────────────────────────────────────────
export const generateReportPDF = (
  data: PDFReportData,
  filename = "expense-analysis-report.pdf"
): void => {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  pdf.setFont("helvetica", "normal");

  // ── HEADER ────────────────────────────────────────────────────────────────
  sf(pdf, NAVY); pdf.rect(0, 0, PW, 36, "F");

  st(pdf, WHITE);
  pdf.setFontSize(18); pdf.setFont("helvetica", "bold");
  pdf.text("Expense Analysis Report", ML, 14);

  pdf.setFontSize(8); pdf.setFont("helvetica", "normal");
  pdf.text(
    t(`Period: ${data.dateRangeLabel}   |   Grouped by: ${data.period}   |   Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`),
    ML, 22
  );
  pdf.text(t("POCKET PLANNER — Personal Finance Intelligence"), ML, 30);

  let y = 42;

  // ── KPI CARDS ─────────────────────────────────────────────────────────────
  const kpiW = (CW - 9) / 4; // 4 cards, 3 gaps of 3mm
  const cards = [
    {
      label: "Total Expenses",
      value: inr(data.kpis.totalExpenses),
      sub:   `${data.kpis.changePercent >= 0 ? "+" : ""}${data.kpis.changePercent.toFixed(1)}% vs prev`,
      color: data.kpis.changePercent > 0 ? RED : GREEN,
    },
    {
      label: "Highest Expense",
      value: inr(data.kpis.highestExpense.amount),
      sub:   data.kpis.highestExpense.category || "N/A",
      color: MUTED,
    },
    {
      label: "Avg per Txn",
      value: inr(data.kpis.avgPerTransaction),
      sub:   "Per expense transaction",
      color: MUTED,
    },
    {
      label: "Savings",
      value: inr(data.kpis.savings),
      sub:   data.kpis.savings >= 0 ? "On track" : "Overspent",
      color: data.kpis.savings >= 0 ? GREEN : RED,
    },
  ];

  const cardH = 26;
  cards.forEach((card, i) => {
    const x = ML + i * (kpiW + 3);
    sf(pdf, BG_LIGHT); sd(pdf, BORDER); pdf.setLineWidth(0.25);
    pdf.rect(x, y, kpiW, cardH, "FD");

    st(pdf, MUTED); pdf.setFontSize(6.5); pdf.setFont("helvetica", "normal");
    pdf.text(t(card.label.toUpperCase()), x + 3, y + 6);

    st(pdf, DARK); pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
    pdf.text(t(card.value), x + 3, y + 15);

    st(pdf, card.color); pdf.setFontSize(6.5); pdf.setFont("helvetica", "normal");
    pdf.text(t(card.sub), x + 3, y + 22);
  });
  y += cardH + 8;

  // ── CATEGORY BREAKDOWN ────────────────────────────────────────────────────
  y = sectionHeader(pdf, y, "CATEGORY BREAKDOWN");

  // Column headers
  sf(pdf, BG_ROW); pdf.rect(ML, y, CW, ROW - 1, "F");
  st(pdf, MUTED); pdf.setFontSize(6.5); pdf.setFont("helvetica", "bold");
  pdf.text("Category",  ML + 3,  y + 4.5);
  pdf.text("Amount",    ML + 65, y + 4.5);
  pdf.text("Share",     ML + 105,y + 4.5);
  pdf.text("Breakdown", ML + 130,y + 4.5);
  y += ROW;

  const maxPct = Math.max(...data.categories.map((c) => c.percentage), 1);

  data.categories.forEach((cat, i) => {
    y = guard(pdf, y, ROW);
    sf(pdf, i % 2 === 0 ? WHITE : BG_LIGHT);
    pdf.rect(ML, y, CW, ROW - 0.5, "F");

    st(pdf, DARK); pdf.setFontSize(7); pdf.setFont("helvetica", "normal");
    pdf.text(t(cat.name), ML + 3, y + 4.5);
    pdf.text(inr(cat.value), ML + 65, y + 4.5);
    pdf.text(`${cat.percentage}%`, ML + 105, y + 4.5);

    // Bar proportional to max category
    const barMax = 60;
    const barW   = (cat.percentage / maxPct) * barMax;
    sf(pdf, BLUE); pdf.rect(ML + 130, y + 1.5, barW, 3, "F");
    y += ROW;
  });

  y = divider(pdf, y + 4);

  // ── MONTHLY COMPARISON ────────────────────────────────────────────────────
  if (data.monthlyData.length > 0) {
    y = sectionHeader(pdf, y, "MONTHLY COMPARISON");

    sf(pdf, BG_ROW); pdf.rect(ML, y, CW, ROW - 1, "F");
    st(pdf, MUTED); pdf.setFontSize(6.5); pdf.setFont("helvetica", "bold");
    pdf.text("Month",    ML + 3,  y + 4.5);
    pdf.text("Expenses", ML + 55, y + 4.5);
    pdf.text("Income",   ML + 105,y + 4.5);
    pdf.text("Net",      ML + 155,y + 4.5);
    y += ROW;

    data.monthlyData.slice(-12).forEach((row, i) => {
      y = guard(pdf, y, ROW);
      sf(pdf, i % 2 === 0 ? WHITE : BG_LIGHT);
      pdf.rect(ML, y, CW, ROW - 0.5, "F");

      const net = row.income - row.expenses;
      st(pdf, DARK); pdf.setFontSize(7); pdf.setFont("helvetica", "normal");
      pdf.text(t(row.month),        ML + 3,  y + 4.5);
      pdf.text(inr(row.expenses),ML + 55, y + 4.5);
      pdf.text(inr(row.income),  ML + 105,y + 4.5);

      st(pdf, net >= 0 ? GREEN : RED);
      pdf.text(`${net >= 0 ? "+" : ""}${inr(net)}`, ML + 155, y + 4.5);
      y += ROW;
    });

    y = divider(pdf, y + 4);
  }

  // ── AI INSIGHTS ───────────────────────────────────────────────────────────
  if (data.insights.length > 0) {
    // Always start AI Insights on a fresh page (prevents awkward splits).
    if (y !== 14) y = newPage(pdf);

    // Pre-compute block heights using the exact font metrics we will render with.
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    const insightBlocks = data.insights.map((raw) => {
      const insight = t(raw);
      const lines = pdf.splitTextToSize(`- ${insight}`, CW - 6) as string[];
      const blockH = lines.length * 5 + 4;
      return { lines, blockH };
    });

    y = sectionHeader(pdf, y, "AI INSIGHTS");

    insightBlocks.forEach(({ lines, blockH }, i) => {
      y = guard(pdf, y, blockH);

      sf(pdf, i % 2 === 0 ? WHITE : BG_LIGHT);
      pdf.rect(ML, y, CW, blockH, "F");

      // Accent left bar
      sf(pdf, BLUE); pdf.rect(ML, y, 2, blockH, "F");

      st(pdf, DARK); pdf.setFontSize(7); pdf.setFont("helvetica", "normal");
      lines.forEach((line: string, li: number) => {
        pdf.text(t(line), ML + 5, y + 4 + li * 5);
      });
      y += blockH + 1;
    });

    y += 3;
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const totalPages = (pdf as unknown as { internal: { getNumberOfPages(): number } })
    .internal.getNumberOfPages();

  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    sf(pdf, BG_ROW); pdf.rect(0, PH - FOOT, PW, FOOT, "F");
    sd(pdf, BORDER); pdf.setLineWidth(0.2); pdf.line(0, PH - FOOT, PW, PH - FOOT);
    st(pdf, MUTED); pdf.setFontSize(6.5); pdf.setFont("helvetica", "normal");
    pdf.text(t("Pocket Planner — Expense Analysis Report | Confidential"), ML, PH - 4);
    pdf.text(`Page ${p} of ${totalPages}`, MR - 18, PH - 4);
  }

  pdf.save(filename);
};