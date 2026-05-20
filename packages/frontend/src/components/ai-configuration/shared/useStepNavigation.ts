import { useState } from 'react'

export type StepId = string

interface UseStepNavigationProps {
  steps: StepId[]
  initialStep?: StepId
}

interface UseStepNavigationReturn {
  currentStep: StepId
  currentIndex: number
  totalSteps: number
  isFirstStep: boolean
  isLastStep: boolean
  goToStep: (step: StepId) => void
  nextStep: () => void
  previousStep: () => void
  reset: () => void
}

export function useStepNavigation({
  steps,
  initialStep
}: UseStepNavigationProps): UseStepNavigationReturn {
  const [currentStep, setCurrentStep] = useState<StepId>(
    initialStep || steps[0]
  )

  const currentIndex = steps.indexOf(currentStep)
  const totalSteps = steps.length
  const isFirstStep = currentIndex === 0
  const isLastStep = currentIndex === totalSteps - 1

  const goToStep = (step: StepId) => {
    if (steps.includes(step)) {
      setCurrentStep(step)
    }
  }

  const nextStep = () => {
    if (!isLastStep) {
      setCurrentStep(steps[currentIndex + 1])
    }
  }

  const previousStep = () => {
    if (!isFirstStep) {
      setCurrentStep(steps[currentIndex - 1])
    }
  }

  const reset = () => {
    setCurrentStep(initialStep || steps[0])
  }

  return {
    currentStep,
    currentIndex,
    totalSteps,
    isFirstStep,
    isLastStep,
    goToStep,
    nextStep,
    previousStep,
    reset
  }
}
