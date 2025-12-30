/**
 * TPAD Advanced Search automation (Updated for new TPAD interface)
 */

import type { Page } from 'playwright';
import { SELECTORS, TPAD_BASE_URL, CLASSIFICATION_OPTIONS, getCountyName } from '../config/selectors.js';
import { logger } from '../utils/logger.js';
import { formatDateForTpad } from '../utils/date-range.js';
import { waitForStable } from './browser.js';
import type { DateRange, SearchParams, RawParcelRecord } from '../types/index.js';

/**
 * Result row data from search results table
 */
interface SearchResultRow {
  viewUrl: string;
  owner: string;
  propertyAddress: string;
  controlMap: string;
  group: string;
  parcel: string;
  specialInterest: string;
  parcelId: string;
  subdivision: string;
  lot: string;
  classification: string;
  saleDate: string;
  gisMapUrl: string;
}

/**
 * Navigate to TPAD search page
 */
export async function navigateToSearch(page: Page): Promise<void> {
  logger.info('Navigating to TPAD search page', { url: TPAD_BASE_URL });
  
  await page.goto(TPAD_BASE_URL, { 
    waitUntil: 'networkidle',
    timeout: 60000,
  });

  await waitForStable(page);
  logger.debug('Search page loaded');
}

/**
 * Open the Advanced Search section
 */
export async function openAdvancedSearch(page: Page): Promise<void> {
  // Click the Advanced Search accordion button
  const advancedToggle = await page.$('button.accordion-button:has-text("Advanced Search")');
  if (advancedToggle) {
    // Check if it's collapsed
    const isExpanded = await advancedToggle.getAttribute('aria-expanded');
    if (isExpanded !== 'true') {
      await advancedToggle.click();
      await page.waitForTimeout(500);
      logger.debug('Opened advanced search section');
    }
  }
}

/**
 * Fill in search criteria and execute search
 */
export async function executeSearch(
  page: Page,
  params: SearchParams
): Promise<void> {
  const countyName = getCountyName(params.countyCode);
  
  logger.info('Executing search', { 
    county: countyName, 
    classification: params.classification,
    dateRange: `${params.saleDateStart} - ${params.saleDateEnd}`,
  });

  // Open advanced search section
  await openAdvancedSearch(page);
  await page.waitForTimeout(500);

  // Select county
  await page.selectOption('#countySelect', { label: countyName });
  await page.waitForTimeout(300);

  // Select classification (Residential = "00 - Residential")
  const classLabel = params.classification === '00' 
    ? CLASSIFICATION_OPTIONS.RESIDENTIAL 
    : params.classification;
  await page.selectOption('#classSelect', { label: classLabel });
  await page.waitForTimeout(300);

  // Fill date range (YYYY-MM-DD format for HTML5 date inputs)
  await page.fill('#saleDateRangeStartSelect', params.saleDateStart);
  await page.fill('#saleDateRangeEndSelect', params.saleDateEnd);
  await page.waitForTimeout(300);

  // Click search button (the one in advanced search, not basic search)
  const searchButtons = await page.$$('button.searchButton');
  if (searchButtons.length > 1) {
    // Second button is the advanced search button
    await searchButtons[1].click();
  } else if (searchButtons.length > 0) {
    await searchButtons[0].click();
  }

  // Wait for results to load - the table uses DataTables which loads dynamically
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');
  
  // Wait for the DataTables to finish loading
  try {
    await page.waitForSelector('#searchResultsTable tbody tr', { timeout: 10000 });
    // Wait a bit more for DataTables to fully render
    await page.waitForTimeout(1000);
  } catch {
    logger.debug('No results table rows appeared after search');
  }
  
  logger.debug('Search executed, results loaded');
}

/**
 * Create search parameters from config and date range
 */
export function createSearchParams(
  countyCode: string,
  dateRange: DateRange
): SearchParams {
  return {
    countyCode,
    classification: '00', // Residential
    saleDateStart: formatDateForTpad(dateRange.start),
    saleDateEnd: formatDateForTpad(dateRange.end),
  };
}

/**
 * Check if there are any results
 */
export async function hasResults(page: Page): Promise<boolean> {
  await page.waitForTimeout(1000);

  // Check for results table
  const table = await page.$('#searchResultsTable');
  if (!table) {
    return false;
  }

  // Check for data rows - but filter out "no results" rows
  const rows = await page.$$('#searchResultsTable tbody tr');
  
  for (const row of rows) {
    const cells = await row.$$('td');
    // Real data rows have 12+ cells, "no results" rows have 1 cell
    if (cells.length >= 12) {
      return true;
    }
    
    // Also check if the single cell says "no matching records"
    if (cells.length === 1) {
      const text = await cells[0].textContent();
      if (text?.toLowerCase().includes('no matching') || text?.toLowerCase().includes('no records')) {
        return false;
      }
    }
  }
  
  return false;
}

/**
 * Get total result count
 */
export async function getResultCount(page: Page): Promise<number | null> {
  // Try to get count from DataTables info
  try {
    const infoEl = await page.$('.dataTables_info');
    if (infoEl) {
      const text = await infoEl.textContent();
      // Format: "Showing 1 to 10 of 70 entries"
      const match = text?.match(/of\s+(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
  } catch {
    // Fallback to counting visible rows
  }
  
  const rows = await page.$$('#searchResultsTable tbody tr');
  logger.debug(`getResultCount: Found ${rows.length} visible rows`);
  return rows.length > 0 ? rows.length : null;
}

/**
 * Extract all result rows from current page
 */
export async function extractResultsFromPage(page: Page): Promise<SearchResultRow[]> {
  const results: SearchResultRow[] = [];

  // Wait for table to be visible
  try {
    await page.waitForSelector('#searchResultsTable tbody tr', { timeout: 5000 });
  } catch {
    logger.debug('No results table rows found');
    return results;
  }

  const rows = await page.$$('#searchResultsTable tbody tr');
  logger.debug(`Found ${rows.length} result rows`);

  for (const row of rows) {
    try {
      const cells = await row.$$('td');
      if (cells.length < 12) {
        logger.debug(`Skipping row with only ${cells.length} cells`);
        continue;
      }

      // Column mapping:
      // 0: View link, 1: Owner, 2: Property Address, 3: Control Map,
      // 4: Group, 5: Parcel, 6: Special Interest, 7: Parcel ID,
      // 8: Subdivision, 9: Lot, 10: Class, 11: Sale Date, 12: GIS Map

      const viewLink = await cells[0].$('a');
      const viewUrl = viewLink ? await viewLink.getAttribute('href') : '';
      const gisLink = cells.length > 12 ? await cells[12].$('a') : null;
      const gisMapUrl = gisLink ? await gisLink.getAttribute('href') || '' : '';

      const getText = async (cell: typeof cells[0]) => {
        const text = await cell.textContent();
        return (text || '').trim();
      };

      const result: SearchResultRow = {
        viewUrl: viewUrl || '',
        owner: await getText(cells[1]),
        propertyAddress: await getText(cells[2]),
        controlMap: await getText(cells[3]),
        group: await getText(cells[4]),
        parcel: await getText(cells[5]),
        specialInterest: await getText(cells[6]),
        parcelId: await getText(cells[7]),
        subdivision: await getText(cells[8]),
        lot: await getText(cells[9]),
        classification: await getText(cells[10]),
        saleDate: await getText(cells[11]),
        gisMapUrl,
      };

      results.push(result);
      logger.debug(`Extracted result: ${result.parcelId} - ${result.owner.slice(0, 30)}`);
    } catch (error) {
      logger.debug('Error extracting row', { error: (error as Error).message });
    }
  }

  return results;
}

/**
 * Convert search result row to raw parcel record
 */
export function searchResultToRawRecord(row: SearchResultRow, countyCode: string): RawParcelRecord {
  // Parse the address - format is typically "STREET NAME  NUMBER"
  let address = row.propertyAddress;
  // Normalize multiple spaces and swap if needed
  address = address.replace(/\s+/g, ' ').trim();
  
  // Try to extract city from subdivision or default to county seat
  const city = 'COVINGTON'; // Default for Tipton County

  return {
    parcel_id: row.parcelId,
    owner_name: row.owner,
    property_address: address,
    city,
    zip: '',
    classification: row.classification,
    land_use: row.classification,
    acreage: '',
    assessed_value: '',
    sale_date: row.saleDate,
    sale_price: '', // Will be filled from parcel details
    deed_instrument: '', // Will be filled from parcel details
    qualified_sale: '',
    source_url: row.viewUrl ? `${TPAD_BASE_URL}${row.viewUrl.replace('./', '/')}` : '',
  };
}

/**
 * Extract parcel URLs from current page
 */
export async function extractParcelUrls(page: Page): Promise<Map<string, string>> {
  const parcelUrls = new Map<string, string>();
  const results = await extractResultsFromPage(page);

  for (const result of results) {
    if (result.parcelId && result.viewUrl) {
      const fullUrl = result.viewUrl.startsWith('http') 
        ? result.viewUrl 
        : `${TPAD_BASE_URL}${result.viewUrl.replace('./', '/')}`;
      parcelUrls.set(result.parcelId, fullUrl);
    }
  }

  return parcelUrls;
}

/**
 * Check if there's a next page in pagination
 * DataTables uses .paginate_button.next and adds .disabled when on last page
 */
export async function hasNextPage(page: Page): Promise<boolean> {
  const nextButton = await page.$('.paginate_button.next');
  if (!nextButton) {
    return false;
  }
  
  // Check if the button is disabled
  const isDisabled = await nextButton.evaluate(el => {
    return el.classList.contains('disabled') || 
           el.hasAttribute('disabled') ||
           el.getAttribute('aria-disabled') === 'true';
  });
  
  return !isDisabled;
}

/**
 * Navigate to the next page of results
 */
export async function goToNextPage(page: Page): Promise<boolean> {
  // Double-check that next page is available
  if (!await hasNextPage(page)) {
    return false;
  }
  
  const nextButton = await page.$('.paginate_button.next:not(.disabled)');
  if (!nextButton) {
    return false;
  }

  try {
    await nextButton.click();
    await page.waitForTimeout(1000);
    await waitForStable(page);
    return true;
  } catch (error) {
    logger.debug('Failed to navigate to next page', { error: (error as Error).message });
    return false;
  }
}

/**
 * Get current page number
 */
export async function getCurrentPageNumber(page: Page): Promise<number> {
  const currentPage = await page.$('.paginate_button.current');
  if (currentPage) {
    const text = await currentPage.textContent();
    if (text) {
      const num = parseInt(text.trim(), 10);
      if (!isNaN(num)) {
        return num;
      }
    }
  }
  return 1;
}

/**
 * Extract parcel IDs from current page
 */
export async function extractParcelIdsFromPage(page: Page): Promise<string[]> {
  const results = await extractResultsFromPage(page);
  return results.map(r => r.parcelId).filter(Boolean);
}
