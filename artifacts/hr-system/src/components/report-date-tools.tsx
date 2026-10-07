import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export interface ReportColumn<T> {
  header: string;
  value: (record: T) => unknown;
}

type ReportDateToolsProps<T> = {
  title: string;
  records: T[];
  dateOf: (record: T) => string | null | undefined;
  periodOf?: (record: T) => { start: string; end: string };
  columns: ReportColumn<T>[];
  children: (filteredRecords: T[]) => ReactNode;
  dateLabel?: string;
};

type DateMode = "all" | "date" | "range";

function dateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (match) return match[1];
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function printableValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toLocaleString();
  return JSON.stringify(value);
}

function escapeCsv(value: string): string {
  const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

function selectedPeriod(mode: DateMode, from: string, to: string): string {
  if (mode === "date") return from || "Select a date";
  if (mode === "range") return `${from || "Start date"} to ${to || "End date"}`;
  return "All dates";
}

export function printReport<T>(
  title: string,
  rows: T[],
  columns: ReportColumn<T>[],
  period: string,
): void {
  const printWindow = window.open("", "_blank", "width=1000,height=750");
  if (!printWindow) {
    toast.error("The print window was blocked. Allow pop-ups and try again.");
    return;
  }

  const doc = printWindow.document;
  doc.title = title;
  const style = doc.createElement("style");
  style.textContent = `
    body { font: 14px Arial, sans-serif; color: #111827; margin: 28px; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    .meta { color: #4b5563; margin: 0 0 20px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #9ca3af; padding: 7px 9px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
    tr { break-inside: avoid; }
    @page { margin: 16mm; }
  `;
  doc.head.append(style);

  const heading = doc.createElement("h1");
  heading.textContent = title;
  const metadata = doc.createElement("p");
  metadata.className = "meta";
  metadata.textContent = `Period: ${period} · Records: ${rows.length} · Generated: ${new Date().toLocaleString()}`;
  const table = doc.createElement("table");
  const header = table.createTHead().insertRow();
  columns.forEach((column) => {
    const cell = doc.createElement("th");
    cell.textContent = column.header;
    header.append(cell);
  });
  const body = table.createTBody();
  rows.forEach((record) => {
    const row = body.insertRow();
    columns.forEach((column) => {
      const cell = row.insertCell();
      cell.textContent = printableValue(column.value(record));
    });
  });
  doc.body.append(heading, metadata, table);
  printWindow.focus();
  printWindow.setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}

export function ReportDateTools<T>({
  title,
  records,
  dateOf,
  periodOf,
  columns,
  children,
  dateLabel = "Report date",
}: ReportDateToolsProps<T>) {
  const [mode, setMode] = useState<DateMode>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const invalidRange = mode === "range" && Boolean(from && to && from > to);

  const filteredRecords = useMemo(() => {
    if (mode === "all") return records;
    if ((mode === "date" && !from) || (mode === "range" && (!from || !to)) || invalidRange) {
      return [];
    }
    return records.filter((record) => {
      const recordPeriod = periodOf?.(record);
      if (recordPeriod) {
        return mode === "date"
          ? recordPeriod.start <= from && recordPeriod.end >= from
          : recordPeriod.start <= to && recordPeriod.end >= from;
      }
      const key = dateKey(dateOf(record));
      if (!key) return false;
      return mode === "date" ? key === from : key >= from && key <= to;
    });
  }, [dateOf, from, invalidRange, mode, periodOf, records, to]);

  const period = selectedPeriod(mode, from, to);

  const downloadCsv = () => {
    const lines = [
      columns.map((column) => escapeCsv(column.header)).join(","),
      ...filteredRecords.map((record) =>
        columns.map((column) => escapeCsv(printableValue(column.value(record)))).join(","),
      ),
    ];
    const blob = new Blob(["\uFEFF", lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fileTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    link.href = url;
    link.download = `${fileTitle || "report"}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <label htmlFor={`${title}-date-mode`} className="text-sm font-medium">{dateLabel}</label>
            <select
              id={`${title}-date-mode`}
              className="h-9 rounded-md border border-input bg-white px-3 text-sm"
              value={mode}
              onChange={(event) => setMode(event.target.value as DateMode)}
            >
              <option value="all">All dates</option>
              <option value="date">Specific date</option>
              <option value="range">Date range</option>
            </select>
          </div>
          {mode !== "all" ? (
            <div className="grid gap-1.5">
              <label htmlFor={`${title}-date-from`} className="text-sm font-medium">
                {mode === "date" ? "Date" : "From"}
              </label>
              <input
                id={`${title}-date-from`}
                type="date"
                className="h-9 rounded-md border border-input bg-white px-3 text-sm"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
          ) : null}
          {mode === "range" ? (
            <div className="grid gap-1.5">
              <label htmlFor={`${title}-date-to`} className="text-sm font-medium">To</label>
              <input
                id={`${title}-date-to`}
                type="date"
                className="h-9 rounded-md border border-input bg-white px-3 text-sm"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!filteredRecords.length || invalidRange || (mode !== "all" && (!from || (mode === "range" && !to)))}
              onClick={() => printReport(title, filteredRecords, columns, period)}
            >
              Print report
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!filteredRecords.length || invalidRange || (mode !== "all" && (!from || (mode === "range" && !to)))}
              onClick={downloadCsv}
            >
              Download CSV
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-gray-600">
            {invalidRange
              ? "Start date must be on or before the end date."
              : mode !== "all" && (!from || (mode === "range" && !to))
                ? "Select the complete date or period to view report records."
                : `Period: ${period}`}
          </p>
          <p className="font-medium text-gray-700">{filteredRecords.length} record(s)</p>
        </div>
      </div>
      {children(filteredRecords)}
    </section>
  );
}
