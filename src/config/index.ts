/**
 * Configuration loader - reads from environment variables with sensible defaults
 */

import dotenv from 'dotenv';
import type { ExtractorConfig } from '../types/index.js';

// Load .env file if present
dotenv.config();

/**
 * Parse a comma-separated string into an array
 */
function parseList(value: string | undefined, defaultValue: string[]): string[] {
  if (!value || value.trim() === '') {
    return defaultValue;
  }
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Parse a boolean from environment variable
 */
function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse an integer from environment variable
 */
function parseInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Default instrument denylist for filtering non-arm's-length transfers
 */
const DEFAULT_INSTRUMENT_DENYLIST = [
  'Quitclaim',
  'Deed of Trust',
  'Release',
  'Correction',
  'Trustee',
  'Executor',
  'Sheriff',
  'Tax Deed',
  'Affidavit',
];

/**
 * Load configuration from environment variables
 */
export function loadConfig(): ExtractorConfig {
  return {
    // Output configuration
    outDir: process.env.OUT_DIR || './data',
    headless: parseBool(process.env.HEADLESS, true),

    // Scraper configuration
    concurrency: parseInt(process.env.CONCURRENCY, 3),
    requestDelayMs: parseInt(process.env.REQUEST_DELAY_MS, 1000),

    // Filtering configuration
    minSalePrice: parseInt(process.env.MIN_SALE_PRICE, 100000),
    instrumentDenylist: parseList(
      process.env.INSTRUMENT_DENYLIST,
      DEFAULT_INSTRUMENT_DENYLIST
    ),

    // County configuration
    countyCode: process.env.COUNTY_CODE || '084', // Tipton County
    countyName: process.env.COUNTY_NAME || 'Tipton',

    // Email configuration
    sendgridApiKey: process.env.SENDGRID_API_KEY || '',
    emailTo: process.env.EMAIL_TO || '',
    emailFrom: process.env.EMAIL_FROM || 'noreply@example.com',

    // S3 configuration (optional)
    s3Bucket: process.env.S3_BUCKET || '',
    awsRegion: process.env.AWS_REGION || 'us-east-1',

    // Google Maps configuration (optional - for property images in email)
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    mapImageType: (process.env.MAP_IMAGE_TYPE || 'streetview') as 'streetview' | 'satellite',
    mapImageWidth: parseInt(process.env.MAP_IMAGE_WIDTH, 600),  // 2x for retina displays
    mapImageHeight: parseInt(process.env.MAP_IMAGE_HEIGHT, 300),
  };
}

/**
 * Validate that required configuration is present
 */
export function validateConfig(config: ExtractorConfig, requireEmail: boolean = true): string[] {
  const errors: string[] = [];

  if (requireEmail) {
    if (!config.sendgridApiKey) {
      errors.push('SENDGRID_API_KEY is required for email delivery');
    }
    if (!config.emailTo) {
      errors.push('EMAIL_TO is required for email delivery');
    }
  }

  if (config.concurrency < 1 || config.concurrency > 10) {
    errors.push('CONCURRENCY must be between 1 and 10');
  }

  if (config.minSalePrice < 0) {
    errors.push('MIN_SALE_PRICE must be non-negative');
  }

  return errors;
}

export default loadConfig;

