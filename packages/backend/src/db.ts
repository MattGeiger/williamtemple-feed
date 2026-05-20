// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { PrismaClient } from '@prisma/client';
import { translationTriggerService } from './services/translation-trigger';

const prisma = new PrismaClient({
  // Configure higher transaction timeout to prevent timeouts on complex operations
  transactionOptions: {
    maxWait: 30000,  // 30 seconds max wait time
    timeout: 20000   // 20 seconds transaction timeout
  }
});

// Register translation middleware
prisma.$use(async (params, next) => {
  const result = await next(params);

  const shouldTranslate = (
    params.action === 'create' || 
    params.action === 'update'
  ) && (
    params.model === 'FoodItem' ||
    params.model === 'Category'
  );

  if (shouldTranslate && result) {
    const translatableFields = {
      FoodItem: ['name'],
      Category: ['name']
    };

    const fields = translatableFields[params.model as keyof typeof translatableFields];
    
    fields.forEach(field => {
      if (result[field]) {
        translationTriggerService.queueContentTranslation(
          result.id,
          params.model as 'FoodItem' | 'Category',
          field,
          result[field]
        );
      }
    });
  }

  return result;
});

export default prisma;