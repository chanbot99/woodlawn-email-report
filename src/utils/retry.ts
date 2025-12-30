/**
 * Retry utility with exponential backoff
 */

import { logger } from './logger.js';

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Optional function to determine if error is retryable */
  isRetryable?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay for a given attempt using exponential backoff with jitter
 */
export function calculateDelay(attempt: number, options: RetryOptions): number {
  const baseDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);
  // Add jitter (±20%)
  const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
  return Math.min(baseDelay + jitter, options.maxDelayMs);
}

/**
 * Execute a function with retry logic
 * 
 * @param fn - Async function to execute
 * @param options - Retry options
 * @param context - Optional context for logging
 * @returns Result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  context?: string
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      if (attempt >= opts.maxRetries) {
        break;
      }

      // Check if error is retryable
      if (opts.isRetryable && !opts.isRetryable(lastError)) {
        break;
      }

      const delay = calculateDelay(attempt, opts);
      logger.warn(`Attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms`, {
        context,
        error: lastError.message,
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Common retryable error checker for network/scraping errors
 */
export function isNetworkRetryable(error: Error): boolean {
  const retryableMessages = [
    'timeout',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'socket hang up',
    'network',
    'Navigation timeout',
    'Target closed',
    'Page closed',
  ];

  const message = error.message.toLowerCase();
  return retryableMessages.some((m) => message.includes(m.toLowerCase()));
}

/**
 * Create a rate-limited function wrapper
 */
export function createRateLimiter(delayMs: number): () => Promise<void> {
  let lastCall = 0;

  return async (): Promise<void> => {
    const now = Date.now();
    const elapsed = now - lastCall;
    
    if (elapsed < delayMs) {
      await sleep(delayMs - elapsed);
    }
    
    lastCall = Date.now();
  };
}

/**
 * Batch executor with concurrency control
 * Uses p-limit pattern but simpler implementation
 */
export async function batchExecute<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let completed = 0;
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];
      
      try {
        results[index] = await fn(item, index);
      } catch (error) {
        // Re-throw to be handled by caller
        throw error;
      }
      
      completed++;
      onProgress?.(completed, items.length);
    }
  }

  // Create worker pool
  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}

