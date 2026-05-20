import { ToastAction } from '@/components/ui/toast'
import { toast } from '@/components/ui/use-toast'
import React from 'react'
import type { MessageType, MessageOptions } from './types'
import { DEFAULT_DURATIONS, DEFAULT_TITLES, VARIANT_MAPPINGS } from './types'

class MessageService {
  private show(message: string, type: MessageType, options?: MessageOptions) {
    const duration = options?.duration ?? DEFAULT_DURATIONS[type]
    const title = DEFAULT_TITLES[type]
    
    const actionComponent = options?.action ? React.createElement(
      ToastAction,
      { 
        altText: options.action.label,
        onClick: options.action.onClick 
      },
      options.action.label
    ) : undefined

    return toast({
      title,
      description: message,
      variant: VARIANT_MAPPINGS[type],
      duration: options?.persist ? null : duration,
      action: actionComponent
    })
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