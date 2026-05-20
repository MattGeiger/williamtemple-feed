// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

// @vitest-environment jsdom
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditAIModelDialog } from '@/components/ai-configuration/EditAIModelDialog';
import type { AIConfiguration } from '@/components/ai-configuration/types';

vi.mock('@/hooks/message/useMessage', () => ({
  useMessage: () => ({
    showMessage: vi.fn(),
    showError: vi.fn()
  })
}));

describe('EditAIModelDialog', () => {
  test('preserves cost inputs across parent re-renders', () => {
    const config: AIConfiguration = {
      id: 1,
      name: 'Gemini Test',
      type: 'apikey',
      value: '',
      description: 'Test config',
      isActive: true,
      createdAt: '2025-12-24T00:00:00.000Z',
      updatedAt: '2025-12-24T00:00:00.000Z',
      serviceType: 'Google',
      model: 'gemini-2.5-flash-lite',
      modelName: 'gemini-2.5-flash-lite',
      endpointUrl: 'https://generativelanguage.googleapis.com',
      inputCost: null,
      outputCost: null,
      unitPrice: 'per_1m',
      temperature: 0.7,
      topP: 1,
      maxTokens: null,
      tokensPerMinute: null,
      requestsPerMinute: null,
      requestsPerDay: null
    };

    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleOpenChange = vi.fn();

    const { rerender } = render(
      <EditAIModelDialog
        open
        configuration={config}
        onOpenChange={handleOpenChange}
        onSave={handleSave}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    const inputRate = screen.getByLabelText('Input Rate') as HTMLInputElement;
    const outputRate = screen.getByLabelText('Output Rate') as HTMLInputElement;

    fireEvent.change(inputRate, { target: { value: '0.1' } });
    fireEvent.change(outputRate, { target: { value: '0.4' } });

    expect(inputRate.value).toBe('0.1');
    expect(outputRate.value).toBe('0.4');

    rerender(
      <EditAIModelDialog
        open
        configuration={config}
        onOpenChange={handleOpenChange}
        onSave={handleSave}
        isLoading
      />
    );

    const inputRateAfter = screen.getByLabelText('Input Rate') as HTMLInputElement;
    const outputRateAfter = screen.getByLabelText('Output Rate') as HTMLInputElement;

    expect(inputRateAfter.value).toBe('0.1');
    expect(outputRateAfter.value).toBe('0.4');
  });
});
