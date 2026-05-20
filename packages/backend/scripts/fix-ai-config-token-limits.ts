#!/usr/bin/env npx ts-node

/**
 * Migration script to fix AIConfiguration.maxTokens values
 * 
 * Issue: maxTokens was incorrectly populated with inputTokenLimit (context window)
 * instead of outputTokenLimit (completion tokens) during model auto-fill.
 * 
 * This causes OpenAI API errors because max_tokens expects completion token limit,
 * not input token limit.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Model specifications for fixing token limits
const MODEL_OUTPUT_LIMITS: Record<string, number> = {
  // OpenAI Models
  'gpt-4.1-nano-2025-04-14': 32768,
  'gpt-4.1-mini-2025-04-14': 32768,
  'gpt-4.1-2025-04-14': 32768,
  'gpt-4o-mini-2024-07-18': 16384, // No outputTokenLimit in specs, use reasonable default
  'gpt-4o-2024-05-13': 16384, // No outputTokenLimit in specs, use reasonable default
  'o4-mini-2025-04-16': 65536, // No outputTokenLimit in specs, use reasonable default
  'o3-mini-2025-01-31': 65536, // No outputTokenLimit in specs, use reasonable default
  'o3-2025-04-16': 65536, // No outputTokenLimit in specs, use reasonable default
  
  // Anthropic Models (no outputTokenLimit specified, use reasonable defaults)
  'claude-3-5-haiku-20241022': 8192,
  'claude-sonnet-4-20250514': 8192,
  'claude-3-7-sonnet-20250219': 64000,
  'claude-opus-4-20250514': 8192,
  
  // Google Models
  'gemini-2.5-flash-lite-preview-06-17': 65536,
  'gemini-2.5-flash-lite': 65536,
  'gemini-2.5-flash': 65536,
  'gemini-2.5-pro': 65536
}

// Threshold for detecting incorrect values (likely inputTokenLimit)
const UNREASONABLE_TOKEN_LIMIT = 100000

async function fixAIConfigTokenLimits() {
  console.log('🔧 Starting AI Configuration token limits migration...')
  
  try {
    // Find configurations with unreasonably high maxTokens
    const problematicConfigs = await prisma.aIConfiguration.findMany({
      where: {
        type: 'apikey',
        maxTokens: {
          gt: UNREASONABLE_TOKEN_LIMIT
        }
      }
    })

    if (problematicConfigs.length === 0) {
      console.log('✅ No problematic token limits found. Migration not needed.')
      return
    }

    console.log(`📋 Found ${problematicConfigs.length} configurations with problematic token limits:`)
    
    const updates: Array<{
      id: number
      name: string
      currentMaxTokens: number | null
      newMaxTokens: number
      model: string | null
    }> = []

    // Process each configuration
    for (const config of problematicConfigs) {
      let newMaxTokens: number

      // Try to find correct limit based on model
      if (config.model && MODEL_OUTPUT_LIMITS[config.model]) {
        newMaxTokens = MODEL_OUTPUT_LIMITS[config.model]
      } else {
        // Use safe default for unknown models
        newMaxTokens = 4096
        console.log(`⚠️  Unknown model "${config.model}" for config "${config.name}", using default 4096`)
      }

      updates.push({
        id: config.id,
        name: config.name,
        currentMaxTokens: config.maxTokens,
        newMaxTokens,
        model: config.model
      })

      console.log(`  - "${config.name}" (${config.model}): ${config.maxTokens} → ${newMaxTokens}`)
    }

    // Confirm before proceeding
    console.log(`\n📝 About to update ${updates.length} configurations. Proceeding...`)

    // Execute updates in transaction
    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.aIConfiguration.update({
          where: { id: update.id },
          data: { maxTokens: update.newMaxTokens }
        })
      }
    })

    console.log(`✅ Successfully updated ${updates.length} configurations`)
    console.log('\n📊 Migration Summary:')
    updates.forEach(update => {
      console.log(`  ✓ ${update.name}: ${update.currentMaxTokens} → ${update.newMaxTokens}`)
    })

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the migration
if (require.main === module) {
  fixAIConfigTokenLimits()
    .then(() => {
      console.log('\n🎉 Token limits migration completed successfully!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Token limits migration failed:', error)
      process.exit(1)
    })
}

export { fixAIConfigTokenLimits }
