import { ReportData } from './reporting.types';

export function generateCsv(data: ReportData): string {
  const { table, report } = data;
  if (!table.columns.length || !table.rows.length) {
    return '\uFEFF"No data available for this report"\n';
  }

  const lines: string[] = [];

  lines.push(`Report: ${report.title}`);
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');

  const headers = table.columns.map(c => escapeCsv(c.label || c.key));
  lines.push(headers.join(','));

  table.rows.forEach(row => {
    const values = table.columns.map(c => {
      let val = row[c.key];
      if (val === null || val === undefined) return '';
      if (typeof val === 'boolean') return val ? 'Yes' : 'No';
      return escapeCsv(String(val));
    });
    lines.push(values.join(','));
  });

  lines.push('');
  lines.push(`Total records: ${table.rows.length}`);

  return '\uFEFF' + lines.join('\n');
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
