# AI Configuration

AI Configuration controls the translation providers, models, prompts, and cost limits used by FEED.

## Who Should Use It?

This page is for administrators or trusted staff who manage translation settings.

Most daily pantry work does not require changing AI Configuration.

## What It Controls

AI Configuration lists the prompts, provider keys, and model settings FEED uses for translation work.

![AI Configuration table with active prompt and API key records](/help-screenshots/ai-configuration-list.png)

- Which AI provider FEED uses.
- Which model is selected.
- Translation prompts.
- API keys.
- Daily or monthly cost limits.
- Usage limits.

## Current Model Choices

OpenAI offers GPT-6 Luna, GPT-6.1 Terra, GPT-6.1 Sol and GPT-6 Astra.
Anthropic offers Claude Haiku 5.5, Sonnet 5.5, Opus 5.5 and Fable 5.1.
Google choices are unchanged. Choose a model, enter its provider key, and
continue through the existing settings to save.

Older models no longer appear as new selections. A saved configuration can
still show its older model and replacement advice; it remains usable while its
provider supports it. Editing with the key field blank keeps the existing key.

Preset prices track the published rates used by FEED. Editing a price or its
unit keeps your manual rate instead. Daily and monthly budgets remain your choice.

## When To Change It

Change AI Configuration when:

- A provider key changes.
- Translation quality needs adjustment.
- Cost limits need review.

## API Key Warnings

FEED may warn you if a key looks unusual for the provider.

A warning does not always block saving. It is a reminder to double-check before moving on.

## Cost Limits

Cost limits help prevent surprise spending.

If translations stop unexpectedly, ask whether a cost or usage limit has been reached.

## Active and Inactive AI Model Settings

If more than one AI model is set to *Active*, only the model most recently set will be used for translation. At least one AI model must be set to *Active* for translation and classification features to work.

## What To Read Next

- For translation workflows, read [Languages & Translations](05-languages-translations.md).
- For document translation, read [Document Translator](06-document-translator.md).
