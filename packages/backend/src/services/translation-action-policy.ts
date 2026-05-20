// Translation Action Policy
// Defines which translation actions are allowed per Translation.type
// Skip/Enable actions are deprecated for all types as of 2025-09-01.

export type TranslationAction = 'includeOriginal' | 'removeOriginal';

export type TranslationType = 'Category' | 'FoodItem' | 'Custom' | 'Generated';

type Capabilities = Record<TranslationType, TranslationAction[]>;

// Single source of truth for capabilities
const capabilities: Capabilities = {
  Category: [],
  FoodItem: [],
  Custom: ['includeOriginal', 'removeOriginal'],
  Generated: ['includeOriginal', 'removeOriginal'],
};

export function getCapabilities(): Capabilities {
  return capabilities;
}

export function isActionAllowed(type: string, action: TranslationAction): boolean {
  // Narrow unknown strings defensively
  if (!['Category', 'FoodItem', 'Custom', 'Generated'].includes(type)) {
    return false;
  }
  const list = capabilities[type as TranslationType] || [];
  return list.includes(action);
}

