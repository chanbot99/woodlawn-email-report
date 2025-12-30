/**
 * Playwright browser setup and management
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { logger } from '../utils/logger.js';
import type { ExtractorConfig } from '../types/index.js';

let browser: Browser | null = null;
let context: BrowserContext | null = null;

/**
 * Launch the browser if not already running
 */
export async function launchBrowser(config: ExtractorConfig): Promise<Browser> {
  if (browser) {
    return browser;
  }

  logger.info('Launching browser', { headless: config.headless });

  browser = await chromium.launch({
    headless: config.headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  return browser;
}

/**
 * Create a new browser context with common settings
 */
export async function createContext(config: ExtractorConfig): Promise<BrowserContext> {
  const b = await launchBrowser(config);
  
  context = await b.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/Chicago',
  });

  // Set default timeout
  context.setDefaultTimeout(30000);
  context.setDefaultNavigationTimeout(60000);

  return context;
}

/**
 * Create a new page in the context
 */
export async function createPage(config: ExtractorConfig): Promise<Page> {
  if (!context) {
    await createContext(config);
  }

  const page = await context!.newPage();

  // Block unnecessary resources to speed up loading
  await page.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    const blockedTypes = ['image', 'media', 'font'];
    
    if (blockedTypes.includes(resourceType)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  return page;
}

/**
 * Close all browser resources
 */
export async function closeBrowser(): Promise<void> {
  if (context) {
    await context.close();
    context = null;
  }
  
  if (browser) {
    await browser.close();
    browser = null;
  }

  logger.info('Browser closed');
}

/**
 * Wait for page to be stable (no network activity)
 */
export async function waitForStable(page: Page, timeout = 5000): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    // Timeout is acceptable - page might have persistent connections
    logger.debug('Network idle timeout - continuing');
  }
}

/**
 * Safe click with wait for navigation if needed
 */
export async function safeClick(
  page: Page,
  selector: string,
  options: { waitForNavigation?: boolean; timeout?: number } = {}
): Promise<void> {
  const { waitForNavigation = false, timeout = 10000 } = options;

  await page.waitForSelector(selector, { state: 'visible', timeout });

  if (waitForNavigation) {
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.click(selector),
    ]);
  } else {
    await page.click(selector);
  }
}

/**
 * Safe fill with clearing existing value first
 */
export async function safeFill(
  page: Page,
  selector: string,
  value: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 10000 } = options;

  await page.waitForSelector(selector, { state: 'visible', timeout });
  await page.fill(selector, ''); // Clear first
  await page.fill(selector, value);
}

/**
 * Safe select option from dropdown
 */
export async function safeSelect(
  page: Page,
  selector: string,
  value: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 10000 } = options;

  await page.waitForSelector(selector, { state: 'visible', timeout });
  await page.selectOption(selector, value);
}

/**
 * Take a screenshot for debugging
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  try {
    await page.screenshot({ 
      path: `debug_${name}_${Date.now()}.png`,
      fullPage: true,
    });
  } catch (error) {
    logger.warn('Failed to take screenshot', { name, error: (error as Error).message });
  }
}

