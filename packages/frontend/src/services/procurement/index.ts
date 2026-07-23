// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { BaseApiService } from '@/services/base';
import type {
  ProcurementDataStatus,
  ProcurementAnalytics,
  ProcurementAnalyticsFilters,
  ProcurementImportRecord,
  UnifiedImportResult,
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

  /** FEED accepts the unified OFB export -- one file covering Warehouse
   *  Completed orders plus Fresh Alliance Pending and Completed pickups. */
  async importOfbExport(file: File): Promise<UnifiedImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.requestFormData<{ result: UnifiedImportResult }>(
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
