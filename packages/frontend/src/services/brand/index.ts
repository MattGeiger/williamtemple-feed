// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { BaseApiService } from '@/services/base';
import type { BrandAssetReference, BrandConfigurationPayload } from '@/contexts/BrandContext';

export type BrandConfigurationRow = {
  id: string;
  payload: BrandConfigurationPayload;
  isActive: boolean;
  isTemplate: boolean;
  updatedAt: string;
};

export type BrandPreview = {
  families: {
    accent: string; darkAccent: string; secondary: string; neutral: string;
    mudEscapedFrom: string | null;
  };
  alternates: { family: string; stop: number; distance: number; color: string }[];
  tokens: Record<'light' | 'dark', Record<string, string>>;
  chartOrder: string[];
  chartColors: Record<'light' | 'dark', string[]>;
};

class BrandService extends BaseApiService {
  constructor() {
    super('/api');
  }

  async list() {
    return this.request<{ configurations: BrandConfigurationRow[]; activeId: string | null }>('/admin/brand');
  }

  async save(id: string, payload: BrandConfigurationPayload, activate: boolean) {
    return this.request<{ configuration: BrandConfigurationRow }>(`/admin/brand/${encodeURIComponent(id)}`, {
      method: 'PUT', body: JSON.stringify({ payload, activate }),
    });
  }

  async preview(payload: BrandConfigurationPayload) {
    return this.request<{ preview: BrandPreview }>('/admin/brand/preview', {
      method: 'POST', body: JSON.stringify({ payload }),
    });
  }

  async activate(id: string) {
    return this.request(`/admin/brand/activate/${encodeURIComponent(id)}`, { method: 'POST' });
  }

  async deactivate() {
    return this.request('/admin/brand/deactivate', { method: 'POST' });
  }

  async remove(id: string) {
    return this.request(`/admin/brand/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async upload(kind: 'logo-light' | 'logo-dark' | 'square', file: File): Promise<{
    asset: BrandAssetReference;
    derivatives: BrandAssetReference[];
  }> {
    const form = new FormData();
    form.set('kind', kind);
    form.set('file', file);
    return this.requestFormData<{
      asset: BrandAssetReference;
      derivatives: BrandAssetReference[];
    }>('/admin/brand/assets', form);
  }
}

export const brandService = new BrandService();
