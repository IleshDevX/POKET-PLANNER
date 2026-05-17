export const exportToCSV = (data: Array<Record<string, any>>, filename = "export.csv") => {
  if (!data || data.length === 0) return;
  const keys = Object.keys(data[0]);
  const rows = data.map((row) => keys.map((k) => JSON.stringify(row[k] ?? "")).join(","));
  const csv = [keys.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
