/**
 * Main TPAD scraper client - orchestrates the extraction process
 */

import type { Page } from 'playwright';
import { createPage, closeBrowser } from './browser.js';
import { 
  navigateToSearch, 
  executeSearch, 
  createSearchParams,
  hasResults,
  getResultCount,
  extractResultsFromPage,
  searchResultToRawRecord,
  hasNextPage,
  goToNextPage,
} from './search.js';
import { 
  extractParcelDetails, 
  parcelDetailsToRawRecord,
  isSaleInDateRange,
} from './parcel-details.js';
import { logger, logSearchResults, logParcelProgress } from '../utils/logger.js';
import { withRetry, isNetworkRetryable, sleep, createRateLimiter } from '../utils/retry.js';
import type { ExtractorConfig, DateRange, RawParcelRecord, ParcelDetails } from '../types/index.js';
import { TPAD_BASE_URL } from '../config/selectors.js';

/**
 * Main extraction result
 */
export interface TpadExtractionResult {
  rawRecords: RawParcelRecord[];
  parcelDetails: ParcelDetails[];
  totalParcels: number;
  totalPages: number;
}

/**
 * TPAD Client class
 */
export class TpadClient {
  private config: ExtractorConfig;
  private page: Page | null = null;
  private rateLimiter: () => Promise<void>;

  constructor(config: ExtractorConfig) {
    this.config = config;
    this.rateLimiter = createRateLimiter(config.requestDelayMs);
  }

  /**
   * Initialize the browser and page
   */
  async initialize(): Promise<void> {
    this.page = await createPage(this.config);
    logger.info('TPAD client initialized');
  }

  /**
   * Close resources
   */
  async close(): Promise<void> {
    await closeBrowser();
    this.page = null;
    logger.info('TPAD client closed');
  }

  /**
   * Run full extraction for a date range
   */
  async extract(dateRange: DateRange): Promise<TpadExtractionResult> {
    if (!this.page) {
      throw new Error('Client not initialized. Call initialize() first.');
    }

    logger.info('Starting TPAD extraction', { 
      dateRange: dateRange.label,
      county: this.config.countyName,
    });

    // Step 1: Navigate to search page
    await withRetry(
      () => navigateToSearch(this.page!),
      { maxRetries: 3, isRetryable: isNetworkRetryable },
      'navigate to search'
    );

    // Step 2: Execute search with date range
    const searchParams = createSearchParams(this.config.countyCode, dateRange);
    await withRetry(
      () => executeSearch(this.page!, searchParams),
      { maxRetries: 3, isRetryable: isNetworkRetryable },
      'execute search'
    );

    // Step 3: Check for results
    const hasAnyResults = await hasResults(this.page);
    if (!hasAnyResults) {
      logger.info('No results found for the specified criteria');
      return {
        rawRecords: [],
        parcelDetails: [],
        totalParcels: 0,
        totalPages: 0,
      };
    }

    const totalCount = await getResultCount(this.page);
    logger.info('Found results', { estimatedCount: totalCount });

    // Step 4: Collect all results from all pages
    const allResults: RawParcelRecord[] = [];
    const parcelUrls: Map<string, string> = new Map();
    let pageNum = 1;

    do {
      logger.debug(`Processing results page ${pageNum}`);
      
      const pageResults = await extractResultsFromPage(this.page);
      
      for (const result of pageResults) {
        const record = searchResultToRawRecord(result, this.config.countyCode);
        allResults.push(record);
        
        if (result.viewUrl) {
          const fullUrl = result.viewUrl.startsWith('http') 
            ? result.viewUrl 
            : `${TPAD_BASE_URL}${result.viewUrl.replace('./', '/')}`;
          parcelUrls.set(result.parcelId, fullUrl);
        }
      }

      const hasMore = await hasNextPage(this.page);
      if (hasMore) {
        await goToNextPage(this.page);
        pageNum++;
        await sleep(500);
      } else {
        break;
      }
    } while (true);

    const totalPages = pageNum;
    logSearchResults(allResults.length, totalPages);

    // Step 5: Fetch details for each parcel to get sale price and deed info
    const parcelDetails: ParcelDetails[] = [];
    const enrichedRecords: RawParcelRecord[] = [];

    const parcelEntries = Array.from(parcelUrls.entries());
    let processedCount = 0;

    for (let i = 0; i < parcelEntries.length; i += this.config.concurrency) {
      const batch = parcelEntries.slice(i, i + this.config.concurrency);
      
      const batchPromises = batch.map(async ([parcelId, url]) => {
        await this.rateLimiter();
        
        return withRetry(
          async () => {
            const detailPage = await createPage(this.config);
            try {
              const details = await extractParcelDetails(detailPage, url, parcelId);
              return details;
            } finally {
              await detailPage.close();
            }
          },
          { maxRetries: 2, isRetryable: isNetworkRetryable },
          `parcel ${parcelId}`
        );
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const [parcelId] = batch[j];
        
        if (result.status === 'fulfilled' && result.value) {
          const details = result.value;
          parcelDetails.push(details);
          
          // Enrich records with sale data from details page
          if (details.sales.length > 0) {
            for (const sale of details.sales) {
              if (isSaleInDateRange(sale.sale_date, dateRange.start, dateRange.end)) {
                enrichedRecords.push(parcelDetailsToRawRecord(details, sale));
              }
            }
          } else {
            // No sales data from details page, use the original search result
            const originalRecord = allResults.find(r => r.parcel_id === parcelId);
            if (originalRecord) {
              enrichedRecords.push({
                ...originalRecord,
                source_url: details.source_url,
              });
            }
          }
        } else {
          // Failed to get details, use original search result
          const originalRecord = allResults.find(r => r.parcel_id === parcelId);
          if (originalRecord) {
            enrichedRecords.push(originalRecord);
          }
        }
      }

      processedCount = Math.min(i + this.config.concurrency, parcelEntries.length);
      logParcelProgress(processedCount, parcelEntries.length);
    }

    // Use enriched records if we got them, otherwise fall back to search results
    const finalRecords = enrichedRecords.length > 0 ? enrichedRecords : allResults;

    logger.info('Extraction complete', {
      totalParcels: parcelUrls.size,
      detailsFetched: parcelDetails.length,
      finalRecords: finalRecords.length,
    });

    return {
      rawRecords: finalRecords,
      parcelDetails,
      totalParcels: parcelUrls.size,
      totalPages,
    };
  }
}

/**
 * Create and initialize a TPAD client
 */
export async function createTpadClient(config: ExtractorConfig): Promise<TpadClient> {
  const client = new TpadClient(config);
  await client.initialize();
  return client;
}
