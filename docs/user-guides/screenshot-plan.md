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
| High | Inventory Reports | Choose A Report View | Where do I review stock risk and replenishment needs? | Reports workspace with date range, planning horizon, and report tabs | Use representative inventory data without client information | Planned |
| High | Inventory Reports | Generate A PDF And CSV Package | How do I choose and order report blocks? | Report selection and confirmation workflow | Show several selected blocks and both export formats | Planned |
| Medium | Inventory Reports | Save A Shared Report Template | Where do shared report templates live? | Report Templates management table | Show Apply, Generate, and row actions | Planned |
| High | Languages & Translations | What Translations Does | Where do translations live? | Translations table | Captured authenticated dev data | Added |
| High | Languages & Translations | How To Find Missing Translations | How do I repair gaps? | Find Missing Translations dialog | Captured authenticated dev data | Added |
| High | Document Translator | How To Translate A Document | How do I start a translation? | Upload dialog and document table | Captured authenticated dev data | Added |
| High | Shopping Lists | How To Export A List | How do I download a PDF? | Shopping Lists table row menu | Captured authenticated dev data with Download PDF and Translate & Download PDF visible | Added |
| Medium | Shopping Lists | Export Settings | How are filenames controlled? | Export Settings dialog | Captured authenticated dev data with filename preview | Added |
| High | Shopping List Builder | What You Build | What am I editing? | Builder canvas with side panels | Captured authenticated dev data | Added |
| High | Shopping List Builder | Translation Settings | How do I show English and translation? | Translation Settings dialog | Show row settings when possible | Planned |
| Medium | AI Configuration | What It Controls | Where are provider settings? | AI Configuration list | Captured authenticated dev data; no API key values visible | Added |
| Medium | Support & Troubleshooting | Opening Help | Where do I search for help? | Help search results | Captured authenticated dev data | Added |
| Medium | AI Configuration | Cost Limits | Where are spending limits? | Cost or usage step in model dialog | Use safe example values | Planned |
