/**
 * Type definitions for New Homeowners Extractor
 */

/**
 * Raw parcel data as scraped from TPAD search results
 */
export interface RawParcelRecord {
  parcel_id: string;
  owner_name: string;
  property_address: string;
  city: string;
  zip: string;
  classification: string;
  land_use: string;
  acreage: string;
  assessed_value: string;
  sale_date: string;
  sale_price: string;
  deed_instrument: string;
  qualified_sale: string;
  source_url: string;
}

/**
 * Cleaned and standardized sale record for output
 */
export interface CleanedSale {
  parcel_id: string;
  situs_address: string;
  city: string;
  state: string;
  zip: string;
  owner_name: string | null;
  owner_mailing_address: string | null;
  sale_date: string;
  sale_price: number;
  deed_instrument: string;
  land_use: string;
  source_url: string;
  extracted_at: string;
}

/**
 * Configuration for the extractor
 */
export interface ExtractorConfig {
  outDir: string;
  headless: boolean;
  concurrency: number;
  requestDelayMs: number;
  minSalePrice: number;
  instrumentDenylist: string[];
  countyCode: string;
  countyName: string;
  sendgridApiKey: string;
  emailTo: string;
  emailFrom: string;
  s3Bucket: string;
  awsRegion: string;
  // Google Maps (optional - for property images in email)
  googleMapsApiKey: string;
  mapImageType: 'streetview' | 'satellite';
  mapImageWidth: number;
  mapImageHeight: number;
}

/**
 * Date range for searching
 */
export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

/**
 * Search parameters for TPAD
 */
export interface SearchParams {
  countyCode: string;
  classification: string;
  saleDateStart: string;
  saleDateEnd: string;
}

/**
 * Parcel detail page data
 */
export interface ParcelDetails {
  parcel_id: string;
  owner_name: string;
  owner_mailing_address: string;
  property_address: string;
  city: string;
  zip: string;
  classification: string;
  land_use: string;
  sales: SaleRecord[];
  source_url: string;
}

/**
 * Individual sale record from parcel details
 */
export interface SaleRecord {
  sale_date: string;
  sale_price: string;
  deed_instrument: string;
  grantor: string;
  grantee: string;
  qualified_sale: string;
  book_page: string;
}

/**
 * Email report data
 */
export interface EmailReportData {
  weekLabel: string;
  countyName: string;
  totalRecords: number;
  filteredRecords: number;
  sales: CleanedSale[];
  generatedAt: string;
}

/**
 * CLI options
 */
export interface CliOptions {
  week?: string;
  out: string;
  dryRun: boolean;
}

/**
 * Extraction result
 */
export interface ExtractionResult {
  rawRecords: RawParcelRecord[];
  cleanedSales: CleanedSale[];
  dateRange: DateRange;
  outputFiles: {
    rawCsv: string;
    cleanedCsv: string;
    cleanedJson: string;
  };
}

