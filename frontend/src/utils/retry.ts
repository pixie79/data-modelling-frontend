/**
 * Retry logic with jitter-based exponential backoff
 * Implements retry with up to 5 attempts and jitter to prevent thundering herd
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  jitter?: boolean;
  onRetry?: (attempt: number, error: unknown) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 5,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  jitter: true,
  onRetry: () => {},
};

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = options.baseDelay * Math.pow(2, attempt);
  
  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, options.maxDelay);
  
  // Add jitter (random value between 0 and 50% of delay)
  if (options.jitter) {
    const jitterAmount = cappedDelay * 0.5 * Math.random();
    return cappedDelay + jitterAmount;
  }
  
  return cappedDelay;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff and jitter
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on last attempt
      if (attempt === opts.maxRetries) {
        break;
      }

      // Call onRetry callback
      opts.onRetry(attempt + 1, error);

      // Calculate delay and wait
      const delay = calculateDelay(attempt, opts);
      await sleep(delay);
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Retry with specific error type checking
 */
export async function retryOnError<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (!shouldRetry(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === opts.maxRetries) {
        break;
      }

      // Call onRetry callback
      opts.onRetry(attempt + 1, error);

      // Calculate delay and wait
      const delay = calculateDelay(attempt, opts);
      await sleep(delay);
    }
  }

  // All retries exhausted
  throw lastError;
}

