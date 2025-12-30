/**
 * Tests for data transformation
 */

import { describe, it, expect } from 'vitest';
import {
  parseAddress,
  cleanOwnerName,
  cleanAddress,
  transformRecord,
  formatSalePrice,
  formatDisplayDate,
  getSalesStats,
} from '../src/processors/transform.js';
import type { RawParcelRecord, CleanedSale } from '../src/types/index.js';

const createMockRecord = (overrides: Partial<RawParcelRecord> = {}): RawParcelRecord => ({
  parcel_id: '123-456',
  owner_name: 'John Doe',
  property_address: '123 Main St',
  city: 'Covington',
  zip: '38019',
  classification: '00',
  land_use: 'Residential',
  acreage: '0.5',
  assessed_value: '150000',
  sale_date: '01/08/2025',
  sale_price: '$250,000',
  deed_instrument: 'Warranty Deed',
  qualified_sale: 'Y',
  source_url: 'https://example.com/parcel/123-456',
  ...overrides,
});

describe('parseAddress', () => {
  it('parses full address with state and zip', () => {
    const result = parseAddress('123 Main St, Covington, TN 38019');
    expect(result.street).toBe('123 Main St');
    expect(result.state).toBe('TN');
    expect(result.zip).toBe('38019');
  });

  it('handles address without zip', () => {
    const result = parseAddress('123 Main St, Covington, TN');
    expect(result.street).toBe('123 Main St');
    expect(result.state).toBe('TN');
  });

  it('returns empty for empty input', () => {
    const result = parseAddress('');
    expect(result.street).toBe('');
    expect(result.city).toBe('');
  });

  it('handles simple street address', () => {
    const result = parseAddress('123 Main St');
    expect(result.street).toBe('123 Main St');
    expect(result.state).toBe('TN'); // Default
  });
});

describe('cleanOwnerName', () => {
  it('trims whitespace', () => {
    expect(cleanOwnerName('  John Doe  ')).toBe('John Doe');
  });

  it('normalizes multiple spaces', () => {
    expect(cleanOwnerName('John    Doe')).toBe('John Doe');
  });

  it('keeps apostrophes and hyphens', () => {
    expect(cleanOwnerName("O'Brien-Smith")).toBe("O'Brien-Smith");
  });

  it('returns empty for empty input', () => {
    expect(cleanOwnerName('')).toBe('');
  });
});

describe('cleanAddress', () => {
  it('converts to uppercase', () => {
    expect(cleanAddress('123 Main St')).toBe('123 MAIN ST');
  });

  it('normalizes whitespace', () => {
    expect(cleanAddress('123   Main   St')).toBe('123 MAIN ST');
  });
});

describe('transformRecord', () => {
  it('transforms raw record to cleaned format', () => {
    const raw = createMockRecord();
    const cleaned = transformRecord(raw);
    
    expect(cleaned.parcel_id).toBe('123-456');
    expect(cleaned.situs_address).toBe('123 MAIN ST');
    expect(cleaned.city).toBe('COVINGTON');
    expect(cleaned.state).toBe('TN');
    expect(cleaned.zip).toBe('38019');
    expect(cleaned.owner_name).toBe('John Doe');
    expect(cleaned.sale_price).toBe(250000);
    expect(cleaned.sale_date).toBe('2025-01-08');
    expect(cleaned.deed_instrument).toBe('Warranty Deed');
    expect(cleaned.source_url).toBe('https://example.com/parcel/123-456');
    expect(cleaned.extracted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('handles missing owner name', () => {
    const raw = createMockRecord({ owner_name: '' });
    const cleaned = transformRecord(raw);
    expect(cleaned.owner_name).toBeNull();
  });

  it('parses various price formats', () => {
    const raw1 = createMockRecord({ sale_price: '$1,250,000' });
    expect(transformRecord(raw1).sale_price).toBe(1250000);

    const raw2 = createMockRecord({ sale_price: '500000' });
    expect(transformRecord(raw2).sale_price).toBe(500000);

    const raw3 = createMockRecord({ sale_price: '' });
    expect(transformRecord(raw3).sale_price).toBe(0);
  });

  it('parses various date formats', () => {
    const raw1 = createMockRecord({ sale_date: '01/15/2025' });
    expect(transformRecord(raw1).sale_date).toBe('2025-01-15');

    const raw2 = createMockRecord({ sale_date: '2025-01-15' });
    expect(transformRecord(raw2).sale_date).toBe('2025-01-15');
  });
});

describe('formatSalePrice', () => {
  it('formats as USD currency', () => {
    expect(formatSalePrice(250000)).toBe('$250,000');
  });

  it('handles millions', () => {
    expect(formatSalePrice(1500000)).toBe('$1,500,000');
  });

  it('handles zero', () => {
    expect(formatSalePrice(0)).toBe('$0');
  });
});

describe('formatDisplayDate', () => {
  it('formats ISO date to MM/DD/YYYY', () => {
    expect(formatDisplayDate('2025-01-15')).toBe('01/15/2025');
  });

  it('returns empty for empty input', () => {
    expect(formatDisplayDate('')).toBe('');
  });
});

describe('getSalesStats', () => {
  const sales: CleanedSale[] = [
    { 
      parcel_id: '1', situs_address: '', city: '', state: 'TN', zip: '',
      owner_name: null, owner_mailing_address: null, sale_date: '', 
      sale_price: 100000, deed_instrument: '', land_use: '', 
      source_url: '', extracted_at: '',
    },
    { 
      parcel_id: '2', situs_address: '', city: '', state: 'TN', zip: '',
      owner_name: null, owner_mailing_address: null, sale_date: '', 
      sale_price: 200000, deed_instrument: '', land_use: '', 
      source_url: '', extracted_at: '',
    },
    { 
      parcel_id: '3', situs_address: '', city: '', state: 'TN', zip: '',
      owner_name: null, owner_mailing_address: null, sale_date: '', 
      sale_price: 300000, deed_instrument: '', land_use: '', 
      source_url: '', extracted_at: '',
    },
  ];

  it('calculates correct count', () => {
    const stats = getSalesStats(sales);
    expect(stats.count).toBe(3);
  });

  it('calculates total value', () => {
    const stats = getSalesStats(sales);
    expect(stats.totalValue).toBe(600000);
  });

  it('calculates average price', () => {
    const stats = getSalesStats(sales);
    expect(stats.averagePrice).toBe(200000);
  });

  it('calculates median price', () => {
    const stats = getSalesStats(sales);
    expect(stats.medianPrice).toBe(200000);
  });

  it('calculates min and max', () => {
    const stats = getSalesStats(sales);
    expect(stats.minPrice).toBe(100000);
    expect(stats.maxPrice).toBe(300000);
  });

  it('handles empty array', () => {
    const stats = getSalesStats([]);
    expect(stats.count).toBe(0);
    expect(stats.totalValue).toBe(0);
    expect(stats.averagePrice).toBe(0);
  });

  it('calculates median for even number of items', () => {
    const evenSales = sales.slice(0, 2);
    const stats = getSalesStats(evenSales);
    expect(stats.medianPrice).toBe(150000); // (100000 + 200000) / 2
  });
});

