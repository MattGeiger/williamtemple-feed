// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import config from '@/config/config';
import { StatusMessage } from '@/types/category';

export interface ApiErrorResponse {
  message: string;
  details?: any;
  status?: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiErrorResponse;
}

/**
 * Error thrown by {@link BaseApiService.request} for non-2xx responses.
 *
 * Extends `Error` so every existing consumer that only reads `.message`
 * keeps working unchanged. The extra fields let callers branch on the
 * server's structured error payload -- e.g. the duplicate-food-item flow
 * reads `code === 'DUPLICATE_FOOD_ITEM_NAME'` and `details.existingItem`
 * to offer a "Mark In Stock" toast action.
 */
export class ApiError extends Error {
  /** HTTP status code of the failed response. */
  status: number;
  /** Machine-readable error code from the response body, when present. */
  code?: string;
  /** The full `error` object from the response body (message, code, ...). */
  details?: any;

  constructor(message: string, init: { status: number; code?: string; details?: any }) {
    super(message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    // Restore prototype chain for `instanceof` after TS down-compilation.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Extracts the suggested filename from an RFC 6266 `Content-Disposition`
 * header. Prefers the RFC 5987 `filename*=UTF-8''…` form, then the quoted
 * or bare `filename=` form. Returns null when absent or malformed.
 */
export function parseContentDispositionFilename(
  header: string | null
): string | null {
  if (!header) return null;
  const extended = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (extended) {
    try {
      return decodeURIComponent(extended[1].trim());
    } catch {
      // fall through to the plain form
    }
  }
  const plain = /filename=("([^"]*)"|[^;]+)/i.exec(header);
  if (plain) {
    return (plain[2] ?? plain[1]).trim();
  }
  return null;
}

/**
 * Base class for all API services providing common functionality
 */
export abstract class BaseApiService {
  protected baseUrl: string;
  private isDevelopment: boolean;

  constructor(endpoint: string) {
    this.baseUrl = `${config.api.baseUrl}${endpoint}`;
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  /**
   * Get headers for the request
   */
  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    return headers;
  }

  /**
   * Makes a GET request
   * @param path - The path to append to the base URL
   * @returns Promise resolving to the response data
   */
  protected async get<T>(path: string = ''): Promise<T> {
    return this.request<T>(path, {
      method: 'GET'
    });
  }

  /**
   * Makes a POST request
   * @param path - The path to append to the base URL
   * @param data - The data to send
   * @returns Promise resolving to the response data
   */
  protected async post<T>(path: string = '', data?: any): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Makes a PUT request
   * @param path - The path to append to the base URL
   * @param data - The data to send
   * @returns Promise resolving to the response data
   */
  protected async put<T>(path: string = '', data?: any): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Makes a DELETE request
   * @param path - The path to append to the base URL
   * @param data - Optional data to send with DELETE request
   * @returns Promise resolving to the response data
   */
  protected async delete<T>(path: string = '', data?: any): Promise<T> {
    return this.request<T>(path, {
      method: 'DELETE',
      ...(data ? { body: JSON.stringify(data) } : {})
    });
  }

  /**
   * Handles API errors consistently across all services
   * @param error - The error to handle
   * @returns A normalized error message
   */
  protected handleError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error('An unexpected error occurred');
  }

  /**
   * Logs errors only in development environment
   * @param message - Log message
   * @param data - Optional data to log
   */
  private logError(message: string, data?: unknown): void {
    if (this.isDevelopment) {
      console.error(`[API Error] ${message}`, data);
    }
  }

  /**
   * Parses error response from the API with comprehensive error handling
   * @param response - The fetch Response object
   * @returns Promise resolving to the error message
   */
  protected async parseErrorResponse(response: Response): Promise<string> {
    try {
      const contentType = response.headers.get('content-type');
      
      // Handle JSON responses
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        
        // Check for error field (backend standard)
        if (errorData && errorData.error) {
          // Handle string error messages directly
          if (typeof errorData.error === 'string') {
            return errorData.error;
          }
          // Handle nested error objects
          if (errorData.error.message) {
            return errorData.error.message;
          }
        }
        
        // Fallback to message field
        if (errorData && errorData.message) {
          return errorData.message;
        }
        
        // Return status text if no error message found in JSON
        return response.statusText || 'Unknown error';
      } else {
        // Handle non-JSON responses (text/html etc.)
        const errorText = await response.text();
        return errorText || response.statusText || 'Unknown error';
      }
    } catch (parseError) {
      this.logError('Failed to parse error response', parseError);
      return response.statusText || 'Unknown error';
    }
  }

  /**
   * Parses an error response into the message plus any structured fields
   * (`code`, full `error` object). Unlike {@link parseErrorResponse} this
   * preserves the server's machine-readable payload so callers can branch
   * on it. Reads the response body, so call at most once per response.
   */
  protected async parseErrorPayload(
    response: Response,
  ): Promise<{ message: string; code?: string; details?: any }> {
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        const errObj = errorData?.error;
        if (errObj && typeof errObj === 'object') {
          return {
            message: errObj.message || response.statusText || 'Unknown error',
            code: typeof errObj.code === 'string' ? errObj.code : undefined,
            details: errObj,
          };
        }
        if (typeof errObj === 'string') {
          return { message: errObj };
        }
        if (errorData && errorData.message) {
          return { message: errorData.message };
        }
        return { message: response.statusText || 'Unknown error' };
      }
      const errorText = await response.text();
      return { message: errorText || response.statusText || 'Unknown error' };
    } catch (parseError) {
      this.logError('Failed to parse error response', parseError);
      return { message: response.statusText || 'Unknown error' };
    }
  }

  /**
   * Makes an API request with consistent error handling
   * @param path - The path to append to the base URL
   * @param options - Request options
   * @returns Promise resolving to the response data
   */
  protected async request<T>(path: string = '', options?: RequestInit): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        credentials: options?.credentials ?? 'include',
        headers: {
          ...this.getHeaders(),
          ...(options?.headers ?? {}),
        },
      });

      // Handle 401 Unauthorized - redirect to login
      if (response.status === 401) {
        window.location.href = '/login';
        throw new Error('Your session has expired. Please log in again to continue.');
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      if (!response.ok) {
        const { message, code, details } = await this.parseErrorPayload(response);

        this.logError('Request failed', {
          status: response.status,
          url: `${this.baseUrl}${path}`,
          method: options?.method || 'GET',
          error: message
        });

        // ApiError extends Error, so consumers that only read `.message`
        // are unaffected; structured callers can read `.code` / `.details`.
        throw new ApiError(message, { status: response.status, code, details });
      }

      const data = await response.json();
      return data;
    } catch (error) {
      this.logError('Request failed', error);
      throw this.handleError(error);
    }
  }

  /**
   * Makes an authenticated request whose response body is binary (CSV,
   * ZIP, PDF). Shares the credential, 401-redirect, and structured
   * `ApiError` handling with `request`, and parses the server-suggested
   * filename from the RFC 6266 `Content-Disposition` header.
   *
   * Callers own the returned Blob's lifecycle: create an object URL,
   * trigger the download, then revoke the URL.
   */
  protected async requestBinary(
    path: string = '',
    options?: RequestInit
  ): Promise<{ blob: Blob; filename: string | null }> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        credentials: options?.credentials ?? 'include',
        headers: {
          ...this.getHeaders(),
          ...(options?.headers ?? {}),
        },
      });

      if (response.status === 401) {
        window.location.href = '/login';
        throw new Error('Your session has expired. Please log in again to continue.');
      }

      if (!response.ok) {
        const { message, code, details } = await this.parseErrorPayload(response);
        this.logError('Binary request failed', {
          status: response.status,
          url: `${this.baseUrl}${path}`,
          method: options?.method || 'GET',
          error: message
        });
        throw new ApiError(message, { status: response.status, code, details });
      }

      const blob = await response.blob();
      return {
        blob,
        filename: parseContentDispositionFilename(
          response.headers.get('Content-Disposition')
        ),
      };
    } catch (error) {
      this.logError('Binary request failed', error);
      throw this.handleError(error);
    }
  }

  /**
   * Makes a bulk delete request
   * @param ids - Array of IDs to delete
   * @returns Promise<void>
   */
  protected async bulkDelete(ids: number[]): Promise<void> {
    await this.request('/bulk', {
      method: 'DELETE',
      body: JSON.stringify({ ids })
    });
  }

  /**
   * Makes a single item delete request
   * @param id - ID of the item to delete
   * @returns Promise<void>
   */
  protected async deleteItem(id: number): Promise<void> {
    await this.request(`/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Converts an error to a status message
   * @param error - The error to convert
   * @param operation - The operation that failed
   * @returns StatusMessage object
   */
  /**
   * Maps common error messages to user-friendly versions following ASK principles
   * @param message Original error message
   * @returns User-friendly error message
   */
  protected getUserFriendlyErrorMessage(message: string): string {
    // Common error messages mapped to ASK-compliant versions
    const errorMap: Record<string, string> = {
      'Network Error': 'We couldn\'t connect to the server. Please check your internet connection and try again. If you\'re still having trouble, contact the administrator at github.com/MattGeiger',
      'Failed to fetch': 'We\'re having trouble reaching our servers. Please check your connection and try again. If this continues, contact the administrator at github.com/MattGeiger',
      'Authentication required': 'Your session has expired for security. Please log in again to continue.',
      'Request failed with status code 404': 'The information you\'re looking for couldn\'t be found. Please refresh the page and try again. If the problem continues, contact the administrator at github.com/MattGeiger',
      'Request failed with status code 500': 'We\'re experiencing technical difficulties on our end. Please try again in a few moments. If this continues, contact the administrator at github.com/MattGeiger',
      'Request failed with status code 400': 'There\'s an issue with the information provided. Please check your input and try again. If you need help, contact the administrator at github.com/MattGeiger',
      'Request failed with status code 403': 'You don\'t have permission to perform this action. If you believe this is an error, contact the administrator at github.com/MattGeiger',
      'Request timed out': 'The request is taking longer than expected. Please try again. If this keeps happening, contact the administrator at github.com/MattGeiger'
    };

    // Check for exact matches
    if (errorMap[message]) {
      return errorMap[message];
    }

    // Check for partial matches (like status codes)
    for (const [key, friendlyMessage] of Object.entries(errorMap)) {
      if (message.toLowerCase().includes(key.toLowerCase())) {
        return friendlyMessage;
      }
    }

    // Handle HTML error responses (like 404 pages)
    if (message.includes('<!DOCTYPE html>') || message.includes('<html>')) {
      if (message.includes('Cannot GET')) {
        return 'The page or feature you\'re trying to access isn\'t available right now. Please refresh and try again. If this continues, contact the administrator at github.com/MattGeiger';
      }
      return 'We encountered an unexpected server response. Please try again or contact the administrator at github.com/MattGeiger';
    }

    // If no mapping found, return original with contact info for critical errors
    if (message.toLowerCase().includes('error') || message.toLowerCase().includes('fail')) {
      return `${message}. If this problem continues, please contact the administrator at github.com/MattGeiger`;
    }

    return message;
  }

  protected errorToStatusMessage(error: Error, operation: string): StatusMessage {
    const friendlyMessage = this.getUserFriendlyErrorMessage(error.message);
    
    return {
      type: 'error',
      message: `We couldn't ${operation}: ${friendlyMessage}`
    };
  }
}
