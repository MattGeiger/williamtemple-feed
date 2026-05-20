import { BaseApiService } from '@/services/base';
import config from '@/config/config';

interface GlobalLimitResponse {
  success: boolean;
  data: {
    limit: number;
    timestamp?: string;
  };
}

export class GlobalLimitService extends BaseApiService {
  constructor() {
    super(config.api.endpoints.globalLimit);
  }

  /**
   * Get the current global limit
   * @returns Promise<number> Current global limit value
   */
  async getGlobalLimit(): Promise<number> {
    try {
      const response = await this.get<GlobalLimitResponse>();
      return response.data.limit;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update the global limit
   * @param limit - New limit value (1-100)
   * @returns Promise<number> Updated global limit value
   */
  async updateGlobalLimit(limit: number): Promise<number> {
    if (limit < 1 || limit > 100 || !Number.isInteger(limit)) {
      throw new Error('Limit must be a whole number between 1 and 100');
    }

    try {
      const response = await this.put<GlobalLimitResponse>('', { limit });
      return response.data.limit;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}