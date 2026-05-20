import * as React from 'react';
import { AlertCircle, CheckCircle2, Languages, Loader2 } from "@/components/ui/icons";

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useLanguageContext } from '@/contexts/LanguageContext';
import { useMessage } from '@/hooks/message/useMessage';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { shoppingListBuilderService } from '@/services/shopping-list-builder';
import {
  SavedBuilderTemplate,
  ShoppingListBuilderTemplate,
} from '@/components/shopping-lists/builder/types';

/**
 * Bulk Translate & Download PDFs modal for one saved shopping-list template.
 *
 * Patterned after the Document Translator's "Advanced" Translate dialog
 * (`packages/frontend/src/components/document-translator/dialogs/translate-dialog.tsx`):
 * staff pick one or more languages with Select All / individual checkboxes,
 * then a single click runs preflight → fill missing translations → render
 * PDF → trigger browser download for each language sequentially. The
 * Document Translator pattern uses sequential per-file downloads (no zip);
 * this modal does the same so each PDF lands in the user's Downloads
 * folder under a stable filename.
 *
 * The "Export single-page lists two-sided" switch (default ON) sends
 * `printMode: 'two-sided-when-single-page'` to the preview-pdf route, which
 * duplicates the rendered output only when the planner produced exactly
 * one page -- multi-page outputs already paginate cleanly for two-sided
 * printing and pass through unchanged.
 */

const triggerPdfDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

// Browsers throttle very-rapid sequential file downloads (Chrome shows the
// "this site is downloading multiple files" prompt and silently swallows
// later requests). Spacing them out by ~250ms keeps every PDF landing in
// the Downloads folder while still feeling like a single click.
const downloadGapMs = 250;
const wait = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

interface PerLanguageState {
  language: string;
  status: 'pending' | 'preflight' | 'translating' | 'generating' | 'done' | 'failed';
  error?: string;
}

type Step = 'setup' | 'progress' | 'done';

interface TranslateAndGenerateDialogProps {
  /** Saved template whose PDF(s) will be generated. */
  template: SavedBuilderTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Filename stem (without extension) for downloaded PDFs. */
  downloadFileName: string;
}

export function TranslateAndGenerateDialog({
  template,
  open,
  onOpenChange,
  downloadFileName,
}: TranslateAndGenerateDialogProps) {
  const { showMessage } = useMessage();
  const { languages, isLoading: isLoadingLanguages } = useLanguageContext();

  const enabledNonEnglishLanguages = React.useMemo(
    () => languages.filter((lang) => lang.isEnabled && lang.name !== 'English'),
    [languages],
  );

  const [step, setStep] = React.useState<Step>('setup');
  const [selectedLanguages, setSelectedLanguages] = React.useState<Set<string>>(new Set());
  const [singlePageDuplicate, setSinglePageDuplicate] = React.useState(true);
  const [perLanguage, setPerLanguage] = React.useState<PerLanguageState[]>([]);

  // Reset state every time the dialog opens. An in-flight bulk export is
  // not interrupted when the dialog is closed mid-progress; per-language
  // state for that batch is simply replaced when the dialog reopens.
  React.useEffect(() => {
    if (open) {
      setStep('setup');
      setSelectedLanguages(new Set());
      setSinglePageDuplicate(true);
      setPerLanguage([]);
    }
  }, [open]);

  const allSelected = enabledNonEnglishLanguages.length > 0
    && enabledNonEnglishLanguages.every((lang) => selectedLanguages.has(lang.name));
  const someSelected = enabledNonEnglishLanguages.some((lang) => selectedLanguages.has(lang.name));

  const toggleLanguage = (name: string, checked: boolean) => {
    setSelectedLanguages((current) => {
      const next = new Set(current);
      if (checked) next.add(name); else next.delete(name);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLanguages(new Set(enabledNonEnglishLanguages.map((lang) => lang.name)));
    } else {
      setSelectedLanguages(new Set());
    }
  };

  const updateLanguageState = (language: string, patch: Partial<PerLanguageState>) => {
    setPerLanguage((current) => current.map((entry) => (
      entry.language === language ? { ...entry, ...patch } : entry
    )));
  };

  const exportLanguage = async (language: string): Promise<boolean> => {
    const templateData = template.templateData as ShoppingListBuilderTemplate;
    try {
      // Preflight to know which strings need translation. Empty templates
      // return totalStrings: 0 and we skip straight to PDF render.
      updateLanguageState(language, { status: 'preflight' });
      const preflight = await shoppingListBuilderService.translationPreflight(templateData, language);

      if (preflight.missingStrings.length > 0) {
        updateLanguageState(language, { status: 'translating' });
        await shoppingListBuilderService.translateMissingStrings(preflight.missingStrings, language);
      }

      updateLanguageState(language, { status: 'generating' });
      const blob = await shoppingListBuilderService.createPreviewPdf(templateData, {
        targetLanguage: language,
        printMode: singlePageDuplicate ? 'two-sided-when-single-page' : undefined,
      });
      triggerPdfDownload(blob, `${downloadFileName} (${language}).pdf`);
      updateLanguageState(language, { status: 'done' });
      return true;
    } catch (error) {
      ErrorHandlerService.handleError(error, 'shoppingListBuilderBulkTranslateAndExport');
      const message = error instanceof Error ? error.message : 'PDF generation failed.';
      updateLanguageState(language, { status: 'failed', error: message });
      return false;
    }
  };

  const handleStart = async () => {
    const selected = enabledNonEnglishLanguages
      .filter((lang) => selectedLanguages.has(lang.name))
      .map((lang) => lang.name);
    if (selected.length === 0) {
      showMessage('Pick at least one language to continue.', 'warning');
      return;
    }
    setPerLanguage(selected.map<PerLanguageState>((language) => ({ language, status: 'pending' })));
    setStep('progress');

    let successes = 0;
    let failures = 0;
    for (let i = 0; i < selected.length; i += 1) {
      const ok = await exportLanguage(selected[i]);
      if (ok) successes += 1; else failures += 1;
      // Brief gap between sequential downloads so Chrome's multi-download
      // protection does not swallow later files.
      if (i < selected.length - 1) await wait(downloadGapMs);
    }
    setStep('done');

    if (failures === 0) {
      showMessage(`Downloaded ${successes} translated PDF${successes === 1 ? '' : 's'}.`, 'success');
    } else if (successes === 0) {
      showMessage(`All ${failures} download${failures === 1 ? '' : 's'} failed.`, 'error');
    } else {
      showMessage(
        `Downloaded ${successes} of ${successes + failures} PDFs (${failures} failed).`,
        'warning',
      );
    }
  };

  const renderLanguageRow = (entry: PerLanguageState) => {
    const labelByStatus: Record<PerLanguageState['status'], string> = {
      pending: 'Waiting…',
      preflight: 'Checking translation cache…',
      translating: 'Translating missing strings…',
      generating: 'Rendering PDF…',
      done: 'Downloaded',
      failed: entry.error ? `Failed: ${entry.error}` : 'Failed',
    };
    const Icon = entry.status === 'done'
      ? CheckCircle2
      : entry.status === 'failed'
        ? AlertCircle
        : entry.status === 'pending'
          ? null
          : Loader2;
    const iconClass = entry.status === 'done'
      ? 'text-green-600'
      : entry.status === 'failed'
        ? 'text-destructive'
        : 'text-muted-foreground';
    return (
      <div key={entry.language} className="flex items-start gap-2 text-sm">
        <div className="mt-0.5 w-4 shrink-0">
          {Icon ? (
            <Icon
              className={`h-4 w-4 ${iconClass} ${(entry.status === 'preflight' || entry.status === 'translating' || entry.status === 'generating') ? 'animate-spin' : ''}`}
            />
          ) : (
            <span className="block h-4 w-4 rounded-full border border-muted-foreground/30" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium">{entry.language}</div>
          <div className="text-xs text-muted-foreground">{labelByStatus[entry.status]}</div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Translate &amp; Download PDFs
          </DialogTitle>
          <DialogDescription>
            Pick the languages to export. Each selection downloads a separate
            PDF named {`${downloadFileName} (Language).pdf`} into your Downloads folder.
          </DialogDescription>
        </DialogHeader>

        {step === 'setup' && (
          <div className="space-y-4 py-2">
            {isLoadingLanguages ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading languages…
              </div>
            ) : enabledNonEnglishLanguages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No translation languages are enabled. Enable at least one
                non-English language in Language Settings before generating
                a translated list.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-medium">Languages</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSelectAll(!allSelected)}
                  >
                    {allSelected ? 'Clear' : 'Select all'}
                  </Button>
                </div>
                <div className="max-h-48 overflow-hidden rounded-md border">
                  <ScrollArea className="h-full">
                    <div className="grid grid-cols-2 gap-2 p-3">
                      {enabledNonEnglishLanguages.map((lang) => {
                        const id = `bulk-translate-lang-${lang.name}`;
                        return (
                          <div key={lang.name} className="flex items-center gap-2">
                            <Checkbox
                              id={id}
                              checked={selectedLanguages.has(lang.name)}
                              onCheckedChange={(checked) => toggleLanguage(lang.name, checked === true)}
                            />
                            <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
                              {lang.name}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
                {someSelected && (
                  <p className="text-xs text-muted-foreground">
                    {selectedLanguages.size} of {enabledNonEnglishLanguages.length} selected.
                  </p>
                )}

                <div className="flex items-start justify-between gap-3 rounded-md border bg-muted/30 p-3">
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor="bulk-translate-two-sided" className="text-sm font-medium">
                      Export single-page lists two-sided
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Single-page PDFs are duplicated so they print on both sides
                      of one sheet. Multi-page PDFs already paginate for two-sided
                      printing and pass through unchanged.
                    </p>
                  </div>
                  <Switch
                    id="bulk-translate-two-sided"
                    checked={singlePageDuplicate}
                    onCheckedChange={setSinglePageDuplicate}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {(step === 'progress' || step === 'done') && (
          <div className="space-y-2 py-2">
            <div className="max-h-72 overflow-y-auto rounded-md border">
              <div className="space-y-3 p-3">
                {perLanguage.map(renderLanguageRow)}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'setup' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleStart}
                disabled={selectedLanguages.size === 0 || enabledNonEnglishLanguages.length === 0}
              >
                Generate &amp; download
                {selectedLanguages.size > 0 && ` (${selectedLanguages.size})`}
              </Button>
            </>
          )}

          {step === 'progress' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}

          {step === 'done' && (
            <Button onClick={() => onOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
