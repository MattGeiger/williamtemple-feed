// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import React from 'react'
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Key } from "@/components/ui/icons";
import { StepWrapper } from '../shared/StepWrapper'
import { ApiKeyStepProps } from '../shared/types'
import { useMessage } from '@/hooks/message/useMessage'
import { validateApiKeyForService } from '../shared/validation'

export function ApiKeyStep({
  mode,
  data,
  onChange,
  isLoading = false,
  validation,
  onBlur
}: ApiKeyStepProps) {
  const { showMessage } = useMessage()
  const warnedRef = React.useRef(false)

  const handleApiKeyBlur = () => {
    onBlur?.('apiKey', 'apikey')
    // Provider-aware soft validation: warn but do not block
    const result = validateApiKeyForService(data.apiKey, data.serviceType)
    if (result.warning && !warnedRef.current) {
      showMessage(result.warning, 'warning')
      warnedRef.current = true
    }
  }
  return (
    <StepWrapper 
      icon={Key} 
      title="API Key" 
      description={mode === 'add' ? 'Enter your API credentials and endpoint URL' : 'API credentials (already configured)'}
    >
      <div className="space-y-2">
        <Label htmlFor="apiKey">API Key</Label>
        {mode === 'add' ? (
          <>
            <Input
              id="apiKey"
              type="password"
              autoComplete="new-password"
              value={data.apiKey}
              onChange={(e) => onChange({ apiKey: e.target.value })}
              onBlur={handleApiKeyBlur}
              placeholder="Enter your API key (e.g., sk-am1RLw7XUWGXGUBaSg...)"
              disabled={isLoading}
              className={`${validation?.showValidation && validation?.errors?.apiKey ? 'border-destructive' : ''}`}
            />
            <p className="text-xs text-muted-foreground">
              API keys are encrypted and never displayed. Required for API access.
            </p>
          </>
        ) : (
          <>
            <Input
              type="password"
              value="••••••••••••••••"
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              API key is encrypted and cannot be viewed. Create a new configuration to change the API key.
            </p>
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="endpointUrl">Endpoint URL {mode === 'add' ? '(Optional)' : ''}</Label>
        {mode === 'add' ? (
          <>
            <Input
              id="endpointUrl"
              value={data.endpointUrl}
              onChange={(e) => onChange({ endpointUrl: e.target.value })}
              onBlur={() => onBlur?.('endpointUrl', 'url')}
              placeholder="Custom endpoint URL (leave empty for service default)"
              disabled={isLoading}
              className={`${validation?.showValidation && validation?.errors?.endpointUrl ? 'border-destructive' : ''}`}
            />
            <p className="text-xs text-muted-foreground">
              Uses service default if empty. Must be a valid URL if provided.
            </p>
          </>
        ) : (
          <>
            <Input
              value={data.endpointUrl || 'Using service default'}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Endpoint URL cannot be changed when editing.
            </p>
          </>
        )}
      </div>

      {mode === 'edit' && (
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Active Status</Label>
            <p className="text-sm text-muted-foreground">
              Enable or disable this configuration
            </p>
          </div>
          <Switch
            checked={data.isActive || false}
            onCheckedChange={(checked) => onChange({ isActive: checked })}
            disabled={isLoading}
          />
        </div>
      )}
    </StepWrapper>
  )
}
