// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

export type BuilderComponentType = 'text' | 'form-field-group' | 'section-table' | 'line' | 'date' | 'language-tag' | 'legend';

export type BuilderDateMode = 'today' | 'custom';
export type BuilderDateFormatId =
  | 'long-ordinal'
  | 'long'
  | 'medium'
  | 'short-slash'
  | 'short-dash'
  | 'iso';
export const DEFAULT_DATE_FORMAT_ID: BuilderDateFormatId = 'long-ordinal';
export const BUILDER_DATE_FORMATS: Array<{
  id: BuilderDateFormatId;
  label: string;
  example: string;
}> = [
  { id: 'long-ordinal', label: 'Day, Month #th, YYYY', example: 'Wednesday, May 7th, 2026' },
  { id: 'long', label: 'Day, Month #, YYYY', example: 'Wednesday, May 7, 2026' },
  { id: 'medium', label: 'Month #, YYYY', example: 'May 7, 2026' },
  { id: 'short-slash', label: 'M/D/YYYY', example: '5/7/2026' },
  { id: 'short-dash', label: 'M-D-YYYY', example: '5-7-2026' },
  { id: 'iso', label: 'YYYY-MM-DD (ISO)', example: '2026-05-07' },
];

const ORDINAL_SUFFIX = (day: number): string => {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Pure local-date formatter so canvas preview and backend HTML render match
// without depending on time zones, locales, or external libraries.
export const formatBuilderDate = (
  date: Date,
  formatId: BuilderDateFormatId = DEFAULT_DATE_FORMAT_ID,
): string => {
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();
  const weekday = date.getDay();

  switch (formatId) {
    case 'long': // Wednesday, May 7, 2026
      return `${WEEKDAYS[weekday]}, ${MONTHS[month]} ${day}, ${year}`;
    case 'medium': // May 7, 2026
      return `${MONTHS[month]} ${day}, ${year}`;
    case 'short-slash': // 5/7/2026
      return `${month + 1}/${day}/${year}`;
    case 'short-dash': // 5-7-2026
      return `${month + 1}-${day}-${year}`;
    case 'iso': // 2026-05-07
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    case 'long-ordinal':
    default: // Wednesday, May 7th, 2026
      return `${WEEKDAYS[weekday]}, ${MONTHS[month]} ${day}${ORDINAL_SUFFIX(day)}, ${year}`;
  }
};

// Parse the persisted ISO yyyy-mm-dd string into a local Date so the formatter
// reads year/month/day without timezone drift.
export const parseBuilderCustomDate = (iso: string | undefined | null): Date | null => {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const toBuilderCustomDateIso = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const resolveBuilderDateInstance = (
  dateMode: BuilderDateMode,
  customDate: string | undefined,
  now: Date = new Date(),
): Date => {
  if (dateMode === 'custom') {
    const parsed = parseBuilderCustomDate(customDate);
    if (parsed) return parsed;
  }
  // Strip time so "today" renders consistently regardless of when the planner
  // runs in the day; this keeps the preview canvas and the PDF in lock step.
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export type BuilderLanguageTagMode =
  | 'hide-english'
  | 'english'
  | 'native'
  | 'native-with-english';

export const DEFAULT_LANGUAGE_TAG_MODE: BuilderLanguageTagMode = 'english';

const BUILDER_LANGUAGE_NATIVE_NAMES: Record<string, string> = {
  Arabic: 'العربية',
  Bengali: 'বাংলা',
  Cantonese: '粵語',
  Chinese: '中文',
  Farsi: 'فارسی',
  French: 'Français',
  Hebrew: 'עברית',
  Hindi: 'हिन्दी',
  Japanese: '日本語',
  Korean: '한국어',
  Mandarin: '中文',
  Persian: 'فارسی',
  Portuguese: 'Português',
  Punjabi: 'ਪੰਜਾਬੀ',
  Russian: 'Русский',
  Somali: 'Soomaali',
  Spanish: 'Español',
  Swahili: 'Kiswahili',
  Ukrainian: 'Українська',
  Urdu: 'اردو',
  Vietnamese: 'Tiếng Việt',
};

const normalizeBuilderLanguageName = (language: string | undefined | null): string => {
  const trimmed = typeof language === 'string' ? language.trim() : '';
  return trimmed.length > 0 ? trimmed : 'English';
};

export const getBuilderLanguageNativeName = (language: string | undefined | null): string => {
  const englishName = normalizeBuilderLanguageName(language);
  return BUILDER_LANGUAGE_NATIVE_NAMES[englishName] ?? englishName;
};

export const resolveBuilderLanguageTagText = (
  language: string | undefined | null,
  mode: BuilderLanguageTagMode = DEFAULT_LANGUAGE_TAG_MODE,
): string => {
  const englishName = normalizeBuilderLanguageName(language);
  if (mode === 'hide-english' && englishName.toLowerCase() === 'english') return '';
  if (mode === 'native') return getBuilderLanguageNativeName(englishName);
  if (mode === 'native-with-english') {
    const nativeName = getBuilderLanguageNativeName(englishName);
    return nativeName === englishName ? englishName : `${nativeName}/${englishName}`;
  }
  return englishName;
};

export type BuilderLayoutMode = 'guided' | 'freeform';
export type BuilderBodyLayoutMode = 'full' | 'split' | 'grid';
export type BuilderComponentRegion = 'header' | 'body' | 'footer';
// `cell-N` names grid square N (row-major) when the body layout is 'grid'.
export type BuilderBodyLane = 'full' | 'left' | 'right' | `cell-${number}`;
// `single-sided`: render the planner's page count as-is.
// `two-sided-duplicate`: always duplicate the rendered output so a stack of
//   single-side prints comes out two-sided.
// `two-sided-when-single-page`: render-time-only mode used by the bulk
//   translated-PDF export modal -- duplicates iff the planner produced
//   exactly 1 page, leaves multi-page outputs alone (they already paginate
//   sensibly for two-sided printing). Mirror with the backend
//   `BuilderPrintMode` union in `shopping-list-builder.ts`.
export type BuilderPrintMode =
  | 'single-sided'
  | 'two-sided-duplicate'
  | 'two-sided-when-single-page';
export type BuilderTableFlowMode = 'fixed' | 'flowing';

export const DEFAULT_LAYOUT_MODE: BuilderLayoutMode = 'guided';
export const DEFAULT_BODY_LAYOUT_MODE: BuilderBodyLayoutMode = 'full';
// 3pt grid: matches the typography height quantum so component tops, bottoms,
// drag snap, and the Guided overlay all use the same coordinate system. Letter
// paper (612 x 792) and the page center (306) still land on grid lines.
export const DEFAULT_GRID_SIZE = 3;
export const LEGACY_DEFAULT_GRID_SIZE = 9;
export const DEFAULT_HEADER_HEIGHT = 36;
export const DEFAULT_FOOTER_HEIGHT = 36;
export const DEFAULT_BODY_COLUMN_GAP = 18;
export const DEFAULT_MAX_PAGES = 1;
export const MAX_BUILDER_PAGES = 5;
export const DEFAULT_PRINT_MODE: BuilderPrintMode = 'single-sided';
export const DEFAULT_INCLUDE_CATEGORY_ICONS = true;
export const DEFAULT_BUILDER_COMPONENT_WIDTH = 267;
export const DEFAULT_SECTION_TABLE_LIMIT_WIDTH = 51;
export const DEFAULT_SECTION_TABLE_WANT_WIDTH = 57;
export const DEFAULT_SECTION_TABLE_CORNER_RADIUS = 9;
// Section-table and form-field row rhythm. Phase 0 table-density work
// (ISSUES.md #26) lowers this from 18pt to 15pt; 15pt = 5 x 3pt so every
// row still finishes on the (now 3pt) grid line. The minimum form-field
// group height keeps 2 rows worth of vertical space.
export const DEFAULT_FORM_FIELD_ROW_HEIGHT = 15;
export const DEFAULT_FORM_FIELD_GROUP_HEIGHT = 36;
export const DEFAULT_SECTION_TABLE_ROW_HEIGHT = 15;
// Tighter per-line height used only for the section-table header row when a
// category-limit tag is present. The measured header then snaps to the shared
// 3pt geometry grid, so a normal title + tag stack is 27pt instead of the
// previous off-grid 28pt.
export const SECTION_TABLE_HEADER_TIGHT_LINE_HEIGHT = 13.5;
export const DEFAULT_COMPONENT_REGION: BuilderComponentRegion = 'body';
export const BUILDER_COMPONENT_REGIONS: BuilderComponentRegion[] = ['header', 'body', 'footer'];

// Per-element repeat behavior for header/footer components. Body components
// always render once on page 0 because they participate in the flowing-table
// pagination plan; this control is meaningful only for header/footer.
export type BuilderHeaderFooterRepeatMode = 'every' | 'odd' | 'even' | 'once';
export const DEFAULT_HEADER_FOOTER_REPEAT_MODE: BuilderHeaderFooterRepeatMode = 'every';
export const BUILDER_HEADER_FOOTER_REPEAT_MODES: BuilderHeaderFooterRepeatMode[] = [
  'every',
  'odd',
  'even',
  'once',
];

export const shouldRenderHeaderFooterOnPage = (
  repeatMode: BuilderHeaderFooterRepeatMode | undefined,
  pageIndex: number,
): boolean => {
  switch (repeatMode ?? DEFAULT_HEADER_FOOTER_REPEAT_MODE) {
    case 'odd':
      // 1-based page numbers: odd = page 1, 3, 5 ... → 0-based pageIndex 0, 2, 4
      return pageIndex % 2 === 0;
    case 'even':
      // 1-based page numbers: even = page 2, 4, 6 ... → 0-based pageIndex 1, 3, 5
      return pageIndex % 2 === 1;
    case 'once':
      return pageIndex === 0;
    case 'every':
    default:
      return true;
  }
};
export const HEADER_FOOTER_LINE_COLOR = 'rgba(217, 70, 239, 0.7)';
export const BODY_SPLIT_GUIDE_COLOR = 'rgba(22, 163, 74, 0.85)';
export const HEADER_FOOTER_MIN_BODY = 27;

export interface BuilderPaper {
  size: 'letter';
  width: number;
  height: number;
  unit: 'pt';
}

interface BuilderComponentBase {
  id: string;
  type: BuilderComponentType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  region?: BuilderComponentRegion;
  repeatMode?: BuilderHeaderFooterRepeatMode;
  // Grid square (row-major, 0-based) this body component belongs to when the
  // template uses the grid layout in 'individual' content mode.
  gridCell?: number;
}

/**
 * Per-component translation mode set via the Properties panel's
 * "Translation Settings" modal. Persists with the template (serialised as
 * part of `templateData` JSON; no schema migration).
 *
 *   - `skip`: never translate this component; PDF renders the original
 *     English text regardless of the requested target language.
 *   - `translate` (default for text components when the field is undefined):
 *     swap the original for the cached translation; fall back to original on
 *     cache miss.
 *   - `translate-with-original`: render the cached translation followed by
 *     an inline 8pt bold English tag. On cache miss, render the original
 *     alone (the tag would be redundant).
 *   - `translate-with-original-block`: identical to `translate-with-original`
 *     except the 8pt bold English tag is placed on its own line beneath the
 *     translation instead of inline. Surfaced in the Form Fields translation
 *     control and the section-table Rows tab; the render path supports it for
 *     any component that uses the shared translated-text renderers.
 *   - `translate-with-original-adaptive`: identical to `translate-with-original`
 *     except the 8pt bold English tag is treated as one unbreakable unit --
 *     it stays inline on the translation's last line if it fits there, and
 *     otherwise drops whole onto the next line (never wraps mid-tag). Binary
 *     placement: same line or a clean line break, decided by available width.
 *     Surfaced in the section-table Rows tab and is the default for inventory
 *     section table rows.
 */
export type BuilderTranslationMode =
  | 'skip'
  | 'translate'
  | 'translate-with-original'
  | 'translate-with-original-block'
  | 'translate-with-original-adaptive';

export const DEFAULT_BUILDER_TRANSLATION_MODE: BuilderTranslationMode = 'translate';

export interface SectionTableTranslationSettings {
  headers?: BuilderTranslationMode;
  tags?: BuilderTranslationMode;
  rows?: BuilderTranslationMode;
}

export const SECTION_TABLE_TRANSLATION_HEIGHT_ADJUSTMENT_MIN = -9;
export const SECTION_TABLE_TRANSLATION_HEIGHT_ADJUSTMENT_MAX = 9;

export const normalizeSectionTableTranslationHeightAdjustment = (
  value: unknown,
): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(
    SECTION_TABLE_TRANSLATION_HEIGHT_ADJUSTMENT_MIN,
    Math.min(SECTION_TABLE_TRANSLATION_HEIGHT_ADJUSTMENT_MAX, Math.round(numeric)),
  );
};

export const DEFAULT_INVENTORY_SECTION_TRANSLATION_SETTINGS: Required<SectionTableTranslationSettings> = {
  headers: 'translate',
  tags: 'translate',
  rows: 'translate-with-original-adaptive',
};

export const resolveSectionTableTranslationSettings = (
  settings: SectionTableTranslationSettings | undefined,
): Required<SectionTableTranslationSettings> => ({
  headers: settings?.headers ?? DEFAULT_INVENTORY_SECTION_TRANSLATION_SETTINGS.headers,
  tags: settings?.tags ?? DEFAULT_INVENTORY_SECTION_TRANSLATION_SETTINGS.tags,
  rows: settings?.rows ?? DEFAULT_INVENTORY_SECTION_TRANSLATION_SETTINGS.rows,
});

export interface TextBuilderComponent extends BuilderComponentBase {
  type: 'text';
  content: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  translationMode?: BuilderTranslationMode;
}

export interface FormField {
  id: string;
  label: string;
  translationMode?: BuilderTranslationMode;
}

export interface FormFieldGroupBuilderComponent extends BuilderComponentBase {
  type: 'form-field-group';
  fields: FormField[];
  labelWidth: number;
  fontSize: number;
  cornerRadius?: number;
  // A1/A3 (forms): mirror the section-table border toggles.
  // - showColumnDividers gates the vertical label|value divider.
  // - showBorders gates the outer box + horizontal row separators.
  // Optional; default `true` (read as `!== false`) for back-compat with
  // templates that predate these flags. Mirrored in the backend route.
  showColumnDividers?: boolean;
  showBorders?: boolean;
}

export interface SectionTableRow {
  id: string;
  item: string;
  limit: string;
  foodItemId?: number;
  limitSource?: 'food-item' | 'category' | 'none';
  // A6 LEGACY: per-row checkbox control, superseded by the table-level
  // `SectionTableBuilderComponent.wantControl`. Still read by
  // `resolveSectionTableWantControl` as a fallback when the table-level
  // field is unset, so older saved templates render correctly. No UI surface
  // remains; do not set on new rows. See ISSUES.md #43.
  wantControl?: 'blank' | 'checkbox';
  // A2: per-row status, populated from inventory when the section is generated.
  // Drives the optional Limited/Clearance status icons (component.showStatusIcons).
  isLimited?: boolean;
  isClearance?: boolean;
}

export type CategoryLimitType = 'person' | 'household';

export interface SectionTableBuilderComponent extends BuilderComponentBase {
  type: 'section-table';
  title: string;
  rows: SectionTableRow[];
  showLimit: boolean;
  // Show/hide the Want column, mirroring showLimit (A5, v1.1.0). Optional for
  // back-compat: older saved templates lack it and must default to `true`
  // (Want was always shown before this field existed). ALWAYS read it as
  // `component.showWant !== false` so undefined means "show"; never read raw.
  // The backend route mirrors this field and convention.
  showWant?: boolean;
  // A6: when 'checkbox', the Want column renders an empty checkbox in every
  // row instead of the blank fill-in space. Optional; default 'blank' (read
  // via `resolveSectionTableWantControl`, which falls back to legacy per-row
  // `SectionTableRow.wantControl` for back-compat). Lifted from per-row to
  // table-level: the row-level setting was tedious and never reliably persisted
  // on inventory-backed tables — the refresh-inventory rebuild wiped per-row
  // fields. See ISSUES.md #43. Mirrored in the backend route.
  wantControl?: 'blank' | 'checkbox';
  // A1/A3: show/hide the vertical column dividers and the table/cell borders
  // (outer box + horizontal row rules) respectively. Optional; default `true`
  // (read as `!== false`) for back-compat. Mirrored in the backend route.
  showColumnDividers?: boolean;
  showBorders?: boolean;
  // A2: show Limited/Clearance status icons next to row items. Optional;
  // default `false` (read as `=== true`) so legacy templates are unchanged.
  showStatusIcons?: boolean;
  // B3: when on, rows with no item-level limit ("No Limit") display the
  // current Global Limit value in the Limit column instead of a blank cell.
  // Optional; default ON (read as `!== false`, ISSUES.md #39) so the org-wide
  // Global Limit caps "No Limit" items by default; an explicit `false` opts a
  // table out. The value is resolved live at render time (canvas: context;
  // PDF: backend query), never baked into the saved rows. Mirrored in the
  // backend route.
  showGlobalLimit?: boolean;
  limitHeader: string;
  wantHeader: string;
  limitWidth: number;
  wantWidth: number;
  fontSize: number;
  rowHeight: number;
  alternateRows: boolean;
  flowMode?: BuilderTableFlowMode;
  repeatHeaderRows?: boolean;
  keepHeaderWithFirstRow?: boolean;
  keepRowsTogether?: boolean;
  cornerRadius?: number;
  categoryLimit?: number | null;
  categoryLimitType?: CategoryLimitType | null;
  translationSettings?: SectionTableTranslationSettings;
  translationHeightAdjustments?: Record<string, number>;
  inventorySource?: {
    categoryId: number;
    categoryName: string;
    categoryIcon?: string | null;
    generatedAt: string;
  };
}

export interface LineBuilderComponent extends BuilderComponentBase {
  type: 'line';
  strokeWidth: number;
  direction: 'horizontal' | 'vertical';
}

export interface DateBuilderComponent extends BuilderComponentBase {
  type: 'date';
  // 'today' resolves at canvas render and PDF generation time; 'custom' uses
  // the user's saved ISO date so the value is deterministic.
  dateMode: BuilderDateMode;
  // ISO yyyy-mm-dd, only consulted when dateMode === 'custom'.
  customDate?: string;
  formatId: BuilderDateFormatId;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  translationMode?: BuilderTranslationMode;
}

export interface LanguageTagBuilderComponent extends BuilderComponentBase {
  type: 'language-tag';
  mode?: BuilderLanguageTagMode;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  align: 'left' | 'center' | 'right';
  lineHeight: number;
}

// A4: Legend base component — explains the A2 status icons. A focused
// status legend (not a generic icon editor): it renders the Limited
// (triangle) and/or Clearance (tag) icons with editable, translatable
// labels, laid out horizontally or vertically.
export interface LegendBuilderComponent extends BuilderComponentBase {
  type: 'legend';
  fontSize: number;
  layout: 'horizontal' | 'vertical';
  showLimited: boolean;
  limitedLabel: string;
  showClearance: boolean;
  clearanceLabel: string;
}

export type BuilderComponent =
  | TextBuilderComponent
  | FormFieldGroupBuilderComponent
  | SectionTableBuilderComponent
  | LineBuilderComponent
  | DateBuilderComponent
  | LanguageTagBuilderComponent
  | LegendBuilderComponent;

export interface ShoppingListBuilderTemplate {
  id: string;
  name: string;
  paper: BuilderPaper;
  components: BuilderComponent[];
  layoutMode?: BuilderLayoutMode;
  bodyLayoutMode?: BuilderBodyLayoutMode;
  gridLayout?: BuilderGridLayout;
  gridContentMode?: BuilderGridContentMode;
  gridSize?: number;
  headerHeight?: number;
  footerHeight?: number;
  bodyColumnGap?: number;
  maxPages?: number;
  printMode?: BuilderPrintMode;
  includeCategoryIcons?: boolean;
}

export const getTemplateLayoutMode = (template: ShoppingListBuilderTemplate): BuilderLayoutMode =>
  template.layoutMode ?? DEFAULT_LAYOUT_MODE;

export const getTemplateBodyLayoutMode = (template: ShoppingListBuilderTemplate): BuilderBodyLayoutMode =>
  template.bodyLayoutMode ?? DEFAULT_BODY_LAYOUT_MODE;

export const getTemplateGridSize = (template: ShoppingListBuilderTemplate): number => {
  const size = template.gridSize ?? DEFAULT_GRID_SIZE;
  if (size === LEGACY_DEFAULT_GRID_SIZE) return DEFAULT_GRID_SIZE;
  return size > 0 ? size : DEFAULT_GRID_SIZE;
};

const LEGACY_DEFAULT_ROW_HEIGHT = 18;

export const normalizeLegacyBuilderTemplateGeometry = (
  template: ShoppingListBuilderTemplate,
): ShoppingListBuilderTemplate => ({
  ...template,
  gridSize: template.gridSize === LEGACY_DEFAULT_GRID_SIZE
    ? DEFAULT_GRID_SIZE
    : (template.gridSize ?? DEFAULT_GRID_SIZE),
  components: template.components.map((component) => {
    if (component.type === 'section-table' && component.rowHeight === LEGACY_DEFAULT_ROW_HEIGHT) {
      return { ...component, rowHeight: DEFAULT_SECTION_TABLE_ROW_HEIGHT };
    }
    if (
      component.type === 'form-field-group'
      && (component as FormFieldGroupBuilderComponent & { rowHeight?: number }).rowHeight === LEGACY_DEFAULT_ROW_HEIGHT
    ) {
      return { ...component, rowHeight: DEFAULT_FORM_FIELD_ROW_HEIGHT };
    }
    return component;
  }),
});

export const getTemplateHeaderHeight = (template: ShoppingListBuilderTemplate): number => {
  const value = template.headerHeight ?? DEFAULT_HEADER_HEIGHT;
  return value < 0 ? 0 : value;
};

export const getTemplateFooterHeight = (template: ShoppingListBuilderTemplate): number => {
  const value = template.footerHeight ?? DEFAULT_FOOTER_HEIGHT;
  return value < 0 ? 0 : value;
};

export const getTemplateBodyColumnGap = (template: ShoppingListBuilderTemplate): number => {
  const value = template.bodyColumnGap ?? DEFAULT_BODY_COLUMN_GAP;
  return value < 0 ? 0 : value;
};

export const getTemplateMaxPages = (template: ShoppingListBuilderTemplate): number => {
  const value = template.maxPages ?? DEFAULT_MAX_PAGES;
  return Math.min(MAX_BUILDER_PAGES, Math.max(1, Math.round(value)));
};

export const getTemplatePrintMode = (template: ShoppingListBuilderTemplate): BuilderPrintMode =>
  template.printMode ?? DEFAULT_PRINT_MODE;

export const getTemplateIncludeCategoryIcons = (template: ShoppingListBuilderTemplate): boolean =>
  template.includeCategoryIcons ?? DEFAULT_INCLUDE_CATEGORY_ICONS;

export interface BuilderRegionBounds {
  region: BuilderComponentRegion;
  top: number;
  bottom: number;
  height: number;
}

export const getTemplateRegionBounds = (
  template: ShoppingListBuilderTemplate,
  region: BuilderComponentRegion,
): BuilderRegionBounds => {
  const headerHeight = getTemplateHeaderHeight(template);
  const footerHeight = getTemplateFooterHeight(template);
  const footerTop = Math.max(0, template.paper.height - footerHeight);

  switch (region) {
    case 'header':
      return {
        region,
        top: 0,
        bottom: Math.min(headerHeight, template.paper.height),
        height: Math.min(headerHeight, template.paper.height),
      };
    case 'footer':
      return {
        region,
        top: footerTop,
        bottom: template.paper.height,
        height: Math.max(0, template.paper.height - footerTop),
      };
    case 'body':
    default: {
      const top = Math.min(headerHeight, template.paper.height);
      const bottom = Math.max(top, footerTop);
      return {
        region: 'body',
        top,
        bottom,
        height: Math.max(0, bottom - top),
      };
    }
  }
};

// ---------------------------------------------------------------------------
// Grid page layout. MIRRORED: the block from here to "end grid layout" is the
// same in `frontend/.../builder/types.ts` and
// `backend/src/routes/shopping-list-builder.ts` (apart from `export`). Change
// both together, like the typography engine.
//
// A grid divides the page body into 2 columns x 2, 3 or 4 rows of equal
// squares, so one Letter sheet carries 4, 6 or 8 small slips. Each square is a
// planner lane (`cell-0` .. `cell-N`, row-major: left to right, then down).
// A square's content that does not fit continues in the SAME square on the
// next page -- the back of the slip when printed two-sided -- never in a
// neighbouring square.
//
// Content modes:
//   'duplicate'  -- "Duplicate All": every body component belongs to the first
//                   square; the planner lays that square out once and repeats
//                   it in every other square.
//   'individual' -- each body component carries `gridCell`, the square it
//                   belongs to.
// ---------------------------------------------------------------------------
export type BuilderGridLayout = '2x2' | '2x3' | '2x4';
export type BuilderGridContentMode = 'duplicate' | 'individual';

export const BUILDER_GRID_LAYOUTS: readonly BuilderGridLayout[] = ['2x2', '2x3', '2x4'];
export const BUILDER_GRID_COLUMNS = 2;
export const DEFAULT_GRID_LAYOUT: BuilderGridLayout = '2x2';
export const DEFAULT_GRID_CONTENT_MODE: BuilderGridContentMode = 'duplicate';

export const getTemplateGridLayout = (template: ShoppingListBuilderTemplate): BuilderGridLayout => (
  template.gridLayout === '2x3' || template.gridLayout === '2x4' ? template.gridLayout : DEFAULT_GRID_LAYOUT
);

export const getTemplateGridContentMode = (template: ShoppingListBuilderTemplate): BuilderGridContentMode => (
  template.gridContentMode === 'individual' ? 'individual' : DEFAULT_GRID_CONTENT_MODE
);

export const getTemplateGridRowCount = (template: ShoppingListBuilderTemplate): number => {
  const layout = getTemplateGridLayout(template);
  if (layout === '2x4') return 4;
  if (layout === '2x3') return 3;
  return 2;
};

export const getTemplateGridCellCount = (template: ShoppingListBuilderTemplate): number => (
  BUILDER_GRID_COLUMNS * getTemplateGridRowCount(template)
);

export const gridCellLane = (cellIndex: number): BuilderBodyLane => `cell-${cellIndex}`;

/** The square a lane names, or null for the full / left / right lanes. */
export const gridCellIndexOfLane = (lane: BuilderBodyLane): number | null => {
  if (!lane.startsWith('cell-')) return null;
  const index = Number(lane.slice(5));
  return Number.isInteger(index) && index >= 0 ? index : null;
};

/**
 * Which half of the page a lane sits in, or null when it spans the page.
 * Split lanes and grid squares both centre their content in a half.
 */
export const getBodyLaneHalf = (
  template: ShoppingListBuilderTemplate,
  lane: BuilderBodyLane,
): 'left' | 'right' | null => {
  const mode = getTemplateBodyLayoutMode(template);
  if (mode === 'full' || lane === 'full') return null;
  if (lane === 'left' || lane === 'right') return lane;
  if (mode !== 'grid') return null;
  const cellIndex = gridCellIndexOfLane(lane);
  if (cellIndex == null) return null;
  return cellIndex % BUILDER_GRID_COLUMNS === 1 ? 'right' : 'left';
};

/**
 * Vertical extent of one grid row. `top`/`bottom` are the row's cut lines;
 * `contentTop`/`contentBottom` are inset by half the column gap so stacked
 * squares keep the same gutter the two columns have.
 */
export const getTemplateGridRowBounds = (
  template: ShoppingListBuilderTemplate,
  rowIndex: number,
): { top: number; bottom: number; contentTop: number; contentBottom: number } => {
  const bodyTop = Math.min(getTemplateHeaderHeight(template), template.paper.height);
  const bodyBottom = Math.max(bodyTop, template.paper.height - getTemplateFooterHeight(template));
  const rowCount = getTemplateGridRowCount(template);
  const gridSize = getTemplateGridSize(template);
  // Rows are equal and sit on the placement grid; any remainder goes to the
  // last row so the squares still tile the whole body.
  const rawRowHeight = (bodyBottom - bodyTop) / rowCount;
  const rowHeight = Math.max(gridSize, Math.floor(rawRowHeight / gridSize) * gridSize);
  const row = Math.min(Math.max(0, rowIndex), rowCount - 1);
  const top = bodyTop + row * rowHeight;
  const bottom = row === rowCount - 1 ? bodyBottom : top + rowHeight;
  const inset = Math.min(getTemplateBodyColumnGap(template) / 2, Math.max(0, (bottom - top) / 4));
  return { top, bottom, contentTop: top + inset, contentBottom: Math.max(top + inset, bottom - inset) };
};

/** The square a body component belongs to under the template's grid. */
export const getComponentGridCell = (
  component: { gridCell?: number },
  template: ShoppingListBuilderTemplate,
): number => {
  if (getTemplateGridContentMode(template) !== 'individual') return 0;
  const cellCount = getTemplateGridCellCount(template);
  const cell = Number.isInteger(component.gridCell) ? (component.gridCell as number) : 0;
  return Math.min(Math.max(0, cell), cellCount - 1);
};

/**
 * Lanes the Guided planner fills, as independent chains. Full and split pages
 * are one chain read page by page. A grid is one chain per square, each
 * running through that square on every page.
 */
export const getTemplateBodyLaneChains = (
  template: ShoppingListBuilderTemplate,
): Array<Array<{ pageIndex: number; lane: BuilderBodyLane }>> => {
  const maxPages = getTemplateMaxPages(template);
  const mode = getTemplateBodyLayoutMode(template);
  const pages = Array.from({ length: maxPages }, (_, pageIndex) => pageIndex);
  if (mode === 'grid') {
    const cells = getTemplateGridContentMode(template) === 'individual'
      ? Array.from({ length: getTemplateGridCellCount(template) }, (_, cellIndex) => cellIndex)
      : [0];
    return cells.map((cellIndex) => pages.map((pageIndex) => ({ pageIndex, lane: gridCellLane(cellIndex) })));
  }
  if (mode === 'split') {
    return [pages.flatMap((pageIndex) => [
      { pageIndex, lane: 'left' as BuilderBodyLane },
      { pageIndex, lane: 'right' as BuilderBodyLane },
    ])];
  }
  return [pages.map((pageIndex) => ({ pageIndex, lane: 'full' as BuilderBodyLane }))];
};
// ------------------------------ end grid layout -----------------------------

export interface BuilderBodyLaneBounds {
  lane: BuilderBodyLane;
  left: number;
  right: number;
  width: number;
  top: number;
  bottom: number;
  height: number;
}

export const getTemplateBodyLaneBounds = (
  template: ShoppingListBuilderTemplate,
  lane: BuilderBodyLane,
): BuilderBodyLaneBounds => {
  const bodyBounds = getTemplateRegionBounds(template, 'body');
  const half = getBodyLaneHalf(template, lane);

  if (!half) {
    return {
      lane: 'full',
      left: 0,
      right: template.paper.width,
      width: template.paper.width,
      top: bodyBounds.top,
      bottom: bodyBounds.bottom,
      height: bodyBounds.height,
    };
  }

  const gap = Math.min(getTemplateBodyColumnGap(template), Math.max(0, template.paper.width - 48));
  const center = template.paper.width / 2;
  const leftRight = center - gap / 2;
  const rightLeft = center + gap / 2;

  // A grid square shares its column's horizontal extent with a split lane and
  // narrows only vertically, to its row.
  const cellIndex = getTemplateBodyLayoutMode(template) === 'grid' ? gridCellIndexOfLane(lane) : null;
  const rowBounds = cellIndex == null
    ? null
    : getTemplateGridRowBounds(template, Math.floor(cellIndex / BUILDER_GRID_COLUMNS));
  const top = rowBounds ? rowBounds.contentTop : bodyBounds.top;
  const bottom = rowBounds ? rowBounds.contentBottom : bodyBounds.bottom;

  if (half === 'right') {
    return {
      lane,
      left: rightLeft,
      right: template.paper.width,
      width: Math.max(0, template.paper.width - rightLeft),
      top,
      bottom,
      height: Math.max(0, bottom - top),
    };
  }

  return {
    lane,
    left: 0,
    right: leftRight,
    width: Math.max(0, leftRight),
    top,
    bottom,
    height: Math.max(0, bottom - top),
  };
};

export const snapToGrid = (value: number, gridSize: number): number => {
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
};

export const getCenteredXInBodyHalf = (
  paperWidth: number,
  objectWidth: number,
  half: Extract<BuilderBodyLane, 'left' | 'right'>,
  gridSize: number = DEFAULT_GRID_SIZE,
): number => {
  const center = paperWidth / 2;
  const halfLeft = half === 'right' ? center : 0;
  const halfRight = half === 'right' ? paperWidth : center;
  const usableWidth = Math.max(0, halfRight - halfLeft);

  if (objectWidth >= usableWidth) {
    return snapToGrid(halfLeft, gridSize);
  }

  return snapToGrid(Math.round(halfLeft + (usableWidth - objectWidth) / 2), gridSize);
};

export interface SavedBuilderComponent {
  id: number;
  name: string;
  componentType: BuilderComponentType;
  componentData: BuilderComponent;
  createdAt: string;
  updatedAt: string;
}

export interface SavedBuilderTemplate {
  id: number;
  name: string;
  templateData: ShoppingListBuilderTemplate;
  createdAt: string;
  updatedAt: string;
}

export interface InventorySectionComponent {
  categoryId: number;
  categoryName: string;
  itemCount: number;
  component: SectionTableBuilderComponent;
}

export type BuilderComponentPatch = Partial<Omit<BuilderComponent, 'id' | 'type'>>;
