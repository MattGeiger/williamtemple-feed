// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { useCallback, useEffect, useState } from 'react';

import type { CatalogueModel } from '@/components/ai-configuration/types';
import { AIConfigService } from '@/services/ai-config';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';

const aiConfigService = new AIConfigService();

/**
 * The models an administrator may choose, from the server rather than from a
 * second copy of the list (ISSUES.md #84).
 *
 * Deliberately never blocks its caller. `ServiceStep` renders inside the
 * configuration wizard, and the dialog's own tests click straight through the
 * service step to reach later ones — so a catalogue that has not arrived, or
 * cannot be fetched at all, must leave the step usable and its Custom fields
 * reachable rather than gating navigation on a network round trip. An empty
 * list is a valid state, not an error state.
 */
export function useModelCatalogue() {
  const [models, setModels] = useState<CatalogueModel[]>([]);
  const [endpoints, setEndpoints] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchCatalogue = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await aiConfigService.getModels();
      setModels(data?.models ?? []);
      setEndpoints(data?.endpoints ?? {});
    } catch (err) {
      ErrorHandlerService.handleError(err, 'fetchModelCatalogue');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalogue();
  }, [fetchCatalogue]);

  return {
    models,
    endpoints,
    isLoading,
    refresh: fetchCatalogue
  };
}
