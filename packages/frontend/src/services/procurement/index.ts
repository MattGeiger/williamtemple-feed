// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { BaseApiService } from '@/services/base';
import type {
  DetectedImportResult,
  ProcurementDataStatus,
  ProcurementAnalytics,
  ProcurementAnalyticsFilters,
  ProcurementImportRecord,
} from '@/types/procurement';

class ProcurementApiService extends BaseApiService {
  constructor() {
    super('/api/procurement');
  }

  async getImports(): Promise<ProcurementImportRecord[]> {
    const response = await this.get<{ imports: ProcurementImportRecord[] }>('/imports');
    return response.imports;
  }

  async getStatus(): Promise<ProcurementDataStatus> {
    const response = await this.get<{ status: ProcurementDataStatus }>('/status');
    return response.status;
  }

  async getAnalytics(filters: ProcurementAnalyticsFilters = {}): Promise<ProcurementAnalytics> {
    const params = new URLSearchParams();
    if (filters.preset) params.set('preset', filters.preset);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.channel) params.set('channel', filters.channel);
    if (filters.acquisitionClass) params.set('acquisitionClass', filters.acquisitionClass);
    const query = params.size > 0 ? `?${params.toString()}` : '';
    const response = await this.get<{ analytics: ProcurementAnalytics }>(`/analytics${query}`);
    return response.analytics;
  }

  /**
   * FEED identifies which OFB export this is from its header row, so staff
   * never have to declare it. The result reports which one it recognized.
   */
  async importOfbExport(file: File): Promise<DetectedImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.requestFormData<{ result: DetectedImportResult }>(
      '/imports',
      formData
    );
    return response.result;
  }

  async rollbackImports(ids: number[]): Promise<number> {
    const response = await this.post<{ result: { updated: number } }>(
      '/imports/rollback',
      { ids }
    );
    return response.result.updated;
  }

  async restoreImports(ids: number[]): Promise<number> {
    const response = await this.post<{ result: { updated: number } }>(
      '/imports/restore',
      { ids }
    );
    return response.result.updated;
  }
}

export const procurementService = new ProcurementApiService();
