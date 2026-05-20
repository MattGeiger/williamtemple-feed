import { Globe } from "@/components/ui/icons";
import { LanguageSelectionForm } from "./language-selection-form"
import { LanguageProvider } from "@/contexts/LanguageContext"
import { SectionHeader } from "@/components/shared/section-header"

export function LanguageManagement() {
  return (
    <LanguageProvider>
      <div className="space-y-6 min-w-0 w-full pt-6" data-testid="data-list">
        <SectionHeader
          title="Language Management"
          description="Manage language availability and content translation settings."
          icon={Globe}
        />

        <div className="w-full">
          <LanguageSelectionForm />
        </div>
      </div>
    </LanguageProvider>
  )
}