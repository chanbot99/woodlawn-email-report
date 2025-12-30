/**
 * Structured logging using Winston
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Custom log format for console output
 */
const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  
  // Add metadata if present
  if (Object.keys(meta).length > 0 && !meta.stack) {
    log += ` ${JSON.stringify(meta)}`;
  }
  
  // Add stack trace for errors
  if (meta.stack) {
    log += `\n${meta.stack}`;
  }
  
  return log;
});

/**
 * Create the logger instance
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  ),
  transports: [
    // Console transport with colors
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        consoleFormat,
      ),
    }),
  ],
});

/**
 * Add file transport if LOG_FILE is set
 */
if (process.env.LOG_FILE) {
  logger.add(
    new winston.transports.File({
      filename: process.env.LOG_FILE,
      format: combine(
        timestamp(),
        winston.format.json(),
      ),
    })
  );
}

/**
 * Log an extraction start event
 */
export function logExtractionStart(dateRange: string, county: string): void {
  logger.info('Starting extraction', { dateRange, county });
}

/**
 * Log search results
 */
export function logSearchResults(count: number, pages: number): void {
  logger.info('Search completed', { recordCount: count, pageCount: pages });
}

/**
 * Log parcel processing progress
 */
export function logParcelProgress(current: number, total: number): void {
  const percent = Math.round((current / total) * 100);
  logger.info(`Processing parcels: ${current}/${total} (${percent}%)`);
}

/**
 * Log filtering results
 */
export function logFilteringResults(before: number, after: number, reasons: Record<string, number>): void {
  logger.info('Filtering completed', { 
    before, 
    after, 
    removed: before - after,
    reasons,
  });
}

/**
 * Log output file creation
 */
export function logOutputFile(type: string, path: string, recordCount: number): void {
  logger.info(`Output file created`, { type, path, recordCount });
}

/**
 * Log email sent
 */
export function logEmailSent(to: string, recordCount: number): void {
  logger.info('Email report sent', { to, recordCount });
}

/**
 * Log an error with context
 */
export function logError(message: string, error: Error, context?: Record<string, unknown>): void {
  logger.error(message, { 
    error: error.message, 
    stack: error.stack,
    ...context,
  });
}

/**
 * Log a warning
 */
export function logWarning(message: string, context?: Record<string, unknown>): void {
  logger.warn(message, context);
}

/**
 * Log a debug message
 */
export function logDebug(message: string, context?: Record<string, unknown>): void {
  logger.debug(message, context);
}

export default logger;

