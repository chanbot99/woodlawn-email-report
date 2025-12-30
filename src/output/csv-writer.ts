/**
 * CSV output writer
 */

import { stringify } from 'csv-stringify/sync';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import type { RawParcelRecord, CleanedSale } from '../types/index.js';
import { logger, logOutputFile } from '../utils/logger.js';

/**
 * CSV column headers for cleaned sales
 */
const CLEANED_HEADERS = [
  'parcel_id',
  'situs_address',
  'city',
  'state',
  'zip',
  'owner_name',
  'owner_mailing_address',
  'sale_date',
  'sale_price',
  'deed_instrument',
  'land_use',
  'source_url',
  'extracted_at',
];

/**
 * CSV column headers for raw records
 */
const RAW_HEADERS = [
  'parcel_id',
  'owner_name',
  'property_address',
  'city',
  'zip',
  'classification',
  'land_use',
  'acreage',
  'assessed_value',
  'sale_date',
  'sale_price',
  'deed_instrument',
  'qualified_sale',
  'source_url',
];

/**
 * Ensure output directory exists
 */
export function ensureOutputDir(outDir: string): void {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
    logger.debug('Created output directory', { path: outDir });
  }
}

/**
 * Write cleaned sales to CSV file
 */
export function writeCleanedCsv(
  sales: CleanedSale[],
  outDir: string,
  filename: string
): string {
  ensureOutputDir(outDir);
  
  const filePath = path.join(outDir, filename);
  
  const csvContent = stringify(sales, {
    header: true,
    columns: CLEANED_HEADERS,
  });

  fs.writeFileSync(filePath, csvContent, 'utf-8');
  logOutputFile('CSV (cleaned)', filePath, sales.length);
  
  return filePath;
}

/**
 * Write raw records to CSV file
 */
export function writeRawCsv(
  records: RawParcelRecord[],
  outDir: string,
  filename: string
): string {
  ensureOutputDir(outDir);
  
  const filePath = path.join(outDir, filename);
  
  const csvContent = stringify(records, {
    header: true,
    columns: RAW_HEADERS,
  });

  fs.writeFileSync(filePath, csvContent, 'utf-8');
  logOutputFile('CSV (raw)', filePath, records.length);
  
  return filePath;
}

/**
 * Read CSV file and parse to records
 */
export function readCsv<T extends Record<string, unknown>>(filePath: string): T[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as T[];
}

/**
 * Convert cleaned sales to CSV string (for email attachment)
 */
export function cleanedSalesToCsvString(sales: CleanedSale[]): string {
  return stringify(sales, {
    header: true,
    columns: CLEANED_HEADERS,
  });
}

/**
 * Generate filename with date range
 */
export function generateFilename(prefix: string, dateLabel: string, extension: string): string {
  // Convert "Week of 2025-01-06" to "2025_01_06"
  const datePart = dateLabel
    .replace('Week of ', '')
    .replace(/-/g, '_');
  
  return `${prefix}_${datePart}.${extension}`;
}

