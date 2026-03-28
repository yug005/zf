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
const LIGHT_CYAN = '\u001b[96m';
const LIGHT_BLUE = '\u001b[94m';
const LIGHT_MAGENTA = '\u001b[95m';
const GRAY = '\u001b[90m';

export function printBanner(title: string, subtitle?: string): void {
  const width = 74;
  const line = '='.repeat(width);

  console.log('');
  console.log(tint(`+${line}+`, LIGHT_BLUE));
  console.log(
    tint('| ', LIGHT_BLUE) +
      tint('ZER0FRICTION', LIGHT_CYAN) +
      tint(' // ', LIGHT_MAGENTA) +
      tint('CLI', WHITE) +
      tint(padRight('', width - stripAnsi('ZER0FRICTION // CLI').length - 1), LIGHT_BLUE) +
      tint('|', LIGHT_BLUE),
  );
  console.log(
    tint('| ', LIGHT_BLUE) +
      tint(title, BOLD + WHITE) +
      tint(padRight('', width - stripAnsi(title).length - 1), LIGHT_BLUE) +
      tint('|', LIGHT_BLUE),
  );
  if (subtitle) {
    const wrapped = wrapText(subtitle, width - 2);
    for (const lineText of wrapped) {
      console.log(
        tint('| ', LIGHT_BLUE) +
          tint(lineText, DIM + CYAN) +
          tint(padRight('', width - stripAnsi(lineText).length - 1), LIGHT_BLUE) +
          tint('|', LIGHT_BLUE),
      );
    }
  }
  console.log(tint(`+${line}+`, LIGHT_BLUE));
  console.log('');
}

export function printSection(title: string): void {
  console.log('');
  console.log(tint(`> ${title}`, BOLD + WHITE));
  console.log(tint(`  ${'-'.repeat(Math.max(12, title.length + 2))}`, GRAY));
}

export function printMuted(message: string): void {
  console.log(tint(message, DIM + GRAY));
}

export function printInfo(message: string): void {
  console.log(`${tint('i', LIGHT_BLUE)} ${message}`);
}

export function printSuccess(message: string): void {
  console.log(`${tint('OK', GREEN)} ${tint(message, WHITE)}`);
}

export function printWarning(message: string): void {
  console.log(`${tint('!!', YELLOW)} ${tint(message, WHITE)}`);
}

export function printError(message: string): void {
  console.error(`${tint('xx', RED)} ${tint(message, WHITE)}`);
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function printKeyValue(rows: Array<{ key: string; value: Primitive }>): void {
  const width = Math.max(...rows.map((row) => row.key.length), 0);
  for (const row of rows) {
    const label = row.key.padEnd(width, ' ');
    console.log(`${tint('>', LIGHT_BLUE)} ${tint(label, DIM + CYAN)}  ${normalizeCell(row.value)}`);
  }
}

export function printList(items: string[]): void {
  if (items.length === 0) {
    printMuted('No items.');
    return;
  }

  for (const item of items) {
    console.log(`${tint('*', LIGHT_MAGENTA)} ${item}`);
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

  const top = `+${widths.map((width) => '-'.repeat(width + 2)).join('+')}+`;
  const divider = `+${widths.map((width) => '-'.repeat(width + 2)).join('+')}+`;
  const bottom = `+${widths.map((width) => '-'.repeat(width + 2)).join('+')}+`;

  console.log(tint(top, GRAY));
  console.log(renderTableRow(headers.map((header) => tint(header, BOLD + WHITE)), widths));
  console.log(tint(divider, GRAY));

  for (const row of rows) {
    console.log(renderTableRow(headers.map((header) => String(normalizeCell(row[header]))), widths));
  }

  console.log(tint(bottom, GRAY));
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
    return tint(normalized, GREEN);
  }
  if (normalized === 'DOWN' || normalized === 'FAILURE' || normalized === 'TRIGGERED') {
    return tint(normalized, RED);
  }
  if (normalized === 'DEGRADED' || normalized === 'ACKNOWLEDGED') {
    return tint(normalized, YELLOW);
  }
  if (normalized === 'PAUSED') {
    return tint(normalized, LIGHT_MAGENTA);
  }

  return status;
}

export function formatLatency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  if (value < 200) {
    return tint(`${value}ms`, GREEN);
  }
  if (value < 1000) {
    return tint(`${value}ms`, YELLOW);
  }
  return tint(`${value}ms`, RED);
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
    return tint(rendered, GREEN);
  }
  if (numeric >= 95) {
    return tint(rendered, YELLOW);
  }
  return tint(rendered, RED);
}

function renderTableRow(values: string[], widths: number[]): string {
  const cells = values.map((value, index) => padAnsi(value, widths[index]));
  return `| ${cells.join(' | ')} |`;
}

function normalizeCell(value: Primitive): string | number | boolean {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return value;
}

function tint(value: string, code: string): string {
  if (!supportsColor()) {
    return stripAnsi(value);
  }
  return `${code}${value}${RESET}`;
}

function padAnsi(value: string, width: number): string {
  const visibleWidth = stripAnsi(value).length;
  return `${value}${' '.repeat(Math.max(0, width - visibleWidth))}`;
}

function padRight(value: string, width: number): string {
  return `${value}${' '.repeat(Math.max(0, width))}`;
}

function wrapText(value: string, width: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (stripAnsi(next).length <= width) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
    }
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [''];
}

function supportsColor(): boolean {
  return process.stdout.isTTY && process.env.NO_COLOR === undefined;
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}
