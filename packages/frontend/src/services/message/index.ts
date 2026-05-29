// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { ToastAction } from '@/components/ui/toast'
import { toast } from '@/components/ui/use-toast'
import React from 'react'
import type { MessageType, MessageOptions } from './types'
import { computeMessageDuration, DEFAULT_TITLES, VARIANT_MAPPINGS } from './types'

class MessageService {
  private show(message: string, type: MessageType, options?: MessageOptions) {
    // Length-aware default (ISSUES.md #44): scale the on-screen time with how
    // much there is to read. An explicit options.duration still wins.
    const duration = options?.duration ?? computeMessageDuration(message)
    const title = DEFAULT_TITLES[type]

    // Forward reference to the toast's dismiss(), populated below. Clicking an
    // embedded action button runs the user's handler and then closes the toast
    // (ISSUES.md #44: action clicks are an explicit close, like the X button).
    let dismissToast: (() => void) | undefined
    const actionComponent = options?.action ? React.createElement(
      ToastAction,
      {
        altText: options.action.label,
        onClick: () => {
          options.action!.onClick()
          dismissToast?.()
        }
      },
      options.action.label
    ) : undefined

    const handle = toast({
      title,
      description: message,
      variant: VARIANT_MAPPINGS[type],
      duration: options?.persist ? null : duration,
      action: actionComponent
    })
    dismissToast = handle.dismiss
    return handle
  }

  /**
   * Creates a progress toast that can be updated during long-running operations
   * Returns an object with update and dismiss methods
   */
  progress(initialMessage: string, type: MessageType = 'info') {
    const progressToast = this.show(initialMessage, type, { 
      duration: 30000 // Longer duration for progress
    })
    
    return {
      update: (message: string, newType?: MessageType) => {
        progressToast.update({
          title: DEFAULT_TITLES[newType || type],
          description: message,
          variant: VARIANT_MAPPINGS[newType || type]
        })
      },
      dismiss: () => progressToast.dismiss()
    }
  }

  success(message: string, options?: MessageOptions) {
    this.show(message, 'success', options)
  }

  error(message: string, options?: MessageOptions) {
    this.show(message, 'error', options)
  }

  info(message: string, options?: MessageOptions) {
    this.show(message, 'info', options)
  }

  warning(message: string, options?: MessageOptions) {
    this.show(message, 'warning', options)
  }

  retryableError(message: string, onRetry: () => void) {
    this.error(message, {
      persist: true,
      action: {
        label: 'Retry',
        onClick: onRetry
      }
    })
  }

  systemError(message: string = 'An unexpected error occurred') {
    this.error(message, {
      persist: true,
      action: {
        label: 'Reload',
        onClick: () => window.location.reload()
      }
    })
  }
}

export const messageService = new MessageService()