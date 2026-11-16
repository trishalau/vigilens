import type { FeatureValues } from "../types";

export const MAX_CSV_ROWS = 250;
export const MAX_CSV_BYTES = 2 * 1024 * 1024;

export interface ParsedTransactionRow {
  rowNumber: number;
  features: FeatureValues;
}

export class CsvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvValidationError";
  }
}

function parseCsvText(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let afterQuote = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inQuotes) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
        afterQuote = true;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      if (cell.length > 0) throw new CsvValidationError("CSV contains a quote inside an unquoted field.");
      inQuotes = true;
      continue;
    }
    if (character === ",") {
      row.push(cell);
      cell = "";
      afterQuote = false;
      continue;
    }
    if (character === "\n" || character === "\r") {
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      afterQuote = false;
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      continue;
    }
    if (afterQuote) {
      if (/\s/.test(character)) continue;
      throw new CsvValidationError("CSV contains unexpected characters after a quoted field.");
    }
    cell += character;
  }

  if (inQuotes) throw new CsvValidationError("CSV contains an unclosed quoted field.");
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }
  return rows;
}

export async function parseTransactionsCsv(file: File, expectedFeatures: string[]): Promise<ParsedTransactionRow[]> {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new CsvValidationError("Choose a .csv file.");
  }
  if (file.size > MAX_CSV_BYTES) {
    throw new CsvValidationError("File is larger than the 2 MB demo upload limit.");
  }

  const text = await file.text();
  const parsedRows = parseCsvText(text);
  const headerRow = parsedRows[0];
  if (!headerRow) throw new CsvValidationError("The CSV file is empty.");
  const headers = headerRow.map((header) => header.trim());
  const expected = new Set(expectedFeatures);
  const headerSet = new Set(headers);
  const missing = expectedFeatures.filter((name) => !headerSet.has(name));
  const extra = headers.filter((name) => !expected.has(name));
  if (missing.length || extra.length) {
    const problems = [
      missing.length ? `Missing columns: ${missing.join(", ")}` : "",
      extra.length ? `Unexpected columns: ${extra.join(", ")}` : "",
    ].filter(Boolean);
    throw new CsvValidationError(problems.join(". "));
  }
  if (headers.length !== expectedFeatures.length) {
    throw new CsvValidationError("CSV must contain each expected feature exactly once.");
  }
  const dataRows = parsedRows.slice(1);
  if (dataRows.length === 0) {
    throw new CsvValidationError("The CSV has a header but no transaction rows.");
  }
  if (dataRows.length > MAX_CSV_ROWS) {
    throw new CsvValidationError(`The demo supports at most ${MAX_CSV_ROWS} rows per upload.`);
  }

  const rows = dataRows.map((values, index) => {
    if (values.length !== headers.length) {
      throw new CsvValidationError(`Row ${index + 1}: found ${values.length} values; expected ${headers.length}.`);
    }
    const record = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex]]));
    const features: FeatureValues = {};
    for (const name of expectedFeatures) {
      const raw = record[name]?.trim();
      if (raw === undefined || raw === "") {
        throw new CsvValidationError(`Row ${index + 1}: feature ${name} is empty.`);
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        throw new CsvValidationError(`Row ${index + 1}: feature ${name} must be a finite number.`);
      }
      features[name] = value;
    }
    return { rowNumber: index + 1, features };
  });

  return rows;
}

export async function predictRowsWithLimit<TInput, TOutput>(
  rows: TInput[],
  predictOne: (row: TInput) => Promise<TOutput>,
  concurrency: number,
  onProgress?: (completed: number, total: number) => void,
): Promise<Array<{ status: "success"; value: TOutput } | { status: "error"; message: string } | { status: "skipped"; message: string }>> {
  const results: Array<
    { status: "success"; value: TOutput } | { status: "error"; message: string } | { status: "skipped"; message: string } | undefined
  > = Array(rows.length).fill(undefined);
  const workerCount = Math.min(Math.max(1, concurrency), rows.length);
  let nextIndex = 0;
  let completed = 0;
  let stopScheduling = false;

  const worker = async () => {
    while (!stopScheduling) {
      const index = nextIndex++;
      if (index >= rows.length) return;
      try {
        results[index] = { status: "success", value: await predictOne(rows[index]) };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Prediction request failed.";
        results[index] = { status: "error", message };
        stopScheduling = true;
      }
      completed += 1;
      onProgress?.(completed, rows.length);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results.map((result) => result ?? {
    status: "skipped",
    message: "Not sent because an earlier request failed.",
  });
}
