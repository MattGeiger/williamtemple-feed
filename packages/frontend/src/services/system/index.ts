import { BaseApiService } from '@/services/base';
import config from '@/config/config';

export interface SystemStartupStatus {
  isStartupCondition: boolean;
  hasFoundationalData: boolean;
  hasUsageData: boolean;
  foundationalDataCounts: {
    categories: number;
    foodItems: number;
    languages: number;
  };
  usageDataCounts: {
    apiUsageLogs: number;
    usageRecords: number;
  };
  systemState: 'startup' | 'operational' | 'error';
  description: string;
}

/**
 * Service for checking system startup status
 */
export class SystemStatusService extends BaseApiService {
  constructor() {
    super('/api/system');
  }

  /**
   * Get system startup status to distinguish between startup conditions and actual errors
   */
  async getStartupStatus(): Promise<SystemStartupStatus> {
    return await this.get<SystemStartupStatus>('/startup-status');
  }
}

export const systemStatusService = new SystemStatusService();
