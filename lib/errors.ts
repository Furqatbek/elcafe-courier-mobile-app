/**
 * Error handling utilities for the Courier App
 */

import logger from '@/lib/logger';

// Custom error classes
export class AppError extends Error {
  code: string;
  statusCode?: number;

  constructor(message: string, code: string, statusCode?: number) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class NetworkError extends AppError {
  constructor(message: string = 'Network connection failed. Please check your internet connection.') {
    super(message, 'NETWORK_ERROR', 0);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed. Please log in again.') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends AppError {
  fields: Record<string, string>;

  constructor(message: string, fields: Record<string, string> = {}) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ServerError extends AppError {
  constructor(message: string = 'An unexpected server error occurred. Please try again later.') {
    super(message, 'SERVER_ERROR', 500);
    this.name = 'ServerError';
  }
}

// Error code constants
export const ErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN',
} as const;

// User-friendly error messages
export const ErrorMessages: Record<string, string> = {
  [ErrorCodes.NETWORK_ERROR]: 'Please check your internet connection and try again.',
  [ErrorCodes.AUTH_ERROR]: 'Your session has expired. Please log in again.',
  [ErrorCodes.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ErrorCodes.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCodes.SERVER_ERROR]: 'Something went wrong on our end. Please try again later.',
  [ErrorCodes.PERMISSION_DENIED]: 'You do not have permission to perform this action.',
  [ErrorCodes.TIMEOUT]: 'The request timed out. Please try again.',
  [ErrorCodes.UNKNOWN]: 'An unexpected error occurred. Please try again.',
};

// Parse API error response
export const parseApiError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof TypeError && error.message.includes('Network')) {
    return new NetworkError();
  }

  if (error instanceof Error) {
    // Check for fetch errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return new NetworkError();
    }

    return new AppError(error.message, ErrorCodes.UNKNOWN);
  }

  // Handle API response errors
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;

    if (err.status === 401 || err.statusCode === 401) {
      return new AuthenticationError(err.message as string);
    }

    if (err.status === 404 || err.statusCode === 404) {
      return new NotFoundError();
    }

    if (err.status === 400 || err.statusCode === 400) {
      return new ValidationError(
        (err.message as string) || 'Validation failed',
        (err.errors as Record<string, string>) || {}
      );
    }

    if ((err.status as number) >= 500 || (err.statusCode as number) >= 500) {
      return new ServerError(err.message as string);
    }

    if (err.message) {
      return new AppError(err.message as string, ErrorCodes.UNKNOWN);
    }
  }

  return new AppError('An unexpected error occurred', ErrorCodes.UNKNOWN);
};

// Get user-friendly error message
export const getErrorMessage = (error: unknown): string => {
  const appError = parseApiError(error);
  return ErrorMessages[appError.code] || appError.message;
};

// Log error for debugging (can be extended to send to error tracking service)
export const logError = (error: unknown, context?: Record<string, unknown>): void => {
  const appError = parseApiError(error);

  logger.error('App Error:', {
    name: appError.name,
    code: appError.code,
    message: appError.message,
    statusCode: appError.statusCode,
    context,
    stack: appError.stack,
  });

  // TODO: Send to error tracking service (Sentry, Bugsnag, etc.)
};

// Retry utility for failed operations
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry on authentication or validation errors
      const appError = parseApiError(error);
      if (appError instanceof AuthenticationError || appError instanceof ValidationError) {
        throw appError;
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  throw lastError;
};
