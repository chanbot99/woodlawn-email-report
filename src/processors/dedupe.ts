/**
 * Deduplication logic for parcel records
 */

import type { RawParcelRecord, CleanedSale } from '../types/index.js';
import { parseSalePrice, parseSaleDate } from '../scraper/parcel-details.js';
import { logger } from '../utils/logger.js';

/**
 * Normalize parcel ID by removing extra whitespace
 * TPAD uses inconsistent spacing like "067    05308 000" vs "067 05308 000"
 */
export function normalizeParcelId(parcelId: string): string {
  return parcelId.trim().replace(/\s+/g, ' ');
}

/**
 * Generate a unique key for a sale record
 * Combines parcel_id + sale_date + sale_price
 */
export function generateSaleKey(record: RawParcelRecord): string {
  const parcelId = normalizeParcelId(record.parcel_id);
  const saleDate = parseSaleDate(record.sale_date);
  const salePrice = parseSalePrice(record.sale_price);
  
  return `${parcelId}|${saleDate}|${salePrice}`;
}

/**
 * Generate a unique key for a cleaned sale
 * Uses normalized parcel_id and also includes address for extra safety
 */
export function generateCleanedSaleKey(sale: CleanedSale): string {
  const parcelId = normalizeParcelId(sale.parcel_id);
  // Include address as secondary key in case parcel IDs have issues
  const address = sale.situs_address?.trim().toUpperCase() || '';
  return `${parcelId}|${address}|${sale.sale_date}|${sale.sale_price}`;
}

/**
 * Generate a unique key based on address only (for fallback deduplication)
 */
export function generateAddressKey(sale: CleanedSale): string {
  const address = sale.situs_address?.trim().toUpperCase() || '';
  const city = sale.city?.trim().toUpperCase() || '';
  return `${address}|${city}|${sale.sale_date}|${sale.sale_price}`;
}

/**
 * Deduplicate raw records by parcel_id + sale_date + sale_price
 * Keeps the first occurrence of each unique combination
 */
export function deduplicateRawRecords(records: RawParcelRecord[]): RawParcelRecord[] {
  const seen = new Set<string>();
  const unique: RawParcelRecord[] = [];

  for (const record of records) {
    const key = generateSaleKey(record);
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(record);
    }
  }

  const duplicatesRemoved = records.length - unique.length;
  if (duplicatesRemoved > 0) {
    logger.info('Removed duplicates', {
      before: records.length,
      after: unique.length,
      removed: duplicatesRemoved,
    });
  }

  return unique;
}

/**
 * Deduplicate cleaned sales by parcel+address+date+price
 * Also uses address-only key as fallback to catch duplicates with parcel ID variations
 */
export function deduplicateCleanedSales(sales: CleanedSale[]): CleanedSale[] {
  const seenByKey = new Set<string>();
  const seenByAddress = new Set<string>();
  const unique: CleanedSale[] = [];

  for (const sale of sales) {
    const primaryKey = generateCleanedSaleKey(sale);
    const addressKey = generateAddressKey(sale);
    
    // Skip if we've seen this exact combination OR this address combination
    if (seenByKey.has(primaryKey) || seenByAddress.has(addressKey)) {
      continue;
    }
    
    seenByKey.add(primaryKey);
    seenByAddress.add(addressKey);
    unique.push(sale);
  }

  const removed = sales.length - unique.length;
  if (removed > 0) {
    logger.info('Deduplicated cleaned sales', {
      before: sales.length,
      after: unique.length,
      removed,
    });
  }

  return unique;
}

/**
 * Deduplicate by parcel ID only, keeping the most recent sale
 */
export function deduplicateByParcel(records: RawParcelRecord[]): RawParcelRecord[] {
  const byParcel = new Map<string, RawParcelRecord>();

  for (const record of records) {
    const parcelId = record.parcel_id.trim();
    const existing = byParcel.get(parcelId);

    if (!existing) {
      byParcel.set(parcelId, record);
      continue;
    }

    // Keep the record with the more recent sale date
    const existingDate = parseSaleDate(existing.sale_date);
    const currentDate = parseSaleDate(record.sale_date);

    if (currentDate > existingDate) {
      byParcel.set(parcelId, record);
    }
  }

  return Array.from(byParcel.values());
}

/**
 * Sort records by sale date (most recent first)
 */
export function sortBySaleDate(records: RawParcelRecord[], ascending = false): RawParcelRecord[] {
  return [...records].sort((a, b) => {
    const dateA = parseSaleDate(a.sale_date);
    const dateB = parseSaleDate(b.sale_date);
    
    if (ascending) {
      return dateA.localeCompare(dateB);
    }
    return dateB.localeCompare(dateA);
  });
}

/**
 * Deduplicate cleaned sales by owner + address
 * Useful for marketing - same owner at same address should only appear once
 * Keeps the record with the highest sale price (most likely the main property)
 */
export function deduplicateByOwnerAddress(sales: CleanedSale[]): CleanedSale[] {
  const byOwnerAddress = new Map<string, CleanedSale>();

  for (const sale of sales) {
    // Create key from owner name + address
    const owner = sale.owner_name?.trim().toUpperCase() || '';
    const address = sale.situs_address?.trim().toUpperCase() || '';
    const key = `${owner}|${address}`;
    
    if (!key || key === '|') continue;

    const existing = byOwnerAddress.get(key);
    
    if (!existing) {
      byOwnerAddress.set(key, sale);
    } else {
      // Keep the one with the higher sale price (main property vs land parcels)
      if (sale.sale_price > existing.sale_price) {
        byOwnerAddress.set(key, sale);
      }
    }
  }

  const unique = Array.from(byOwnerAddress.values());
  
  const removed = sales.length - unique.length;
  if (removed > 0) {
    logger.info('Deduplicated by owner+address', {
      before: sales.length,
      after: unique.length,
      removed,
    });
  }

  return unique;
}

