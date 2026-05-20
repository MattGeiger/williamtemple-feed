import { AITranslationService, TranslationRequest, TranslationResult, ClassificationRequest, ClassificationResult, BatchTranslationRequest, BatchTranslationResult, ServiceCapabilities, ServiceLimits } from '../base/AITranslationService';
import { limitEnforcement } from '../../limits';
import { estimateInputTokensAndCost, estimateOutputTokensAndCost } from '../../token';
import { convertToPerTokenRate } from '../../token/calculation';
import ApiUsageTracker from '../../token/usage-tracker';
import { decryptApiKey } from '../../encryption';
import { PromptBuilder } from '../prompts/PromptBuilder';
import { TemplateEngine } from '../prompts/TemplateEngine';
import { getModelSpecByModel } from '../model-specs';

import { GoogleGenAI } from '@google/genai';

// Add delay function for rate limiting and backoff
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Google Gemini supported languages (comprehensive list based on Google's multilingual capabilities)
const GOOGLE_SUPPORTED_LANGUAGES = [
  'Albanian', 'Amharic', 'Arabic', 'Armenian', 'Azerbaijani', 'Basque', 'Belarusian', 'Bengali', 
  'Bosnian', 'Bulgarian', 'Burmese', 'Catalan', 'Chinese', 'Croatian', 'Czech', 'Danish', 
  'Dutch', 'English', 'Estonian', 'Filipino', 'Finnish', 'French', 'Galician', 'Georgian', 
  'German', 'Greek', 'Gujarati', 'Hebrew', 'Hindi', 'Hungarian', 'Icelandic', 'Indonesian', 
  'Irish', 'Italian', 'Japanese', 'Kannada', 'Kazakh', 'Korean', 'Latvian', 'Lithuanian', 
  'Macedonian', 'Malay', 'Malayalam', 'Marathi', 'Mongolian', 'Nepali', 'Norwegian', 'Persian', 
  'Polish', 'Portuguese', 'Punjabi', 'Romanian', 'Russian', 'Serbian', 'Sinhala', 'Slovak', 
  'Slovenian', 'Spanish', 'Swahili', 'Swedish', 'Tamil', 'Telugu', 'Thai', 'Turkish', 
  'Ukrainian', 'Urdu', 'Vietnamese', 'Welsh'
];

// Language code to full name mapping for Google
const GOOGLE_LANGUAGE_NAMES: { [key: string]: string } = {
  'sq': 'Albanian', 'am': 'Amharic', 'ar': 'Arabic', 'hy': 'Armenian', 'az': 'Azerbaijani',
  'eu': 'Basque', 'be': 'Belarusian', 'bn': 'Bengali', 'bs': 'Bosnian', 'bg': 'Bulgarian',
  'my': 'Burmese', 'ca': 'Catalan', 'zh': 'Chinese', 'hr': 'Croatian', 'cs': 'Czech',
  'da': 'Danish', 'nl': 'Dutch', 'en': 'English', 'et': 'Estonian', 'tl': 'Filipino',
  'fi': 'Finnish', 'fr': 'French', 'gl': 'Galician', 'ka': 'Georgian', 'de': 'German',
  'el': 'Greek', 'gu': 'Gujarati', 'he': 'Hebrew', 'hi': 'Hindi', 'hu': 'Hungarian',
  'is': 'Icelandic', 'id': 'Indonesian', 'ga': 'Irish', 'it': 'Italian', 'ja': 'Japanese',
  'kn': 'Kannada', 'kk': 'Kazakh', 'ko': 'Korean', 'lv': 'Latvian', 'lt': 'Lithuanian',
  'mk': 'Macedonian', 'ms': 'Malay', 'ml': 'Malayalam', 'mr': 'Marathi', 'mn': 'Mongolian',
  'ne': 'Nepali', 'no': 'Norwegian', 'fa': 'Persian', 'pl': 'Polish', 'pt': 'Portuguese',
  'pa': 'Punjabi', 'ro': 'Romanian', 'ru': 'Russian', 'sr': 'Serbian', 'si': 'Sinhala',
  'sk': 'Slovak', 'sl': 'Slovenian', 'es': 'Spanish', 'sw': 'Swahili', 'sv': 'Swedish',
  'ta': 'Tamil', 'te': 'Telugu', 'th': 'Thai', 'tr': 'Turkish', 'uk': 'Ukrainian',
  'ur': 'Urdu', 'vi': 'Vietnamese', 'cy': 'Welsh'
};

const SUPPORTED_LANGUAGES_SET = new Set(GOOGLE_SUPPORTED_LANGUAGES);

// Google Gemini model pricing (estimated based on current rates)
const GOOGLE_MODEL_PRICING = {
  'gemini-2.5-flash': { prompt: 0.000075, completion: 0.0003 },
  'gemini-2.5-pro': { prompt: 0.00125, completion: 0.005 },
  'gemini-2.0-flash-exp': { prompt: 0.000075, completion: 0.0003 },
  'gemini-1.5-flash': { prompt: 0.000075, completion: 0.0003 },
  'gemini-1.5-pro': { prompt: 0.00125, completion: 0.005 }
};

export class GoogleTranslationService extends AITranslationService {
  private googleClient: any = null;
  private cachedApiKey: string | null = null;

  constructor(config: any) {
    super(config);
  }

  protected async getApiKey(): Promise<string> {
    if (!this.config?.encryptedApiKey || !this.config?.salt) {
      throw new Error('Google AI API configuration required. Please configure API settings in Tools → AI Configuration.');
    }
    return decryptApiKey(this.config.encryptedApiKey, this.config.salt);
  }

  private async getGoogleClient(): Promise<any> {
    if (!this.googleClient || !this.cachedApiKey) {
      const apiKey = await this.getApiKey();
      if (this.cachedApiKey !== apiKey) {
        // Initialize Google Gen AI client
        this.googleClient = new GoogleGenAI({ apiKey });
        this.cachedApiKey = apiKey;
      }
    }
    return this.googleClient;
  }

  /**
   * Check and override parameters for Gemini 3 preview models
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
    thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
    warnings: string[];
  } {
    const modelSpec = getModelSpecByModel(model);
    const warnings: string[] = [];
    let temperature = requestedTemperature ?? 0.7;
    let topP: number | undefined = requestedTopP;
    let thinkingLevel: 'minimal' | 'low' | 'medium' | 'high' | undefined;
    const validThinkingLevels = ['minimal', 'low', 'medium', 'high'] as const;
    const isValidThinkingLevel = requestedThinkingLevel
      ? validThinkingLevels.includes(requestedThinkingLevel as (typeof validThinkingLevels)[number])
      : false;

    if (modelSpec?.apiParameters?.modelFamily === 'gemini-3') {
      if (requestedTemperature !== 1.0) {
        temperature = 1.0;
        if (requestedTemperature !== undefined) {
          warnings.push(
            `Gemini 3 models default to temperature=1.0. Your configured temperature of ${requestedTemperature} has been overridden to 1.0 per Google's recommendation.`
          );
        }
      }

      if (requestedThinkingLevel && !isValidThinkingLevel) {
        warnings.push(
          `Gemini 3 model thinking_level "${requestedThinkingLevel}" is invalid. Defaulting to "${modelSpec.apiParameters.thinkingLevel ?? 'low'}".`
        );
      }

      const normalizedThinkingLevel = isValidThinkingLevel
        ? (requestedThinkingLevel as (typeof validThinkingLevels)[number])
        : undefined;

      thinkingLevel = normalizedThinkingLevel
        ?? modelSpec.apiParameters.thinkingLevel
        ?? 'low';
      const supportedLevels = modelSpec.apiParameters.supportedThinkingLevels;
      if (supportedLevels && thinkingLevel && !supportedLevels.includes(thinkingLevel)) {
        const fallbackLevel = modelSpec.apiParameters.thinkingLevel ?? supportedLevels[0];
        if (requestedThinkingLevel !== undefined && requestedThinkingLevel !== null) {
          warnings.push(
            `Gemini 3 model thinking_level "${requestedThinkingLevel}" is not supported. Defaulting to "${fallbackLevel}".`
          );
        }
        thinkingLevel = fallbackLevel;
      }
    }

    return { temperature, topP, thinkingLevel, warnings };
  }

  protected normalizeLanguage(language: string): string {
    let targetLanguage = language.trim();
    
    // If it looks like a code (2-3 chars), try to map it
    if (/^[a-z]{2,3}$/i.test(targetLanguage)) {
      const mappedName = GOOGLE_LANGUAGE_NAMES[targetLanguage.toLowerCase()];
      if (mappedName) {
        console.log(`Converting language code '${targetLanguage}' to full name '${mappedName}'`);
        targetLanguage = mappedName;
      }
    }
    
    return targetLanguage;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const client = await this.getGoogleClient();
      // Test with a minimal request
      await client.models.generateContent({
        model: this.getModel(),
        contents: 'test',
        config: { maxOutputTokens: 1 }
      });
      return true;
    } catch (error) {
      console.error('Google AI API key validation failed:', error);
      return false;
    }
  }

  getServiceCapabilities(): ServiceCapabilities {
    return {
      supportsLanguages: GOOGLE_SUPPORTED_LANGUAGES,
      maxTokensPerRequest: this.config.maxTokens || 8192,
      supportsBatchOperations: true,
      supportsClassification: true
    };
  }

  getServiceLimits(): ServiceLimits {
    return {
      tokensPerMinute: this.config.tokensPerMinute || 30000,
      requestsPerMinute: this.config.requestsPerMinute || 60,
      requestsPerDay: this.config.requestsPerDay || 1500,
      inputCost: this.config.inputCost || 0.000075,
      outputCost: this.config.outputCost || 0.0003
    };
  }

  getSupportedLanguages(): string[] {
    return GOOGLE_SUPPORTED_LANGUAGES;
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
    const warnings: string[] = [];
    
    try {
      console.log('Google translation request:', {
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
          
          const client = await this.getGoogleClient();
          
          const promptConfig = await PromptBuilder.getPromptConfiguration(
            this.config,
            'translation',
            request.context
          );
          const systemInstruction = TemplateEngine.substituteVariables(
            promptConfig.systemPrompt,
            { targetLanguage, instructions: request.instructions }
          );
          
          console.log('[Google Service] Sending translation request with system prompt:', {
            promptLength: systemInstruction.length,
            targetLanguage,
            hasInstructions: !!request.instructions
          });

          const paramCheck = this.checkAndOverrideParameters(
            model,
            promptConfig.temperature,
            promptConfig.topP,
            this.config.thinkingLevel
          );
          if (paramCheck.warnings.length > 0) {
            warnings.push(...paramCheck.warnings);
          }

          const response = await client.models.generateContent({
            model,
            contents: request.text,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'object',
                properties: {
                  translatedText: {
                    type: 'string',
                    description: 'The translated text in the target language'
                  }
                },
                required: ['translatedText']
              },
              temperature: paramCheck.temperature,
              ...(paramCheck.topP !== undefined && { topP: paramCheck.topP }),
              ...(paramCheck.thinkingLevel && {
                thinkingConfig: { thinking_level: paramCheck.thinkingLevel }
              }),
              maxOutputTokens: promptConfig.maxTokens
            }
          });

          console.log('Google AI response:', response);

          if (!response.text) {
            throw new Error('No content in translation response');
          }

          const duration = Date.now() - startTime;
          const outputText = response.text;

          console.log('Attempting to parse:', outputText);
          
          const responseJson = JSON.parse(outputText);
          
          console.log('Parsed response:', responseJson);

          if (!responseJson.translatedText) {
            throw new Error('Response missing translatedText field');
          }

          const outputMetrics = estimateOutputTokensAndCost(outputText, this.config);
          const usageMetrics = this.extractUsageMetrics(
            response,
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
          
          // Only retry on rate limits and server errors
          if (this.isRetryableError(error as any)) {
            console.warn(`Translation API error, will retry: ${(error as any).message}`);
            continue;
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
      
      this.handleServiceError(error, 'translation');
    }
  }

  async translateTextBatch(request: BatchTranslationRequest): Promise<BatchTranslationResult> {
    const model = this.getModel();
    const startTime = Date.now();
    let targetLanguage = this.normalizeLanguage(request.targetLanguage);
    const warnings: string[] = [];
    
    // Validate language
    if (!this.isLanguageSupported(targetLanguage)) {
      throw new Error(`Unsupported language: ${request.targetLanguage}. Please use full language name.`);
    }

    // Deduplication: Group texts by content
    const uniqueTexts = new Map<string, { ids: string[]; instructions?: string }>();
    
    for (const item of request.texts) {
      const text = item.text.trim();
      
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
        data.instructions ? `Text ${index + 1}: ${data.instructions}` : null
      ).filter(Boolean).join(' ') : '';
    
    try {
      const client = await this.getGoogleClient();
      
      const promptConfig = await PromptBuilder.getPromptConfiguration(
        this.config,
        'batch_translation',
        request.context || 'document'
      );
      const systemInstruction = TemplateEngine.substituteVariables(
        promptConfig.systemPrompt,
        { targetLanguage, specialInstructions: specialInstructionsText }
      );
      
      console.log('[Google Service] Sending batch translation request with system prompt:', {
        promptLength: systemInstruction.length,
        targetLanguage,
        uniqueTexts: uniqueTexts.size
      });
      
      const paramCheck = this.checkAndOverrideParameters(
        model,
        promptConfig.temperature,
        promptConfig.topP,
        this.config.thinkingLevel
      );
      if (paramCheck.warnings.length > 0) {
        warnings.push(...paramCheck.warnings);
      }

      const response = await client.models.generateContent({
        model,
        contents: `Translate these texts to ${targetLanguage}:\n${textsForTranslation}`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              translations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    translatedText: {
                      type: 'string',
                      description: 'The translated text in the target language'
                    }
                  },
                  required: ['translatedText']
                }
              }
            },
            required: ['translations']
          },
          temperature: paramCheck.temperature,
          ...(paramCheck.topP !== undefined && { topP: paramCheck.topP }),
          ...(paramCheck.thinkingLevel && {
            thinkingConfig: { thinking_level: paramCheck.thinkingLevel }
          }),
          maxOutputTokens: promptConfig.maxTokens
        }
      });

      if (!response.text) {
        throw new Error('No content in translation response');
      }

      const responseJson = JSON.parse(response.text);
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
      // Estimate token usage
      const estimatedInputTokens = Math.ceil(textsForTranslation.length / 4) + 100;
      const estimatedOutputTokens = Math.ceil(response.text.length / 4);
      const usageMetrics = this.extractUsageMetrics(response, estimatedInputTokens, estimatedOutputTokens);
      
      // Calculate cost using configuration-based rates
      const inputCostPerToken = convertToPerTokenRate(this.config.inputCost || 0, this.config.unitPrice);
      const outputCostPerToken = convertToPerTokenRate(this.config.outputCost || 0, this.config.unitPrice);
      const totalCost = (usageMetrics.promptTokens * inputCostPerToken) +
        (usageMetrics.completionTokens * outputCostPerToken);
      
      // Log API usage
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
      
      console.log(`Batch translation completed: ${uniqueTexts.size} unique -> ${allTranslations.length} total`);
      
      const result: BatchTranslationResult = {
        translations: allTranslations,
        metrics: {
          duration,
          promptTokens: usageMetrics.promptTokens,
          completionTokens: usageMetrics.completionTokens,
          totalCost
        }
      };

      if (warnings.length > 0) {
        result.warnings = warnings;
      }

      // Track usage for multi-service analytics
      await this.trackSuccessfulUsage(
        'batch',
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
      console.error('Batch translation error:', error);
      this.handleServiceError(error, 'batch translation');
    }
  }

  async classifySegments(request: ClassificationRequest): Promise<ClassificationResult> {
    const model = this.getModel();
    const startTime = Date.now();
    const warnings: string[] = [];
    
    try {
      console.log('Classification request:', {
        model,
        segmentCount: request.segments.length
      });

      const client = await this.getGoogleClient();
      
      // Create the classification prompt
      const segmentsText = request.segments.map((seg, index) => 
        `${index + 1}. "${seg.text}"`
      ).join('\n');

      const promptConfig = await PromptBuilder.getPromptConfiguration(
        this.config,
        'classification'
      );
      const systemInstruction = promptConfig.systemPrompt;
      
      console.log('[Google Service] Sending classification request with system prompt:', {
        promptLength: systemInstruction.length,
        segmentCount: request.segments.length
      });

      const paramCheck = this.checkAndOverrideParameters(
        model,
        promptConfig.temperature,
        promptConfig.topP,
        this.config.thinkingLevel
      );
      if (paramCheck.warnings.length > 0) {
        warnings.push(...paramCheck.warnings);
      }

      const response = await client.models.generateContent({
        model,
        contents: `Classify these text segments:\n${segmentsText}`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              classifications: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    a: { type: 'number', minimum: 0, maximum: 1 },
                    b: { type: 'number', minimum: 0, maximum: 1 }
                  },
                  required: ['id', 'a', 'b']
                }
              }
            },
            required: ['classifications']
          },
          temperature: paramCheck.temperature,
          ...(paramCheck.topP !== undefined && { topP: paramCheck.topP }),
          ...(paramCheck.thinkingLevel && {
            thinkingConfig: { thinking_level: paramCheck.thinkingLevel }
          }),
          maxOutputTokens: promptConfig.maxTokens
        }
      });

      console.log('Google AI classification response:', response);

      if (!response.text) {
        throw new Error('No content in classification response');
      }

      const duration = Date.now() - startTime;
      const outputText = response.text;

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

      // Estimate token usage
      const estimatedInputTokens = Math.ceil(segmentsText.length / 4) + 100;
      const estimatedOutputTokens = Math.ceil(outputText.length / 4);
      const usageMetrics = this.extractUsageMetrics(response, estimatedInputTokens, estimatedOutputTokens);
      
      // Calculate cost using configuration-based rates
      const inputCostPerToken = convertToPerTokenRate(this.config.inputCost || 0, this.config.unitPrice);
      const outputCostPerToken = convertToPerTokenRate(this.config.outputCost || 0, this.config.unitPrice);
      const totalCost = (usageMetrics.promptTokens * inputCostPerToken) +
        (usageMetrics.completionTokens * outputCostPerToken);

      // Log API usage
      try {
        await ApiUsageTracker.logApiUsage(
          usageMetrics.promptTokens,
          usageMetrics.completionTokens,
          model,
          'classification'
        );
      } catch (loggingError) {
        console.warn('Failed to log API usage:', loggingError);
      }

      const result: ClassificationResult = {
        classifications: classificationsWithIds,
        metrics: {
          duration,
          promptTokens: usageMetrics.promptTokens,
          completionTokens: usageMetrics.completionTokens,
          totalCost
        }
      };

      if (warnings.length > 0) {
        result.warnings = warnings;
      }

      // Track usage for multi-service analytics
      await this.trackSuccessfulUsage(
        'classification',
        {
          promptTokens: usageMetrics.promptTokens,
          completionTokens: usageMetrics.completionTokens,
          totalCost,
          duration
        },
        model,
        { language: undefined } // Classification doesn't target a specific language
      );

      return result;
      
    } catch (error) {
      console.error('Classification error details:', {
        error,
        request: {
          segmentCount: request.segments.length
        }
      });
      
      this.handleServiceError(error, 'classification');
    }
  }

  async classifySegmentsBatch(request: ClassificationRequest): Promise<ClassificationResult> {
    const model = this.getModel();
    const startTime = Date.now();
    const warnings: string[] = [];
    
    try {
      console.log('Batch classification request:', {
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
      
      // Create numbered prompt with unique texts (consistent with single classification)
      const uniqueTextsArray = Array.from(uniqueTexts.keys());
      const segmentsText = uniqueTextsArray.map((text, index) => 
        `${index + 1}. "${text}"`
      ).join('\n');

      const client = await this.getGoogleClient();
      
      const promptConfig = await PromptBuilder.getPromptConfiguration(
        this.config,
        'batch_classification'
      );
      const systemInstruction = promptConfig.systemPrompt;
      
      console.log('[Google Service] Sending batch classification request with system prompt:', {
        promptLength: systemInstruction.length,
        segmentCount: request.segments.length,
        uniqueTexts: uniqueTexts.size
      });

      const paramCheck = this.checkAndOverrideParameters(
        model,
        promptConfig.temperature,
        promptConfig.topP,
        this.config.thinkingLevel
      );
      if (paramCheck.warnings.length > 0) {
        warnings.push(...paramCheck.warnings);
      }

      const response = await client.models.generateContent({
        model,
        contents: `Classify these text segments:\n${segmentsText}`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              classifications: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    a: { type: 'number', minimum: 0, maximum: 1 },
                    b: { type: 'number', minimum: 0, maximum: 1 }
                  },
                  required: ['id', 'a', 'b']
                }
              }
            },
            required: ['classifications']
          },
          temperature: paramCheck.temperature,
          ...(paramCheck.topP !== undefined && { topP: paramCheck.topP }),
          ...(paramCheck.thinkingLevel && {
            thinkingConfig: { thinking_level: paramCheck.thinkingLevel }
          }),
          maxOutputTokens: promptConfig.maxTokens
        }
      });

      console.log('Google AI batch classification response:', response);

      if (!response.text) {
        throw new Error('No content in classification response');
      }

      const duration = Date.now() - startTime;
      const outputText = response.text;

      const responseJson = JSON.parse(outputText);

      if (!responseJson.classifications || !Array.isArray(responseJson.classifications)) {
        throw new Error('Response missing classifications array');
      }

      // Map results back to all segment instances using response IDs and text
      const allClassifications: Array<{
        id: string;
        a: number;
        b: number;
      }> = [];
      
      // Create mapping from response classifications back to original segments
      responseJson.classifications.forEach((classification: any, index: number) => {
        const originalText = uniqueTextsArray[index];
        const segmentIds = uniqueTexts.get(originalText) || [];
        
        segmentIds.forEach(id => {
          allClassifications.push({
            id,
            a: classification.a,
            b: classification.b
          });
        });
      });

      // Estimate token usage
      const estimatedInputTokens = Math.ceil(segmentsText.length / 4) + 100;
      const estimatedOutputTokens = Math.ceil(outputText.length / 4);
      const usageMetrics = this.extractUsageMetrics(response, estimatedInputTokens, estimatedOutputTokens);
      
      // Calculate cost using configuration-based rates
      const inputCostPerToken = convertToPerTokenRate(this.config.inputCost || 0, this.config.unitPrice);
      const outputCostPerToken = convertToPerTokenRate(this.config.outputCost || 0, this.config.unitPrice);
      const totalCost = (usageMetrics.promptTokens * inputCostPerToken) +
        (usageMetrics.completionTokens * outputCostPerToken);

      // Log API usage
      try {
        await ApiUsageTracker.logApiUsage(
          usageMetrics.promptTokens,
          usageMetrics.completionTokens,
          model,
          'classification'
        );
      } catch (loggingError) {
        console.warn('Failed to log API usage:', loggingError);
      }

      console.log(`Batch classification completed: ${uniqueTexts.size} unique texts -> ${allClassifications.length} total results`);

      const result: ClassificationResult = {
        classifications: allClassifications,
        metrics: {
          duration,
          promptTokens: usageMetrics.promptTokens,
          completionTokens: usageMetrics.completionTokens,
          totalCost
        }
      };

      if (warnings.length > 0) {
        result.warnings = warnings;
      }

      // Track usage for multi-service analytics
      await this.trackSuccessfulUsage(
        'classification',
        {
          promptTokens: usageMetrics.promptTokens,
          completionTokens: usageMetrics.completionTokens,
          totalCost,
          duration
        },
        model,
        { language: undefined } // Classification doesn't target a specific language
      );

      return result;
      
    } catch (error) {
      console.error('Batch classification error details:', {
        error,
        request: {
          segmentCount: request.segments.length
        }
      });
      
      this.handleServiceError(error, 'batch classification');
    }
  }

  private extractUsageMetrics(
    response: any,
    fallbackPromptTokens: number,
    fallbackCompletionTokens: number
  ): { promptTokens: number; completionTokens: number } {
    const usageMetadata = response?.usageMetadata;
    const promptTokenCount = usageMetadata?.promptTokenCount;
    const candidatesTokenCount = usageMetadata?.candidatesTokenCount;
    const thoughtsTokenCount = usageMetadata?.thoughtsTokenCount;
    const hasCompletionCounts = (candidatesTokenCount !== undefined && candidatesTokenCount !== null) ||
      (thoughtsTokenCount !== undefined && thoughtsTokenCount !== null);
    const completionTokens = hasCompletionCounts
      ? (candidatesTokenCount || 0) + (thoughtsTokenCount || 0)
      : fallbackCompletionTokens;

    return {
      promptTokens: promptTokenCount ?? fallbackPromptTokens,
      completionTokens
    };
  }

  private isRetryableError(error: any): boolean {
    // Google AI specific retryable errors
    if (error.status === 429 || // Rate limit
        error.status === 503 || // Service unavailable  
        error.status === 500 || // Internal server error
        error.status === 502 || // Bad gateway
        error.status === 504) { // Gateway timeout
      return true;
    }
    return false;
  }
}
