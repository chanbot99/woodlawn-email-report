/**
 * JSON output writer
 */

import * as fs from 'fs';
import * as path from 'path';
import type { CleanedSale, RawParcelRecord, DateRange } from '../types/index.js';
import { logger, logOutputFile } from '../utils/logger.js';
import { ensureOutputDir } from './csv-writer.js';
import { getSalesStats } from '../processors/transform.js';

/**
 * Output JSON structure with metadata
 */
export interface JsonOutput {
  metadata: {
    generated_at: string;
    date_range: {
      start: string;
      end: string;
      label: string;
    };
    county: string;
    record_count: number;
    stats: {
      total_value: number;
      average_price: number;
      median_price: number;
      min_price: number;
      max_price: number;
    };
  };
  records: CleanedSale[];
}

/**
 * Write cleaned sales to JSON file with metadata
 */
export function writeCleanedJson(
  sales: CleanedSale[],
  dateRange: DateRange,
  countyName: string,
  outDir: string,
  filename: string
): string {
  ensureOutputDir(outDir);
  
  const filePath = path.join(outDir, filename);
  const stats = getSalesStats(sales);
  
  const output: JsonOutput = {
    metadata: {
      generated_at: new Date().toISOString(),
      date_range: {
        start: dateRange.start.toISOString().split('T')[0],
        end: dateRange.end.toISOString().split('T')[0],
        label: dateRange.label,
      },
      county: countyName,
      record_count: sales.length,
      stats: {
        total_value: stats.totalValue,
        average_price: Math.round(stats.averagePrice),
        median_price: Math.round(stats.medianPrice),
        min_price: stats.minPrice,
        max_price: stats.maxPrice,
      },
    },
    records: sales,
  };

  const jsonContent = JSON.stringify(output, null, 2);
  fs.writeFileSync(filePath, jsonContent, 'utf-8');
  logOutputFile('JSON', filePath, sales.length);
  
  return filePath;
}

/**
 * Write raw records to JSON file (for debugging/archival)
 */
export function writeRawJson(
  records: RawParcelRecord[],
  outDir: string,
  filename: string
): string {
  ensureOutputDir(outDir);
  
  const filePath = path.join(outDir, filename);
  
  const output = {
    generated_at: new Date().toISOString(),
    record_count: records.length,
    records,
  };

  const jsonContent = JSON.stringify(output, null, 2);
  fs.writeFileSync(filePath, jsonContent, 'utf-8');
  logOutputFile('JSON (raw)', filePath, records.length);
  
  return filePath;
}

/**
 * Read JSON file
 */
export function readJson<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Convert output to minified JSON string (for smaller file size)
 */
export function toMinifiedJson(data: unknown): string {
  return JSON.stringify(data);
}

