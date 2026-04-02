import chalk from 'chalk';
import Table from 'cli-table3';

export interface OutputOptions {
  json?: boolean;
  quiet?: boolean;
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printError(err: unknown, jsonMode: boolean): void {
  if (jsonMode) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { statusCode?: number }).statusCode;
    const output: Record<string, unknown> = { error: message };
    if (code !== undefined) output.code = code;
    console.error(JSON.stringify(output));
  } else {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Error: ${message}`));
  }
}

export function printSuccess(message: string, quiet: boolean): void {
  if (!quiet) {
    console.log(chalk.green(`✅ ${message}`));
  }
}

export function printInfo(message: string, quiet: boolean): void {
  if (!quiet) {
    console.log(message);
  }
}

export function printTable(
  headers: string[],
  rows: string[][],
  quiet: boolean
): void {
  if (quiet) return;
  const table = new Table({ head: headers.map((h) => chalk.cyan(h)) });
  for (const row of rows) {
    table.push(row);
  }
  console.log(table.toString());
}

export function exitWithError(err: unknown, jsonMode: boolean): never {
  printError(err, jsonMode);
  process.exit(1);
}
