export interface BuilderPreviewTranslationPreflight {
  cached: Record<string, string>;
  missingStrings: string[];
}

export type BuilderPreviewTranslationDecision =
  | { status: 'ready'; translations: Record<string, string> }
  | {
    status: 'missing';
    cached: Record<string, string>;
    missingStrings: string[];
  };

export function resolvePreviewTranslationPreflight(
  preflight: BuilderPreviewTranslationPreflight,
): BuilderPreviewTranslationDecision {
  if (preflight.missingStrings.length > 0) {
    return {
      status: 'missing',
      cached: preflight.cached ?? {},
      missingStrings: preflight.missingStrings,
    };
  }

  return {
    status: 'ready',
    translations: preflight.cached ?? {},
  };
}

export function mergePreviewTranslations(
  cached: Record<string, string>,
  newlyTranslated: Record<string, string>,
): Record<string, string> {
  return {
    ...cached,
    ...newlyTranslated,
  };
}
