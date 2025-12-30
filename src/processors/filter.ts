/**
 * Filtering logic for arms-length sale detection
 */

import type { RawParcelRecord, ExtractorConfig, DateRange } from '../types/index.js';
import { parseSalePrice, parseSaleDate } from '../scraper/parcel-details.js';
import { isDateInRange } from '../utils/date-range.js';
import { logger } from '../utils/logger.js';

/**
 * Reasons why a record was filtered out
 */
export interface FilterResult {
  passed: RawParcelRecord[];
  filtered: RawParcelRecord[];
  reasons: FilterReasons;
}

export interface FilterReasons {
  lowSalePrice: number;
  deniedInstrument: number;
  outsideDateRange: number;
  nonResidential: number;
  qualifiedSaleFailed: number;
  other: number;
  [key: string]: number;
}

/**
 * Check if deed instrument is in denylist
 */
export function isDeniedInstrument(
  instrument: string,
  denylist: string[]
): boolean {
  if (!instrument) return false;
  
  const normalized = instrument.toLowerCase().trim();
  return denylist.some(denied => 
    normalized.includes(denied.toLowerCase())
  );
}

/**
 * Check if sale appears to be arms-length based on heuristics
 */
export function isLikelyArmsLength(record: RawParcelRecord, config: ExtractorConfig): boolean {
  const price = parseSalePrice(record.sale_price);
  
  // Check price threshold
  if (price < config.minSalePrice) {
    return false;
  }

  // Check instrument denylist
  if (isDeniedInstrument(record.deed_instrument, config.instrumentDenylist)) {
    return false;
  }

  // If TPAD has qualified sale indicator, trust it
  if (record.qualified_sale) {
    const qualified = record.qualified_sale.toLowerCase();
    if (qualified === 'n' || qualified === 'no' || qualified === 'false') {
      return false;
    }
  }

  return true;
}

/**
 * Check if record is residential
 */
export function isResidential(record: RawParcelRecord): boolean {
  // Classification "00" typically means residential
  const classification = record.classification?.trim();
  if (classification === '00' || classification?.toLowerCase().includes('residential')) {
    return true;
  }
  
  // Also check land use
  const landUse = record.land_use?.toLowerCase() || '';
  const residentialTerms = ['residential', 'single family', 'sfr', 'duplex', 'townhouse', 'condo'];
  
  return residentialTerms.some(term => landUse.includes(term));
}

/**
 * Filter records based on configuration criteria
 */
export function filterRecords(
  records: RawParcelRecord[],
  config: ExtractorConfig,
  dateRange: DateRange
): FilterResult {
  const passed: RawParcelRecord[] = [];
  const filtered: RawParcelRecord[] = [];
  const reasons: FilterReasons = {
    lowSalePrice: 0,
    deniedInstrument: 0,
    outsideDateRange: 0,
    nonResidential: 0,
    qualifiedSaleFailed: 0,
    other: 0,
  };

  for (const record of records) {
    let reason: keyof FilterReasons | null = null;

    // Check date range
    const saleDate = parseSaleDate(record.sale_date);
    if (saleDate && !isDateInRange(saleDate, dateRange)) {
      reason = 'outsideDateRange';
    }

    // Check residential classification
    if (!reason && !isResidential(record)) {
      reason = 'nonResidential';
    }

    // Check sale price
    const price = parseSalePrice(record.sale_price);
    if (!reason && price < config.minSalePrice) {
      reason = 'lowSalePrice';
    }

    // Check instrument denylist
    if (!reason && isDeniedInstrument(record.deed_instrument, config.instrumentDenylist)) {
      reason = 'deniedInstrument';
    }

    // Check qualified sale indicator if available
    if (!reason && record.qualified_sale) {
      const qualified = record.qualified_sale.toLowerCase().trim();
      if (qualified === 'n' || qualified === 'no' || qualified === 'false' || qualified === '0') {
        reason = 'qualifiedSaleFailed';
      }
    }

    if (reason) {
      filtered.push(record);
      reasons[reason]++;
    } else {
      passed.push(record);
    }
  }

  logger.info('Filtering complete', {
    total: records.length,
    passed: passed.length,
    filtered: filtered.length,
    reasons,
  });

  return { passed, filtered, reasons };
}

/**
 * Default instrument denylist
 */
export const DEFAULT_INSTRUMENT_DENYLIST = [
  'Quitclaim',
  'Quit Claim',
  'QCD',
  'Deed of Trust',
  'Trust Deed',
  'Release',
  'Correction',
  'Corrective',
  'Trustee',
  'Executor',
  'Executrix',
  'Administrator',
  'Sheriff',
  "Sheriff's Deed",
  'Tax Deed',
  'Tax Sale',
  'Affidavit',
  'Transfer on Death',
  'TOD',
  'Gift Deed',
  'Love and Affection',
  'Partition',
  'Divorce',
  'Court Order',
  'Judgment',
  'Foreclosure',
];

