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

## 1.5.0 Coverage Audit (2026-08-19)

Counted `![` per guide. The split is not subtle — **every guide written for the
1.5 feature set has no screenshots at all**, and they are the longest ones:

| Guide | Images | Lines |
|---|---|---|
| 04 Inventory & Analytics | **0** | 313 |
| 12 Data Management | **0** | 181 |
| 14 Analytics Reports | **0** | 181 |
| 13 Admin | **0** | 93 |
| 15 Service Log | **0** | 72 |
| 11 Settings | **0** | 57 |
| *(01–10, older features)* | 1–3 each | 45–83 |

**897 lines of guide with no visual reference**, covering the newest and least
familiar functionality. The older guides average one screenshot per ~25 lines.

The 14 existing screenshots are all correctly paired light/dark — the convention
holds, it simply stopped being applied when these guides were written.

### Where a picture replaces prose

Not every section needs one. These are the places where the text is currently
describing something *visual* or *sequential*, which is where a screenshot earns
its place rather than decorating.

| Priority | Guide | Section | Why prose is failing | Proposed screenshot | Status |
|---|---|---|---|---|---|
| **High** | Analytics Reports | Making a report | "The cards start to wiggle. Click the ones you want. Each gets a number showing where it will appear" — an entirely visual behaviour explained in words. The single clearest case in the set. | Selection mode active, several cards chosen and numbered | Planned |
| **High** | Analytics Reports | Making a report | The Review step has drag-to-reorder, a name field, and include/exclude toggles; three paragraphs describe one screen. | Review dialog with cards ordered and the suggested name visible | Planned |
| **High** | Data Management | Add Data | Import is the highest-stakes staff action and the flow is multi-step. | Drop area, then the detected-source review with reconciliation counts | Planned |
| **High** | Data Management | Add Data | **New in beta.21**: a rejected file now names the record and offers Try Another File. Staff should recognise it before meeting it. | The failure panel with a real error message | Planned |
| **High** | Inventory & Analytics | Read Client Analytics | Describing a bubble map in prose is close to pointless; a reader cannot picture bubble-area scaling. | Where Households Live, Portland metro, bubbles visible | Planned |
| **High** | Service Log | Record The Day | Already listed below as Planned since before 1.5; still uncaptured, and the metric cards are the daily workflow. | Service Date control with configured metric cards | Planned |
| Medium | Inventory & Analytics | Read The Analytics | Four tabs and a date-range control described in text; one image orients the whole page. | Analytics workspace, tab row and date presets visible | Planned |
| Medium | Inventory & Analytics | Read Service Analytics | The Households/Visits toggle is a control the reader must find before the text makes sense. | Households by Season with the measure toggle | Planned |
| Medium | Data Management | Restore A Backup | Recovery under stress; the confirmation step lists what will be replaced. | Restore confirmation with the unit list | Planned |
| Medium | Admin | Inviting someone new | A form with role choice; currently 93 lines with nothing shown. | Invite dialog with role selection | Planned |
| Medium | Admin | Choosing how strict sign-in is | The strictness options are the page's real decision and are easy to mis-set. | Sign-in policy controls | Planned |
| Medium | Settings | Update The Weekly Schedule | A grid of day rows with open/close times — visual by nature. | Operating Hours weekly schedule | Planned |
| Low | Settings | Choose How FEED Looks | Theme choice is self-evident once found. | Appearance setting | Planned |
| Low | Service Log | Configure Service Metrics | Three-step dialog; already listed below. | Metric dialog with icon selection | Planned |

### Deliberately not proposed

- **Analytics card-by-card descriptions** (04, lines 43–283). Twenty-odd cards
  described in text. Screenshotting each would create a maintenance burden that
  goes stale every time a chart changes, and the descriptions are about *what
  the numbers mean*, which a picture does not convey. One orientation image for
  the workspace is the right amount.
- **Report output examples.** A PDF page or CSV screenshot dates instantly and
  tells the reader nothing they cannot see by generating one.
- **Admin history, Data Management import history.** Ordinary tables; the
  existing table screenshots elsewhere already teach the pattern.

### Capture note for these specific shots

The dev database currently holds restored production data. Analytics screens are
safe — every card is aggregate, and the map plots postal-code centroids, not
addresses. **Data Management and Admin screens are not automatically safe**:
import history shows filenames, and Admin shows real email addresses. Use
synthetic values or redact before capturing those two.

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
