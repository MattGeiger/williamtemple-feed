import { useCallback } from 'react';
import { messageService } from '@/services/message';
import type { MessageType, MessageOptions } from '@/services/message/types';

/**
 * React hook for using the message service
 * Provides memoized functions for showing various types of messages
 */
export function useMessage() {
  const showMessage = useCallback((
    message: string,
    type: MessageType = 'info',
    options?: MessageOptions
  ) => {
    messageService.show(message, type, options);
  }, []);

  const showSuccess = useCallback((
    message: string,
    options?: MessageOptions
  ) => {
    messageService.success(message, options);
  }, []);

  const showError = useCallback((
    message: string,
    options?: MessageOptions
  ) => {
    messageService.error(message, options);
  }, []);

  const showInfo = useCallback((
    message: string,
    options?: MessageOptions
  ) => {
    messageService.info(message, options);
  }, []);

  const showWarning = useCallback((
    message: string,
    options?: MessageOptions
  ) => {
    messageService.warning(message, options);
  }, []);

  const showRetryableError = useCallback((
    message: string,
    onRetry: () => void
  ) => {
    messageService.retryableError(message, onRetry);
  }, []);

  const showSystemError = useCallback((
    message?: string
  ) => {
    messageService.systemError(message);
  }, []);

  const showProgress = useCallback((
    initialMessage: string,
    type: MessageType = 'info'
  ) => {
    return messageService.progress(initialMessage, type);
  }, []);

  return {
    showMessage,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    showRetryableError,
    showSystemError,
    showProgress
  };
}
