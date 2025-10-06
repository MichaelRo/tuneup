import type { Plan } from '../types/index.js';

function downloadBlob(content: BlobPart, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function exportJson(
  plan: Plan,
  beforeCounts: Record<string, unknown> | null,
  afterCounts: Record<string, unknown> | null,
  meta: { provider: string; version: string; lang: string },
): void {
  const payload = {
    generatedAt: new Date().toISOString(),
    meta,
    before: beforeCounts,
    after: afterCounts,
    plan,
  };
  const filename = `tuneup-report-${timestamp()}.json`;
  downloadBlob(JSON.stringify(payload, null, 2), filename, 'application/json');
}

export function exportCsv(rows: Array<Record<string, string>>): void {
  if (!rows.length) {
    console.warn('No rows to export');
    return;
  }
  const headers = Object.keys(rows[0] ?? {});
  const escapeCell = (value: string): string => {
    if (value === null || value === undefined) return '';
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };
  const lines = [headers.join(',')];
  rows.forEach(row => {
    const line = headers.map(header => escapeCell(row[header] ?? '')).join(',');
    lines.push(line);
  });
  const filename = `tuneup-report-${timestamp()}.csv`;
  downloadBlob(lines.join('\n'), filename, 'text/csv');
}
