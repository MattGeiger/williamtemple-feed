export type DocumentType = 'original' | 'translated';

export interface Document {
  id: number;
  name: string;
  createdAt: string;
  updatedAt?: string;
  fileSize?: string;
  file?: File;
  type: DocumentType;
  // For translations
  parentId?: number;
  language?: string;
  // File status
  hasContent?: boolean;
  hasIntegrityIssue?: boolean;
  wasCleared?: boolean;
  // UI metadata
  translationsCount?: number;
  cachedTranslationsCount?: number;
}