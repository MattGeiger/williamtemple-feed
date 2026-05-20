export type LimitType = 'person' | 'household';

export interface Category {
  id: number;
  name: string;
  limit: number;
  limitType: LimitType;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryValidation {
  MIN_LENGTH: number;  // 3 characters
  MAX_LENGTH: number;  // 36 characters
  MIN_LIMIT: number;  // 1
  MAX_LIMIT: number;  // 100
}

export interface StatusMessage {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  details?: string[];
  retryable?: boolean;
}

export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: string[];
}

export interface BulkDeleteResult {
  message: string;
  result: {
    success: {
      count: number;
      names: string[];
    };
    failure: {
      count: number;
      categories: Array<{
        name: string;
        itemCount: number;
      }>;
    };
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    details?: string[];
    code?: string;
  };
}

// Constants for validation
export const CATEGORY_VALIDATION: CategoryValidation = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 36,
  MIN_LIMIT: 1,
  MAX_LIMIT: 100,
} as const;