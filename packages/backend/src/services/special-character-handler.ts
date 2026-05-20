/**
 * Special character handler for translation service
 * This function detects and handles text that only contains special characters or numbers
 */
export function isSpecialCharacterOnly(text: string): boolean {
  // Check if text contains only special characters or numbers
  return /^[^a-zA-Z]*$/.test(text);
}
