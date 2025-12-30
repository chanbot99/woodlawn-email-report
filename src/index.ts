#!/usr/bin/env node
/**
 * New Homeowners Extractor CLI
 * 
 * Extracts weekly residential property sales from Tennessee Property Assessment Data (TPAD)
 * for Tipton County and sends a formatted report via email.
 * 
 * Usage:
 *   npx newhomeowners --out ./data
 *   npx newhomeowners --week 2025-01-06 --out ./data
 *   npx newhomeowners --dry-run
 */

import { Command } from 'commander';
import { loadConfig, validateConfig } from './config/index.js';
import { 
  getPreviousWeekRange, 
  getWeekRangeFromMonday, 
  formatDateRange, 
  getDateRangeFilename 
} from './utils/date-range.js';
import { logger, logExtractionStart, logFilteringResults } from './utils/logger.js';
import { createTpadClient } from './scraper/tpad-client.js';
import { filterRecords } from './processors/filter.js';
import { deduplicateRawRecords, deduplicateCleanedSales, deduplicateByOwnerAddress } from './processors/dedupe.js';
import { transformRecords } from './processors/transform.js';
import { writeRawCsv, writeCleanedCsv, generateFilename } from './output/csv-writer.js';
import { writeCleanedJson } from './output/json-writer.js';
import { uploadOutputs, generateS3KeyPrefix } from './output/s3-uploader.js';
import { sendReportEmail } from './email/sendgrid.js';
import type { CliOptions, ExtractionResult } from './types/index.js';

const program = new Command();

program
  .name('newhomeowners')
  .description('Extract new homeowner data from TPAD for lawn care marketing')
  .version('1.0.0')
  .option('-w, --week <date>', 'Monday of the week to process (YYYY-MM-DD), defaults to previous week')
  .option('-o, --out <dir>', 'Output directory', './data')
  .option('-d, --dry-run', 'Run without sending email', false)
  .option('--test-email', 'Send a test email to verify configuration')
  .action(async (options: CliOptions & { testEmail?: boolean }) => {
    try {
      await run(options);
    } catch (error) {
      logger.error('Fatal error', error as Error);
      process.exit(1);
    }
  });

/**
 * Main execution function
 */
async function run(options: CliOptions & { testEmail?: boolean }): Promise<void> {
  const config = loadConfig();
  
  // Override output directory from CLI
  if (options.out) {
    config.outDir = options.out;
  }

  // Handle test email mode
  if (options.testEmail) {
    const { sendTestEmail } = await import('./email/sendgrid.js');
    const success = await sendTestEmail(config);
    process.exit(success ? 0 : 1);
  }

  // Validate configuration
  const errors = validateConfig(config, !options.dryRun);
  if (errors.length > 0) {
    for (const error of errors) {
      logger.error(error);
    }
    if (!options.dryRun) {
      process.exit(1);
    }
  }

  // Determine date range
  const dateRange = options.week 
    ? getWeekRangeFromMonday(options.week)
    : getPreviousWeekRange();

  logExtractionStart(formatDateRange(dateRange), config.countyName);

  // Initialize client and run extraction
  const client = await createTpadClient(config);
  
  try {
    // Extract data from TPAD
    const { rawRecords, totalParcels, totalPages } = await client.extract(dateRange);

    if (rawRecords.length === 0) {
      logger.info('No records found for the specified period');
      await client.close();
      return;
    }

    // Deduplicate raw records
    const deduped = deduplicateRawRecords(rawRecords);

    // Filter for arms-length sales
    const { passed, filtered, reasons } = filterRecords(deduped, config, dateRange);
    logFilteringResults(deduped.length, passed.length, reasons);

    // Transform to cleaned format and deduplicate
    // 1. First dedupe by parcel+address+date+price (catches true duplicates)
    // 2. Then dedupe by owner+address (for marketing, one contact per owner/address)
    const transformedSales = transformRecords(passed);
    const dedupedByRecord = deduplicateCleanedSales(transformedSales);
    const cleanedSales = deduplicateByOwnerAddress(dedupedByRecord);

    // Generate output filenames
    const dateLabel = dateRange.label;
    const filenameBase = getDateRangeFilename(dateRange);

    // Write output files
    const rawCsvPath = writeRawCsv(
      rawRecords, 
      config.outDir, 
      generateFilename('raw_export', dateLabel, 'csv')
    );
    
    const cleanedCsvPath = writeCleanedCsv(
      cleanedSales, 
      config.outDir, 
      generateFilename('cleaned_sales', dateLabel, 'csv')
    );
    
    const cleanedJsonPath = writeCleanedJson(
      cleanedSales, 
      dateRange, 
      config.countyName, 
      config.outDir, 
      generateFilename('cleaned_sales', dateLabel, 'json')
    );

    const result: ExtractionResult = {
      rawRecords,
      cleanedSales,
      dateRange,
      outputFiles: {
        rawCsv: rawCsvPath,
        cleanedCsv: cleanedCsvPath,
        cleanedJson: cleanedJsonPath,
      },
    };

    // Upload to S3 if configured
    if (config.s3Bucket) {
      const keyPrefix = generateS3KeyPrefix(config.countyName, dateLabel);
      await uploadOutputs(config, [
        { path: cleanedCsvPath, keyPrefix },
        { path: cleanedJsonPath, keyPrefix },
      ]);
    }

    // Send email report
    if (!options.dryRun) {
      const emailSent = await sendReportEmail(config, cleanedSales, dateRange);
      if (!emailSent) {
        logger.warn('Email was not sent - check configuration');
      }
    } else {
      logger.info('Dry run mode - skipping email');
    }

    // Summary
    logger.info('Extraction complete', {
      totalParcels,
      totalPages,
      rawRecords: rawRecords.length,
      cleanedSales: cleanedSales.length,
      outputDir: config.outDir,
    });

  } finally {
    await client.close();
  }
}

// Parse and execute
program.parse();

