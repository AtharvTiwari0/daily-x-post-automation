import { logger } from '../logger';

/**
 * Normalizes a URL to assist in deduplication.
 * Removes protocols, query parameters, anchors, and trailing slashes.
 */
export function normalizeUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    let host = url.hostname.replace('www.', '');
    let pathname = url.pathname;
    
    // Remove trailing slash
    if (pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    
    return `${host}${pathname}`.toLowerCase();
  } catch {
    // Return trimmed lowercase if parsing fails
    return urlStr.trim().toLowerCase().replace(/\/$/, '');
  }
}

/**
 * Delays execution for MS milliseconds.
 */
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retries an asynchronous operation up to maxAttempts times, with optional delay.
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delayMs?: number;
    backoffFactor?: number;
    label?: string;
  } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  let delayMs = options.delayMs ?? 1000;
  const backoffFactor = options.backoffFactor ?? 2;
  const label = options.label ?? 'Operation';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts) {
        logger.error(`${label} failed on final attempt ${attempt}/${maxAttempts}.`, error);
        throw error;
      }
      logger.warn(`${label} failed on attempt ${attempt}/${maxAttempts}. Retrying in ${delayMs}ms... Error: ${(error as Error).message}`);
      await sleep(delayMs);
      delayMs *= backoffFactor;
    }
  }
  throw new Error(`${label} failed after maximum retry attempts.`);
}

/**
 * Checks if a date is within the last 24 hours.
 */
export function isWithinLast24Hours(date: Date | string | number): boolean {
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  
  const diffMs = Date.now() - d.getTime();
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  
  // Accept items within 24 hours, and allow up to 1 hour in the future to account for clock skew
  return diffMs >= -3600000 && diffMs <= twentyFourHoursMs;
}
