/**
 * Centralized DOM selectors for TPAD (Tennessee Property Assessment Data) website
 * 
 * Updated for the new TPAD interface (2024+)
 * 
 * If the site structure changes, update selectors here in one place.
 * 
 * TPAD URL: https://assessment.cot.tn.gov/TPAD
 */

export const TPAD_BASE_URL = 'https://assessment.cot.tn.gov/TPAD';

/**
 * Selectors for the TPAD search page (new interface)
 */
export const SELECTORS = {
  // Main search page elements
  search: {
    // County dropdown (uses county name, not code)
    countyDropdown: '#countySelect',
    // Property classification dropdown (in Advanced Search)
    classificationDropdown: '#classSelect',
    // Sale date range inputs (in Advanced Search)
    saleDateStart: '#saleDateRangeStartSelect',
    saleDateEnd: '#saleDateRangeEndSelect',
    // Owner name input
    ownerInput: '#ownerSelect',
    // Property address input
    propertyAddressInput: '#propertyAddressSelect',
    // Search buttons (there are two - basic and advanced)
    searchButton: 'button.searchButton',
    basicSearchButton: 'button.basic-search-btn',
    advancedSearchButton: 'button.searchButton:not(.basic-search-btn)',
    // Advanced search toggle (accordion button)
    advancedSearchToggle: '.basicSearchAdvSearchBtn, button.accordion-button:has-text("Advanced Search")',
    // Advanced search accordion section
    advancedSearchSection: '#advancedSearch',
    // Reset button
    resetButton: '#advancedSearchResetButton',
  },

  // Results display
  results: {
    // Results container
    container: '.search-results, .results-container, #searchResults',
    // Result cards/rows
    resultCards: '.property-card, .result-item, .search-result',
    // Result links (parcel detail links)
    parcelLinks: 'a[href*="parcel"], a[href*="Parcel"]',
    // No results message
    noResultsMessage: '.no-results, .empty-results',
    // Result count display
    resultCount: '.result-count, .results-count',
    // Pagination controls
    pagination: {
      container: '.pagination, nav[aria-label="pagination"]',
      nextButton: '.page-link:has-text("Next"), .next-page, a:has-text(">")',
      prevButton: '.page-link:has-text("Previous"), .prev-page, a:has-text("<")',
      pageNumbers: '.page-link[data-page], .page-number',
      currentPage: '.page-item.active .page-link, .current-page',
    },
    // Loading indicator
    loadingSpinner: '.loading, .spinner, .loader',
  },

  // Parcel details page
  parcelDetails: {
    // Header info
    parcelId: '.parcel-id, #parcelId, [data-field="parcelId"]',
    ownerName: '.owner-name, #ownerName, [data-field="ownerName"]',
    ownerAddress: '.owner-address, .mailing-address, [data-field="mailingAddress"]',
    propertyAddress: '.property-address, .situs-address, [data-field="propertyAddress"]',
    
    // Property details
    classification: '.classification, [data-field="classification"]',
    landUse: '.land-use, [data-field="landUse"]',
    assessedValue: '.assessed-value, [data-field="assessedValue"]',
    acreage: '.acreage, [data-field="acreage"]',
    
    // Sales history section
    salesSection: '.sales-history, #salesHistory, .sale-information',
    salesTable: '.sales-table, table.sales',
    salesRows: '.sales-table tbody tr, .sale-row',
    
    // Sale record fields (typically in table columns or data attributes)
    saleDate: '.sale-date, [data-field="saleDate"]',
    salePrice: '.sale-price, [data-field="salePrice"]',
    deedType: '.deed-type, .instrument, [data-field="deedType"]',
    grantor: '.grantor, [data-field="grantor"]',
    grantee: '.grantee, [data-field="grantee"]',
    qualified: '.qualified, [data-field="qualified"]',
    bookPage: '.book-page, [data-field="bookPage"]',
  },

  // Common elements
  common: {
    loadingOverlay: '.loading-overlay, .modal-backdrop',
    errorMessage: '.error-message, .alert-danger',
    successMessage: '.success-message, .alert-success',
  },
} as const;

/**
 * County names for Tennessee counties (for dropdown selection)
 * The new TPAD uses county names, not codes
 */
export const COUNTY_NAMES: Record<string, string> = {
  '001': 'Anderson',
  '002': 'Bedford',
  '003': 'Benton',
  '004': 'Bledsoe',
  '005': 'Blount',
  '006': 'Bradley',
  '007': 'Campbell',
  '008': 'Cannon',
  '009': 'Carroll',
  '010': 'Carter',
  '011': 'Cheatham',
  '012': 'Chester',
  '013': 'Claiborne',
  '014': 'Clay',
  '015': 'Cocke',
  '016': 'Coffee',
  '017': 'Crockett',
  '018': 'Cumberland',
  '019': 'Davidson',
  '020': 'Decatur',
  '021': 'DeKalb',
  '022': 'Dickson',
  '023': 'Dyer',
  '024': 'Fayette',
  '025': 'Fentress',
  '026': 'Franklin',
  '027': 'Gibson',
  '028': 'Giles',
  '029': 'Grainger',
  '030': 'Greene',
  '031': 'Grundy',
  '032': 'Hamblen',
  '033': 'Hamilton',
  '034': 'Hancock',
  '035': 'Hardeman',
  '036': 'Hardin',
  '037': 'Hawkins',
  '038': 'Haywood',
  '039': 'Henderson',
  '040': 'Henry',
  '041': 'Hickman',
  '042': 'Houston',
  '043': 'Humphreys',
  '044': 'Jackson',
  '045': 'Jefferson',
  '046': 'Johnson',
  '047': 'Knox',
  '048': 'Lake',
  '049': 'Lauderdale',
  '050': 'Lawrence',
  '051': 'Lewis',
  '052': 'Lincoln',
  '053': 'Loudon',
  '054': 'Macon',
  '055': 'Madison',
  '056': 'Marion',
  '057': 'Marshall',
  '058': 'Maury',
  '059': 'McMinn',
  '060': 'McNairy',
  '061': 'Meigs',
  '062': 'Monroe',
  '063': 'Montgomery',
  '064': 'Moore',
  '065': 'Morgan',
  '066': 'Obion',
  '067': 'Overton',
  '068': 'Perry',
  '069': 'Pickett',
  '070': 'Polk',
  '071': 'Putnam',
  '072': 'Rhea',
  '073': 'Roane',
  '074': 'Robertson',
  '075': 'Rutherford',
  '076': 'Scott',
  '077': 'Sequatchie',
  '078': 'Sevier',
  '079': 'Shelby',
  '080': 'Smith',
  '081': 'Stewart',
  '082': 'Sullivan',
  '083': 'Sumner',
  '084': 'Tipton',
  '085': 'Trousdale',
  '086': 'Unicoi',
  '087': 'Union',
  '088': 'Van Buren',
  '089': 'Warren',
  '090': 'Washington',
  '091': 'Wayne',
  '092': 'Weakley',
  '093': 'White',
  '094': 'Williamson',
  '095': 'Wilson',
};

/**
 * Get county name from code
 */
export function getCountyName(code: string): string {
  return COUNTY_NAMES[code] || code;
}

/**
 * Classification options (for dropdown selection)
 */
export const CLASSIFICATION_OPTIONS = {
  ALL: 'All Classifications',
  RESIDENTIAL: '00 - Residential',
  COUNTY: '01 - County',
  CITY: '02 - City',
  STATE: '03 - State',
} as const;

/**
 * For backward compatibility
 */
export const CLASSIFICATION_CODES = {
  RESIDENTIAL: '00',
  FARM: '01',
  COMMERCIAL: '02',
  INDUSTRIAL: '03',
  EXEMPT: '04',
  STATE_ASSESSED: '05',
} as const;

/**
 * Legacy county codes (kept for compatibility)
 */
export const COUNTY_CODES = COUNTY_NAMES;
