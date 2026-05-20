/**
 * Message type variants supported by the system
 */
export type MessageType = 'success' | 'error' | 'info' | 'warning';

/**
 * Configuration options for message display
 */
export interface MessageOptions {
  /** Duration in milliseconds to display the message */
  duration?: number;
  
  /** Optional action button configuration */
  action?: {
    /** Label for the action button */
    label: string;
    /** Callback function when action is clicked */
    onClick: () => void;
  };

  /** Whether the message should persist until manually dismissed */
  persist?: boolean;
}

/**
 * Default durations for different message types (in milliseconds)
 * Based on accessibility research: 5-6 seconds optimal, minimum 6 seconds for WCAG compliance
 * Radix Toast automatically pauses on hover, focus, and window blur
 */
export const DEFAULT_DURATIONS: Record<MessageType, number> = {
  success: 6000,  // Increased from 4000ms for accessibility
  error: 8000,    // Increased from 6000ms for critical messages
  info: 6000,     // Increased from 4000ms for accessibility
  warning: 7000   // Increased from 5000ms for important warnings
} as const;

/**
 * Default titles for different message types
 */
export const DEFAULT_TITLES: Partial<Record<MessageType, string>> = {
  error: 'Error',
  warning: 'Warning'
} as const;

/**
 * Variant mappings for toast styling
 */
export const VARIANT_MAPPINGS: Record<MessageType, 'default' | 'destructive' | 'warning'> = {
  success: 'default',
  error: 'destructive',
  info: 'default',
  warning: 'warning'
} as const;