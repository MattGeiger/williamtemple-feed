export interface Language {
  id: number;
  name: string;
  isEnabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BulkUpdateLanguageState {
  name: string;
  isEnabled: boolean;
  preserveTranslations?: boolean;
}

export interface BulkUpdateResult {
  success: {
    count: number;
    items: string[];
  };
  failure: {
    count: number;
    items: string[];
  };
}

export interface LanguageResponse {
  languages: Language[];
}

export interface BulkUpdateResponse {
  message: string;
  result: BulkUpdateResult;
}

export interface TranslationCountResponse {
  count: number;
}