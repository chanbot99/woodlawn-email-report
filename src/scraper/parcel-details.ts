/**
 * Parcel details page extraction (Updated for new TPAD interface)
 */

import type { Page } from 'playwright';
import { TPAD_BASE_URL } from '../config/selectors.js';
import { logger } from '../utils/logger.js';
import { waitForStable } from './browser.js';
import type { ParcelDetails, SaleRecord, RawParcelRecord } from '../types/index.js';

/**
 * Navigate to parcel details page and extract information
 */
export async function extractParcelDetails(
  page: Page,
  parcelUrl: string,
  parcelId: string
): Promise<ParcelDetails | null> {
  try {
    // Construct full URL if relative
    const fullUrl = parcelUrl.startsWith('http') 
      ? parcelUrl 
      : `${TPAD_BASE_URL}${parcelUrl.replace('./', '/')}`;

    await page.goto(fullUrl, { 
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await waitForStable(page);

    // Extract owner info and property address from "Property Owner and Mailing Address" card
    // The Current Owner section has the best address info: "467 OWEN RD, BRIGHTON TN 38011"
    let ownerName = '';
    let ownerMailingAddress = '';
    let propertyAddress = '';
    let city = '';
    let zip = '';
    
    const ownerCard = await page.$('.card:has-text("Property Owner")');
    if (ownerCard) {
      const ownerBody = await ownerCard.$('.card-body');
      if (ownerBody) {
        // Extract all text content and parse it
        const ownerData = await ownerBody.evaluate((el) => {
          const text = el.textContent || '';
          const result = {
            januaryOwner: '',
            januaryAddress: '',
            currentOwner: '',
            currentAddress: '',
            currentCity: '',
            currentState: '',
            currentZip: '',
          };
          
          // Find Current Owner section - this has the property address
          const currentMatch = text.match(/Current Owner\s*([\s\S]*?)(?:$)/i);
          if (currentMatch) {
            const currentSection = currentMatch[1].trim();
            const lines = currentSection.split('\n').map((l: string) => l.trim()).filter(Boolean);
            
            // First line(s) are owner name
            // Then street address
            // Then city state zip
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              
              // Check if this looks like a city/state/zip line
              const cityStateZip = line.match(/^([A-Z\s]+)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
              if (cityStateZip) {
                result.currentCity = cityStateZip[1].trim();
                result.currentState = cityStateZip[2];
                result.currentZip = cityStateZip[3];
              } 
              // Check if it looks like a street address (has number)
              else if (line.match(/^\d+\s+\w/) || line.match(/\d+$/)) {
                result.currentAddress = line;
              }
              // Otherwise it's part of the owner name
              else if (!result.currentOwner && !line.includes('Current Owner')) {
                result.currentOwner = line;
              }
            }
          }
          
          // Find January 1 Owner section for mailing address
          const janMatch = text.match(/January 1 Owner\s*([\s\S]*?)(?:Current Owner|$)/i);
          if (janMatch) {
            const janSection = janMatch[1].trim();
            const lines = janSection.split('\n').map((l: string) => l.trim()).filter(Boolean);
            
            // First lines are owner name, rest is mailing address
            const ownerLines: string[] = [];
            const addressLines: string[] = [];
            let foundAddress = false;
            
            for (const line of lines) {
              // If line contains numbers or looks like address, it's address
              if (line.match(/\d/) || line.match(/^[A-Z]{2}\s+\d{5}/)) {
                foundAddress = true;
              }
              if (foundAddress) {
                addressLines.push(line);
              } else {
                ownerLines.push(line);
              }
            }
            
            result.januaryOwner = ownerLines.join(' ').trim();
            result.januaryAddress = addressLines.join(', ').trim();
          }
          
          return result;
        });
        
        // Use Current Owner's name and address (this is who you'd contact)
        ownerName = ownerData.currentOwner || ownerData.januaryOwner;
        propertyAddress = ownerData.currentAddress;
        city = ownerData.currentCity;
        zip = ownerData.currentZip;
        ownerMailingAddress = ownerData.januaryAddress;
      }
    }

    // Fallback: Extract property address from "Property Location" card if we didn't get it
    if (!propertyAddress) {
      const locationCard = await page.$('.card:has-text("Property Location")');
      if (locationCard) {
        const addressText = await locationCard.evaluate((el) => {
          const text = el.textContent || '';
          const match = text.match(/Address:\s*([A-Z0-9\s]+)/);
          return match ? match[1].trim() : '';
        });
        if (addressText) {
          propertyAddress = addressText;
        }
      }
    }

    // Extract classification from General Information section
    // Format: "00 - Residential"
    let classification = '';
    let landUse = '';
    
    try {
      // The classification is in the General Information card
      const generalInfo = await page.$('.card:has-text("General Information")');
      if (generalInfo) {
        const classificationText = await generalInfo.$eval(
          '.card-body',
          (el) => {
            const text = el.textContent || '';
            // Look for pattern like "00 - Residential"
            const match = text.match(/(\d{2}\s*-\s*[A-Za-z]+)/);
            return match ? match[1].trim() : '';
          }
        );
        if (classificationText) {
          classification = classificationText;
          landUse = classificationText;
        }
      }
    } catch {
      // Fall back to simple extraction
      classification = 'Residential';
      landUse = 'Residential';
    }

    // Extract sales history from the sales table
    const sales = await extractSalesHistory(page);

    const details: ParcelDetails = {
      parcel_id: parcelId,
      owner_name: ownerName,
      owner_mailing_address: ownerMailingAddress,
      property_address: propertyAddress,
      city,
      zip,
      classification,
      land_use: landUse,
      sales,
      source_url: fullUrl,
    };

    logger.debug('Extracted parcel details', { 
      parcelId, 
      salesCount: sales.length,
      owner: ownerName.slice(0, 30),
    });

    return details;

  } catch (error) {
    logger.warn('Failed to extract parcel details', { 
      parcelId, 
      error: (error as Error).message,
    });
    return null;
  }
}

/**
 * Extract sales history from parcel details page
 * 
 * Table structure:
 * Sale Date | Price | Book | Page | Vacant/Improved | Type Instrument | Qualification
 */
async function extractSalesHistory(page: Page): Promise<SaleRecord[]> {
  const sales: SaleRecord[] = [];

  try {
    // Find the sales table - it's in the "Sale Information" section
    // Headers: Sale Date, Price, Book, Page, Vacant/Improved, Type Instrument, Qualification
    const tables = await page.$$('table.table-striped');
    
    for (const table of tables) {
      // Check if this is the sales table by looking at headers
      const headers = await table.$$eval('th', (ths) => 
        ths.map(th => th.textContent?.trim().toLowerCase() || '')
      );
      
      if (!headers.includes('sale date') || !headers.includes('price')) {
        continue;
      }

      // This is the sales table
      const rows = await table.$$('tbody tr');
      
      for (const row of rows) {
        const cells = await row.$$('td');
        if (cells.length < 7) continue;

        const sale: SaleRecord = {
          sale_date: (await cells[0].textContent())?.trim() || '',
          sale_price: (await cells[1].textContent())?.trim() || '',
          book_page: `${(await cells[2].textContent())?.trim() || ''}-${(await cells[3].textContent())?.trim() || ''}`,
          grantor: '', // Not available in this table
          grantee: '', // Not available in this table  
          deed_instrument: (await cells[5].textContent())?.trim() || '',
          qualified_sale: (await cells[6].textContent())?.trim() || '',
        };

        // Only add if we have meaningful data
        if (sale.sale_date || sale.sale_price) {
          sales.push(sale);
        }
      }
      
      break; // Found the sales table, no need to check others
    }
  } catch (error) {
    logger.debug('Error extracting sales history', { 
      error: (error as Error).message,
    });
  }

  return sales;
}

/**
 * Convert parcel details to raw record format
 */
export function parcelDetailsToRawRecord(
  details: ParcelDetails,
  sale: SaleRecord
): RawParcelRecord {
  return {
    parcel_id: details.parcel_id,
    owner_name: details.owner_name,
    property_address: details.property_address,
    city: details.city,
    zip: details.zip,
    classification: details.classification,
    land_use: details.land_use,
    acreage: '',
    assessed_value: '',
    sale_date: sale.sale_date,
    sale_price: sale.sale_price,
    deed_instrument: sale.deed_instrument,
    qualified_sale: sale.qualified_sale,
    source_url: details.source_url,
  };
}

/**
 * Parse price string to number
 * Handles formats like "$50,000", "50000", "$1,250,000"
 */
export function parseSalePrice(priceStr: string): number {
  if (!priceStr) return 0;
  
  // Remove currency symbols, commas, spaces
  const cleaned = priceStr.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  
  return isNaN(num) ? 0 : num;
}

/**
 * Parse sale date string to ISO format (YYYY-MM-DD)
 * Handles formats like "12/1/2025", "12/01/2025"
 */
export function parseSaleDate(dateStr: string): string {
  if (!dateStr) return '';

  // MM/DD/YYYY format
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  return dateStr;
}

/**
 * Check if a sale appears to be from a specific date range
 */
export function isSaleInDateRange(
  saleDateStr: string,
  startDate: Date,
  endDate: Date
): boolean {
  const isoDate = parseSaleDate(saleDateStr);
  if (!isoDate) return false;

  const saleDate = new Date(isoDate);
  return saleDate >= startDate && saleDate <= endDate;
}

/**
 * Parse qualification code
 * A = ACCEPTED (qualified sale)
 * Other codes indicate unqualified sales
 */
export function isQualifiedSale(qualificationStr: string): boolean {
  const code = qualificationStr.trim().toUpperCase();
  return code.startsWith('A') || code.includes('ACCEPTED') || code.includes('QUALIFIED');
}

/**
 * Parse deed instrument type
 * WD = WARRANTY DEED
 * QCD = QUITCLAIM DEED
 * etc.
 */
export function parseDeedInstrument(instrumentStr: string): string {
  if (!instrumentStr) return '';
  
  // Extract the description after the code
  const match = instrumentStr.match(/^[A-Z]+\s*-\s*(.+)$/);
  if (match) {
    return match[1].trim();
  }
  
  return instrumentStr.trim();
}
