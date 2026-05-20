// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import OpenAI from 'openai';
import { AITranslationService, TranslationRequest, TranslationResult, ClassificationRequest, ClassificationResult, BatchTranslationRequest, BatchTranslationResult, ServiceCapabilities, ServiceLimits } from '../base/AITranslationService';
import { limitEnforcement } from '../../limits';
import { estimateInputTokensAndCost, estimateOutputTokensAndCost } from '../../token';
import { convertToPerTokenRate } from '../../token/calculation';
import ApiUsageTracker from '../../token/usage-tracker';
import { translationRecovery } from '../../translation-recovery';
import { decryptApiKey } from '../../encryption';
import { PromptBuilder } from '../prompts/PromptBuilder';
import { TemplateEngine } from '../prompts/TemplateEngine';
import { buildOpenAIParameters, getModelSpecByModel } from '../model-specs';

// Add delay function for rate limiting and backoff
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// OpenAI-specific supported languages
const OPENAI_SUPPORTED_LANGUAGES = [
  'Albanian', 'Amharic', 'Arabic', 'Armenian', 'Bengali', 'Bosnian', 'Bulgarian', 'Burmese',
  'Catalan', 'Chinese', 'Croatian', 'Czech', 'Danish', 'Dutch', 'Estonian', 'Finnish', 'French',
  'Georgian', 'German', 'Greek', 'Gujarati', 'Hindi', 'Hungarian', 'Icelandic', 'Indonesian',
  'Italian', 'Japanese', 'Kannada', 'Kazakh', 'Korean', 'Latvian', 'Lithuanian', 'Macedonian',
  'Malay', 'Malayalam', 'Marathi', 'Mongolian', 'Norwegian', 'Persian', 'Polish', 'Portuguese',
  'Punjabi', 'Romanian', 'Russian', 'Serbian', 'Slovak', 'Slovenian', 'Somali', 'Spanish',
  'Swahili', 'Swedish', 'Tagalog', 'Tamil', 'Telugu', 'Thai', 'Turkish', 'Ukrainian', 'Urdu',
  'Vietnamese'
];

// Language code to full name mapping (for transition period only)
const LANGUAGE_NAMES: { [key: string]: string } = {
  'sq': 'Albanian', 'am': 'Amharic', 'ar': 'Arabic', 'hy': 'Armenian', 'bn': 'Bengali',
  'bs': 'Bosnian', 'bg': 'Bulgarian', 'my': 'Burmese', 'ca': 'Catalan', 'zh': 'Chinese',
  'hr': 'Croatian', 'cs': 'Czech', 'da': 'Danish', 'nl': 'Dutch', 'et': 'Estonian',
  'fi': 'Finnish', 'fr': 'French', 'ka': 'Georgian', 'de': 'German', 'el': 'Greek',
  'gu': 'Gujarati', 'hi': 'Hindi', 'hu': 'Hungarian', 'is': 'Icelandic', 'id': 'Indonesian',
  'it': 'Italian', 'ja': 'Japanese', 'kn': 'Kannada', 'kk': 'Kazakh', 'ko': 'Korean',
  'lv': 'Latvian', 'lt': 'Lithuanian', 'mk': 'Macedonian', 'ms': 'Malay', 'ml': 'Malayalam',
  'mr': 'Marathi', 'mn': 'Mongolian', 'no': 'Norwegian', 'fa': 'Persian', 'pl': 'Polish',
  'pt': 'Portuguese', 'pa': 'Punjabi', 'ro': 'Romanian', 'ru': 'Russian', 'sr': 'Serbian',
  'sk': 'Slovak', 'sl': 'Slovenian', 'so': 'Somali', 'es': 'Spanish', 'sw': 'Swahili',
  'sv': 'Swedish', 'tl': 'Tagalog', 'ta': 'Tamil', 'te': 'Telugu', 'th': 'Thai',
  'tr': 'Turkish', 'uk': 'Ukrainian', 'ur': 'Urdu', 'vi': 'Vietnamese', 'en': 'English'
};

// Set for fast lookups
const SUPPORTED_LANGUAGES_SET = new Set(OPENAI_SUPPORTED_LANGUAGES);

// Cached JSON schema for classification to improve performance
let cachedClassificationSchema: any = null;

// Optimal batch size for parallel processing
const OPTIMAL_BATCH_SIZE = 15;

// Function to get cached classification schema
function getClassificationSchema() {
  if (!cachedClassificationSchema) {
    cachedClassificationSchema = {
      name: "classification_response",
      schema: {
        type: "object",
        properties: {
          classifications: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                a: { type: "number", minimum: 0, maximum: 1 },
                b: { type: "number", minimum: 0, maximum: 1 }
              },
              required: ["id", "a", "b"],
              additionalProperties: false
            }
          }
        },
        required: ["classifications"],
        additionalProperties: false
      },
      strict: true
    };
  }
  return cachedClassificationSchema;
}

export class OpenAITranslationService extends AITranslationService {
  private openaiClient: OpenAI | null = null;
  private cachedApiKey: string | null = null;

  /**
   * Check and override parameters for GPT-5 models
   * Returns the effective parameters and any warnings
   */
  private checkAndOverrideParameters(
    model: string,
    requestedTemperature?: number,
    requestedTopP?: number,
    requestedThinkingLevel?: string | null
  ): {
    temperature: number;
    topP?: number;
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
    warnings: string[];
  } {
    const modelSpec = getModelSpecByModel(model);
    const warnings: string[] = [];
    let temperature = requestedTemperature ?? 1.0;
    let topP: number | undefined = requestedTopP;
    let reasoningEffort: 'minimal' | 'low' | 'medium' | 'high' | undefined;
    const validThinkingLevels = ['minimal', 'low', 'medium', 'high'] as const;
    const isValidThinkingLevel = requestedThinkingLevel
      ? validThinkingLevels.includes(requestedThinkingLevel as (typeof validThinkingLevels)[number])
      : false;
    
    // Check if this is a GPT-5 model that has special constraints
    if (modelSpec?.apiParameters?.modelFamily === 'gpt-5') {
      // GPT-5 models only support temperature=1.0
      if (requestedTemperature !== 1.0) {
        console.log(`[OpenAI Service] GPT-5 model detected, overriding temperature from ${requestedTemperature} to 1.0`);
        temperature = 1.0;
        warnings.push(`GPT-5 models only support temperature=1.0. Your configured temperature of ${requestedTemperature} has been overridden to 1.0.`);
      }
      
      // GPT-5 models don't support top_p parameter
      if (requestedTopP !== undefined && requestedTopP !== null) {
        console.log(`[OpenAI Service] GPT-5 model detected, excluding top_p parameter (was ${requestedTopP})`);
        topP = undefined;
        warnings.push(`GPT-5 models don't support the top_p parameter. It has been excluded from the API call.`);
      }

      if (requestedThinkingLevel && !isValidThinkingLevel) {
        warnings.push(
          `GPT-5 model reasoning_effort "${requestedThinkingLevel}" is invalid. Defaulting to "${modelSpec.apiParameters?.reasoningEffort ?? 'low'}".`
        );
      }

      const normalizedThinkingLevel = isValidThinkingLevel
        ? (requestedThinkingLevel as (typeof validThinkingLevels)[number])
        : undefined;

      reasoningEffort = normalizedThinkingLevel ??
        modelSpec.apiParameters?.reasoningEffort ??
        'low';

      const reasoningSource = requestedThinkingLevel
        ? 'AIConfiguration'
        : modelSpec.apiParameters?.reasoningEffort
          ? 'ModelSpec'
          : 'OpenAI Default';
      console.log('[OpenAI Service] GPT-5 reasoning effort resolved:', {
        requestedThinkingLevel,
        modelSpecDefault: modelSpec.apiParameters?.reasoningEffort,
        resolved: reasoningEffort,
        source: reasoningSource
      });
    }
    
    // Return the adjusted parameters
    return { temperature, topP, reasoningEffort, warnings };
  }

  protected async getApiKey(): Promise<string> {
    if (!this.config?.encryptedApiKey || !this.config?.salt) {
      throw new Error('OpenAI API configuration required. Please configure API settings in Tools → AI Configuration.');
    }
    return decryptApiKey(this.config.encryptedApiKey, this.config.salt);
  }

  private async getOpenAIClient(): Promise<OpenAI> {
    if (!this.openaiClient || !this.cachedApiKey) {
      const apiKey = await this.getApiKey();
      if (this.cachedApiKey !== apiKey) {
        // Reset client if API key changed
        this.openaiClient = new OpenAI({ apiKey });
        this.cachedApiKey = apiKey;
      }
    }
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }
    return this.openaiClient;
  }

  protected normalizeLanguage(language: string): string {
    let targetLanguage = language.trim();
    
    // If it looks like a code (2-3 chars), try to map it
    if (/^[a-z]{2,3}$/i.test(targetLanguage)) {
      const mappedName = LANGUAGE_NAMES[targetLanguage.toLowerCase()];
      if (mappedName) {
        console.log(`Converting language code '${targetLanguage}' to full name '${mappedName}'`);
        targetLanguage = mappedName;
      }
    }
    
    return targetLanguage;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const openai = await this.getOpenAIClient();
      // Test with a minimal request
      await openai.models.list();
      return true;
    } catch (error) {
      console.error('OpenAI API key validation failed:', error);
      return false;
    }
  }

  getServiceCapabilities(): ServiceCapabilities {
    return {
      supportsLanguages: OPENAI_SUPPORTED_LANGUAGES,
      maxTokensPerRequest: this.config.maxTokens || 4096,
      supportsBatchOperations: true,
      supportsClassification: true
    };
  }

  getServiceLimits(): ServiceLimits {
    return {
      tokensPerMinute: this.config.tokensPerMinute || 30000,
      requestsPerMinute: this.config.requestsPerMinute || 500,
      requestsPerDay: this.config.requestsPerDay || 10000,
      inputCost: this.config.inputCost || 0.00015,
      outputCost: this.config.outputCost || 0.0006
    };
  }

  getSupportedLanguages(): string[] {
    return OPENAI_SUPPORTED_LANGUAGES;
  }

  isLanguageSupported(language: string): boolean {
    const normalizedLanguage = this.normalizeLanguage(language);
    return SUPPORTED_LANGUAGES_SET.has(normalizedLanguage);
  }

  async translateText(request: TranslationRequest): Promise<TranslationResult> {
    // Early return for skip conditions
    if (this.shouldSkipTranslation(request.text, request.targetLanguage)) {
      return this.createSkippedTranslationResult(request.text);
    }

    const targetLanguage = this.normalizeLanguage(request.targetLanguage);
    
    // Validate the language is supported
    if (!this.isLanguageSupported(targetLanguage)) {
      throw new Error(`Unsupported language: ${request.targetLanguage}. Please use full language name.`);
    }

    const model = this.getModel();
    const inputMetrics = estimateInputTokensAndCost(request.text, request.targetLanguage, this.config);

    const usageCheck = await limitEnforcement.checkTokenUsage(inputMetrics.tokenCount, this.config);

    if (!usageCheck.canProceed) {
      throw new Error(`Translation limit exceeded: ${usageCheck.reason}`);
    }

    const startTime = Date.now();
    const warnings: string[] = [];  // Collect any warnings
    
    try {
      console.log('Translation request:', {
        model,
        targetLanguage,
        text: request.text
      });

      // Add retry logic with backoff
      let retries = 0;
      const maxRetries = 2;
      let lastError: any = null;

      while (retries <= maxRetries) {
        try {
          // Add exponential backoff between retries
          if (retries > 0) {
            const backoffMs = Math.pow(2, retries) * 500;
            console.log(`Translation retry attempt ${retries}/${maxRetries}, backing off for ${backoffMs}ms`);
            await delay(backoffMs);
          }
          
          const openai = await this.getOpenAIClient();
          const promptConfig = await PromptBuilder.getPromptConfiguration(
            this.config,
            'translation',
            request.context
          );
          const systemPrompt = TemplateEngine.substituteVariables(
            promptConfig.systemPrompt,
            { targetLanguage, instructions: request.instructions }
          );
          
          console.log('[OpenAI Service] Sending translation request with system prompt:', {
            model,
            promptLength: systemPrompt.length,
            promptPreview: systemPrompt.substring(0, 150) + '...',
            fullPrompt: systemPrompt
          });
          
          const apiParameters = buildOpenAIParameters(model, promptConfig.maxTokens);
          
          // Check and override parameters for GPT-5 models
          const paramCheck = this.checkAndOverrideParameters(
            model,
            promptConfig.temperature,
            promptConfig.topP,
            this.config.thinkingLevel
          );
          const requestReasoningEffort = paramCheck.reasoningEffort as any;
          const maxTokensValue = apiParameters.max_completion_tokens ?? apiParameters.max_tokens;
          console.log('[OpenAI Service] API call parameters:', {
            model,
            temperature: paramCheck.temperature,
            topP: paramCheck.topP,
            reasoningEffort: paramCheck.reasoningEffort,
            maxTokens: maxTokensValue
          });
          if (paramCheck.warnings.length > 0) {
            warnings.push(...paramCheck.warnings);
          }
          
          const completion = await openai.chat.completions.create({
            model,
            temperature: paramCheck.temperature,
            ...(paramCheck.topP !== undefined && { top_p: paramCheck.topP }),
            ...(requestReasoningEffort && { reasoning_effort: requestReasoningEffort }),
            ...apiParameters,
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: request.text
              }
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "translation_response",
                schema: {
                  type: "object",
                  properties: {
                    translatedText: {
                      type: "string",
                      description: "The translated text in the target language"
                    }
                  },
                  required: ["translatedText"],
                  additionalProperties: false
                },
                strict: true
              }
            }
          });

          console.log('OpenAI response:', completion);

          // Handle potential response issues
          if (completion.choices[0].finish_reason === 'length') {
            throw new Error('Translation response was truncated due to length');
          }

          if (completion.choices[0].finish_reason === 'content_filter') {
            throw new Error('Translation was halted by content filter');
          }

          const message = completion.choices[0].message;
          
          console.log('Message content:', message);

          if (!message.content) {
            throw new Error('No content in translation response');
          }

          const duration = Date.now() - startTime;
          const outputText = message.content;

          console.log('Attempting to parse:', outputText);
          
          const responseJson = JSON.parse(outputText);
          
          console.log('Parsed response:', responseJson);

          if (!responseJson.translatedText) {
            throw new Error('Response missing translatedText field');
          }

          const outputMetrics = estimateOutputTokensAndCost(outputText, this.config);
          const usageMetrics = this.extractUsageMetrics(
            completion,
            inputMetrics.tokenCount,
            outputMetrics.tokenCount
          );
          const inputCostPerToken = convertToPerTokenRate(this.config.inputCost || 0, this.config.unitPrice);
          const outputCostPerToken = convertToPerTokenRate(this.config.outputCost || 0, this.config.unitPrice);
          const totalCost = (usageMetrics.promptTokens * inputCostPerToken) +
            (usageMetrics.completionTokens * outputCostPerToken);

          // Log API usage for metrics tracking
          try {
            await ApiUsageTracker.logApiUsage(
              usageMetrics.promptTokens,
              usageMetrics.completionTokens,
              model,
              'translation'
            );
          } catch (loggingError) {
            console.warn('Failed to log API usage:', loggingError);
          }

          const result: TranslationResult = {
            translatedText: responseJson.translatedText,
            metrics: {
              duration,
              promptTokens: usageMetrics.promptTokens,
              completionTokens: usageMetrics.completionTokens,
              totalCost
            }
          };
          
          // Add warnings if any
          if (warnings.length > 0) {
            result.warnings = warnings;
          }

          // Track usage for multi-service analytics
          await this.trackSuccessfulUsage(
            'translation',
            {
              promptTokens: usageMetrics.promptTokens,
              completionTokens: usageMetrics.completionTokens,
              totalCost,
              duration
            },
            model,
            { language: targetLanguage }
          );

          return result;
          
        } catch (error) {
          lastError = error;
          retries++;
          
          // Only retry on rate limits and server errors, not on validation/parsing errors
          if (error instanceof OpenAI.APIError) {
            if (error.status === 429 || (error.status >= 500 && error.status < 600)) {
              console.warn(`Translation API error (${error.status}), will retry: ${error.message}`);
              continue;
            }
          }
          
          throw error;
        }
      }
      
      throw lastError || new Error('Translation failed after multiple retries');
    } catch (error) {
      console.error('Translation error details:', {
        error,
        request: {
          text: request.text,
          targetLanguage: request.targetLanguage
        }
      });
      
      // On rate limits or server errors, check for stuck translations
      if (error instanceof OpenAI.APIError && (error.status === 429 || error.status >= 500)) {
        console.warn('API error detected, checking for stuck translations...');
        try {
          await translationRecovery.recoverStuckTranslations();
        } catch (recoveryError) {
          console.error('Error during translation recovery:', recoveryError);
        }
      }
      
      this.handleServiceError(error, 'translation');
    }
  }

  async translateTextBatch(request: BatchTranslationRequest): Promise<BatchTranslationResult> {
    const model = this.getModel();
    const startTime = Date.now();
    let targetLanguage = this.normalizeLanguage(request.targetLanguage);
    const warnings: string[] = [];  // Collect any warnings
    
    // Validate language
    if (!this.isLanguageSupported(targetLanguage)) {
      throw new Error(`Unsupported language: ${request.targetLanguage}. Please use full language name.`);
    }

    // Deduplication: Group texts by content
    const uniqueTexts = new Map<string, { ids: string[]; instructions?: string }>();
    const idToText = new Map<string, string>();
    
    for (const item of request.texts) {
      const text = item.text.trim();
      idToText.set(item.id, text);
      
      if (!uniqueTexts.has(text)) {
        uniqueTexts.set(text, { ids: [item.id], instructions: item.instructions });
      } else {
        uniqueTexts.get(text)!.ids.push(item.id);
      }
    }
    
    console.log(`Batch translation: ${request.texts.length} segments -> ${uniqueTexts.size} unique texts`);
    
    // Create batch prompt
    const uniqueTextsList = Array.from(uniqueTexts.entries());
    const textsForTranslation = uniqueTextsList.map(([text, data], index) => 
      `${index + 1}. "${text}"`
    ).join('\n');
    
    // Check if any texts have special instructions
    const hasSpecialInstructions = uniqueTextsList.some(([_, data]) => data.instructions);
      const specialInstructionsText = hasSpecialInstructions ?
      uniqueTextsList.map(([text, data], index) =>
        data.instructions ? `Text ${index + 1}: ${data.instructions}` : ''
      ).filter(Boolean).join(' ') : '';
    
    try {
      const openai = await this.getOpenAIClient();
      const promptConfig = await PromptBuilder.getPromptConfiguration(
        this.config,
        'batch_translation',
        request.context || 'document'
      );
      const systemPrompt = TemplateEngine.substituteVariables(
        promptConfig.systemPrompt,
        { targetLanguage, specialInstructions: specialInstructionsText }
      );
      
      console.log('[OpenAI Service] Sending batch translation request with system prompt:', {
        model,
        promptLength: systemPrompt.length,
        promptPreview: systemPrompt.substring(0, 150) + '...',
        fullPrompt: systemPrompt
      });
      
      const apiParameters = buildOpenAIParameters(model, promptConfig.maxTokens);
      
      // Check and override parameters for GPT-5 models
      const paramCheck = this.checkAndOverrideParameters(
        model,
        promptConfig.temperature,
        promptConfig.topP,
        this.config.thinkingLevel
      );
      const requestReasoningEffort = paramCheck.reasoningEffort as any;
      const maxTokensValue = apiParameters.max_completion_tokens ?? apiParameters.max_tokens;
      console.log('[OpenAI Service] API call parameters:', {
        model,
        temperature: paramCheck.temperature,
        topP: paramCheck.topP,
        reasoningEffort: paramCheck.reasoningEffort,
        maxTokens: maxTokensValue
      });
      if (paramCheck.warnings.length > 0) {
        warnings.push(...paramCheck.warnings);
      }
      
      const completion = await openai.chat.completions.create({
        model,
        temperature: paramCheck.temperature,
        ...(paramCheck.topP !== undefined && { top_p: paramCheck.topP }),
        ...(requestReasoningEffort && { reasoning_effort: requestReasoningEffort }),
        ...apiParameters,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `Translate these texts to ${targetLanguage}:\n${textsForTranslation}`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "batch_translation_response",
            schema: {
              type: "object",
              properties: {
                translations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      translatedText: {
                        type: "string",
                        description: "The translated text in the target language"
                      }
                    },
                    required: ["translatedText"],
                    additionalProperties: false
                  }
                }
              },
              required: ["translations"],
              additionalProperties: false
            },
            strict: true
          }
        }
      });
      
      if (completion.choices[0].finish_reason === 'length') {
        throw new Error('Translation response was truncated due to length');
      }

      const message = completion.choices[0].message;
      if (!message.content) {
        throw new Error('No content in translation response');
      }

      const responseJson = JSON.parse(message.content);
      if (!responseJson.translations || !Array.isArray(responseJson.translations)) {
        throw new Error('Response missing translations array');
      }
      
      // Map translations back to all IDs
      const allTranslations: Array<{ id: string; originalText: string; translatedText: string }> = [];
      
      uniqueTextsList.forEach(([originalText, data], index) => {
        const translation = responseJson.translations[index];
        if (translation && translation.translatedText) {
          data.ids.forEach(id => {
            allTranslations.push({
              id,
              originalText,
              translatedText: translation.translatedText
            });
          });
        }
      });
      
      const duration = Date.now() - startTime;
      const inputTokens = completion.usage?.prompt_tokens || 0;
      const outputTokens = completion.usage?.completion_tokens || 0;
      
      // Calculate cost using configuration-based rates
      const inputCostPerToken = convertToPerTokenRate(this.config.inputCost || 0, this.config.unitPrice);
      const outputCostPerToken = convertToPerTokenRate(this.config.outputCost || 0, this.config.unitPrice);
      const totalCost = (inputTokens * inputCostPerToken) + (outputTokens * outputCostPerToken);
      
      // Log API usage
      try {
        await ApiUsageTracker.logApiUsage(inputTokens, outputTokens, model, 'translation');
      } catch (loggingError) {
        console.warn('Failed to log API usage:', loggingError);
      }
      
      console.log(`Batch translation completed: ${uniqueTexts.size} unique -> ${allTranslations.length} total`);
      
      const result: BatchTranslationResult = {
        translations: allTranslations,
        metrics: {
          duration,
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalCost
        }
      };
      
      // Add warnings if any
      if (warnings.length > 0) {
        result.warnings = warnings;
      }

      // Track usage for multi-service analytics
      await this.trackSuccessfulUsage(
        'batch',
        {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalCost,
          duration
        },
        model,
        { language: targetLanguage }
      );
      
      return result;
      
    } catch (error) {
      this.handleServiceError(error, 'batch translation');
    }
  }

  async classifySegments(request: ClassificationRequest): Promise<ClassificationResult> {
    const model = this.getModel();
    const startTime = Date.now();
    const warnings: string[] = [];  // Collect any warnings
    
    try {
      console.log('Classification request:', {
        model,
        segmentCount: request.segments.length
      });

      const openai = await this.getOpenAIClient();
      
      // Create the classification prompt
      const segmentsText = request.segments.map((seg, index) => 
        `${index + 1}. "${seg.text}"`
      ).join('\n');

      const promptConfig = await PromptBuilder.getPromptConfiguration(
        this.config,
        'classification'
      );
      const systemPrompt = promptConfig.systemPrompt;

      console.log('[OpenAI Service] Sending classification request with system prompt:', {
        model,
        promptLength: systemPrompt.length,
        promptPreview: systemPrompt.substring(0, 150) + '...',
        fullPrompt: systemPrompt
      });

      const apiParameters = buildOpenAIParameters(model, promptConfig.maxTokens);
      
      // Check and override parameters for GPT-5 models
      const paramCheck = this.checkAndOverrideParameters(
        model,
        promptConfig.temperature,
        promptConfig.topP,
        this.config.thinkingLevel
      );
      const requestReasoningEffort = paramCheck.reasoningEffort as any;
      const maxTokensValue = apiParameters.max_completion_tokens ?? apiParameters.max_tokens;
      console.log('[OpenAI Service] API call parameters:', {
        model,
        temperature: paramCheck.temperature,
        topP: paramCheck.topP,
        reasoningEffort: paramCheck.reasoningEffort,
        maxTokens: maxTokensValue
      });
      if (paramCheck.warnings.length > 0) {
        warnings.push(...paramCheck.warnings);
      }

      const completion = await openai.chat.completions.create({
        model,
        temperature: paramCheck.temperature,
        ...(paramCheck.topP !== undefined && { top_p: paramCheck.topP }),
        ...(requestReasoningEffort && { reasoning_effort: requestReasoningEffort }),
        ...apiParameters,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `Classify these text segments:\n${segmentsText}`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "classification_response",
            schema: {
              type: "object",
              properties: {
                classifications: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      a: { type: "number", minimum: 0, maximum: 1 },
                      b: { type: "number", minimum: 0, maximum: 1 }
                    },
                    required: ["id", "a", "b"],
                    additionalProperties: false
                  }
                }
              },
              required: ["classifications"],
              additionalProperties: false
            },
            strict: true
          }
        }
      });

      console.log('OpenAI classification response:', completion);

      if (completion.choices[0].finish_reason === 'length') {
        throw new Error('Classification response was truncated due to length');
      }

      if (completion.choices[0].finish_reason === 'content_filter') {
        throw new Error('Classification was halted by content filter');
      }

      const message = completion.choices[0].message;
      
      if (!message.content) {
        throw new Error('No content in classification response');
      }

      const duration = Date.now() - startTime;
      const outputText = message.content;

      const responseJson = JSON.parse(outputText);

      if (!responseJson.classifications || !Array.isArray(responseJson.classifications)) {
        throw new Error('Response missing classifications array');
      }

      // Validate response count matches input count
      if (responseJson.classifications.length !== request.segments.length) {
        console.warn(`Classification count mismatch: expected ${request.segments.length}, got ${responseJson.classifications.length}`);
        // Continue processing but log the discrepancy
      }

      // Map segment IDs back to the original IDs
      const classificationsWithIds = responseJson.classifications.map((classification: any, index: number) => ({
        ...classification,
        id: request.segments[index]?.id || classification.id
      }));

      const inputTokens = completion.usage?.prompt_tokens || 0;
      const outputTokens = completion.usage?.completion_tokens || 0;
      
      // Calculate cost using configuration-based rates
      const inputCostPerToken = convertToPerTokenRate(this.config.inputCost || 0, this.config.unitPrice);
      const outputCostPerToken = convertToPerTokenRate(this.config.outputCost || 0, this.config.unitPrice);
      const totalCost = (inputTokens * inputCostPerToken) + (outputTokens * outputCostPerToken);

      // Log API usage
      try {
        await ApiUsageTracker.logApiUsage(inputTokens, outputTokens, model, 'classification');
      } catch (loggingError) {
        console.warn('Failed to log API usage:', loggingError);
      }

      const result: ClassificationResult = {
        classifications: classificationsWithIds,
        metrics: {
          duration,
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalCost
        }
      };
      
      // Add warnings if any
      if (warnings.length > 0) {
        result.warnings = warnings;
      }

      // Track usage for multi-service analytics
      await this.trackSuccessfulUsage(
        'classification',
        {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalCost,
          duration
        },
        model,
        { language: undefined } // Classification doesn't target a specific language
      );

      return result;
      
    } catch (error) {
      this.handleServiceError(error, 'classification');
    }
  }

  async classifySegmentsBatch(request: ClassificationRequest): Promise<ClassificationResult> {
    const model = this.getModel();
    const startTime = Date.now();
    const warnings: string[] = [];  // Collect any warnings
    
    try {
      console.log('Parallel batch classification request:', {
        model,
        segmentCount: request.segments.length
      });

      // Deduplication: Group segments by text content
      const uniqueTexts = new Map<string, string[]>(); // text -> array of IDs
      
      for (const segment of request.segments) {
        const text = segment.text.trim();
        if (!uniqueTexts.has(text)) {
          uniqueTexts.set(text, []);
        }
        uniqueTexts.get(text)!.push(segment.id);
      }
      
      console.log(`Deduplicated ${request.segments.length} segments to ${uniqueTexts.size} unique texts`);
      
      const uniqueTextsArray = Array.from(uniqueTexts.keys());
      
      // Split unique texts into optimal batches for parallel processing
      const batches: string[][] = [];
      for (let i = 0; i < uniqueTextsArray.length; i += OPTIMAL_BATCH_SIZE) {
        batches.push(uniqueTextsArray.slice(i, i + OPTIMAL_BATCH_SIZE));
      }
      
      console.log(`Split ${uniqueTextsArray.length} unique texts into ${batches.length} parallel batches of ~${OPTIMAL_BATCH_SIZE} segments each`);
      
      // Get configuration once for all batches
      const promptConfig = await PromptBuilder.getPromptConfiguration(
        this.config,
        'batch_classification'
      );
      const systemPrompt = promptConfig.systemPrompt;
      const cachedSchema = getClassificationSchema();
      const apiParameters = buildOpenAIParameters(model, promptConfig.maxTokens);
      
      // Check and override parameters for GPT-5 models (do once for all batches)
      const paramCheck = this.checkAndOverrideParameters(
        model,
        promptConfig.temperature,
        promptConfig.topP,
        this.config.thinkingLevel
      );
      const requestReasoningEffort = paramCheck.reasoningEffort as any;
      const maxTokensValue = apiParameters.max_completion_tokens ?? apiParameters.max_tokens;
      console.log('[OpenAI Service] API call parameters:', {
        model,
        temperature: paramCheck.temperature,
        topP: paramCheck.topP,
        reasoningEffort: paramCheck.reasoningEffort,
        maxTokens: maxTokensValue
      });
      if (paramCheck.warnings.length > 0) {
        warnings.push(...paramCheck.warnings);
      }
      
      // Process all batches concurrently
      const batchPromises = batches.map(async (batchTexts, batchIndex) => {
        const openai = await this.getOpenAIClient();
        
        // Create numbered prompt for this batch
        const segmentsText = batchTexts.map((text, index) => 
          `${index + 1}. "${text}"`
        ).join('\n');
        
        console.log(`[OpenAI Service] Processing parallel batch ${batchIndex + 1}/${batches.length} with ${batchTexts.length} segments`);
        
        const completion = await openai.chat.completions.create({
          model,
          temperature: paramCheck.temperature,
          ...(paramCheck.topP !== undefined && { top_p: paramCheck.topP }),
          ...(requestReasoningEffort && { reasoning_effort: requestReasoningEffort }),
          ...apiParameters,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: `Classify these text segments:\n${segmentsText}`
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: cachedSchema
          }
        });
        
        if (completion.choices[0].finish_reason === 'length') {
          throw new Error(`Batch ${batchIndex + 1} response was truncated due to length`);
        }
        
        if (completion.choices[0].finish_reason === 'content_filter') {
          throw new Error(`Batch ${batchIndex + 1} was halted by content filter`);
        }
        
        const message = completion.choices[0].message;
        if (!message.content) {
          throw new Error(`No content in batch ${batchIndex + 1} response`);
        }
        
        const responseJson = JSON.parse(message.content);
        if (!responseJson.classifications || !Array.isArray(responseJson.classifications)) {
          throw new Error(`Batch ${batchIndex + 1} missing classifications array`);
        }
        
        // Map batch results to segment classifications
        const batchClassifications: Array<{ id: string; a: number; b: number; }> = [];
        
        responseJson.classifications.forEach((classification: any, index: number) => {
          const originalText = batchTexts[index];
          const segmentIds = uniqueTexts.get(originalText) || [];
          
          segmentIds.forEach(id => {
            batchClassifications.push({
              id,
              a: classification.a,
              b: classification.b
            });
          });
        });
        
        return {
          classifications: batchClassifications,
          metrics: {
            promptTokens: completion.usage?.prompt_tokens || 0,
            completionTokens: completion.usage?.completion_tokens || 0,
            batchIndex
          }
        };
      });
      
      // Wait for all batches to complete
      console.log(`Processing ${batchPromises.length} parallel batches concurrently...`);
      const batchResults = await Promise.all(batchPromises);
      
      // Combine all results
      const allClassifications: Array<{ id: string; a: number; b: number; }> = [];
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      
      batchResults.forEach(result => {
        allClassifications.push(...result.classifications);
        totalInputTokens += result.metrics.promptTokens;
        totalOutputTokens += result.metrics.completionTokens;
      });
      
      // Calculate cost using configuration-based rates
      const inputCostPerToken = convertToPerTokenRate(this.config.inputCost || 0, this.config.unitPrice);
      const outputCostPerToken = convertToPerTokenRate(this.config.outputCost || 0, this.config.unitPrice);
      const totalCost = (totalInputTokens * inputCostPerToken) + (totalOutputTokens * outputCostPerToken);
      const duration = Date.now() - startTime;
      
      // Log API usage
      try {
        await ApiUsageTracker.logApiUsage(totalInputTokens, totalOutputTokens, model, 'classification');
      } catch (loggingError) {
        console.warn('Failed to log API usage:', loggingError);
      }
      
      console.log(`Parallel batch classification completed: ${uniqueTexts.size} unique texts -> ${allClassifications.length} total results in ${batches.length} concurrent batches (${duration}ms)`);
      
      const result: ClassificationResult = {
        classifications: allClassifications,
        metrics: {
          duration,
          promptTokens: totalInputTokens,
          completionTokens: totalOutputTokens,
          totalCost
        }
      };
      
      // Add warnings if any
      if (warnings.length > 0) {
        result.warnings = warnings;
      }

      // Track usage for multi-service analytics
      await this.trackSuccessfulUsage(
        'classification',
        {
          promptTokens: totalInputTokens,
          completionTokens: totalOutputTokens,
          totalCost,
          duration
        },
        model,
        { language: undefined } // Classification doesn't target a specific language
      );
      
      return result;
      
    } catch (error) {
      this.handleServiceError(error, 'batch classification');
    }
  }

  private extractUsageMetrics(
    completion: OpenAI.Chat.Completions.ChatCompletion,
    fallbackPromptTokens: number,
    fallbackCompletionTokens: number
  ): { promptTokens: number; completionTokens: number } {
    const usage = completion?.usage;

    return {
      promptTokens: usage?.prompt_tokens ?? fallbackPromptTokens,
      completionTokens: usage?.completion_tokens ?? fallbackCompletionTokens
    };
  }

}
