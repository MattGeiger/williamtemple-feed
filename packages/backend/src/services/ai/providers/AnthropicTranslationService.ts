import Anthropic from '@anthropic-ai/sdk';
import { AITranslationService, TranslationRequest, TranslationResult, ClassificationRequest, ClassificationResult, BatchTranslationRequest, BatchTranslationResult, ServiceCapabilities, ServiceLimits } from '../base/AITranslationService';
import { limitEnforcement } from '../../limits';
import { estimateInputTokensAndCost, estimateOutputTokensAndCost } from '../../token';
import ApiUsageTracker from '../../token/usage-tracker';
import { translationRecovery } from '../../translation-recovery';
import { decryptApiKey } from '../../encryption';
import { PromptBuilder } from '../prompts/PromptBuilder';
import { TemplateEngine } from '../prompts/TemplateEngine';
import { getModelSpecByModel } from '../model-specs';

// Add delay function for rate limiting and backoff
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Anthropic Claude supported languages (based on comprehensive multilingual capabilities)
const ANTHROPIC_SUPPORTED_LANGUAGES = [
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

// Language code to full name mapping for Anthropic
const ANTHROPIC_LANGUAGE_NAMES: { [key: string]: string } = {
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

// Set for fast lookups
const SUPPORTED_LANGUAGES_SET = new Set(ANTHROPIC_SUPPORTED_LANGUAGES);

// Optimal batch size for Anthropic tool calling with Claude 4.5 models.
// Balances throughput (fewer API calls) with quality and token efficiency.
// 40 segments × ~80 tokens/classification ≈ 3,200 tokens output (within 16K ceiling).
const ANTHROPIC_OPTIMAL_BATCH_SIZE = 40;

export class AnthropicTranslationService extends AITranslationService {
  private anthropicClient: Anthropic | null = null;
  private cachedApiKey: string | null = null;

  protected async getApiKey(): Promise<string> {
    if (!this.config?.encryptedApiKey || !this.config?.salt) {
      throw new Error('Anthropic API configuration required. Please configure API settings in Tools → AI Configuration.');
    }
    return decryptApiKey(this.config.encryptedApiKey, this.config.salt);
  }

  private async getAnthropicClient(): Promise<Anthropic> {
    if (!this.anthropicClient || !this.cachedApiKey) {
      const apiKey = await this.getApiKey();
      if (this.cachedApiKey !== apiKey) {
        // Reset client if API key changed
        this.anthropicClient = new Anthropic({ apiKey });
        this.cachedApiKey = apiKey;
      }
    }
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized');
    }
    return this.anthropicClient;
  }

  private checkAndOverrideParameters(
    model: string,
    requestedTemperature?: number,
    requestedTopP?: number
  ): {
    temperature: number;
    topP?: number;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let temperature = requestedTemperature ?? 0.7;
    let topP: number | undefined = requestedTopP ?? 1.0;

    // Claude 4.5 models reject requests that include both temperature and top_p.
    if (model.includes('-4-5-')) {
      if (temperature !== undefined && topP !== undefined) {
        const excludedTopP = topP;
        console.log(
          `[Anthropic Service] Claude 4.5 model detected, excluding top_p parameter (temperature=${temperature}, top_p=${excludedTopP})`
        );
        topP = undefined;
        warnings.push(
          `Claude 4.5 models don't support both temperature and top_p. Excluding top_p=${excludedTopP} and keeping temperature=${temperature}.`
        );
      }
    }

    return { temperature, topP, warnings };
  }

  protected normalizeLanguage(language: string): string {
    let targetLanguage = language.trim();
    
    // If it looks like a code (2-3 chars), try to map it
    if (/^[a-z]{2,3}$/i.test(targetLanguage)) {
      const mappedName = ANTHROPIC_LANGUAGE_NAMES[targetLanguage.toLowerCase()];
      if (mappedName) {
        console.log(`Converting language code '${targetLanguage}' to full name '${mappedName}'`);
        targetLanguage = mappedName;
      }
    }
    
    return targetLanguage;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const anthropic = await this.getAnthropicClient();
      // Test with a minimal request
      await anthropic.messages.create({
        model: this.getModel(),
        max_tokens: 1,
        messages: [{ role: "user", content: "test" }]
      });
      return true;
    } catch (error) {
      console.error('Anthropic API key validation failed:', error);
      return false;
    }
  }

  getServiceCapabilities(): ServiceCapabilities {
    return {
      supportsLanguages: ANTHROPIC_SUPPORTED_LANGUAGES,
      maxTokensPerRequest: this.config.maxTokens || 4096,
      supportsBatchOperations: true,
      supportsClassification: true
    };
  }

  getServiceLimits(): ServiceLimits {
    return {
      tokensPerMinute: this.config.tokensPerMinute || 20000,
      requestsPerMinute: this.config.requestsPerMinute || 50,
      requestsPerDay: this.config.requestsPerDay || 1000,
      inputCost: this.config.inputCost || 0.003,
      outputCost: this.config.outputCost || 0.015
    };
  }

  getSupportedLanguages(): string[] {
    return ANTHROPIC_SUPPORTED_LANGUAGES;
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
          
          const anthropic = await this.getAnthropicClient();
          
          const promptConfig = await PromptBuilder.getPromptConfiguration(
            this.config,
            'translation',
            request.context
          );
          const systemPrompt = TemplateEngine.substituteVariables(
            promptConfig.systemPrompt,
            { targetLanguage, instructions: request.instructions }
          );
          
          console.log('[Anthropic Service] Sending translation request with system prompt:', {
            model,
            promptLength: systemPrompt.length,
            promptPreview: systemPrompt.substring(0, 150) + '...',
            fullPrompt: systemPrompt
          });

          const paramCheck = this.checkAndOverrideParameters(
            model,
            promptConfig.temperature,
            promptConfig.topP
          );
          const maxTokens = this.resolveMaxTokens(model, promptConfig.maxTokens, 2048, 'translation');
          const response = await anthropic.messages.create({
            model,
            max_tokens: maxTokens,
            temperature: paramCheck.temperature,
            ...(paramCheck.topP !== undefined && { top_p: paramCheck.topP }),
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: request.text
              },
              {
                role: "assistant",
                content: "{"
              }
            ]
          });

          console.log('Anthropic response:', response);

          if (response.stop_reason === 'max_tokens') {
            throw new Error('Translation response was truncated due to length');
          }

          if (!response.content || response.content.length === 0) {
            throw new Error('No content in translation response');
          }

          const textContent = response.content.find(block => block.type === 'text');
          if (!textContent) {
            throw new Error('No text content in translation response');
          }

          const duration = Date.now() - startTime;
          const outputText = "{" + textContent.text;

          console.log('Attempting to parse:', outputText);
          
          let responseJson: any;
          try {
            responseJson = JSON.parse(outputText);
          } catch (parseError) {
            console.error('=== ANTHROPIC PARSE FAILURE ===');
            console.error('Model:', model);
            console.error('Target language:', targetLanguage);
            console.error('Original text:', request.text);
            console.error('Content block count:', response.content.length);
            console.error('Text block raw:', textContent.text);
            console.error('Output text (with prefix):', outputText);
            console.error('Parse error:', parseError);
            console.error('==============================');
            throw parseError;
          }
          
          console.log('Parsed response:', responseJson);

          if (!responseJson.translatedText) {
            throw new Error('Response missing translatedText field');
          }

          const outputMetrics = estimateOutputTokensAndCost(outputText, this.config);
          const totalCost = inputMetrics.cost + outputMetrics.cost;

          // Log API usage for metrics tracking
          try {
            await ApiUsageTracker.logApiUsage(
              response.usage.input_tokens,
              response.usage.output_tokens,
              model,
              'translation'
            );
          } catch (loggingError) {
            console.warn('Failed to log API usage:', loggingError);
          }

          const result = {
            translatedText: responseJson.translatedText,
            metrics: {
              duration,
              promptTokens: response.usage.input_tokens,
              completionTokens: response.usage.output_tokens,
              totalCost
            }
          };

          // Track usage for multi-service analytics
          await this.trackSuccessfulUsage(
            'translation',
            {
              promptTokens: response.usage.input_tokens,
              completionTokens: response.usage.output_tokens,
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
      
      // On rate limits or server errors, check for stuck translations
      if (this.isRetryableError(error as any)) {
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
        data.instructions ? `Text ${index + 1}: ${data.instructions}` : ''
      ).filter(Boolean).join(' ') : '';
    
    try {
      const anthropic = await this.getAnthropicClient();
      
      const promptConfig = await PromptBuilder.getPromptConfiguration(
        this.config,
        'batch_translation',
        request.context || 'document'
      );
      const systemPrompt = TemplateEngine.substituteVariables(
        promptConfig.systemPrompt,
        { targetLanguage, specialInstructions: specialInstructionsText }
      );
      
      console.log('[Anthropic Service] Sending batch translation request with system prompt:', {
        model,
        promptLength: systemPrompt.length,
        promptPreview: systemPrompt.substring(0, 150) + '...',
        fullPrompt: systemPrompt
      });
      
      const paramCheck = this.checkAndOverrideParameters(
        model,
        promptConfig.temperature,
        promptConfig.topP
      );
      const maxTokens = this.resolveMaxTokens(model, promptConfig.maxTokens, 1024, 'batch_translation');
      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature: paramCheck.temperature,
        ...(paramCheck.topP !== undefined && { top_p: paramCheck.topP }),
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Translate these texts to ${targetLanguage}:\n${textsForTranslation}`
          },
          {
            role: "assistant",
            content: "{"
          }
        ]
      });
      
      if (response.stop_reason === 'max_tokens') {
        throw new Error('Translation response was truncated due to length');
      }

      if (!response.content || response.content.length === 0) {
        throw new Error('No content in translation response');
      }

      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent) {
        throw new Error('No text content in translation response');
      }

      const outputText = "{" + textContent.text;
      const responseJson = JSON.parse(outputText);
      
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
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const totalCost = (inputTokens * this.getServiceLimits().inputCost / 1000000) + 
                       (outputTokens * this.getServiceLimits().outputCost / 1000000);
      
      // Log API usage
      try {
        await ApiUsageTracker.logApiUsage(inputTokens, outputTokens, model, 'translation');
      } catch (loggingError) {
        console.warn('Failed to log API usage:', loggingError);
      }
      
      console.log(`Batch translation completed: ${uniqueTexts.size} unique -> ${allTranslations.length} total`);
      
      const result = {
        translations: allTranslations,
        metrics: {
          duration,
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalCost
        }
      };

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
    
    try {
      console.log('Classification request:', {
        model,
        segmentCount: request.segments.length
      });

      const anthropic = await this.getAnthropicClient();
      
      // Create the classification prompt
      const segmentsText = request.segments.map((seg, index) => 
        `${index + 1}. "${seg.text}"`
      ).join('\n');

      const promptConfig = await PromptBuilder.getPromptConfiguration(
        this.config,
        'classification'
      );
      const systemPrompt = promptConfig.systemPrompt;
      
      console.log('[Anthropic Service] Sending classification request with system prompt:', {
        model,
        promptLength: systemPrompt.length,
        promptPreview: systemPrompt.substring(0, 150) + '...',
        fullPrompt: systemPrompt
      });

      // Define classification tool for guaranteed structured output
      const classificationTool: Anthropic.Tool = {
        name: "classify_segments",
        description: "Classify text segments using binary confidence scores",
        input_schema: {
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
                required: ["id", "a", "b"]
              }
            }
          },
          required: ["classifications"]
        }
      };

      const paramCheck = this.checkAndOverrideParameters(
        model,
        promptConfig.temperature,
        promptConfig.topP
      );
      const maxTokens = this.resolveMaxTokens(model, promptConfig.maxTokens, 2048, 'classification');
      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature: paramCheck.temperature,
        ...(paramCheck.topP !== undefined && { top_p: paramCheck.topP }),
        system: systemPrompt,
        tools: [classificationTool],
        tool_choice: { type: "tool", name: "classify_segments" },
        messages: [
          {
            role: "user",
            content: `Classify these text segments:\n${segmentsText}`
          }
        ]
      });

      console.log('Anthropic classification response:', response);

      if (response.stop_reason === 'max_tokens') {
        throw new Error('Classification response was truncated due to length');
      }

      // Extract tool use response
      const toolUseContent = response.content.find(block => block.type === 'tool_use');
      if (!toolUseContent) {
        throw new Error('No tool use content in classification response');
      }

      const classifications = (toolUseContent.input as any).classifications;
      if (!Array.isArray(classifications)) {
        throw new Error('Tool response missing classifications array');
      }

      const duration = Date.now() - startTime;

      console.log('Parsed classification response:', { classifications });

      // Validate response count matches input count
      if (classifications.length !== request.segments.length) {
        console.warn(`Classification count mismatch: expected ${request.segments.length}, got ${classifications.length}`);
        // Continue processing but log the discrepancy
      }

      // Map segment IDs back to the original IDs
      const classificationsWithIds = classifications.map((classification: any, index: number) => ({
        id: request.segments[index]?.id || classification.id,
        a: classification.a || 0,
        b: classification.b || 0
      }));

      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const totalCost = (inputTokens * this.getServiceLimits().inputCost / 1000000) + 
                       (outputTokens * this.getServiceLimits().outputCost / 1000000);

      // Log API usage
      try {
        await ApiUsageTracker.logApiUsage(inputTokens, outputTokens, model, 'classification');
      } catch (loggingError) {
        console.warn('Failed to log API usage:', loggingError);
      }

      const result = {
        classifications: classificationsWithIds,
        metrics: {
          duration,
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalCost
        }
      };

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
        { language: undefined }
      );

      return result;
      
    } catch (error) {
      this.handleServiceError(error, 'classification');
    }
  }

  async classifySegmentsBatch(request: ClassificationRequest): Promise<ClassificationResult> {
    const model = this.getModel();
    const startTime = Date.now();
    
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
      
      // Create array of unique texts for processing
      const uniqueTextsArray = Array.from(uniqueTexts.keys());
      
      // Split into optimal batch sizes for Anthropic tool calling
      const batches: string[][] = [];
      for (let i = 0; i < uniqueTextsArray.length; i += ANTHROPIC_OPTIMAL_BATCH_SIZE) {
        batches.push(uniqueTextsArray.slice(i, i + ANTHROPIC_OPTIMAL_BATCH_SIZE));
      }
      
      console.log(`Processing ${uniqueTextsArray.length} unique texts in ${batches.length} parallel batches (${ANTHROPIC_OPTIMAL_BATCH_SIZE} segments each)`);
      
      // Get prompt configuration once
      const promptConfig = await PromptBuilder.getPromptConfiguration(
        this.config,
        'batch_classification'
      );
      
      const maxTokens = this.resolveMaxTokens(model, promptConfig.maxTokens, 2048, 'batch_classification');
      console.log('[Classification] Batch configuration:', {
        batchSize: ANTHROPIC_OPTIMAL_BATCH_SIZE,
        totalBatches: batches.length,
        maxTokensPerBatch: maxTokens,
        estimatedOutputPerBatch: batches[0]?.length ? batches[0].length * 80 : 0
      });

      // Process batches in parallel
      const batchPromises = batches.map(async (batch, batchIndex) => {
        return this.processSingleBatch(batch, batchIndex, promptConfig);
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      // Combine all results
      let allClassifications: Array<{ id: string; a: number; b: number; }> = [];
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalCost = 0;
      
      batchResults.forEach((batchResult, batchIndex) => {
        const batchTexts = batches[batchIndex];
        
        batchResult.classifications.forEach((classification: any, index: number) => {
          const originalText = batchTexts[index];
          const segmentIds = uniqueTexts.get(originalText) || [];
          
          segmentIds.forEach(id => {
            allClassifications.push({
              id,
              a: classification.a || 0,
              b: classification.b || 0
            });
          });
        });
        
        totalInputTokens += batchResult.metrics.promptTokens;
        totalOutputTokens += batchResult.metrics.completionTokens;
        totalCost += batchResult.metrics.totalCost;
      });
      
      const duration = Date.now() - startTime;
      
      // Log combined API usage
      try {
        await ApiUsageTracker.logApiUsage(totalInputTokens, totalOutputTokens, model, 'classification');
      } catch (loggingError) {
        console.warn('Failed to log API usage:', loggingError);
      }

      console.log(`Parallel batch classification completed: ${uniqueTexts.size} unique texts -> ${allClassifications.length} total results in ${duration}ms`);

      const result = {
        classifications: allClassifications,
        metrics: {
          duration,
          promptTokens: totalInputTokens,
          completionTokens: totalOutputTokens,
          totalCost
        }
      };

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
        { language: undefined }
      );

      return result;
      
    } catch (error) {
      this.handleServiceError(error, 'batch classification');
    }
  }
  
  private async processSingleBatch(batch: string[], batchIndex: number, promptConfig: any): Promise<{ classifications: any[], metrics: any }> {
    const model = this.getModel();
    const anthropic = await this.getAnthropicClient();
    
    const segmentsText = batch.map((text, index) => 
      `${index + 1}. "${text}"`
    ).join('\n');
    
    const systemPrompt = promptConfig.systemPrompt;
    
    // Define classification tool for guaranteed structured output
      const classificationTool: Anthropic.Tool = {
        name: "classify_segments_batch",
        description: "Classify text segments using binary confidence scores",
        input_schema: {
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
                required: ["id", "a", "b"]
              }
            }
          },
          required: ["classifications"]
        }
      };

      const paramCheck = this.checkAndOverrideParameters(
        model,
        promptConfig.temperature,
        promptConfig.topP
      );

      const response = await anthropic.messages.create({
        model,
        max_tokens: this.resolveMaxTokens(model, promptConfig.maxTokens, 2048, 'batch_classification'),
        temperature: paramCheck.temperature,
        ...(paramCheck.topP !== undefined && { top_p: paramCheck.topP }),
        system: systemPrompt,
        tools: [classificationTool],
        tool_choice: { type: "tool", name: "classify_segments_batch" },
        messages: [
          {
            role: "user",
            content: `Classify these text segments:\n${segmentsText}`
          }
        ]
      });

    if (response.stop_reason === 'max_tokens') {
      throw new Error(`Classification batch ${batchIndex} response was truncated due to length`);
    }

    // Extract tool use response
    const toolUseContent = response.content.find(block => block.type === 'tool_use');
    if (!toolUseContent) {
      throw new Error(`No tool use content in classification batch ${batchIndex} response`);
    }

    const classifications = (toolUseContent.input as any).classifications;
    if (!Array.isArray(classifications)) {
      throw new Error(`Tool response missing classifications array in batch ${batchIndex}`);
    }
    
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const totalCost = (inputTokens * this.getServiceLimits().inputCost / 1000000) + 
                     (outputTokens * this.getServiceLimits().outputCost / 1000000);
    
    return {
      classifications,
      metrics: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalCost
      }
    };
  }

  private resolveMaxTokens(
    model: string,
    promptConfigMaxTokens: number | undefined,
    fallback: number,
    operationType?: 'classification' | 'batch_classification' | 'translation' | 'batch_translation'
  ): number {
    const modelSpec = getModelSpecByModel(model);
    const isClaude45Model = model.includes('-4-5-');
    // Operation-specific ceilings to prevent SDK timeouts and right-size outputs.
    const OPERATION_CEILINGS: Record<string, number | undefined> = {
      classification: 16384,
      batch_classification: 16384,
      translation: 20480,
      batch_translation: 20480
    };
    const operationCeiling =
      isClaude45Model && operationType ? OPERATION_CEILINGS[operationType] : undefined;
    const candidates = [
      operationCeiling,
      promptConfigMaxTokens,
      this.config.outputTokenLimit ?? undefined,
      this.config.maxTokens ?? undefined,
      modelSpec?.outputTokenLimit
    ].filter((value): value is number => typeof value === 'number' && value > 0);

    const resolved = candidates.length > 0 ? Math.min(...candidates) : fallback;
    return Math.max(1, Math.floor(resolved));
  }

  private isRetryableError(error: any): boolean {
    // Anthropic specific retryable errors
    if (error.status === 429 || // Rate limit
        error.status === 500 || // Internal server error
        error.status === 502 || // Bad gateway
        error.status === 503 || // Service unavailable
        error.status === 504) { // Gateway timeout
      return true;
    }
    return false;
  }

}
