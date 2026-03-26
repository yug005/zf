type TableRow = Record<string, string | number | boolean | null | undefined>;

export function printTable(rows: TableRow[], columns?: string[]): void {
  if (rows.length === 0) {
    console.log('No results.');
    return;
  }

  const headers = columns && columns.length > 0 ? columns : Object.keys(rows[0]);
  const widths = headers.map((header) =>
    Math.max(
      header.length,
      ...rows.map((row) => String(normalizeCell(row[header])).length),
    ),
  );

  const renderRow = (values: string[]) =>
    values
      .map((value, index) => value.padEnd(widths[index], ' '))
      .join('  ');

  console.log(renderRow(headers));
  console.log(renderRow(widths.map((width) => '-'.repeat(width))));

  for (const row of rows) {
    console.log(renderRow(headers.map((header) => String(normalizeCell(row[header])))));
  }
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString();
}

function normalizeCell(value: TableRow[string]): string | number | boolean {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return value;
}
