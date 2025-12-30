/**
 * Data transformation from raw records to cleaned output format
 */

import type { RawParcelRecord, CleanedSale } from '../types/index.js';
import { parseSalePrice, parseSaleDate } from '../scraper/parcel-details.js';
import { logger } from '../utils/logger.js';

/**
 * Parse and normalize address components
 */
export function parseAddress(fullAddress: string): {
  street: string;
  city: string;
  state: string;
  zip: string;
} {
  if (!fullAddress) {
    return { street: '', city: '', state: '', zip: '' };
  }

  // Try to parse "Street, City, ST ZIP" format
  const parts = fullAddress.split(',').map(p => p.trim());
  
  if (parts.length >= 2) {
    const street = parts[0];
    const lastPart = parts[parts.length - 1];
    
    // Try to extract state and zip from last part
    const stateZipMatch = lastPart.match(/([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?$/i);
    
    if (stateZipMatch) {
      const state = stateZipMatch[1].toUpperCase();
      const zip = stateZipMatch[2] || '';
      const cityPart = parts.length > 2 
        ? parts.slice(1, -1).join(', ') 
        : lastPart.replace(stateZipMatch[0], '').trim();
      
      return { street, city: cityPart, state, zip };
    }
    
    // Fallback: assume last part is city
    return { 
      street, 
      city: parts.length > 1 ? parts[1] : '', 
      state: 'TN', 
      zip: '',
    };
  }

  return { street: fullAddress, city: '', state: 'TN', zip: '' };
}

/**
 * Clean and normalize owner name
 */
export function cleanOwnerName(name: string): string {
  if (!name) return '';
  
  return name
    .trim()
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/[^\w\s,.'&-]/g, '');  // Remove special chars except common name punctuation
}

/**
 * Clean and normalize address string
 */
export function cleanAddress(address: string): string {
  if (!address) return '';
  
  return address
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/**
 * Transform a raw record to cleaned sale format
 */
export function transformRecord(record: RawParcelRecord): CleanedSale {
  // Parse sale price
  const salePrice = parseSalePrice(record.sale_price);
  
  // Parse and normalize sale date to ISO format
  const saleDate = parseSaleDate(record.sale_date);
  
  // Clean address - use property_address, fallback to parsing
  const propertyAddress = cleanAddress(record.property_address);
  
  // Determine city and zip
  let city = record.city?.trim() || '';
  let zip = record.zip?.trim() || '';
  
  // If city/zip not provided, try to parse from address
  if (!city && propertyAddress.includes(',')) {
    const parsed = parseAddress(propertyAddress);
    city = city || parsed.city;
    zip = zip || parsed.zip;
  }

  // Clean owner info
  const ownerName = cleanOwnerName(record.owner_name);
  
  return {
    parcel_id: record.parcel_id.trim(),
    situs_address: propertyAddress,
    city: city.toUpperCase(),
    state: 'TN',
    zip: zip,
    owner_name: ownerName || null,
    owner_mailing_address: null, // Will be populated from parcel details if available
    sale_date: saleDate,
    sale_price: salePrice,
    deed_instrument: record.deed_instrument?.trim() || '',
    land_use: record.land_use?.trim() || record.classification?.trim() || '',
    source_url: record.source_url || '',
    extracted_at: new Date().toISOString(),
  };
}

/**
 * Transform multiple raw records to cleaned sales
 */
export function transformRecords(records: RawParcelRecord[]): CleanedSale[] {
  const transformed = records.map(transformRecord);
  
  logger.debug('Transformed records', {
    input: records.length,
    output: transformed.length,
  });
  
  return transformed;
}

/**
 * Format sale price for display
 */
export function formatSalePrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Format date for display (MM/DD/YYYY)
 */
export function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return '';
  
  // Parse YYYY-MM-DD format directly to avoid timezone issues
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${month}/${day}/${year}`;
  }
  
  return isoDate;
}

/**
 * Get summary statistics for cleaned sales
 */
export function getSalesStats(sales: CleanedSale[]): {
  count: number;
  totalValue: number;
  averagePrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
} {
  if (sales.length === 0) {
    return {
      count: 0,
      totalValue: 0,
      averagePrice: 0,
      medianPrice: 0,
      minPrice: 0,
      maxPrice: 0,
    };
  }

  const prices = sales.map(s => s.sale_price).sort((a, b) => a - b);
  const totalValue = prices.reduce((sum, p) => sum + p, 0);
  
  const medianIndex = Math.floor(prices.length / 2);
  const medianPrice = prices.length % 2 === 0
    ? (prices[medianIndex - 1] + prices[medianIndex]) / 2
    : prices[medianIndex];

  return {
    count: sales.length,
    totalValue,
    averagePrice: totalValue / sales.length,
    medianPrice,
    minPrice: prices[0],
    maxPrice: prices[prices.length - 1],
  };
}

