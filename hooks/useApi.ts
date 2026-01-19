/**
 * useApi Hook
 * Provides API request handling with loading states, error handling, and toast notifications
 */

import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/Toast';
import { ApiRequestError, NetworkError, AuthenticationError } from '@/services/api';

interface UseApiOptions {
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  successMessage?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}

interface UseApiReturn<T, P extends any[]> extends UseApiState<T> {
  execute: (...args: P) => Promise<T | null>;
  reset: () => void;
}

export function useApi<T, P extends any[] = any[]>(
  apiFunction: (...args: P) => Promise<T>,
  options: UseApiOptions = {}
): UseApiReturn<T, P> {
  const { t } = useTranslation();
  const toast = useToast();
  const {
    showSuccessToast = false,
    showErrorToast = true,
    successMessage,
    onSuccess,
    onError,
  } = options;

  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const mountedRef = useRef(true);

  const getErrorMessage = useCallback(
    (error: Error): string => {
      if (error instanceof NetworkError) {
        return t('errors.network', 'Network error. Please check your connection.');
      }
      if (error instanceof AuthenticationError) {
        return t('errors.auth', 'Session expired. Please login again.');
      }
      if (error instanceof ApiRequestError) {
        // Try to get translated error message
        const errorKey = `errors.api.${error.code}`;
        const translated = t(errorKey, error.message);
        return translated !== errorKey ? translated : error.message;
      }
      return error.message || t('errors.unknown', 'An unexpected error occurred.');
    },
    [t]
  );

  const execute = useCallback(
    async (...args: P): Promise<T | null> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const data = await apiFunction(...args);

        if (mountedRef.current) {
          setState({ data, isLoading: false, error: null });

          if (showSuccessToast) {
            toast.success(successMessage || t('common.success', 'Success'));
          }

          onSuccess?.(data);
        }

        return data;
      } catch (error: any) {
        if (mountedRef.current) {
          setState({ data: null, isLoading: false, error });

          if (showErrorToast) {
            toast.error(getErrorMessage(error));
          }

          onError?.(error);
        }

        return null;
      }
    },
    [apiFunction, showSuccessToast, showErrorToast, successMessage, onSuccess, onError, toast, t, getErrorMessage]
  );

  const reset = useCallback(() => {
    setState({ data: null, isLoading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

/**
 * useApiMutation Hook
 * Similar to useApi but designed for mutation operations (POST, PUT, DELETE)
 */
export function useApiMutation<T, P extends any[] = any[]>(
  apiFunction: (...args: P) => Promise<T>,
  options: UseApiOptions = {}
): UseApiReturn<T, P> {
  return useApi(apiFunction, {
    showSuccessToast: true,
    showErrorToast: true,
    ...options,
  });
}

/**
 * useApiQuery Hook
 * Similar to useApi but designed for query operations (GET)
 */
export function useApiQuery<T, P extends any[] = any[]>(
  apiFunction: (...args: P) => Promise<T>,
  options: UseApiOptions = {}
): UseApiReturn<T, P> {
  return useApi(apiFunction, {
    showSuccessToast: false,
    showErrorToast: true,
    ...options,
  });
}

/**
 * Error message mapping for common API errors
 */
export const ERROR_MESSAGES: Record<number, string> = {
  400: 'errors.bad_request',
  401: 'errors.unauthorized',
  403: 'errors.forbidden',
  404: 'errors.not_found',
  409: 'errors.conflict',
  422: 'errors.validation',
  429: 'errors.rate_limit',
  500: 'errors.server',
  502: 'errors.bad_gateway',
  503: 'errors.service_unavailable',
};

export default useApi;
