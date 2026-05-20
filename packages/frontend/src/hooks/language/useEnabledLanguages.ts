import { useState, useEffect, useCallback } from 'react';
import { Language } from '@/types/language';
import { LanguageService } from '@/services/language';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';

const languageService = new LanguageService();

export function useEnabledLanguages() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEnabledLanguages = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await languageService.getEnabledLanguages();
      setLanguages(data || []);
    } catch (err) {
      ErrorHandlerService.handleError(err, 'fetchEnabledLanguages');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnabledLanguages();
  }, [fetchEnabledLanguages]);

  return {
    languages,
    isLoading,
    refresh: fetchEnabledLanguages
  };
}