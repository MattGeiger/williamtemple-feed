# Help Screenshot Plan

This file tracks places where showing the screen will be better than only
telling the reader what to do.

## Capture Rules

- Capture real FEED screens after the Help structure is in place.
- Keep screenshots focused on one task.
- Avoid private client information.
- Capture both light and dark mode for every in-app screenshot so the guide
  matches the reader's current theme.
- Update the matching guide when a screenshot is added.
- Store in-app help screenshots in `packages/frontend/public/help-screenshots/`
  and reference them from guides with `/help-screenshots/file-name.png`.
- Use the base filename for the light screenshot and the matching `-dark`
  filename for dark mode. Example: `inventory-food-items-table.png` and
  `inventory-food-items-table-dark.png`.

## Planned Screenshots

| Priority | Guide | Section | User question | Proposed screenshot | Notes | Status |
|---|---|---|---|---|---|---|
| High | Getting Started | Where To Start | Where do I go? | Sidebar and Dashboard overview | Captured authenticated dev data in current collapsed-sidebar state | Added |
| High | Getting Started | How To Sign In | Where do I enter the code? | Login page and OTP step | Hide real email addresses | Planned |
| High | Dashboard & Alerts | What To Check | What does the home page tell me? | Full Dashboard overview | Captured authenticated dev data | Added |
| Medium | Dashboard & Alerts | How To Review Alerts | Where are alerts? | Alert bell and alerts dialog | Show one safe example alert | Planned |
| High | Inventory | How To Update Stock Status | How do I mark an item in stock? | Food Items table with status filter and row menu | Captured authenticated dev data; row menu screenshot can be added later if needed | Added |
| Medium | Inventory | Categories | Where do limits change? | Category edit dialog | Use common category example | Planned |
| High | Inventory Analytics | Read The Analytics | Where do I review availability and service pressure? | Analytics workspace with date range, summary, charts, and history tables | Use representative inventory data without client information | Planned |
| High | Inventory Analytics | Generate Analytics Reports | How do I combine cards into one report? | Analytics selection mode and Generate Report review | Avoid showing locally downloaded files or identifying data | Planned |
| Medium | Inventory | Optional Supply Information | Where can I add an optional estimate or supply source? | Food Item editor with Supply tab selected | Show Unknown defaults and no client information | Planned |
| High | Languages & Translations | What Translations Does | Where do translations live? | Translations table | Captured authenticated dev data | Added |
| High | Languages & Translations | How To Find Missing Translations | How do I repair gaps? | Find Missing Translations dialog | Captured authenticated dev data | Added |
| High | Document Translator | How To Translate A Document | How do I start a translation? | Upload dialog and document table | Captured authenticated dev data | Added |
| High | Shopping Lists | How To Export A List | How do I download a PDF? | Shopping Lists table row menu | Captured authenticated dev data with Download PDF and Translate & Download PDF visible | Added |
| Medium | Shopping Lists | Export Settings | How are filenames controlled? | Export Settings dialog | Captured authenticated dev data with filename preview | Added |
| High | Shopping List Builder | What You Build | What am I editing? | Builder canvas with side panels | Captured authenticated dev data | Added |
| High | Shopping List Builder | Translation Settings | How do I show English and translation? | Translation Settings dialog | Show row settings when possible | Planned |
| Medium | AI Configuration | What It Controls | Where are provider settings? | AI Configuration list | Captured authenticated dev data; no API key values visible | Added |
| High | Data Management | Add Data | Where do I import a CSV? | Unified Add Data drop area and detected-source review | Use a synthetic file with no client data | Planned |
| High | Service Log | Record The Day | Where do I record service counts? | Service Date control and configured metric cards | Use synthetic counts and generic metric names | Planned |
| Medium | Service Log | Configure Service Metrics | How do I add or edit a metric? | Three-step metric dialog with icon selection | Use generic pantry terminology | Planned |
| Medium | Support & Troubleshooting | Opening Help | Where do I search for help? | Help search results | Captured authenticated dev data | Added |
| Medium | AI Configuration | Cost Limits | Where are spending limits? | Cost or usage step in model dialog | Use safe example values | Planned |
