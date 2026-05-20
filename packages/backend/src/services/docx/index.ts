import { PrismaClient } from '@prisma/client';
import DocxParser from './parser';
import DocxTranslationService from './translation';
import { storageService } from '../storage';
import DocxTextValidator from './text-validation';
import StyleManager from './StyleManager';
import * as DocxTypes from './types';

// Create and export the DocxParser
const docxParser = new DocxParser();

// Create and export the DocxTranslationService with the shared Prisma client
const prisma = new PrismaClient();
const docxTranslationService = new DocxTranslationService(prisma);

// Initialize services if not already done
(async () => {
  try {
    // Ensure storage is initialized
    await storageService.initialize();
    console.log('DocxTranslationService: Storage service initialized');
  } catch (error) {
    console.error('DocxTranslationService: Failed to initialize storage service', error);
  }
})();

export {
  docxParser,
  docxTranslationService,
  DocxTextValidator,
  StyleManager,
  DocxTypes
};
