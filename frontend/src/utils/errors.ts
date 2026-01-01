/**
 * Error handling utilities
 */

import type { ApiError } from '@/types/api';

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Convert API error to AppError
 */
export function handleApiError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (typeof error === 'object' && error !== null && 'response' in error) {
    const axiosError = error as { response?: { data?: ApiError; status?: number } };
    const apiError = axiosError.response?.data;
    const statusCode = axiosError.response?.status;

    if (apiError) {
      return new AppError(
        apiError.message || 'An error occurred',
        apiError.error,
        statusCode,
        apiError.details
      );
    }
  }

  if (error instanceof Error) {
    return new AppError(error.message);
  }

  return new AppError('An unknown error occurred');
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.statusCode === undefined || error.statusCode >= 500;
  }
  return false;
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.statusCode === 401 || error.statusCode === 403;
  }
  return false;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: unknown): string {
  const appError = handleApiError(error);

  // Map common error codes to user-friendly messages
  const friendlyMessages: Record<string, string> = {
    NETWORK_ERROR: 'Network error. Please check your connection and try again.',
    UNAUTHORIZED: 'You are not authorized to perform this action.',
    NOT_FOUND: 'The requested resource was not found.',
    VALIDATION_ERROR: 'Please check your input and try again.',
  };

  if (appError.code && appError.code in friendlyMessages) {
    const message = friendlyMessages[appError.code];
    if (message) {
      return message;
    }
  }

  return appError.message ?? 'An unexpected error occurred';
}
