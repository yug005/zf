type Primitive = string | number | boolean | null | undefined;
type TableRow = Record<string, Primitive>;

const RESET = '\u001b[0m';
const DIM = '\u001b[2m';
const BOLD = '\u001b[1m';
const CYAN = '\u001b[36m';
const BLUE = '\u001b[34m';
const GREEN = '\u001b[32m';
const YELLOW = '\u001b[33m';
const RED = '\u001b[31m';
const MAGENTA = '\u001b[35m';
const WHITE = '\u001b[37m';

export function printBanner(title: string, subtitle?: string): void {
  console.log('');
  console.log(color(`${BOLD}${CYAN}Zer0Friction CLI${RESET}`));
  console.log(color(`${DIM}${title}${RESET}`));
  if (subtitle) {
    console.log(color(`${DIM}${subtitle}${RESET}`));
  }
  console.log('');
}

export function printSection(title: string): void {
  console.log('');
  console.log(color(`${BOLD}${WHITE}${title}${RESET}`));
}

export function printMuted(message: string): void {
  console.log(color(`${DIM}${message}${RESET}`));
}

export function printInfo(message: string): void {
  console.log(color(`${BLUE}i${RESET} ${message}`));
}

export function printSuccess(message: string): void {
  console.log(color(`${GREEN}OK${RESET} ${message}`));
}

export function printWarning(message: string): void {
  console.log(color(`${YELLOW}!${RESET} ${message}`));
}

export function printError(message: string): void {
  console.error(color(`${RED}x${RESET} ${message}`));
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function printKeyValue(rows: Array<{ key: string; value: Primitive }>): void {
  const width = Math.max(...rows.map((row) => row.key.length), 0);
  for (const row of rows) {
    const label = row.key.padEnd(width, ' ');
    console.log(`${color(`${DIM}${label}${RESET}`)}  ${normalizeCell(row.value)}`);
  }
}

export function printTable(rows: TableRow[], columns?: string[]): void {
  if (rows.length === 0) {
    printMuted('No results.');
    return;
  }

  const headers = columns && columns.length > 0 ? columns : Object.keys(rows[0]);
  const widths = headers.map((header) =>
    Math.max(
      header.length,
      ...rows.map((row) => stripAnsi(String(normalizeCell(row[header]))).length),
    ),
  );

  const renderRow = (values: string[]) =>
    values
      .map((value, index) => {
        const rawWidth = stripAnsi(value).length;
        return value.padEnd(widths[index] + Math.max(0, value.length - rawWidth), ' ');
      })
      .join('  ');

  console.log(renderRow(headers.map((header) => color(`${DIM}${header}${RESET}`))));
  console.log(renderRow(widths.map((width) => color(`${DIM}${'-'.repeat(width)}${RESET}`))));

  for (const row of rows) {
    console.log(renderRow(headers.map((header) => String(normalizeCell(row[header])))));
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString();
}

export function formatStatus(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === 'UP' || normalized === 'SUCCESS' || normalized === 'RESOLVED') {
    return color(`${GREEN}${normalized}${RESET}`);
  }
  if (normalized === 'DOWN' || normalized === 'FAILURE' || normalized === 'TRIGGERED') {
    return color(`${RED}${normalized}${RESET}`);
  }
  if (normalized === 'DEGRADED' || normalized === 'ACKNOWLEDGED') {
    return color(`${YELLOW}${normalized}${RESET}`);
  }
  if (normalized === 'PAUSED') {
    return color(`${MAGENTA}${normalized}${RESET}`);
  }

  return status;
}

export function formatLatency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  if (value < 200) {
    return color(`${GREEN}${value}ms${RESET}`);
  }
  if (value < 1000) {
    return color(`${YELLOW}${value}ms${RESET}`);
  }
  return color(`${RED}${value}ms${RESET}`);
}

export function formatPercentage(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const numeric = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(numeric)) {
    return String(value);
  }

  const rendered = `${numeric.toFixed(2)}%`;
  if (numeric >= 99.9) {
    return color(`${GREEN}${rendered}${RESET}`);
  }
  if (numeric >= 95) {
    return color(`${YELLOW}${rendered}${RESET}`);
  }
  return color(`${RED}${rendered}${RESET}`);
}

function normalizeCell(value: Primitive): string | number | boolean {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return value;
}

function color(value: string): string {
  return value;
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}
