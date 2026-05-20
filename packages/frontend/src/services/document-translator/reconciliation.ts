import { BaseApiService } from '../base';

export interface ReconciliationResult {
  status: 'success' | 'partial' | 'failed';
  message?: string;
  actionsCount: number;
  actions: string[];
  issuesCount: number;
  issues: string[];
}

/**
 * Service for handling storage reconciliation operations
 */
class ReconciliationApiService extends BaseApiService {
  constructor() {
    super('/api/storage-reconciliation');
  }

  /**
   * Trigger a full storage reconciliation
   */
  async triggerFullReconciliation(): Promise<ReconciliationResult> {
    try {
      return await this.post<ReconciliationResult>('/full-scan', {});
    } catch (error) {
      console.error('Error triggering full reconciliation:', error);
      throw error;
    }
  }

  /**
   * Trigger reconciliation for a specific date range
   * @param startDate The start date in ISO format (YYYY-MM-DD)
   * @param endDate The end date in ISO format (YYYY-MM-DD), optional
   */
  async triggerDateRangeReconciliation(
    startDate: string,
    endDate?: string
  ): Promise<ReconciliationResult> {
    try {
      return await this.post<ReconciliationResult>('/date-range', {
        startDate,
        endDate
      });
    } catch (error) {
      console.error('Error triggering date range reconciliation:', error);
      throw error;
    }
  }
}

export const ReconciliationService = new ReconciliationApiService();
