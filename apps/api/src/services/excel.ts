import fs from 'fs/promises';
import XLSX from 'xlsx';
import { z } from 'zod';
import { AppError } from '../lib/errors';

export interface RecipientRow {
  rowIndex: number;
  name: string;
  email: string;
  course: string;
  role: string;
  joiningDate: string;
  completionDate: string;
  rollNumber: string;
  [key: string]: string | number;
}

const normalizeKey = (key: string) =>
  key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const recipientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Email must be valid'),
  course: z.string().optional().default(''),
  role: z.string().optional().default(''),
  joiningDate: z.string().optional().default(''),
  completionDate: z.string().optional().default(''),
  rollNumber: z.string().optional().default('')
});

const normalizeDate = (value: unknown) => {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return String(value);
    return `${String(date.y).padStart(4, '0')}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  const parsed = new Date(String(value));
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return String(value);
};

export async function readExcelRecipients(filePath: string): Promise<RecipientRow[]> {
  const buffer = await fs.readFile(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return [];
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false
  });

  const invalidRows: Array<{ rowIndex: number; reason: string }> = [];

  const recipients = rows
    .map((row, index) => {
      const normalized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        normalized[normalizeKey(key)] = value;
      }

      const name = String(normalized.name ?? '').trim();
      const email = String(normalized.email ?? '').trim();

      const candidate = {
        rowIndex: index + 2,
        name,
        email,
        course: String(normalized.course ?? '').trim(),
        role: String(normalized.role ?? '').trim(),
        joiningDate: normalizeDate(normalized.joining_date ?? normalized.joiningdate ?? normalized.join_date),
        completionDate: normalizeDate(normalized.completion_date ?? normalized.completiondate ?? normalized.date),
        rollNumber: String(normalized.roll_number ?? normalized.rollnumber ?? '').trim(),
        ...normalized
      };

      const validation = recipientSchema.safeParse({
        name: candidate.name,
        email: candidate.email,
        course: candidate.course,
        role: candidate.role,
        joiningDate: candidate.joiningDate,
        completionDate: candidate.completionDate,
        rollNumber: candidate.rollNumber
      });

      if (!validation.success) {
        invalidRows.push({
          rowIndex: candidate.rowIndex,
          reason: validation.error.issues[0]?.message ?? 'Invalid row'
        });
        return null;
      }

      return candidate as RecipientRow;
    })
    .filter((row): row is RecipientRow => Boolean(row));

  if (invalidRows.length > 0) {
    const preview = invalidRows
      .slice(0, 5)
      .map((row) => `Row ${row.rowIndex}: ${row.reason}`)
      .join('; ');
    throw new AppError(`Excel validation failed. ${preview}`, 400);
  }

  return recipients;
}

export function buildTemplateContext(row: RecipientRow) {
  const date = row.completionDate || row.joiningDate || new Date().toISOString().slice(0, 10);
  return {
    ...row,
    name: row.name,
    email: row.email,
    course: row.course,
    role: row.role,
    date,
    joining_date: row.joiningDate,
    completion_date: row.completionDate,
    roll_number: row.rollNumber,
    roll_no: row.rollNumber,
    today: date
  };
}
