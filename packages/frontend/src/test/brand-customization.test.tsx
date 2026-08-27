// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppearanceWizard } from '@/components/settings/customization/appearance-wizard';
import type { BrandConfigurationPayload } from '@/contexts/BrandContext';

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  preview: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('@/services/brand', () => ({
  brandService: mocks,
}));

const config: BrandConfigurationPayload = {
  schemaVersion: 1,
  identity: {
    organizationName: 'Example Pantry', appName: 'FEED',
    tagline: 'Food with dignity', description: 'Shared pantry operations.',
    organizationWebsite: 'https://example.org/',
  },
  logo: {
    light: { kind: 'builtin', src: '/brand/st-johns-template-mark.svg', width: 640, height: 220 },
    dark: { kind: 'builtin', src: '/brand/st-johns-template-mark.svg', width: 640, height: 220 },
  },
  colors: {
    accent: { l: 0.6, c: 0.15, h: 160 },
    hierarchy: [{ l: 0.6, c: 0.15, h: 160 }],
  },
  staff: {
    signInTitle: 'Sign in to Example Pantry',
    emailGuidance: 'Use your authorized work email',
    emailPlaceholder: 'you@example.org',
  },
  capabilities: { publicInventory: true },
};

describe('Appearance wizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.save.mockResolvedValue({ configuration: { id: 'example-pantry' } });
    mocks.preview.mockResolvedValue({
      preview: {
        families: { accent: 'emerald', darkAccent: 'emerald', secondary: 'zinc', neutral: 'zinc', mudEscapedFrom: null },
        alternates: [
          { family: 'emerald', stop: 600, distance: 0.01, color: '#059669' },
          { family: 'teal', stop: 600, distance: 0.02, color: '#0d9488' },
          { family: 'green', stop: 600, distance: 0.03, color: '#16a34a' },
        ],
        tokens: {
          light: { background: '#fff', foreground: '#111', card: '#fff', 'card-foreground': '#111', border: '#ddd', primary: '#047857', 'primary-foreground': '#fff' },
          dark: { background: '#111', foreground: '#fff', card: '#222', 'card-foreground': '#fff', border: '#555', primary: '#6ee7b7', 'primary-foreground': '#111' },
        },
        chartOrder: ['teal'],
        chartColors: { light: ['#007d79', '#d02670', '#ba4e00', '#8a3ffc', '#0f62fe'], dark: ['#3ddbd9', '#ff7eb6', '#ff832b', '#be95ff', '#78a9ff'] },
      },
    });
  });

  it('uses the required six-step order and offers draft or activation at review', async () => {
    render(
      <AppearanceWizard
        open
        onOpenChange={vi.fn()}
        templates={[{ id: 'template-example', name: 'Start from Example', description: 'Complete example.', config }]}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Set up your appearance' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Start from Example/ }));
    fireEvent.change(screen.getByLabelText('Configuration name'), { target: { value: 'example-pantry' } });

    const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    next();
    expect(screen.getByRole('heading', { name: 'Organization identity' })).toBeInTheDocument();
    next();
    expect(screen.getByRole('heading', { name: 'Logos & app mark' })).toBeInTheDocument();
    next();
    expect(screen.getByRole('heading', { name: 'Brand color story' })).toBeInTheDocument();
    await waitFor(() => expect(mocks.preview).toHaveBeenCalled());
    next();
    expect(screen.getByRole('heading', { name: 'Staff sign-in copy' })).toBeInTheDocument();
    next();
    // No Capabilities step: whether the public inventory page is served is a
    // deployment capability rather than brand identity, and its control belongs
    // with the other administrator data-sharing settings in Data Management.
    expect(screen.queryByRole('heading', { name: 'Capabilities' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Review & save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save & activate' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('example-pantry', expect.objectContaining({ identity: expect.objectContaining({ organizationName: 'Example Pantry' }) }), false));
  });
});

