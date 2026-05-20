/**
 * Setup wizard types and interfaces
 */

export type SetupStep = 'welcome' | 'keygen' | 'validation' | 'complete'

export interface SetupState {
  setupStep: SetupStep
  generatedKey: string | null
  isInitializing: boolean
  initializationError: string | null
}

export interface SetupWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  preserveConfigData?: boolean
}

export interface SetupStepProps {
  setupState: SetupState
  onNext: () => void
  onBack: () => void
  onGenerateKey: () => Promise<void>
  onInitializeSystem: () => Promise<void>
}
