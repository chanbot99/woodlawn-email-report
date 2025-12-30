/**
 * Tests for filtering logic
 */

import { describe, it, expect } from 'vitest';
import {
  isDeniedInstrument,
  isLikelyArmsLength,
  isResidential,
  filterRecords,
  DEFAULT_INSTRUMENT_DENYLIST,
} from '../src/processors/filter.js';
import type { RawParcelRecord, ExtractorConfig } from '../src/types/index.js';
import { getWeekRangeFromMonday } from '../src/utils/date-range.js';

const mockConfig: ExtractorConfig = {
  outDir: './data',
  headless: true,
  concurrency: 3,
  requestDelayMs: 1000,
  minSalePrice: 1000,
  instrumentDenylist: DEFAULT_INSTRUMENT_DENYLIST,
  countyCode: '084',
  countyName: 'Tipton',
  sendgridApiKey: '',
  emailTo: '',
  emailFrom: '',
  s3Bucket: '',
  awsRegion: 'us-east-1',
};

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

describe('isDeniedInstrument', () => {
  const denylist = ['Quitclaim', 'Deed of Trust', 'Sheriff'];

  it('returns true for denied instrument', () => {
    expect(isDeniedInstrument('Quitclaim Deed', denylist)).toBe(true);
  });

  it('returns true for partial match', () => {
    expect(isDeniedInstrument("Sheriff's Deed", denylist)).toBe(true);
  });

  it('returns false for allowed instrument', () => {
    expect(isDeniedInstrument('Warranty Deed', denylist)).toBe(false);
  });

  it('is case insensitive', () => {
    expect(isDeniedInstrument('QUITCLAIM', denylist)).toBe(true);
  });

  it('returns false for empty instrument', () => {
    expect(isDeniedInstrument('', denylist)).toBe(false);
  });
});

describe('isLikelyArmsLength', () => {
  it('returns true for valid arms-length sale', () => {
    const record = createMockRecord({
      sale_price: '$250,000',
      deed_instrument: 'Warranty Deed',
      qualified_sale: 'Y',
    });
    expect(isLikelyArmsLength(record, mockConfig)).toBe(true);
  });

  it('returns false for low price', () => {
    const record = createMockRecord({
      sale_price: '$100',
    });
    expect(isLikelyArmsLength(record, mockConfig)).toBe(false);
  });

  it('returns false for denied instrument', () => {
    const record = createMockRecord({
      deed_instrument: 'Quitclaim Deed',
    });
    expect(isLikelyArmsLength(record, mockConfig)).toBe(false);
  });

  it('returns false for unqualified sale', () => {
    const record = createMockRecord({
      qualified_sale: 'N',
    });
    expect(isLikelyArmsLength(record, mockConfig)).toBe(false);
  });

  it('returns true when qualified_sale is empty (unknown)', () => {
    const record = createMockRecord({
      qualified_sale: '',
    });
    expect(isLikelyArmsLength(record, mockConfig)).toBe(true);
  });
});

describe('isResidential', () => {
  it('returns true for classification 00', () => {
    const record = createMockRecord({ classification: '00' });
    expect(isResidential(record)).toBe(true);
  });

  it('returns true for "Residential" classification', () => {
    const record = createMockRecord({ classification: 'Residential' });
    expect(isResidential(record)).toBe(true);
  });

  it('returns true for residential land use', () => {
    const record = createMockRecord({ 
      classification: '',
      land_use: 'Single Family Residential',
    });
    expect(isResidential(record)).toBe(true);
  });

  it('returns false for commercial', () => {
    const record = createMockRecord({ 
      classification: '02',
      land_use: 'Commercial',
    });
    expect(isResidential(record)).toBe(false);
  });
});

describe('filterRecords', () => {
  const dateRange = getWeekRangeFromMonday('2025-01-06');

  it('keeps valid arms-length residential sales', () => {
    const records = [
      createMockRecord({ sale_date: '01/08/2025' }),
    ];
    
    const result = filterRecords(records, mockConfig, dateRange);
    expect(result.passed).toHaveLength(1);
    expect(result.filtered).toHaveLength(0);
  });

  it('filters out low price sales', () => {
    const records = [
      createMockRecord({ sale_price: '$500' }),
    ];
    
    const result = filterRecords(records, mockConfig, dateRange);
    expect(result.passed).toHaveLength(0);
    expect(result.filtered).toHaveLength(1);
    expect(result.reasons.lowSalePrice).toBe(1);
  });

  it('filters out denied instruments', () => {
    const records = [
      createMockRecord({ deed_instrument: 'Quitclaim Deed' }),
    ];
    
    const result = filterRecords(records, mockConfig, dateRange);
    expect(result.passed).toHaveLength(0);
    expect(result.reasons.deniedInstrument).toBe(1);
  });

  it('filters out sales outside date range', () => {
    const records = [
      createMockRecord({ sale_date: '01/01/2025' }), // Before range
    ];
    
    const result = filterRecords(records, mockConfig, dateRange);
    expect(result.passed).toHaveLength(0);
    expect(result.reasons.outsideDateRange).toBe(1);
  });

  it('filters out non-residential', () => {
    const records = [
      createMockRecord({ 
        classification: '02',
        land_use: 'Commercial',
      }),
    ];
    
    const result = filterRecords(records, mockConfig, dateRange);
    expect(result.passed).toHaveLength(0);
    expect(result.reasons.nonResidential).toBe(1);
  });

  it('handles multiple records with different filter reasons', () => {
    const records = [
      createMockRecord({ sale_date: '01/08/2025' }), // Valid
      createMockRecord({ sale_price: '$500', sale_date: '01/08/2025' }), // Low price
      createMockRecord({ deed_instrument: 'Quitclaim', sale_date: '01/08/2025' }), // Denied
      createMockRecord({ sale_date: '01/01/2025' }), // Outside range
    ];
    
    const result = filterRecords(records, mockConfig, dateRange);
    expect(result.passed).toHaveLength(1);
    expect(result.filtered).toHaveLength(3);
  });
});

