import { GENERATION_POLICY } from '../config/generationPolicy.js';

export interface RetryAssessment {
  isRetryable: boolean;
  errorCode: string;
  delayMs: number;
  reason: string;
}

export class RetryEngine {
  /**
   * Evaluates an error to determine if it should be retried and computes backoff delay.
   */
  public evaluate(error: any, currentAttempt: number): RetryAssessment {
    const errorMsg = String(error?.message || error || '').toLowerCase();
    const statusCode = error?.status || error?.statusCode || error?.response?.status || 0;

    let isRetryable = false;
    let errorCode = 'UNKNOWN_ERROR';
    let reason = 'Non-retryable error';

    // 1. Quota & Rate Limit errors (HTTP 429 / RESOURCE_EXHAUSTED)
    if (statusCode === 429 || errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('resource_exhausted')) {
      isRetryable = true;
      errorCode = 'RATE_LIMITED';
      reason = 'Provider rate limit or quota reached. Backing off.';
    }
    // 2. Timeout errors (HTTP 408 / ETIMEDOUT / ECONNRESET)
    else if (
      statusCode === 408 ||
      statusCode === 504 ||
      errorMsg.includes('timeout') ||
      errorMsg.includes('etimedout') ||
      errorMsg.includes('econnreset') ||
      errorMsg.includes('socket hang up')
    ) {
      isRetryable = true;
      errorCode = 'NETWORK_TIMEOUT';
      reason = 'Network or provider timeout.';
    }
    // 3. Transient server errors (HTTP 500, 502, 503)
    else if (statusCode === 500 || statusCode === 502 || statusCode === 503 || errorMsg.includes('internal error') || errorMsg.includes('service unavailable')) {
      isRetryable = true;
      errorCode = 'PROVIDER_UNAVAILABLE';
      reason = 'Temporary provider service failure.';
    }
    // 4. Fatal / Non-retryable errors
    else if (
      statusCode === 400 ||
      statusCode === 401 ||
      statusCode === 403 ||
      errorMsg.includes('missing_credentials') ||
      errorMsg.includes('invalid_api_key') ||
      errorMsg.includes('safety') ||
      errorMsg.includes('policy')
    ) {
      isRetryable = false;
      errorCode = errorMsg.includes('missing_credentials') ? 'MISSING_CREDENTIALS' : 'INVALID_REQUEST';
      reason = 'Fatal client or configuration error.';
    }

    // Check maximum attempt threshold
    if (currentAttempt >= GENERATION_POLICY.RETRY.MAX_JOB_ATTEMPTS) {
      isRetryable = false;
      reason = `Exceeded max retry attempts (${GENERATION_POLICY.RETRY.MAX_JOB_ATTEMPTS}).`;
    }

    // Calculate Exponential Backoff with Jitter
    const baseDelay = GENERATION_POLICY.RETRY.BASE_DELAY_MS;
    const maxDelay = GENERATION_POLICY.RETRY.MAX_DELAY_MS;
    const jitterRatio = GENERATION_POLICY.RETRY.JITTER_RATIO;

    const rawExponential = Math.min(maxDelay, baseDelay * Math.pow(2, currentAttempt - 1));
    const jitterMagnitude = rawExponential * jitterRatio;
    const jitter = (Math.random() * 2 - 1) * jitterMagnitude;
    const delayMs = Math.max(1000, Math.round(rawExponential + jitter));

    return {
      isRetryable,
      errorCode,
      delayMs: isRetryable ? delayMs : 0,
      reason,
    };
  }
}

export const retryEngine = new RetryEngine();
