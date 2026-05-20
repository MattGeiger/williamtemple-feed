import type { ModelName } from '../config/limits';

export type { ModelName };

export type TokenRates = Record<ModelName, {
  prompt: number;
  completion: number;
}>;

export type TokenLimits = {
  MODEL_DAILY_LIMITS: Record<ModelName, number>;
  MODEL_CONTEXT_LIMITS: Record<ModelName, {
    CONTEXT_WINDOW: number;
    MAX_OUTPUT: number;
  }>;
  RATE_LIMITS: {
    RPM: number;
    RPD: number;
    TPM: number;
    WINDOW_MS: number;
  };
  COST_LIMITS: {
    MONTHLY: number;
  };
  WARNING_THRESHOLDS: {
    WARNING: number;
    ELEVATED_WARNING: number;
    FINAL_WARNING: number;
  };
};
