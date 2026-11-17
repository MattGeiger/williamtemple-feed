// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeftRight,
  Bold,
  Loader2,
  Paintbrush,
  ZoomIn,
  ZoomOut,
} from "@/components/ui/icons";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SectionHeader } from '@/components/shared/section-header';
import {
  Tabs as AnimatedTabs,
  TabsList as AnimatedTabsList,
  TabsTrigger as AnimatedTabsTrigger,
} from '@/components/ui/tabs';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { BetweenHorizontalStartIcon } from '@/components/animate-ui/icons/between-horizontal-start';
import { UndoIcon } from '@/components/animate-ui/icons/undo';
import { CopyIcon } from '@/components/animate-ui/icons/copy';
import { Trash2Icon } from '@/components/animate-ui/icons/trash-2';
import { GalleryVerticalEndIcon } from '@/components/animate-ui/icons/gallery-vertical-end';
import { LayoutDashboardIcon } from '@/components/animate-ui/icons/layout-dashboard';
// Action-bar & palette animated icons
import { DownloadIcon } from '@/components/animate-ui/icons/download';
import { SaveIcon } from '@/components/animate-ui/icons/save';
import { LanguagesIcon } from '@/components/animate-ui/icons/languages';
import { RotateCcwIcon } from '@/components/animate-ui/icons/rotate-ccw';
import { LayoutTemplateIcon } from '@/components/animate-ui/icons/layout-template';
import { MoreHorizontalIcon } from '@/components/animate-ui/icons/more-horizontal';
import { PencilIcon } from '@/components/animate-ui/icons/pencil';
import { SquarePenIcon } from '@/components/animate-ui/icons/square-pen';
import { TypeIcon } from '@/components/animate-ui/icons/type';
import { Table2Icon } from '@/components/animate-ui/icons/table-2';
import { RectangleEllipsisIcon } from '@/components/animate-ui/icons/rectangle-ellipsis';
import { MinusIcon } from '@/components/animate-ui/icons/minus';
import { PlusIcon } from '@/components/animate-ui/icons/plus';
import { SettingsIcon } from '@/components/animate-ui/icons/settings';
import { CirclePlusIcon } from '@/components/animate-ui/icons/circle-plus';
import { PackageXIcon } from '@/components/animate-ui/icons/package-x';
import { TagIcon } from '@/components/animate-ui/icons/tag';
import { AlertTriangleIcon } from '@/components/animate-ui/icons/alert-triangle';
import { ArrowLeftRightIcon } from '@/components/animate-ui/icons/arrow-left-right';
import { Grid2x2CheckIcon } from '@/components/animate-ui/icons/grid-2x2-check';
import { SquareDashedMousePointerIcon } from '@/components/animate-ui/icons/square-dashed-mouse-pointer';
import { Grid3x3Icon } from '@/components/animate-ui/icons/grid-3x3';
import { CalendarDaysIcon } from '@/components/animate-ui/icons/calendar-days';
import { EditDialog as FoodItemEditDialog } from '@/components/food-item-management/edit-dialog';
import { AddFoodItemDialog } from '@/components/food-item-management/add-dialog';
import { EditDialog as CategoryEditDialog } from '@/components/category-management/edit-dialog';
import { useCategoryContext } from '@/contexts/CategoryContext';
import { useFoodItemContext } from '@/contexts/FoodItemContext';
import { useTerminology } from '@/contexts/TerminologyContext';
import { Category } from '@/types/category';
import { DietaryFlags, FoodItem, FoodItemSupply, StatusFlags } from '@/types/food-item';
import { useMessage } from '@/hooks/message/useMessage';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { notifyFoodItemCreateError } from '@/services/food-item/duplicate-name-notification';
import { shoppingListBuilderService } from '@/services/shopping-list-builder';
import { GlobalLimitService } from '@/services/global-limit';
import { DEFAULT_ICON, getIconComponent } from '@/lib/food-icons';
import { cn, truncateMiddle } from '@/lib/utils';
import { createBuilderComponent, createDefaultBuilderTemplate } from './default-template';
import {
  BUILDER_CELL_VERTICAL_PADDING_PT,
  BUILDER_FONT_SIZES,
  BUILDER_LINE_HEIGHT_MULTIPLIER,
  BUILDER_TAGGED_HEADER_LINE_HEIGHT_MULTIPLIER,
  SPLIT_PAGE_FONT_SIZES,
  SPLIT_PAGE_MAX_BUILDER_FONT_SIZE,
  baseRowHeight as typographyBaseRowHeight,
  estimateWrappedLineCount as typographyEstimateLineCount,
  snapHeightToGridForFontSize as typographySnapHeightForFontSize,
  taggedHeaderHeight as typographyTaggedHeaderHeight,
  untaggedHeaderHeight as typographyUntaggedHeaderHeight,
} from './typography';
import {
  BUILDER_COMPONENT_REGIONS,
  BUILDER_DATE_FORMATS,
  BUILDER_GRID_COLUMNS,
  BUILDER_GRID_LAYOUTS,
  BuilderGridContentMode,
  BuilderGridLayout,
  getBodyLaneHalf,
  getComponentGridCell,
  getTemplateBodyLaneChains,
  getTemplateGridCellCount,
  getTemplateGridContentMode,
  getTemplateGridLayout,
  getTemplateGridRowBounds,
  getTemplateGridRowCount,
  gridCellIndexOfLane,
  gridCellLane,
  BUILDER_HEADER_FOOTER_REPEAT_MODES,
  BODY_SPLIT_GUIDE_COLOR,
  BuilderComponent,
  BuilderBodyLane,
  BuilderBodyLayoutMode,
  BuilderComponentRegion,
  BuilderComponentType,
  BuilderDateFormatId,
  BuilderLanguageTagMode,
  BuilderHeaderFooterRepeatMode,
  BuilderLayoutMode,
  BuilderPrintMode,
  DateBuilderComponent,
  DEFAULT_DATE_FORMAT_ID,
  DEFAULT_LANGUAGE_TAG_MODE,
  formatBuilderDate,
  parseBuilderCustomDate,
  resolveBuilderDateInstance,
  shouldRenderHeaderFooterOnPage,
  toBuilderCustomDateIso,
  DEFAULT_BUILDER_COMPONENT_WIDTH,
  DEFAULT_FORM_FIELD_GROUP_HEIGHT,
  DEFAULT_FORM_FIELD_ROW_HEIGHT,
  DEFAULT_GRID_SIZE,
  DEFAULT_SECTION_TABLE_ROW_HEIGHT,
  SECTION_TABLE_HEADER_TIGHT_LINE_HEIGHT,
  DEFAULT_COMPONENT_REGION,
  FormFieldGroupBuilderComponent,
  getTemplateBodyColumnGap,
  getTemplateBodyLaneBounds,
  getTemplateBodyLayoutMode,
  getTemplateFooterHeight,
  getTemplateGridSize,
  getTemplateHeaderHeight,
  getTemplateLayoutMode,
  getTemplateMaxPages,
  getTemplateIncludeCategoryIcons,
  getTemplatePrintMode,
  getTemplateRegionBounds,
  getCenteredXInBodyHalf,
  HEADER_FOOTER_LINE_COLOR,
  HEADER_FOOTER_MIN_BODY,
  InventorySectionComponent,
  LanguageTagBuilderComponent,
  LegendBuilderComponent,
  LineBuilderComponent,
  SavedBuilderComponent,
  SavedBuilderTemplate,
  BuilderTranslationMode,
  DEFAULT_BUILDER_TRANSLATION_MODE,
  normalizeLegacyBuilderTemplateGeometry,
  normalizeSectionTableTranslationHeightAdjustment,
  SectionTableBuilderComponent,
  SectionTableTranslationSettings,
  SectionTableRow,
  ShoppingListBuilderTemplate,
  resolveSectionTableTranslationSettings,
  resolveBuilderLanguageTagText,
  snapToGrid,
  TextBuilderComponent,
} from './types';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  FieldRow,
  GeometryInput,
  InspectorSection,
  PanelHeading,
  Segmented,
  SwitchRow,
  ToolbarButton,
} from './builder-ui';
import { TranslationSettingsDialog } from './dialogs/translation-settings-dialog';
import { SectionTableTranslationSettingsDialog } from './dialogs/section-table-translation-settings-dialog';
import {
  BUILDER_TEXT_ORIGINAL_TAG_MEASURE_FONT_SIZE,
  BUILDER_TEXT_ORIGINAL_TAG_FONT_SIZE,
  PreviewLanguageContext,
  isRTLLanguage,
  renderTextBody,
  renderTranslatedBuilderText,
  usePreviewLanguage,
} from './translation-render';
import {
  mergePreviewTranslations,
  resolvePreviewTranslationPreflight,
} from './preview-language';
// Pulled by PageSetupPanel for the canvas-wide "Preview language" select
// and consumed by the TranslationSettingsDialog. ShoppingListBuilder.tsx
// is wrapped in <LanguageProvider> (see App.tsx); this is the only place
// the builder file itself needs the hook.
import { useLanguageContext } from '@/contexts/LanguageContext';

const BUILDER_COMPONENT_DRAG_TYPE = 'application/x-shopping-list-builder-component';
const SAVED_COMPONENT_DRAG_TYPE = 'application/x-shopping-list-builder-saved-component-id';
const INVENTORY_SECTION_DRAG_TYPE = 'application/x-shopping-list-builder-inventory-category-id';
const DRAG_TEXT_FALLBACK_TYPE = 'text/plain';

const paletteItems: Array<{
  type: BuilderComponentType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { type: 'text', label: 'Text block', icon: TypeIcon },
  { type: 'date', label: 'Date', icon: CalendarDaysIcon },
  { type: 'language-tag', label: 'Language tag', icon: LanguagesIcon },
  { type: 'form-field-group', label: 'Form fields', icon: RectangleEllipsisIcon },
  { type: 'section-table', label: 'Section table', icon: Table2Icon },
  { type: 'line', label: 'Line', icon: MinusIcon },
  { type: 'legend', label: 'Legend', icon: GalleryVerticalEndIcon },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const toNumber = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const MAX_SAVED_TEMPLATE_NAME_LENGTH = 48;
const GUIDED_COLLISION_GAP = 4;
// Flow stacking gap. One grid square gives stacked flowing tables a clean
// visual breathing margin that matches the canvas grid rhythm.
const FLOWING_TABLE_GAP = 9;
const DROPDOWN_TO_DIALOG_OPEN_DELAY_MS = 250;
// Flowing table preview is planner-backed: the canvas renders the same page and
// lane segments that the Chromium PDF export renders.
const ENABLE_FLOWING_TABLE_PREVIEW = true;
const TABLE_CELL_HORIZONTAL_PADDING = 8;
const AVERAGE_TABLE_CHARACTER_WIDTH_RATIO = 0.52;
// Canvas zoom slider. The slider's 100% maps to a 1.2x render scale because
// at 1.2x a Letter page fills the default Properties-card-flanked canvas
// region; that anchor is the user-facing "Full page" preset. Slider values
// are stored as displayed percentages; getCanvasScale() converts them to the
// transform: scale() multiplier used by the page frame.
const CANVAS_ZOOM_SCALE_FACTOR = 1.2;
// 40% keeps a whole Letter page width visible in the narrowest three-column
// workspace (a 1280px window with the app sidebar open).
const CANVAS_MIN_ZOOM = 40;
const CANVAS_MAX_ZOOM = 200;
const CANVAS_DEFAULT_ZOOM = 100;
const CANVAS_ZOOM_STEP = 5;
const getCanvasScale = (zoom: number) => (zoom * CANVAS_ZOOM_SCALE_FACTOR) / 100;
// Breathing room kept around the page when a zoom preset fits it to the canvas.
const CANVAS_FIT_MARGIN = 48;

const CORNER_RADIUS_OPTIONS = [
  { value: '0', label: 'Square' },
  { value: '3', label: '3' },
  { value: '6', label: '6' },
  { value: '9', label: '9' },
];

const IS_APPLE_PLATFORM = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const undoShortcutLabel = IS_APPLE_PLATFORM ? '⌘Z' : 'Ctrl+Z';
const duplicateShortcutLabel = IS_APPLE_PLATFORM ? '⌘D' : 'Ctrl+D';

function ShoppingListBuilderTitleIcon({
  className,
  size,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <AnimateIcon animateOnView animateOnViewOnce animateOnHover>
      <LayoutDashboardIcon className={className} size={size} />
    </AnimateIcon>
  );
}

interface BuilderTextMeasureSegment {
  text: string;
  fontSize: number;
  fontWeight?: 'normal' | 'bold';
  // When true the segment's whole `text` is measured as one unbreakable
  // token -- internal whitespace is NOT a wrap opportunity. Used by the
  // `translate-with-original-adaptive` mode so the 8pt English tag either
  // fits on the current line or drops whole onto the next one.
  atomic?: boolean;
}

interface SectionTableMeasurementOptions {
  language?: string;
  translations?: Record<string, string>;
  inventoryTranslations?: {
    categories: Record<number, string>;
    foodItems: Record<number, string>;
  };
}

const limitTemplateName = (name: string) => name.slice(0, MAX_SAVED_TEMPLATE_NAME_LENGTH);
const normalizeSavedEntityName = (name: string) => name.trim().toLocaleLowerCase();

interface EditingSavedComponentSource {
  savedComponentId: number;
  canvasComponentId: string;
}

const setBuilderDragData = (
  event: React.DragEvent<HTMLElement>,
  type: string,
  value: string,
  label: string,
) => {
  const payload = JSON.stringify({ type, value });
  event.dataTransfer.clearData();
  event.dataTransfer.setData(type, value);
  event.dataTransfer.setData(DRAG_TEXT_FALLBACK_TYPE, payload);
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.dropEffect = 'copy';
  event.currentTarget.setAttribute('data-dragging-label', label);
};

const getBuilderDragData = (event: React.DragEvent<HTMLDivElement>, type: string) => {
  const directValue = event.dataTransfer.getData(type);
  if (directValue) {
    return directValue;
  }

  try {
    const fallback = JSON.parse(event.dataTransfer.getData(DRAG_TEXT_FALLBACK_TYPE)) as {
      type?: string;
      value?: string;
    };
    return fallback.type === type ? fallback.value ?? '' : '';
  } catch {
    return '';
  }
};

const isCjkCharacter = (character: string) => /[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/u.test(character);
const isFullWidthCharacter = (character: string) => /[\uFF01-\uFF60\uFFE0-\uFFE6]/u.test(character);
const isCyrillicCharacter = (character: string) => /[\u0400-\u04FF]/u.test(character);

const estimateGlyphWidth = (character: string, fontSize: number) => {
  if (isCjkCharacter(character) || isFullWidthCharacter(character)) {
    return fontSize;
  }
  if (/\s/u.test(character)) {
    return fontSize * 0.28;
  }
  if (isCyrillicCharacter(character)) {
    return fontSize * 0.58;
  }
  if (/[ilI.,'`:;]/u.test(character)) {
    return fontSize * 0.3;
  }
  if (/[mwMW@%&]/u.test(character)) {
    return fontSize * 0.78;
  }
  if (/[A-Z0-9]/u.test(character)) {
    return fontSize * 0.56;
  }
  return fontSize * AVERAGE_TABLE_CHARACTER_WIDTH_RATIO;
};

const estimateVisualTextWidth = (
  value: string,
  fontSize: number,
  fontWeight: BuilderTextMeasureSegment['fontWeight'] = 'normal',
) => {
  const weightMultiplier = fontWeight === 'bold' ? 1.08 : 1;
  return (
    Array.from(String(value || '')).reduce((total, character) => (
      total + estimateGlyphWidth(character, fontSize)
    ), 0) * weightMultiplier
  );
};

const estimateWrappedLineCount = (value: string, availableWidth: number, fontSize: number) => {
  return estimateWrappedSegmentLineCount([{ text: value, fontSize }], availableWidth);
};

// Slack (in pt) subtracted from the cell's available width before
// comparing predicted token widths. Compensates for per-glyph estimator
// variance between headless puppeteer (which the per-character ratios
// were calibrated against) and shipping Chromium on macOS, where Latin
// text routinely renders 3-5% wider than the estimator predicts. Mirror
// with `WRAP_AVAILABLE_WIDTH_SAFETY_PT` in the backend route.
const WRAP_AVAILABLE_WIDTH_SAFETY_PT = 6;

// Real Chromium renders text ~3-5% wider than the per-glyph estimator
// predicts, so the wrap slack must scale with the cell width rather than be a
// flat pt value (ISSUES.md #33). A flat 6pt under-cushioned mid-width cells
// even at 12pt (e.g. "Hot Dog & Hamburger Buns" wrapped in real Chrome but the
// planner predicted one line, so the row never grew). Reserve the larger of
// the 6pt floor and 5% of the available width. Mirror with the backend route engine.
const WRAP_AVAILABLE_WIDTH_SAFETY_RATIO = 0.05;

const estimateWrappedSegmentLineCount = (
  segments: BuilderTextMeasureSegment[],
  availableWidth: number,
) => {
  // Conservative effective width: reserve a small slack to absorb the
  // per-glyph metric variance between the planner's estimator and real
  // Chrome rendering. Without it, borderline rows like Swahili "Vitu
  // mbalimbali vilivyohifadhiwa kwa baridi" measured 147.8pt against a
  // 148pt cell (planner: fits one line) but Chrome wrapped the
  // translation, overflowing the row's planned height.
  const safetyPt = Math.max(
    WRAP_AVAILABLE_WIDTH_SAFETY_PT,
    availableWidth * WRAP_AVAILABLE_WIDTH_SAFETY_RATIO,
  );
  const width = Math.max(1, availableWidth - safetyPt);
  let lineCount = 1;
  let currentLineWidth = 0;
  let pendingSpaceWidth = 0;
  let hasContentOnLine = false;

  const resetLine = () => {
    lineCount += 1;
    currentLineWidth = 0;
    pendingSpaceWidth = 0;
    hasContentOnLine = false;
  };

  segments.forEach((segment) => {
    const fontSize = Math.max(1, segment.fontSize);
    // Atomic segments are measured as a single token (internal whitespace is
    // not a wrap opportunity); non-atomic segments split on newlines/spaces.
    const tokens = segment.atomic
      ? [String(segment.text || '')]
      : String(segment.text || '').split(/(\n|\s+)/);
    tokens.forEach((token) => {
      if (!token) return;
      if (token === '\n') {
        resetLine();
        return;
      }
      if (/^\s+$/.test(token)) {
        if (hasContentOnLine) {
          pendingSpaceWidth += estimateVisualTextWidth(token, fontSize, segment.fontWeight);
        }
        return;
      }

      const tokenWidth = estimateVisualTextWidth(token, fontSize, segment.fontWeight);
      const candidateWidth = hasContentOnLine
        ? currentLineWidth + pendingSpaceWidth + tokenWidth
        : tokenWidth;

      if (hasContentOnLine && candidateWidth > width) {
        lineCount += 1;
        currentLineWidth = 0;
        hasContentOnLine = false;
      }

      if (tokenWidth > width) {
        const tokenLineCount = Math.max(1, Math.ceil(tokenWidth / width));
        lineCount += tokenLineCount - 1;
        currentLineWidth = tokenWidth - ((tokenLineCount - 1) * width);
        if (currentLineWidth <= 0 || currentLineWidth > width) {
          currentLineWidth = width;
        }
      } else {
        currentLineWidth = hasContentOnLine ? candidateWidth : tokenWidth;
      }
      pendingSpaceWidth = 0;
      hasContentOnLine = true;
    });
  });

  return lineCount;
};

const translationMeasureSegments = (
  original: string,
  cachedTranslation: string | null | undefined,
  mode: BuilderTranslationMode,
  fontSize: number,
): BuilderTextMeasureSegment[] => {
  if (mode === 'skip' || !cachedTranslation) {
    return [{ text: original, fontSize }];
  }
  if (
    mode === 'translate-with-original'
    || mode === 'translate-with-original-block'
    || mode === 'translate-with-original-adaptive'
  ) {
    // `-block` forces the English tag onto its own line: a '\n' segment
    // is read as a hard break by estimateWrappedSegmentLineCount, so the
    // measured row height accounts for the extra line. The plain inline
    // variant uses a space and lets the tag wrap word-by-word. `-adaptive`
    // also uses a space separator but marks the English segment `atomic`,
    // so the measurement keeps the tag whole -- it either fits on the
    // current line or counts as one extra line, matching the
    // `white-space: nowrap` render.
    const block = mode === 'translate-with-original-block';
    const adaptive = mode === 'translate-with-original-adaptive';
    const separator = block ? '\n' : ' ';
    return [
      { text: cachedTranslation, fontSize },
      { text: separator, fontSize },
      {
        text: original,
        fontSize: BUILDER_TEXT_ORIGINAL_TAG_MEASURE_FONT_SIZE,
        fontWeight: 'bold',
        atomic: adaptive,
      },
    ];
  }
  return [{ text: cachedTranslation, fontSize }];
};

const sectionTableTitleSegments = (
  component: SectionTableBuilderComponent,
  fontSize: number,
  measurement?: SectionTableMeasurementOptions,
) => {
  const headerMode = resolveSectionTableTranslationSettings(component.translationSettings).headers;
  // Inventory tables resolve the title from CategoryTranslation; base-
  // component tables resolve it from the Generated (List) cache.
  const categoryTranslation = component.inventorySource?.categoryId
    ? measurement?.inventoryTranslations?.categories[component.inventorySource.categoryId]
    : measurement?.translations?.[component.title];

  return translationMeasureSegments(component.title, categoryTranslation, headerMode, fontSize);
};

const sectionTableRowItemSegments = (
  row: SectionTableBuilderComponent['rows'][number],
  mode: BuilderTranslationMode,
  fontSize: number,
  measurement?: SectionTableMeasurementOptions,
) => {
  // Inventory rows resolve from FoodItemTranslation; base-component rows
  // (no foodItemId) resolve from the Generated (List) cache.
  const itemTranslation = row.foodItemId
    ? measurement?.inventoryTranslations?.foodItems[row.foodItemId]
    : measurement?.translations?.[row.item];

  return translationMeasureSegments(row.item, itemTranslation, mode, fontSize);
};

const builderGeneratedTextSegments = (
  original: string,
  mode: BuilderTranslationMode,
  fontSize: number,
  measurement?: SectionTableMeasurementOptions,
) => translationMeasureSegments(original, measurement?.translations?.[original], mode, fontSize);

const sectionTableRowUsesTranslatedText = (
  row: SectionTableBuilderComponent['rows'][number],
  mode: BuilderTranslationMode,
  measurement?: SectionTableMeasurementOptions,
) => {
  if (mode === 'skip') return false;
  // Inventory rows: look in FoodItemTranslation. Base-component rows
  // (no foodItemId): look in the Generated (List) cache.
  return row.foodItemId
    ? Boolean(measurement?.inventoryTranslations?.foodItems[row.foodItemId])
    : Boolean(measurement?.translations?.[row.item]);
};

const builderGeneratedTextUsesTranslation = (
  original: string,
  mode: BuilderTranslationMode,
  measurement?: SectionTableMeasurementOptions,
) => (
  mode !== 'skip'
  && Boolean(measurement?.translations?.[original])
);

const sectionTableHeaderMeasurementSegments = (
  component: SectionTableBuilderComponent,
  fontSize: number,
  measurement?: SectionTableMeasurementOptions,
) => {
  const settings = resolveSectionTableTranslationSettings(component.translationSettings);
  const categoryLimitTag = formatCategoryLimitTag(component.categoryLimit, component.categoryLimitType);
  return {
    titleSegments: sectionTableTitleSegments(component, fontSize, measurement),
    categoryLimitSegments: categoryLimitTag
      ? builderGeneratedTextSegments(`(${categoryLimitTag})`, settings.tags, Math.max(7, fontSize - 2), measurement)
      : undefined,
    limitHeaderSegments: component.showLimit
      ? builderGeneratedTextSegments(component.limitHeader || 'Limit', settings.headers, fontSize, measurement)
      : undefined,
    wantHeaderSegments: builderGeneratedTextSegments(component.wantHeader || 'Want', settings.headers, fontSize, measurement),
  };
};

const getSectionTableTranslationHeightAdjustmentPt = (
  component: SectionTableBuilderComponent,
  measurement?: SectionTableMeasurementOptions,
) => {
  if (!measurement?.language) return 0;
  const gridSquares = normalizeSectionTableTranslationHeightAdjustment(
    component.translationHeightAdjustments?.[measurement.language],
  );
  return gridSquares * DEFAULT_GRID_SIZE;
};

const getAdjustedSectionTablePlannerHeight = (
  component: SectionTableBuilderComponent,
  visualHeight: number,
  measurement?: SectionTableMeasurementOptions,
) => {
  // Manual translation-height adjustments reserve planner space only; row
  // heights stay visual so the painted table does not change.
  const adjustment = getSectionTableTranslationHeightAdjustmentPt(component, measurement);
  if (adjustment === 0) return visualHeight;
  return Math.max(DEFAULT_GRID_SIZE, visualHeight + adjustment);
};

// A2: pt reserved at the start of the item cell by status icons (Limited /
// Clearance), so the item text wraps in the remaining width. ~1em icon + gap
// per visible icon; mirrors the backend `statusIconRowOverhead`.
const statusIconRowOverhead = (
  row: SectionTableBuilderComponent['rows'][number],
  fontSize: number,
  showStatusIcons?: boolean,
): number => {
  if (!showStatusIcons) return 0;
  const count = (row.isLimited ? 1 : 0) + (row.isClearance ? 1 : 0);
  return count * fontSize * 1.35;
};

const getTableRowTextLineCount = (
  row: SectionTableBuilderComponent['rows'][number],
  options: {
    itemWidth: number;
    limitWidth: number;
    fontSize: number;
    showLimit: boolean;
    showStatusIcons?: boolean;
    itemSegments?: BuilderTextMeasureSegment[];
  },
) => Math.max(
  options.itemSegments
    ? estimateWrappedSegmentLineCount(
      options.itemSegments,
      Math.max(1, options.itemWidth - TABLE_CELL_HORIZONTAL_PADDING - statusIconRowOverhead(row, options.fontSize, options.showStatusIcons)),
    )
    : estimateWrappedLineCount(
      row.item,
      Math.max(1, options.itemWidth - TABLE_CELL_HORIZONTAL_PADDING - statusIconRowOverhead(row, options.fontSize, options.showStatusIcons)),
      options.fontSize,
    ),
  options.showLimit
    ? estimateWrappedLineCount(
      row.limit,
      Math.max(1, options.limitWidth - TABLE_CELL_HORIZONTAL_PADDING),
      options.fontSize,
    )
    : 1,
);

const getTableRowHeight = (
  row: SectionTableBuilderComponent['rows'][number],
  rowHeight: number,
  options: {
    itemWidth: number;
    limitWidth: number;
    fontSize: number;
    showLimit: boolean;
    showStatusIcons?: boolean;
    itemSegments?: BuilderTextMeasureSegment[];
    useNaturalContentHeight?: boolean;
  },
) => {
  // Font-aware floor from the typography engine. At fontSize=10 this is 15pt,
  // matching the shared 3pt geometry grid; larger fonts grow to the next
  // typography band.
  const fontFloor = typographyBaseRowHeight(options.fontSize);
  const storedRowHeight = Number.isFinite(rowHeight) && rowHeight > 0
    ? rowHeight
    : DEFAULT_SECTION_TABLE_ROW_HEIGHT;
  const baseRowHeight = Math.max(storedRowHeight, fontFloor);
  const lineCount = getTableRowTextLineCount(row, options);

  if (options.useNaturalContentHeight) {
    return Math.max(
      baseRowHeight,
      typographySnapHeightForFontSize(options.fontSize, lineCount),
    );
  }

  return Math.max(baseRowHeight, baseRowHeight * lineCount);
};

// Mirrors `categoryIconTitleWidthOverhead` in
// `packages/backend/src/routes/shopping-list-builder.ts`. The renderer puts
// a `width: 1em` icon in the title cell with a `gap: 2ch` flex gap when
// `includeCategoryIcons === true` and the table has an `inventorySource`.
// Pure geometric overhead is ~`1em + 2ch ≈ fontSize × 2.12`, but real
// macOS Chrome renders Latin titles measurably wider than puppeteer (the
// font metrics the per-glyph table was calibrated against), so the planner
// reserves `fontSize × 3.5` to keep Swahili "Vyakula Vilivyogandishwa" +
// (Chagua hadi 3) from clipping the bottom of the header band.
const categoryIconTitleWidthOverhead = (fontSize: number, showCategoryIcon: boolean): number =>
  showCategoryIcon ? Math.ceil(fontSize * 3.5) : 0;

const getTableHeaderHeight = (
  component: SectionTableBuilderComponent,
  rowHeight: number,
  options: {
    itemWidth: number;
    limitWidth: number;
    wantWidth: number;
    fontSize: number;
    showLimit: boolean;
    showWant: boolean;
    titleSegments?: BuilderTextMeasureSegment[];
    categoryLimitSegments?: BuilderTextMeasureSegment[];
    limitHeaderSegments?: BuilderTextMeasureSegment[];
    wantHeaderSegments?: BuilderTextMeasureSegment[];
    iconOverhead?: number;
  },
) => {
  const categoryLimitTag = formatCategoryLimitTag(component.categoryLimit, component.categoryLimitType);
  // Only the title shares its cell with the category icon; tag, limit, and
  // want headers render in their own cells and are unaffected by iconOverhead.
  const titleAvailableWidth = Math.max(
    1,
    options.itemWidth - TABLE_CELL_HORIZONTAL_PADDING - (options.iconOverhead ?? 0),
  );
  const titleLineCount = options.titleSegments
    ? estimateWrappedSegmentLineCount(options.titleSegments, titleAvailableWidth)
    : estimateWrappedLineCount(component.title, titleAvailableWidth, options.fontSize);
  const categoryLimitLineCount = categoryLimitTag
    ? (options.categoryLimitSegments
      ? estimateWrappedSegmentLineCount(
        options.categoryLimitSegments,
        Math.max(1, options.itemWidth - TABLE_CELL_HORIZONTAL_PADDING),
      )
      : estimateWrappedLineCount(
        `(${categoryLimitTag})`,
        Math.max(1, options.itemWidth - TABLE_CELL_HORIZONTAL_PADDING),
        Math.max(7, options.fontSize - 2),
      ))
    : 0;
  const limitHeaderLineCount = options.showLimit
    ? (options.limitHeaderSegments
      ? estimateWrappedSegmentLineCount(
        options.limitHeaderSegments,
        Math.max(1, options.limitWidth - TABLE_CELL_HORIZONTAL_PADDING),
      )
      : estimateWrappedLineCount(
        component.limitHeader || 'Limit',
        Math.max(1, options.limitWidth - TABLE_CELL_HORIZONTAL_PADDING),
        options.fontSize,
      ))
    : 1;
  const wantHeaderLineCount = options.showWant
    ? (options.wantHeaderSegments
      ? estimateWrappedSegmentLineCount(
        options.wantHeaderSegments,
        Math.max(1, options.wantWidth - TABLE_CELL_HORIZONTAL_PADDING),
      )
      : estimateWrappedLineCount(
        component.wantHeader || 'Want',
        Math.max(1, options.wantWidth - TABLE_CELL_HORIZONTAL_PADDING),
        options.fontSize,
      ))
    : 1;
  const otherHeaderMaxLineCount = Math.max(1, limitHeaderLineCount, wantHeaderLineCount);

  // Tagged case: typography engine snaps the compact title/tag stack to the
  // shared 3pt geometry grid, with a 27pt minimum band.
  if (categoryLimitTag) {
    return typographyTaggedHeaderHeight(
      options.fontSize,
      titleLineCount,
      categoryLimitLineCount,
      otherHeaderMaxLineCount,
    );
  }

  // Untagged case: max(title, limitHeader, wantHeader) lines ×
  // baseRowHeight(fontSize). Honor any caller-supplied rowHeight that already
  // exceeds the font floor.
  const maxLineCount = Math.max(titleLineCount, otherHeaderMaxLineCount);
  const typographyHeight = typographyUntaggedHeaderHeight(options.fontSize, maxLineCount);
  if (Number.isFinite(rowHeight) && rowHeight > 0) {
    return Math.max(typographyHeight, rowHeight * maxLineCount);
  }
  return typographyHeight;
};

const getComponentHeight = (
  component: BuilderComponent,
  measurement?: SectionTableMeasurementOptions,
  layout?: { includeCategoryIcons?: boolean },
) => {
  if (component.type === 'section-table') {
    const rowHeight = Number.isFinite(component.rowHeight) && component.rowHeight > 0
      ? component.rowHeight
      : DEFAULT_SECTION_TABLE_ROW_HEIGHT;
    const limitWidth = component.showLimit ? component.limitWidth : 0;
    const showWant = component.showWant !== false;
    const wantWidth = showWant ? component.wantWidth : 0;
    const itemWidth = component.width - limitWidth - wantWidth;
    const rowMode = resolveSectionTableTranslationSettings(component.translationSettings).rows;
    const showCategoryIcon = Boolean(layout?.includeCategoryIcons && component.inventorySource);
    const headerHeight = getTableHeaderHeight(component, rowHeight, {
      itemWidth,
      limitWidth,
      wantWidth,
      fontSize: component.fontSize,
      showLimit: component.showLimit,
      showWant,
      iconOverhead: categoryIconTitleWidthOverhead(component.fontSize, showCategoryIcon),
      ...sectionTableHeaderMeasurementSegments(component, component.fontSize, measurement),
    });

    const rowHeights = component.rows.map((row) => getTableRowHeight(row, rowHeight, {
      itemWidth,
      limitWidth,
      fontSize: component.fontSize,
      showLimit: component.showLimit,
      showStatusIcons: component.showStatusIcons === true,
      itemSegments: sectionTableRowItemSegments(row, rowMode, component.fontSize, measurement),
      useNaturalContentHeight: sectionTableRowUsesTranslatedText(row, rowMode, measurement),
    }));
    const visualHeight = headerHeight + rowHeights.reduce((total, height) => total + height, 0);
    return getAdjustedSectionTablePlannerHeight(component, visualHeight, measurement);
  }

  if (component.type === 'form-field-group') {
    // Font-aware per-row height + label wrap. At fontSize=10 with single-line
    // labels this is 18pt × N (= legacy DEFAULT_FORM_FIELD_ROW_HEIGHT × N, no
    // change for existing forms). When a label wraps (long text in a narrow
    // labelWidth, or a larger font) each affected row grows to perRow × lineCount,
    // matching what the canvas / PDF actually render.
    const perRow = typographyBaseRowHeight(component.fontSize);
    const labelWidth = Math.min(component.labelWidth, component.width - 24);
    // Label cell renders with px-[3px] horizontal padding (6px total).
    const labelAvailableWidth = Math.max(1, labelWidth - 6);
    const fieldsHeight = component.fields.reduce((total, field) => {
      const mode = field.translationMode ?? DEFAULT_BUILDER_TRANSLATION_MODE;
      const lineCount = builderGeneratedTextUsesTranslation(field.label, mode, measurement)
        ? estimateWrappedSegmentLineCount(
          builderGeneratedTextSegments(field.label, mode, component.fontSize, measurement),
          labelAvailableWidth,
        )
        : typographyEstimateLineCount(field.label, labelAvailableWidth, component.fontSize);
      return total + Math.max(perRow, perRow * lineCount);
    }, 0);
    return Math.max(
      component.height,
      DEFAULT_FORM_FIELD_GROUP_HEIGHT,
      fieldsHeight,
    );
  }

  if (component.type === 'line') {
    return component.direction === 'horizontal'
      ? Math.max(component.strokeWidth, 4)
      : Math.max(component.height, 16);
  }

  if (component.type === 'legend') {
    const entries = (component.showLimited ? 1 : 0) + (component.showClearance ? 1 : 0);
    const rows = component.layout === 'vertical' ? Math.max(1, entries) : 1;
    return typographyBaseRowHeight(component.fontSize) * rows;
  }

  return component.height;
};

const getCanvasComponentHeight = (
  component: BuilderComponent,
  measurement?: SectionTableMeasurementOptions,
  layout?: { includeCategoryIcons?: boolean },
) => getComponentHeight(component, measurement, layout);

interface SectionTableMetrics {
  rowHeight: number;
  limitWidth: number;
  wantWidth: number;
  itemWidth: number;
  fontSize: number;
  headerHeight: number;
}

interface FlowingTableSegment {
  component: SectionTableBuilderComponent;
  pageIndex: number;
  lane: BuilderBodyLane;
  x: number;
  y: number;
  width: number;
  height: number;
  rows: SectionTableRow[];
  rowHeights: number[];
  startRowIndex: number;
  isFirstSegment: boolean;
  isContinuation: boolean;
  // A repeat of the first grid square ("Duplicate All"). Rendered, but not
  // an editing target: the original in the first square is.
  isDuplicate?: boolean;
}

interface BodyPlacement {
  componentId: string;
  pageIndex: number;
  lane: BuilderBodyLane;
  x: number;
  y: number;
  height: number;
  isDuplicate?: boolean;
}

interface FlowingTablePlan {
  pageCount: number;
  segments: FlowingTableSegment[];
  flowingComponentIds: Set<string>;
  // In Guided Mode the planner places ALL body components by sequence;
  // their derived positions live here. Empty in Freeform Mode (where
  // non-flowing body components keep their stored x/y).
  bodyPlacements: BodyPlacement[];
  // Body components fully governed by the plan (segments + placements).
  // Renderers and drag handlers use this to decide whether to honor stored
  // x/y or use plan-derived positions.
  plannedBodyComponentIds: Set<string>;
  overflowRowCount: number;
  // Body components the plan could not place at all because their lane chain
  // ran out (a full grid square on the last page, for example).
  unplacedComponentCount: number;
}

const getSectionTableMetrics = (
  component: SectionTableBuilderComponent,
  measurement?: SectionTableMeasurementOptions,
  // Whether the category icon will share the title cell at render time
  // (`template.includeCategoryIcons` AND `component.inventorySource`).
  // Threaded from `PreviewSectionTable` so the planner's title wrap
  // measurement matches what Chromium will actually lay out.
  layout?: { showCategoryIcon?: boolean },
): SectionTableMetrics => {
  const rowHeight = Number.isFinite(component.rowHeight) && component.rowHeight > 0
    ? component.rowHeight
    : DEFAULT_SECTION_TABLE_ROW_HEIGHT;
  const limitWidth = component.showLimit ? component.limitWidth : 0;
  const showWant = component.showWant !== false;
  const wantWidth = showWant ? component.wantWidth : 0;
  const itemWidth = component.width - limitWidth - wantWidth;
  const fontSize = component.fontSize;
  const showCategoryIcon = Boolean(layout?.showCategoryIcon && component.inventorySource);
  const headerHeight = getTableHeaderHeight(component, rowHeight, {
    itemWidth,
    limitWidth,
    wantWidth,
    fontSize,
    showLimit: component.showLimit,
    showWant,
    iconOverhead: categoryIconTitleWidthOverhead(fontSize, showCategoryIcon),
    ...sectionTableHeaderMeasurementSegments(component, fontSize, measurement),
  });

  return { rowHeight, limitWidth, wantWidth, itemWidth, fontSize, headerHeight };
};

const getSectionTableRowHeights = (
  component: SectionTableBuilderComponent,
  metrics = getSectionTableMetrics(component),
  measurement?: SectionTableMeasurementOptions,
) => {
  const rowMode = resolveSectionTableTranslationSettings(component.translationSettings).rows;
  const rowHeights = component.rows.map((row) => getTableRowHeight(row, metrics.rowHeight, {
    itemWidth: metrics.itemWidth,
    limitWidth: metrics.limitWidth,
    fontSize: metrics.fontSize,
    showLimit: component.showLimit,
    showStatusIcons: component.showStatusIcons === true,
    itemSegments: sectionTableRowItemSegments(row, rowMode, metrics.fontSize, measurement),
    useNaturalContentHeight: sectionTableRowUsesTranslatedText(row, rowMode, measurement),
  }));
  return rowHeights;
};

const isFlowingBodyTable = (component: BuilderComponent, template: ShoppingListBuilderTemplate): component is SectionTableBuilderComponent => (
  component.type === 'section-table'
  && getComponentRegion(component, template) === 'body'
  && ENABLE_FLOWING_TABLE_PREVIEW
  && component.flowMode === 'flowing'
);

const nextFlowLane = (
  pageIndex: number,
  lane: BuilderBodyLane,
  template: ShoppingListBuilderTemplate,
): { pageIndex: number; lane: BuilderBodyLane } => {
  if (getTemplateBodyLayoutMode(template) !== 'split') {
    return { pageIndex: pageIndex + 1, lane: 'full' };
  }

  if (lane === 'left') {
    return { pageIndex, lane: 'right' };
  }

  return { pageIndex: pageIndex + 1, lane: 'left' };
};

const getFlowSegmentX = (
  component: SectionTableBuilderComponent,
  template: ShoppingListBuilderTemplate,
  lane: BuilderBodyLane,
  isFirstSegment: boolean,
) => {
  const half = getBodyLaneHalf(template, lane);
  if (!half) {
    return isFirstSegment ? component.x : clamp(component.x, 0, template.paper.width - component.width);
  }

  const center = template.paper.width / 2;
  const halfLeft = half === 'right' ? center : 0;
  const halfRight = half === 'right' ? template.paper.width : center;
  const usableWidth = Math.max(0, halfRight - halfLeft);
  if (component.width >= usableWidth) {
    return halfLeft;
  }

  return halfLeft + (usableWidth - component.width) / 2;
};

// Lane-relative X for non-flowing body components placed by the Guided
// planner. Components narrower than the lane center horizontally; wider ones
// clamp to the lane's left edge.
const getBodyPlacementX = (
  component: BuilderComponent,
  template: ShoppingListBuilderTemplate,
  lane: BuilderBodyLane,
): number => {
  const half = getBodyLaneHalf(template, lane);
  if (!half) {
    return clamp(component.x, 0, template.paper.width - component.width);
  }
  const center = template.paper.width / 2;
  const halfLeft = half === 'right' ? center : 0;
  const halfRight = half === 'right' ? template.paper.width : center;
  const usableWidth = Math.max(0, halfRight - halfLeft);
  if (component.width >= usableWidth) {
    return halfLeft;
  }
  return halfLeft + (usableWidth - component.width) / 2;
};

const isBodyComponent = (
  component: BuilderComponent,
  template: ShoppingListBuilderTemplate,
) => getComponentRegion(component, template) === 'body';

interface FlowingTableState {
  component: SectionTableBuilderComponent;
  docIndex: number;
  metrics: SectionTableMetrics;
  rowHeights: number[];
  rowIndex: number;
  segmentIndex: number;
}

// Flowing-table planner. Mirrors the backend planner so canvas + Chromium HTML
// PDF render the same layout for the same template.
//
// - Guided (default): sequence-first. Flowing tables are placed in the order
//   they appear in `template.components` -- i.e. the user's add/reorder
//   sequence. Each table is fully placed (including continuations) before the
//   next is considered. Lanes are visited in reading order:
//   page0-left, page0-right, page1-left, page1-right, ...
//
// - Freeform: legacy two-phase planner that respects component.y for first
//   placement on a virgin lane and drains continuations per lane.
const createFlowingTablePlan = (
  template: ShoppingListBuilderTemplate,
  measurement?: SectionTableMeasurementOptions,
): FlowingTablePlan => {
  const maxPages = getTemplateMaxPages(template);
  const bodyBounds = getTemplateRegionBounds(template, 'body');
  const bodyLayout = getTemplateBodyLayoutMode(template);
  const isSplit = bodyLayout === 'split';
  const isGrid = bodyLayout === 'grid';
  // A grid is always sequence-planned: its squares are the layout, so there
  // is no free placement to honour.
  const isGuided = isGrid || getTemplateLayoutMode(template) === 'guided';
  const segments: FlowingTableSegment[] = [];
  const flowingComponentIds = new Set<string>();
  const bodyPlacements: BodyPlacement[] = [];
  const plannedBodyComponentIds = new Set<string>();
  let overflowRowCount = 0;
  let unplacedComponentCount = 0;
  let pageCount = 1;

  const orderedComponents = isGuided
    ? template.components.filter(
      (component): component is SectionTableBuilderComponent => isFlowingBodyTable(component, template),
    )
    : [...template.components.filter(
      (component): component is SectionTableBuilderComponent => isFlowingBodyTable(component, template),
    )].sort((first, second) => {
      if (first.y !== second.y) return first.y - second.y;
      return first.x - second.x;
    });

  const flowingTables = orderedComponents.map((component, docIndex): FlowingTableState => {
    flowingComponentIds.add(component.id);
    const metrics = getSectionTableMetrics(component, measurement);
    return {
      component,
      docIndex,
      metrics,
      rowHeights: getSectionTableRowHeights(component, metrics, measurement),
      rowIndex: 0,
      segmentIndex: 0,
    };
  });

  type LaneSlot = { pageIndex: number; lane: BuilderBodyLane };
  const laneChains: LaneSlot[][] = getTemplateBodyLaneChains(template);
  // Freeform never plans a grid (see `isGuided`), so its single chain is the
  // full / split reading order.
  const laneSequence: LaneSlot[] = laneChains[0] ?? [];

  const tryPlace = (
    state: FlowingTableState,
    slot: LaneSlot,
    laneBounds: ReturnType<typeof getTemplateBodyLaneBounds>,
    cursor: number,
    isNative: boolean,
    options: { ignoreUserY?: boolean } = {},
  ): { newCursor: number; placed: boolean } => {
    const { component, metrics, rowHeights } = state;
    const isLaneVirgin = cursor <= laneBounds.top;
    const isOriginalSlot = state.segmentIndex === 0 && isNative;
    const honorUserY = !options.ignoreUserY && isOriginalSlot && isLaneVirgin;
    const baseTop = honorUserY
      ? Math.max(component.y, cursor, laneBounds.top)
      : Math.max(cursor, laneBounds.top);
    const availableTop = baseTop;
    const availableBottom = Math.min(laneBounds.bottom, bodyBounds.bottom);
    const availableHeight = availableBottom - availableTop;
    const nextRowHeight = rowHeights[state.rowIndex] ?? metrics.rowHeight;
    const segmentPlannerHeight = (rowsHeightValue: number) => getAdjustedSectionTablePlannerHeight(
      component,
      metrics.headerHeight + rowsHeightValue,
      measurement,
    );

    if (availableHeight < segmentPlannerHeight(Math.max(1, nextRowHeight))) {
      return { newCursor: cursor, placed: false };
    }

    const rows: SectionTableRow[] = [];
    const segmentRowHeights: number[] = [];
    let rowsHeight = 0;
    const startRowIndex = state.rowIndex;
    while (state.rowIndex < component.rows.length) {
      const candidateHeight = rowHeights[state.rowIndex] ?? metrics.rowHeight;
      const candidatePlannerHeight = segmentPlannerHeight(rowsHeight + candidateHeight);
      if (rows.length > 0 && candidatePlannerHeight > availableHeight) break;
      if (rows.length === 0 && candidatePlannerHeight > availableHeight) break;
      rows.push(component.rows[state.rowIndex]);
      segmentRowHeights.push(candidateHeight);
      rowsHeight += candidateHeight;
      state.rowIndex += 1;
    }

    if (rows.length === 0) {
      return { newCursor: cursor, placed: false };
    }

    const isFirstSegment = state.segmentIndex === 0;
    const height = segmentPlannerHeight(rowsHeight);
    segments.push({
      component,
      pageIndex: slot.pageIndex,
      lane: slot.lane,
      x: getFlowSegmentX(component, template, slot.lane, isFirstSegment),
      y: availableTop,
      width: component.width,
      height,
      rows,
      rowHeights: segmentRowHeights,
      startRowIndex,
      isFirstSegment,
      isContinuation: !isFirstSegment,
    });
    state.segmentIndex += 1;
    pageCount = Math.max(pageCount, slot.pageIndex + 1);
    return { newCursor: availableTop + height + FLOWING_TABLE_GAP, placed: true };
  };

  if (isGuided) {
    // Sequence-first: walk ALL body components in template.components order.
    //   - Flowing section-tables: place every row across as many lanes as
    //     needed (multi-segment).
    //   - Other body components (text, fixed section-tables, form-field
    //     groups, lines, dates, saved): place once. Advance to the next lane
    //     if the component does not fit; if it cannot fit on a virgin lane it
    //     anchors at the lane top so the user sees and can correct it.
    const flowingStateById = new Map<string, FlowingTableState>(
      flowingTables.map((state) => [state.component.id, state]),
    );
    const bodyComponents = template.components.filter((component) => isBodyComponent(component, template));
    bodyComponents.forEach((component) => plannedBodyComponentIds.add(component.id));

    // Plan one chain of lanes with the components that belong to it. Full and
    // split pages are a single chain holding every body component; a grid is
    // one chain per square (see `getTemplateBodyLaneChains`).
    const planChain = (chain: LaneSlot[], chainComponents: BuilderComponent[]) => {
      let slotIdx = 0;
      let cursor = bodyBounds.top;
      const advanceSlot = () => {
        slotIdx += 1;
        cursor = bodyBounds.top;
      };

      for (const component of chainComponents) {
        if (slotIdx >= chain.length) {
          unplacedComponentCount += 1;
          continue;
        }

        if (isFlowingBodyTable(component, template)) {
          const state = flowingStateById.get(component.id)!;
          while (state.rowIndex < component.rows.length && slotIdx < chain.length) {
            const slot = chain[slotIdx];
            const laneBounds = getTemplateBodyLaneBounds(template, slot.lane);
            const { newCursor, placed } = tryPlace(state, slot, laneBounds, cursor, false, { ignoreUserY: true });
            if (placed) {
              cursor = newCursor;
            } else {
              advanceSlot();
              continue;
            }
            if (state.rowIndex < component.rows.length) {
              advanceSlot();
            }
          }
          overflowRowCount += component.rows.length - state.rowIndex;
        } else {
          const height = getCanvasComponentHeight(component, measurement);
          let placed = false;
          while (!placed && slotIdx < chain.length) {
            const slot = chain[slotIdx];
            const laneBounds = getTemplateBodyLaneBounds(template, slot.lane);
            const availableTop = Math.max(cursor, laneBounds.top);
            const availableBottom = Math.min(laneBounds.bottom, bodyBounds.bottom);
            const fitsHere = availableTop + height <= availableBottom;
            const isLaneVirgin = cursor <= laneBounds.top;
            if (fitsHere || isLaneVirgin) {
              bodyPlacements.push({
                componentId: component.id,
                pageIndex: slot.pageIndex,
                lane: slot.lane,
                x: getBodyPlacementX(component, template, slot.lane),
                y: availableTop,
                height,
              });
              cursor = availableTop + height + FLOWING_TABLE_GAP;
              pageCount = Math.max(pageCount, slot.pageIndex + 1);
              placed = true;
            } else {
              advanceSlot();
            }
          }
          if (!placed) unplacedComponentCount += 1;
        }
      }
    };

    if (isGrid) {
      laneChains.forEach((chain) => {
        const cellIndex = gridCellIndexOfLane(chain[0]?.lane ?? 'full') ?? 0;
        planChain(chain, bodyComponents.filter((component) => (
          getComponentGridCell(component, template) === cellIndex
        )));
      });

      if (getTemplateGridContentMode(template) === 'duplicate') {
        // "Duplicate All": repeat the first square's finished layout in every
        // other square. Squares share a size, so a copy is the original moved
        // by whole columns and rows.
        const originBounds = getTemplateBodyLaneBounds(template, gridCellLane(0));
        const originalSegments = [...segments];
        const originalPlacements = [...bodyPlacements];
        for (let cellIndex = 1; cellIndex < getTemplateGridCellCount(template); cellIndex += 1) {
          const lane = gridCellLane(cellIndex);
          const dx = (cellIndex % BUILDER_GRID_COLUMNS) * (template.paper.width / BUILDER_GRID_COLUMNS);
          const dy = getTemplateBodyLaneBounds(template, lane).top - originBounds.top;
          originalSegments.forEach((segment) => {
            segments.push({ ...segment, lane, x: segment.x + dx, y: segment.y + dy, isDuplicate: true });
          });
          originalPlacements.forEach((placement) => {
            bodyPlacements.push({ ...placement, lane, x: placement.x + dx, y: placement.y + dy, isDuplicate: true });
          });
        }
      }
    } else {
      planChain(laneSequence, bodyComponents);
    }

    return {
      pageCount: Math.min(maxPages, Math.max(pageCount, 1)),
      segments,
      flowingComponentIds,
      bodyPlacements,
      plannedBodyComponentIds,
      overflowRowCount,
      unplacedComponentCount,
    };
  }

  // Freeform planner (original two-phase, lane-by-lane allocation).
  const homeLaneOf = (state: FlowingTableState): BuilderBodyLane => (
    isSplit ? getComponentBodyLane(state.component, template) : 'full'
  );
  const nativesByLaneKey = new Map<string, FlowingTableState[]>();
  flowingTables.forEach((state) => {
    const key = `0:${homeLaneOf(state)}`;
    const list = nativesByLaneKey.get(key) ?? [];
    list.push(state);
    nativesByLaneKey.set(key, list);
  });
  nativesByLaneKey.forEach((list) => list.sort((a, b) => {
    if (a.component.y !== b.component.y) return a.component.y - b.component.y;
    return a.component.x - b.component.x;
  }));

  const pending: FlowingTableState[] = [];
  const insertByDocIndex = (state: FlowingTableState) => {
    let index = 0;
    while (index < pending.length && pending[index].docIndex <= state.docIndex) {
      index += 1;
    }
    pending.splice(index, 0, state);
  };

  laneSequence.forEach((slot) => {
    const laneBounds = getTemplateBodyLaneBounds(template, slot.lane);
    let cursor = bodyBounds.top;
    const natives = nativesByLaneKey.get(`${slot.pageIndex}:${slot.lane}`) ?? [];

    while (pending.length > 0) {
      const candidate = pending[0];
      const { newCursor, placed } = tryPlace(candidate, slot, laneBounds, cursor, false);
      if (!placed) break;
      cursor = newCursor;
      pending.shift();
      if (candidate.rowIndex < candidate.component.rows.length) {
        insertByDocIndex(candidate);
      }
    }

    natives.forEach((state) => {
      const { newCursor, placed } = tryPlace(state, slot, laneBounds, cursor, true);
      if (placed) {
        cursor = newCursor;
        if (state.rowIndex < state.component.rows.length) {
          insertByDocIndex(state);
        }
      } else {
        insertByDocIndex(state);
      }
    });
  });

  pending.forEach((state) => {
    overflowRowCount += state.component.rows.length - state.rowIndex;
  });

  // Freeform: planner only governs flowing tables; mirror them into the
  // planned set so the renderer/drag code can rely on a single membership
  // check across both modes.
  flowingComponentIds.forEach((id) => plannedBodyComponentIds.add(id));

  return {
    pageCount: Math.min(maxPages, Math.max(pageCount, 1)),
    segments,
    flowingComponentIds,
    bodyPlacements,
    plannedBodyComponentIds,
    overflowRowCount,
    unplacedComponentCount,
  };
};

interface GuidedInsertTarget {
  // The sequence index inside template.components where the dragged component
  // should be re-inserted (computed AFTER the dragged component is removed).
  sequenceIndex: number;
  pageIndex: number;
  lane: BuilderBodyLane;
  x: number;
  y: number;
  width: number;
  // Grid square the dragged component joins when dropped here. Set only for
  // an 'individual' grid, where a drop can move a component between squares.
  gridCell?: number;
  // Height below `y` that also counts as this target. Lets a drop anywhere
  // in the open part of a grid square land there, instead of requiring the
  // pointer to be within a few points of the insert line.
  catchHeight?: number;
}

// Compute drop targets for drag-reorder of body components in Guided Mode.
// Targets sit before/between/after each placed body component (flowing tables
// AND single-placement components) in plan reading order. The dragged
// component is excluded so the target index maps cleanly to a post-removal
// splice position in template.components.
//
// Full and split pages are one reading sequence. An 'individual' grid is one
// sequence per square, and an empty square still offers a target at its top so
// a component can be dragged into it.
const computeGuidedInsertTargets = (
  template: ShoppingListBuilderTemplate,
  plan: FlowingTablePlan,
  draggedComponentId: string,
): GuidedInsertTarget[] => {
  const bodyLayout = getTemplateBodyLayoutMode(template);
  const isGrid = bodyLayout === 'grid';
  if (!isGrid && getTemplateLayoutMode(template) !== 'guided') return [];

  const remainingComponents = template.components.filter((c) => c.id !== draggedComponentId);
  const sequenceIndexOf = (componentId: string) => {
    const idx = remainingComponents.findIndex((c) => c.id === componentId);
    return idx === -1 ? remainingComponents.length : idx;
  };

  const laneBox = (pageLane: BuilderBodyLane) => {
    const lb = getTemplateBodyLaneBounds(template, pageLane);
    return { x: lb.left, width: Math.max(1, lb.right - lb.left), top: lb.top, bottom: lb.bottom };
  };

  // For each placed component (excluding the dragged one and any Duplicate
  // All copies), its first placement (top) and last placement (tail).
  type PlacedRef = {
    componentId: string;
    firstPageIndex: number;
    firstLane: BuilderBodyLane;
    firstY: number;
    lastPageIndex: number;
    lastLane: BuilderBodyLane;
    lastBottom: number;
  };
  const placedRefFor = (component: BuilderComponent): PlacedRef | null => {
    const segs = plan.segments.filter((s) => s.component.id === component.id && !s.isDuplicate);
    if (segs.length > 0) {
      const head = segs[0];
      const tail = segs[segs.length - 1];
      return {
        componentId: component.id,
        firstPageIndex: head.pageIndex,
        firstLane: head.lane,
        firstY: head.y,
        lastPageIndex: tail.pageIndex,
        lastLane: tail.lane,
        lastBottom: tail.y + tail.height,
      };
    }
    const placement = plan.bodyPlacements.find((p) => p.componentId === component.id && !p.isDuplicate);
    if (!placement) return null;
    return {
      componentId: component.id,
      firstPageIndex: placement.pageIndex,
      firstLane: placement.lane,
      firstY: placement.y,
      lastPageIndex: placement.pageIndex,
      lastLane: placement.lane,
      lastBottom: placement.y + placement.height,
    };
  };

  const targets: GuidedInsertTarget[] = [];

  // Targets for one reading sequence. `emptyLane` is where a drop lands when
  // the sequence holds nothing; `gridCell` tags every target of a square.
  const addSequenceTargets = (
    components: BuilderComponent[],
    emptyLane: BuilderBodyLane,
    gridCell?: number,
  ) => {
    const placed = components
      .filter((component) => plan.plannedBodyComponentIds.has(component.id))
      .map(placedRefFor)
      .filter((ref): ref is PlacedRef => ref != null);

    if (placed.length === 0) {
      const { x, width, top, bottom } = laneBox(emptyLane);
      targets.push({
        sequenceIndex: remainingComponents.length,
        pageIndex: 0,
        lane: emptyLane,
        x,
        y: top,
        width,
        gridCell,
        catchHeight: gridCell == null ? undefined : Math.max(0, bottom - top),
      });
      return;
    }

    // Before first placement.
    {
      const first = placed[0];
      const { x, width, top } = laneBox(first.firstLane);
      targets.push({
        sequenceIndex: sequenceIndexOf(first.componentId),
        pageIndex: first.firstPageIndex,
        lane: first.firstLane,
        x,
        y: top,
        width,
        gridCell,
      });
    }

    // Between consecutive placements.
    for (let i = 0; i < placed.length - 1; i += 1) {
      const before = placed[i];
      const after = placed[i + 1];
      const sameLane = before.lastPageIndex === after.firstPageIndex && before.lastLane === after.firstLane;
      const lane = sameLane ? before.lastLane : after.firstLane;
      const { x, width, top } = laneBox(lane);
      targets.push({
        sequenceIndex: sequenceIndexOf(after.componentId),
        pageIndex: sameLane ? before.lastPageIndex : after.firstPageIndex,
        lane,
        x,
        y: sameLane ? (before.lastBottom + after.firstY) / 2 : top,
        width,
        gridCell,
      });
    }

    // After last placement.
    {
      const last = placed[placed.length - 1];
      const { x, width, bottom } = laneBox(last.lastLane);
      const afterY = last.lastBottom + FLOWING_TABLE_GAP / 2;
      targets.push({
        catchHeight: gridCell == null ? undefined : Math.max(0, bottom - afterY),
        // Within a grid square the component goes right after the square's
        // last component; on a single-sequence page that is the very end.
        sequenceIndex: gridCell == null ? remainingComponents.length : sequenceIndexOf(last.componentId) + 1,
        pageIndex: last.lastPageIndex,
        lane: last.lastLane,
        x,
        y: last.lastBottom + FLOWING_TABLE_GAP / 2,
        width,
        gridCell,
      });
    }
  };

  if (isGrid && getTemplateGridContentMode(template) === 'individual') {
    for (let cellIndex = 0; cellIndex < getTemplateGridCellCount(template); cellIndex += 1) {
      addSequenceTargets(
        remainingComponents.filter((component) => (
          isBodyComponent(component, template) && getComponentGridCell(component, template) === cellIndex
        )),
        gridCellLane(cellIndex),
        cellIndex,
      );
    }
    return targets;
  }

  addSequenceTargets(
    remainingComponents,
    isGrid ? gridCellLane(0) : bodyLayout === 'split' ? 'left' : 'full',
  );
  return targets;
};

const findNearestInsertTarget = (
  targets: GuidedInsertTarget[],
  paperHeight: number,
  cursor: { pageIndex: number; x: number; y: number },
  toleranceY: number,
  toleranceX: number,
): GuidedInsertTarget | null => {
  if (targets.length === 0) return null;
  const cursorFlat = cursor.pageIndex * paperHeight + cursor.y;
  let best: GuidedInsertTarget | null = null;
  let bestScore = Infinity;
  for (const target of targets) {
    const targetFlat = target.pageIndex * paperHeight + target.y;
    const insideCatch = target.catchHeight != null
      && cursorFlat >= targetFlat
      && cursorFlat <= targetFlat + target.catchHeight;
    const yDist = insideCatch ? 0 : Math.abs(targetFlat - cursorFlat);
    const left = target.x;
    const right = target.x + target.width;
    const xDist = cursor.x < left ? left - cursor.x : cursor.x > right ? cursor.x - right : 0;
    if (yDist > toleranceY || xDist > toleranceX) continue;
    const score = yDist + xDist;
    if (score < bestScore) {
      bestScore = score;
      best = target;
    }
  }
  return best;
};

const cloneTemplate = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const componentTypeLabel = (type: BuilderComponentType) => {
  switch (type) {
    case 'form-field-group':
      return 'Form fields';
    case 'section-table':
      return 'Section table';
    case 'line':
      return 'Line';
    case 'date':
      return 'Date';
    case 'language-tag':
      return 'Language tag';
    case 'legend':
      return 'Legend';
    case 'text':
    default:
      return 'Text block';
  }
};

const translationModeLabel = (mode: BuilderTranslationMode): string => {
  switch (mode) {
    case 'skip':
      return 'Do not translate';
    case 'translate-with-original':
      return 'Include English';
    case 'translate-with-original-block':
      return 'Include English (with line break)';
    case 'translate-with-original-adaptive':
      return 'Include English (adaptive)';
    case 'translate':
    default:
      return 'Translate';
  }
};

const languageTagModeLabel = (mode: BuilderLanguageTagMode): string => {
  switch (mode) {
    case 'hide-english':
      return 'Hide tag for English';
    case 'native':
      return 'Translate language tag';
    case 'native-with-english':
      return 'Translate language tag and include English';
    case 'english':
    default:
      return 'Show language tag in English only';
  }
};

const componentRegionLabel = (region: BuilderComponentRegion) => {
  switch (region) {
    case 'header':
      return 'Header';
    case 'footer':
      return 'Footer';
    case 'body':
    default:
      return 'Body';
  }
};

const componentRegionDescription = (region: BuilderComponentRegion) => {
  switch (region) {
    case 'header':
      return 'Repeats above page body content';
    case 'footer':
      return 'Repeats below page body content';
    case 'body':
    default:
      return 'Flows between header and footer';
  }
};

const componentRegionBadgeClass = (region: BuilderComponentRegion) => {
  switch (region) {
    case 'header':
    case 'footer':
      return 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/10';
    case 'body':
    default:
      return 'border-border bg-background text-foreground hover:bg-accent';
  }
};

const headerFooterRepeatModeLabel = (mode: BuilderHeaderFooterRepeatMode) => {
  switch (mode) {
    case 'odd':
      return 'Show on odd pages';
    case 'even':
      return 'Show on even pages';
    case 'once':
      return 'Show once';
    case 'every':
    default:
      return 'Show on every page';
  }
};

const headerFooterRepeatModeShortLabel = (mode: BuilderHeaderFooterRepeatMode) => {
  switch (mode) {
    case 'odd':
      return 'Odd pages';
    case 'even':
      return 'Even pages';
    case 'once':
      return 'Once';
    case 'every':
    default:
      return 'Every page';
  }
};

const headerFooterRepeatModeDescription = (mode: BuilderHeaderFooterRepeatMode) => {
  switch (mode) {
    case 'odd':
      return 'Render on pages 1, 3, 5, ...';
    case 'even':
      return 'Render on pages 2, 4, 6, ...';
    case 'once':
      return 'Render only on the first page';
    case 'every':
    default:
      return 'Render on every page';
  }
};

const bodyLayoutModeLabel = (mode: BuilderBodyLayoutMode) => {
  switch (mode) {
    case 'split':
      return 'Split page';
    case 'grid':
      return 'Grid page';
    case 'full':
    default:
      return 'Full page';
  }
};

const printModeLabel = (mode: BuilderPrintMode) => {
  switch (mode) {
    case 'two-sided-duplicate':
      return 'Make 2-sided';
    case 'two-sided-when-single-page':
      // Render-time only (used by the bulk translated-PDF export modal). The
      // Properties panel does not surface this option, but the badge in the
      // canvas page header would render this label if the value showed up.
      return 'Two-sided (single page only)';
    case 'single-sided':
    default:
      return 'Single-sided';
  }
};

const getRegionForPoint = (
  y: number,
  template: ShoppingListBuilderTemplate,
): BuilderComponentRegion => {
  const headerHeight = getTemplateHeaderHeight(template);
  const footerTop = template.paper.height - getTemplateFooterHeight(template);

  if (headerHeight > 0 && y < headerHeight) {
    return 'header';
  }

  if (getTemplateFooterHeight(template) > 0 && y >= footerTop) {
    return 'footer';
  }

  return DEFAULT_COMPONENT_REGION;
};

const inferComponentRegion = (
  component: BuilderComponent,
  template: ShoppingListBuilderTemplate,
): BuilderComponentRegion => {
  const midpoint = component.y + getCanvasComponentHeight(component) / 2;
  return getRegionForPoint(midpoint, template);
};

const isInventorySectionTable = (
  component: BuilderComponent,
): component is SectionTableBuilderComponent => (
  component.type === 'section-table' && Boolean(component.inventorySource?.categoryId)
);

const getComponentRegion = (
  component: BuilderComponent,
  template: ShoppingListBuilderTemplate,
): BuilderComponentRegion => (
  isInventorySectionTable(component) ? 'body' : component.region ?? inferComponentRegion(component, template)
);

const getSectionTableFlowMode = (component: SectionTableBuilderComponent) => (
  ENABLE_FLOWING_TABLE_PREVIEW && component.flowMode === 'flowing' ? 'flowing' : 'fixed'
);

const getComponentBodyLane = (
  component: BuilderComponent,
  template: ShoppingListBuilderTemplate,
): BuilderBodyLane => {
  const bodyLayout = getTemplateBodyLayoutMode(template);
  if (bodyLayout === 'full' || getComponentRegion(component, template) !== 'body') {
    return 'full';
  }
  // A grid component's lane is the square it belongs to, not where its stale
  // stored x happens to fall.
  if (bodyLayout === 'grid') {
    return gridCellLane(getComponentGridCell(component, template));
  }

  return component.x + component.width / 2 >= template.paper.width / 2 ? 'right' : 'left';
};

const getComponentPlacementBounds = (
  component: BuilderComponent,
  template: ShoppingListBuilderTemplate,
  region: BuilderComponentRegion,
) => {
  const regionBounds = getTemplateRegionBounds(template, region);
  const lane = getComponentBodyLane({ ...component, region } as BuilderComponent, template);
  const laneBounds = region === 'body' && getTemplateLayoutMode(template) === 'guided'
    ? getTemplateBodyLaneBounds(template, lane)
    : null;

  return {
    region,
    lane,
    left: laneBounds?.left ?? 0,
    right: laneBounds?.right ?? template.paper.width,
    top: regionBounds.top,
    bottom: regionBounds.bottom,
  };
};

const componentRect = (component: BuilderComponent) => ({
  left: component.x,
  right: component.x + component.width,
  top: component.y,
  bottom: component.y + getCanvasComponentHeight(component),
});

const rectanglesOverlap = (
  first: ReturnType<typeof componentRect>,
  second: ReturnType<typeof componentRect>,
  gap = 0,
) => (
  first.left < second.right + gap
  && first.right + gap > second.left
  && first.top < second.bottom + gap
  && first.bottom + gap > second.top
);

const resolveGuidedCollision = (
  component: BuilderComponent,
  template: ShoppingListBuilderTemplate,
  excludeComponentId?: string,
) => {
  if (getTemplateLayoutMode(template) !== 'guided') {
    return component;
  }

  const region = getComponentRegion(component, template);
  const lane = getComponentBodyLane(component, template);
  const displayHeight = getCanvasComponentHeight(component);
  const bounds = getComponentPlacementBounds(component, template, region);
  const minY = bounds.top;
  const maxY = Math.max(minY, bounds.bottom - displayHeight);
  const gridSize = getTemplateGridSize(template);
  const colliders = template.components.filter((current) => (
    current.id !== (excludeComponentId ?? component.id)
    && getComponentRegion(current, template) === region
    && getComponentBodyLane(current, template) === lane
  ));

  const isAvailable = (y: number) => {
    const candidate = componentRect({ ...component, y } as BuilderComponent);
    return colliders.every((current) => !rectanglesOverlap(candidate, componentRect(current), GUIDED_COLLISION_GAP));
  };

  const requestedY = clamp(component.y, minY, maxY);
  if (isAvailable(requestedY)) {
    return { ...component, y: requestedY } as BuilderComponent;
  }

  const candidates = new Set<number>([requestedY]);
  for (let y = minY; y <= maxY; y += gridSize) {
    candidates.add(snapToGrid(y, gridSize));
  }
  colliders.forEach((current) => {
    candidates.add(snapToGrid(componentRect(current).bottom + GUIDED_COLLISION_GAP, gridSize));
    candidates.add(snapToGrid(componentRect(current).top - displayHeight - GUIDED_COLLISION_GAP, gridSize));
  });

  const orderedCandidates = Array.from(candidates)
    .map((y) => clamp(y, minY, maxY))
    .sort((a, b) => Math.abs(a - requestedY) - Math.abs(b - requestedY));
  const availableY = orderedCandidates.find(isAvailable);

  if (availableY == null) {
    return { ...component, y: requestedY } as BuilderComponent;
  }

  return { ...component, y: availableY } as BuilderComponent;
};

const canPlaceComponentInRegion = (
  component: BuilderComponent,
  template: ShoppingListBuilderTemplate,
  region: BuilderComponentRegion,
) => {
  if (isInventorySectionTable(component)) {
    return region === 'body';
  }

  const bounds = getTemplateRegionBounds(template, region);
  if (bounds.height <= 0) {
    return false;
  }

  if (region === 'body') {
    return true;
  }

  return getCanvasComponentHeight(component) <= bounds.height;
};

const resolveComponentRegion = (
  component: BuilderComponent,
  template: ShoppingListBuilderTemplate,
  preferredRegion?: BuilderComponentRegion,
): BuilderComponentRegion => {
  if (isInventorySectionTable(component)) {
    return 'body';
  }

  const requestedRegion = preferredRegion ?? getComponentRegion(component, template);

  if (canPlaceComponentInRegion(component, template, requestedRegion)) {
    return requestedRegion;
  }

  if (requestedRegion !== 'body' && canPlaceComponentInRegion(component, template, 'body')) {
    return 'body';
  }

  return requestedRegion;
};

const clampComponentToTemplateRegion = (
  component: BuilderComponent,
  template: ShoppingListBuilderTemplate,
  preferredRegion?: BuilderComponentRegion,
  options: { avoidCollisions?: boolean; excludeComponentId?: string } = {},
): BuilderComponent => {
  const region = resolveComponentRegion(component, template, preferredRegion);
  const bounds = getComponentPlacementBounds(component, template, region);
  const displayHeight = getCanvasComponentHeight(component);
  const maxX = Math.max(bounds.left, bounds.right - component.width);
  const maxY = Math.max(bounds.top, bounds.bottom - displayHeight);
  const clamped = {
    ...component,
    region,
    x: clamp(component.x, bounds.left, maxX),
    y: clamp(component.y, bounds.top, maxY),
  } as BuilderComponent;

  return options.avoidCollisions
    ? resolveGuidedCollision(clamped, template, options.excludeComponentId)
    : clamped;
};

const clampTemplateComponentsToRegions = (
  template: ShoppingListBuilderTemplate,
  options: { avoidCollisions?: boolean } = {},
): ShoppingListBuilderTemplate => {
  const nextTemplate: ShoppingListBuilderTemplate = { ...template, components: [] };
  nextTemplate.components = template.components.map((component) => {
    const placed = clampComponentToTemplateRegion(component, nextTemplate, undefined, {
      avoidCollisions: options.avoidCollisions,
      excludeComponentId: component.id,
    });
    nextTemplate.components.push(placed);
    return placed;
  });

  return nextTemplate;
};

const annotateTemplateComponentRegions = (
  template: ShoppingListBuilderTemplate,
): ShoppingListBuilderTemplate => ({
  ...template,
  components: template.components.map((component) => ({
    ...component,
    region: getComponentRegion(component, template),
  } as BuilderComponent)),
});

const limitSourceLabel = (row: SectionTableRow) => {
  if (!row.foodItemId) return 'Manual';

  switch (row.limitSource) {
    case 'food-item':
      return 'Item';
    case 'category':
      return 'Category';
    case 'none':
    default:
      return 'No limit';
  }
};

const formatCategoryLimitTag = (
  limit: number | null | undefined,
  limitType: 'person' | 'household' | null | undefined,
): string | null => {
  if (limit == null || !Number.isFinite(limit) || limit <= 0) {
    return null;
  }

  if (limitType === 'person') {
    return `Choose up to ${limit} per person`;
  }

  if (limit === 1) {
    return 'Choose one';
  }

  if (limit === 2) {
    return 'Choose two';
  }

  return `Choose up to ${limit}`;
};

const cloneComponentForCanvas = (
  component: BuilderComponent,
  paperWidth: number,
  paperHeight: number,
): BuilderComponent => {
  const clone = cloneTemplate(component);
  const displayHeight = getCanvasComponentHeight(clone);
  const x = Number.isFinite(clone.x) ? clone.x : 48;
  const y = Number.isFinite(clone.y) ? clone.y : 48;

  return {
    ...clone,
    id: `${clone.id}-instance-${Date.now()}`,
    x: clamp(x, 0, paperWidth - clone.width),
    y: clamp(y, 0, paperHeight - displayHeight),
  } as BuilderComponent;
};

// B3: resolve the text shown in a row's Limit cell. A row carries only its own
// item-level limit; when it has none ("No Limit") and the table has not opted
// out of `showGlobalLimit` (default ON, ISSUES.md #39), fall back to the live
// org-wide Global Limit value. MUST mirror `resolveRowLimitText` in the
// backend route.
function resolveRowLimitText(
  rowLimit: string,
  showGlobalLimit: boolean,
  globalLimit: number | null | undefined,
): string {
  if (rowLimit && rowLimit.length > 0) return rowLimit;
  if (showGlobalLimit && globalLimit != null) return String(globalLimit);
  return rowLimit;
}

// A6: resolve the effective Want-column control for a section table. The
// table-level `component.wantControl` is the source of truth; when unset, fall
// back to legacy per-row `wantControl` ('checkbox' if ANY row carries it) so
// older saved templates render correctly. Lifted from per-row to table-level
// because the row-level setting never reliably persisted on inventory-backed
// tables (the refresh-inventory rebuild wipes per-row fields) and the use case
// is "apply to all rows" anyway. See ISSUES.md #43.
// MUST mirror `resolveSectionTableWantControl` in the backend route.
function resolveSectionTableWantControl(
  component: SectionTableBuilderComponent,
): 'blank' | 'checkbox' {
  if (component.wantControl === 'checkbox') return 'checkbox';
  if (component.wantControl === 'blank') return 'blank';
  if (component.rows.some((row) => row.wantControl === 'checkbox')) return 'checkbox';
  return 'blank';
}

function PreviewText({ component }: { component: TextBuilderComponent }) {
  // Pull the canvas-wide preview language + cache map from context. When
  // language === '' the canvas is in its default English state and we
  // render component.content directly. When a language is active we
  // honour the per-component translationMode (default 'translate') and
  // produce the same body the backend renderer emits to PDF.
  const { language, translations } = usePreviewLanguage();
  const cachedTranslation = language && translations[component.content]
    ? translations[component.content]
    : null;
  const mode = component.translationMode ?? DEFAULT_BUILDER_TRANSLATION_MODE;
  const body = language
    ? renderTextBody(component.content, cachedTranslation, mode)
    : component.content;
  const isTranslated = Boolean(language && cachedTranslation && mode !== 'skip');
  const isRtl = isTranslated && isRTLLanguage(language);
  const textAlign = component.align === 'center'
    ? 'center'
    : isRtl
      ? (component.align === 'left' ? 'right' : 'left')
      : component.align;

  return (
    <div
      dir="auto"
      className="h-full w-full whitespace-pre-line"
      style={{
        fontSize: component.fontSize,
        fontWeight: component.fontWeight === 'bold' ? 700 : 400,
        lineHeight: component.lineHeight,
        textAlign,
        unicodeBidi: 'plaintext',
      }}
    >
      {body}
    </div>
  );
}

function PreviewFormFields({ component }: { component: FormFieldGroupBuilderComponent }) {
  const { language, translations } = usePreviewLanguage();
  const measurement = language ? { language, translations } : undefined;
  const labelWidth = Math.min(component.labelWidth, component.width - 24);
  const valueWidth = component.width - labelWidth;
  const cornerRadius = Math.max(0, component.cornerRadius ?? 0);
  // Font-aware per-row height. 10pt -> 18pt (no change), 14-18pt -> 27pt.
  // Each row's actual min-height is perRow * lineCount so wrapped labels grow
  // to a 9pt-multiple (e.g. 36pt or 54pt) instead of stretching to fit
  // arbitrary content height. Keeps the form's bottom edge on the grid.
  const perRow = typographyBaseRowHeight(component.fontSize);
  const labelAvailableWidth = Math.max(1, labelWidth - 6);
  // RTL preview language: dir="rtl" reverses the label|value grid columns
  // (label moves to the right) and flips text alignment. The label|value
  // divider picks its physical edge explicitly from the table direction --
  // see the matching note in PreviewSectionTable for why a logical
  // border-inline-start is unsafe next to dir="auto" cells.
  const isRtl = isRTLLanguage(language);
  const dividerClass = isRtl ? 'border-r' : 'border-l';
  // A1/A3 (forms, mirror of section tables): default ON for back-compat.
  // showColumnDividers gates the vertical label|value divider; showBorders
  // gates the outer box + horizontal row separators.
  const showColumnDividers = component.showColumnDividers !== false;
  const showBorders = component.showBorders !== false;
  const colDivider = showColumnDividers ? dividerClass : '';

  return (
    <div
      dir={isRtl ? 'rtl' : undefined}
      className={cn('w-full bg-white', showBorders && 'border border-[#a8a8a8]')}
      style={{
        fontSize: component.fontSize,
        borderRadius: cornerRadius,
        overflow: cornerRadius > 0 ? 'hidden' : undefined,
      }}
    >
      {component.fields.map((field, index) => {
        const mode = field.translationMode ?? DEFAULT_BUILDER_TRANSLATION_MODE;
        const lineCount = language && builderGeneratedTextUsesTranslation(field.label, mode, measurement)
          ? estimateWrappedSegmentLineCount(
            builderGeneratedTextSegments(field.label, mode, component.fontSize, measurement),
            labelAvailableWidth,
          )
          : typographyEstimateLineCount(field.label, labelAvailableWidth, component.fontSize);
        const fieldRowHeight = Math.max(perRow, perRow * lineCount);
        const renderedLabel = language
          ? renderTranslatedBuilderText(field.label, translations[field.label], mode)
          : field.label;
        return (
          <div
            key={field.id}
            className={cn('grid', showBorders && index > 0 && 'border-t border-[#a8a8a8]')}
            style={{
              gridTemplateColumns: `${labelWidth}px ${valueWidth}px`,
              minHeight: fieldRowHeight,
            }}
          >
            <div
              dir="auto"
              className="px-[3px] [unicode-bidi:plaintext]"
              style={{
                paddingTop: BUILDER_CELL_VERTICAL_PADDING_PT,
                paddingBottom: BUILDER_CELL_VERTICAL_PADDING_PT,
                lineHeight: BUILDER_LINE_HEIGHT_MULTIPLIER,
              }}
            >
              {renderedLabel}
            </div>
            <div className={cn('border-[#a8a8a8]', colDivider)} />
          </div>
        );
      })}
    </div>
  );
}

function PreviewSectionTable({ component, rows = component.rows, rowHeights, includeCategoryIcons = false }: {
  component: SectionTableBuilderComponent;
  rows?: SectionTableRow[];
  rowHeights?: number[];
  includeCategoryIcons?: boolean;
}) {
  const { language, translations, inventoryTranslations, globalLimit } = usePreviewLanguage();
  const rowHeight = Number.isFinite(component.rowHeight) && component.rowHeight > 0
    ? component.rowHeight
    : DEFAULT_SECTION_TABLE_ROW_HEIGHT;
  const limitWidth = component.showLimit ? component.limitWidth : 0;
  const showWant = component.showWant !== false;
  // A6: table-level toggle (with legacy per-row fallback). Same value on every
  // row, computed once outside the row loop below.
  const wantCheckbox = resolveSectionTableWantControl(component) === 'checkbox';
  const wantWidth = showWant ? component.wantWidth : 0;
  const itemWidth = component.width - limitWidth - wantWidth;
  const measurement = language ? { language, translations, inventoryTranslations } : undefined;
  const translationSettings = resolveSectionTableTranslationSettings(component.translationSettings);
  const headerMode = translationSettings.headers ?? DEFAULT_BUILDER_TRANSLATION_MODE;
  const tagMode = translationSettings.tags ?? DEFAULT_BUILDER_TRANSLATION_MODE;
  const rowMode = translationSettings.rows ?? DEFAULT_BUILDER_TRANSLATION_MODE;
  // Compute the icon flag BEFORE measuring header geometry so the planner
  // subtracts the icon's title-cell width when wrapping long category
  // titles (ISSUES.md #26 follow-up).
  const shouldShowCategoryIcon = includeCategoryIcons && Boolean(component.inventorySource);
  const computedRowHeights = rowHeights ?? (
    rows === component.rows
      ? getSectionTableRowHeights(
        component,
        getSectionTableMetrics(component, measurement, { showCategoryIcon: shouldShowCategoryIcon }),
        measurement,
      )
      : undefined
  );
  const headerHeight = getTableHeaderHeight(component, rowHeight, {
    itemWidth,
    limitWidth,
    wantWidth,
    fontSize: component.fontSize,
    showLimit: component.showLimit,
    showWant,
    iconOverhead: categoryIconTitleWidthOverhead(component.fontSize, shouldShowCategoryIcon),
    ...sectionTableHeaderMeasurementSegments(component, component.fontSize, measurement),
  });
  // Columns in order: Item, [Limit if shown], [Want if shown]. Handles all
  // four combinations (A5): both, limit-only, want-only, names-only.
  const gridTemplateColumns = [
    `${itemWidth}px`,
    ...(component.showLimit ? [`${limitWidth}px`] : []),
    ...(showWant ? [`${wantWidth}px`] : []),
  ].join(' ');
  const categoryLimitTag = formatCategoryLimitTag(component.categoryLimit, component.categoryLimitType);
  const categoryLimitTagSource = categoryLimitTag ? `(${categoryLimitTag})` : null;
  // Inventory tables resolve the title from CategoryTranslation; base-
  // component tables resolve it from the Generated (List) cache.
  const categoryTranslation = language
    ? (component.inventorySource?.categoryId
      ? inventoryTranslations?.categories[component.inventorySource.categoryId]
      : translations[component.title])
    : undefined;
  const renderedTitle = renderTranslatedBuilderText(
    component.title,
    categoryTranslation,
    headerMode,
  );
  const CategoryIcon = shouldShowCategoryIcon
    ? getIconComponent(component.inventorySource?.categoryIcon || DEFAULT_ICON)
    : null;
  const cornerRadius = Math.max(0, component.cornerRadius ?? 0);
  // RTL preview language: dir="rtl" reverses the grid column order of the
  // header and every body row (Category | Limit | Want -> Want | Limit |
  // Category) and flips text alignment.
  const isRtl = isRTLLanguage(language);
  // Column dividers must resolve against the TABLE's direction, not each
  // cell's. The Limit/Want cells carry `dir="auto"` + `unicode-bidi:plaintext`
  // for correct text shaping, so a logical `border-inline-start` would flip
  // to the wrong physical edge whenever a cell's content is LTR (e.g. a digit
  // limit value or an untranslated "Limit" header) -- stacking both dividers
  // on the same side. Pick the physical edge explicitly from the table dir.
  const dividerClass = isRtl ? 'border-r' : 'border-l';
  // A1/A3: vertical column dividers and table/cell borders (outer box +
  // horizontal row rules) are independently toggleable; both default ON for
  // back-compat with templates that predate these flags.
  const showColumnDividers = component.showColumnDividers !== false;
  const showBorders = component.showBorders !== false;
  const colDivider = showColumnDividers ? dividerClass : '';

  return (
    <div
      dir={isRtl ? 'rtl' : undefined}
      className={cn('w-full bg-white', showBorders && 'border border-[#b9b9b9]')}
      style={{
        fontSize: component.fontSize,
        borderRadius: cornerRadius,
        overflow: cornerRadius > 0 ? 'hidden' : undefined,
      }}
    >
      <div
        className={cn('grid bg-white font-bold', showBorders && 'border-b border-[#b9b9b9]')}
        style={{ gridTemplateColumns, height: headerHeight }}
      >
        <div
          dir="auto"
          className={cn(
            // text-start (not text-left) so the title aligns to the
            // inline-start edge in both LTR and RTL renders.
            'flex flex-col justify-center px-1 text-start [unicode-bidi:plaintext]',
            shouldShowCategoryIcon ? 'items-start' : 'items-center text-center',
          )}
          style={{
            // Tagged headers stack title + tag without container padding; the
            // header band's min-height alone determines the box. Untagged
            // headers use the same body padding/line-height as data rows.
            paddingTop: categoryLimitTag ? 0 : BUILDER_CELL_VERTICAL_PADDING_PT,
            paddingBottom: categoryLimitTag ? 0 : BUILDER_CELL_VERTICAL_PADDING_PT,
            lineHeight: categoryLimitTag
              ? BUILDER_TAGGED_HEADER_LINE_HEIGHT_MULTIPLIER
              : BUILDER_LINE_HEIGHT_MULTIPLIER,
          }}
        >
          <span className="inline-flex max-w-full items-center gap-[2ch]">
            {CategoryIcon && <CategoryIcon aria-hidden="true" className="h-[1em] w-[1em] shrink-0" strokeWidth={2} />}
            <span className="min-w-0 whitespace-pre-wrap">{renderedTitle}</span>
          </span>
          {categoryLimitTag && (
            <span
              data-testid="builder-section-table-category-limit"
              className={cn(
                'block font-normal italic',
                CategoryIcon && 'pl-[calc(1em+3ch)]',
              )}
              style={{
                fontSize: Math.max(7, component.fontSize - 2),
                lineHeight: BUILDER_TAGGED_HEADER_LINE_HEIGHT_MULTIPLIER,
              }}
            >
              {renderTranslatedBuilderText(
                categoryLimitTagSource ?? '',
                categoryLimitTagSource ? translations[categoryLimitTagSource] : null,
                tagMode,
              )}
            </span>
          )}
        </div>
        {component.showLimit && (
          <div
            dir="auto"
            className={cn('flex items-center justify-center border-[#b9b9b9] px-1 [unicode-bidi:plaintext]', colDivider)}
            style={{ lineHeight: BUILDER_LINE_HEIGHT_MULTIPLIER }}
        >
            {renderTranslatedBuilderText(
              component.limitHeader || 'Limit',
              language ? translations[component.limitHeader || 'Limit'] : null,
              headerMode,
            )}
          </div>
        )}
        {showWant && (
          <div
            dir="auto"
            className={cn('flex items-center justify-center border-[#b9b9b9] px-1 [unicode-bidi:plaintext]', colDivider)}
            style={{ lineHeight: BUILDER_LINE_HEIGHT_MULTIPLIER }}
          >
            {renderTranslatedBuilderText(
              component.wantHeader || 'Want',
              language ? translations[component.wantHeader || 'Want'] : null,
              headerMode,
            )}
          </div>
        )}
      </div>
      {rows.map((row, index) => {
        const tableRowHeight = computedRowHeights?.[index] ?? getTableRowHeight(row, rowHeight, {
          itemWidth,
          limitWidth,
          fontSize: component.fontSize,
          showLimit: component.showLimit,
          showStatusIcons: component.showStatusIcons === true,
          itemSegments: sectionTableRowItemSegments(row, rowMode, component.fontSize, measurement),
          useNaturalContentHeight: sectionTableRowUsesTranslatedText(row, rowMode, measurement),
        });
        return (
          <div
            key={row.id}
            className={cn(
              'grid',
              showBorders && index < rows.length - 1 && 'border-b border-[#cfcfcf]',
            )}
            style={{
              gridTemplateColumns,
              height: tableRowHeight,
              backgroundColor: component.alternateRows && index % 2 === 0 ? '#e4e4e4' : '#ffffff',
            }}
          >
            <div
              className="flex items-start gap-1 px-1"
              style={{
                paddingTop: BUILDER_CELL_VERTICAL_PADDING_PT,
                paddingBottom: BUILDER_CELL_VERTICAL_PADDING_PT,
                lineHeight: BUILDER_LINE_HEIGHT_MULTIPLIER,
              }}
            >
              {component.showStatusIcons === true && (row.isLimited || row.isClearance) && (
                <span className="flex shrink-0 items-center gap-0.5" style={{ height: `${component.fontSize}px`, lineHeight: 1 }}>
                  {row.isLimited && (
                    <AlertTriangleIcon size={component.fontSize} style={{ color: '#000000' }} />
                  )}
                  {row.isClearance && (
                    <TagIcon size={component.fontSize} style={{ color: '#000000' }} />
                  )}
                </span>
              )}
              <span dir="auto" className="min-w-0 whitespace-pre-line [unicode-bidi:plaintext]">
                {renderTranslatedBuilderText(
                  row.item,
                  // Inventory rows resolve from FoodItemTranslation; base-
                  // component rows resolve from the Generated (List) cache.
                  language
                    ? (row.foodItemId
                      ? inventoryTranslations?.foodItems[row.foodItemId]
                      : translations[row.item])
                    : null,
                  rowMode,
                )}
              </span>
            </div>
            {component.showLimit && (
              <div
                dir="auto"
                className={cn('whitespace-pre-line border-[#cfcfcf] px-1 text-center [unicode-bidi:plaintext]', colDivider)}
                style={{
                  paddingTop: BUILDER_CELL_VERTICAL_PADDING_PT,
                  paddingBottom: BUILDER_CELL_VERTICAL_PADDING_PT,
                  lineHeight: BUILDER_LINE_HEIGHT_MULTIPLIER,
                }}
              >
                {resolveRowLimitText(row.limit, component.showGlobalLimit !== false, globalLimit)}
              </div>
            )}
            {showWant && (
              <div className={cn('flex items-center justify-center border-[#cfcfcf]', colDivider)}>
                {wantCheckbox && (
                  <span
                    className="inline-block border border-[#555555]"
                    style={{ width: 9, height: 9, borderRadius: 1 }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PreviewLine({ component }: { component: LineBuilderComponent }) {
  return (
    <div
      className="bg-black"
      style={{
        width: component.direction === 'horizontal' ? component.width : component.strokeWidth,
        height: component.direction === 'horizontal' ? component.strokeWidth : component.height,
      }}
    />
  );
}

function PreviewDate({ component }: { component: DateBuilderComponent }) {
  const { language, translations } = usePreviewLanguage();
  // For 'today' the date is recomputed on every render so the canvas stays
  // current as long as the builder is open. The PDF renderer mirrors this
  // behavior using server time, so canvas + PDF stay in lock step.
  const resolved = resolveBuilderDateInstance(component.dateMode, component.customDate);
  const formatted = formatBuilderDate(resolved, component.formatId ?? DEFAULT_DATE_FORMAT_ID);
  const mode = component.translationMode ?? DEFAULT_BUILDER_TRANSLATION_MODE;
  const body = language
    ? renderTextBody(formatted, translations[formatted] ?? null, mode)
    : formatted;
  return (
    <div
      dir="auto"
      data-testid="builder-date-preview"
      className="h-full w-full whitespace-pre-line"
      style={{
        fontSize: component.fontSize,
        fontWeight: component.fontWeight === 'bold' ? 700 : 400,
        lineHeight: component.lineHeight,
        textAlign: component.align,
        unicodeBidi: 'plaintext',
      }}
    >
      {body}
    </div>
  );
}

function PreviewLanguageTag({ component }: { component: LanguageTagBuilderComponent }) {
  const { language } = usePreviewLanguage();
  const label = resolveBuilderLanguageTagText(language, component.mode ?? DEFAULT_LANGUAGE_TAG_MODE);
  return (
    <div
      dir="auto"
      data-testid="builder-language-tag-preview"
      className="h-full w-full whitespace-pre-line"
      style={{
        fontSize: component.fontSize,
        fontWeight: component.fontWeight === 'bold' ? 700 : 400,
        lineHeight: component.lineHeight,
        textAlign: component.align,
        unicodeBidi: 'plaintext',
      }}
    >
      {label}
    </div>
  );
}

function PreviewLegend({ component }: { component: LegendBuilderComponent }) {
  // A4: explains the A2 status icons. Labels translate via the same Generated
  // (List) cache as text components; icons reuse the A2 lucide icons/colors.
  const { language, translations } = usePreviewLanguage();
  const renderLabel = (label: string) =>
    renderTranslatedBuilderText(label, language ? translations[label] : null, 'translate');
  const entries: Array<{ key: string; icon: React.ReactNode; label: string }> = [];
  if (component.showLimited) {
    entries.push({ key: 'limited', icon: <AlertTriangleIcon size={component.fontSize} style={{ color: '#000000' }} />, label: component.limitedLabel });
  }
  if (component.showClearance) {
    entries.push({ key: 'clearance', icon: <TagIcon size={component.fontSize} style={{ color: '#000000' }} />, label: component.clearanceLabel });
  }
  // RTL preview language: dir="rtl" flips the legend to read right-to-left —
  // entries pack from the right edge and each entry's icon leads on the right.
  // Mirrors the backend legendComponentHtml. Must match section-table/form RTL.
  const isRtl = isRTLLanguage(language);
  return (
    <div
      dir={isRtl ? 'rtl' : undefined}
      className={cn('flex w-full', component.layout === 'vertical' ? 'flex-col gap-1' : 'flex-row flex-wrap items-center gap-x-4 gap-y-1')}
      style={{ fontSize: component.fontSize, lineHeight: BUILDER_LINE_HEIGHT_MULTIPLIER }}
    >
      {entries.map((entry) => (
        <span key={entry.key} className="flex items-center gap-1">
          <span className="flex shrink-0 items-center" style={{ height: `${component.fontSize}px`, lineHeight: 1 }}>{entry.icon}</span>
          <span dir="auto" className="[unicode-bidi:plaintext]">{renderLabel(entry.label)}</span>
        </span>
      ))}
    </div>
  );
}

function PreviewComponent({ component, includeCategoryIcons = false }: {
  component: BuilderComponent;
  includeCategoryIcons?: boolean;
}) {
  switch (component.type) {
    case 'form-field-group':
      return <PreviewFormFields component={component} />;
    case 'section-table':
      return <PreviewSectionTable component={component} includeCategoryIcons={includeCategoryIcons} />;
    case 'line':
      return <PreviewLine component={component} />;
    case 'date':
      return <PreviewDate component={component} />;
    case 'language-tag':
      return <PreviewLanguageTag component={component} />;
    case 'legend':
      return <PreviewLegend component={component} />;
    case 'text':
    default:
      return <PreviewText component={component} />;
  }
}

function PageInspector({
  layoutMode,
  bodyLayoutMode,
  gridSize,
  paperHeight,
  headerHeight,
  footerHeight,
  maxPages,
  printMode,
  includeCategoryIcons,
  onCommitHeader,
  onCommitFooter,
  onChangeBodyLayoutMode,
  gridLayout,
  gridContentMode,
  onChangeGridLayout,
  onChangeGridContentMode,
  onChangeMaxPages,
  onChangePrintMode,
  onChangeIncludeCategoryIcons,
}: {
  gridLayout: BuilderGridLayout;
  gridContentMode: BuilderGridContentMode;
  onChangeGridLayout: (value: BuilderGridLayout) => void;
  onChangeGridContentMode: (value: BuilderGridContentMode) => void;
  layoutMode: BuilderLayoutMode;
  bodyLayoutMode: BuilderBodyLayoutMode;
  gridSize: number;
  paperHeight: number;
  headerHeight: number;
  footerHeight: number;
  maxPages: number;
  printMode: BuilderPrintMode;
  includeCategoryIcons: boolean;
  onCommitHeader: (value: number) => void;
  onCommitFooter: (value: number) => void;
  onChangeBodyLayoutMode: (value: BuilderBodyLayoutMode) => void;
  onChangeMaxPages: (value: number) => void;
  onChangePrintMode: (value: BuilderPrintMode) => void;
  onChangeIncludeCategoryIcons: (value: boolean) => void;
}) {
  const [headerInput, setHeaderInput] = React.useState(String(headerHeight));
  const [footerInput, setFooterInput] = React.useState(String(footerHeight));

  React.useEffect(() => {
    setHeaderInput(String(headerHeight));
  }, [headerHeight]);

  React.useEffect(() => {
    setFooterInput(String(footerHeight));
  }, [footerHeight]);

  const commit = (raw: string, max: number, currentValue: number, onCommit: (value: number) => void) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      onCommit(currentValue);
      return;
    }
    const bounded = Math.max(0, Math.min(max, Math.round(parsed)));
    const snapped = layoutMode === 'guided' && bounded > 0 ? snapToGrid(bounded, gridSize) : bounded;
    onCommit(Math.max(0, Math.min(max, snapped)));
  };

  const headerMax = Math.max(0, paperHeight - footerHeight - HEADER_FOOTER_MIN_BODY);
  const footerMax = Math.max(0, paperHeight - headerHeight - HEADER_FOOTER_MIN_BODY);
  const blurOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  return (
    <div data-testid="builder-page-setup" className="space-y-3">
      <InspectorSection title="Body">
        <FieldRow label="Layout" controlClassName="w-[72%]">
          <Segmented
            ariaLabel="Body layout"
            testId="builder-body-layout-select"
            value={bodyLayoutMode}
            onChange={onChangeBodyLayoutMode}
            options={[
              { value: 'full', label: 'Full', ariaLabel: 'Full page', testId: 'builder-body-layout-full' },
              { value: 'split', label: 'Split', ariaLabel: 'Split page', testId: 'builder-body-layout-split' },
              { value: 'grid', label: 'Grid', ariaLabel: 'Grid page', testId: 'builder-body-layout-grid' },
            ]}
          />
        </FieldRow>
        {/*
          Grid settings stay in place and disable outside Grid, so choosing a
          layout never shifts the rows below it.
        */}
        <FieldRow label="Grid size" controlClassName="w-[72%]">
          <Segmented
            ariaLabel="Grid size"
            testId="builder-grid-layout-select"
            value={gridLayout}
            onChange={onChangeGridLayout}
            options={BUILDER_GRID_LAYOUTS.map((layout) => ({
              value: layout,
              label: layout.replace('x', ' × '),
              ariaLabel: `${layout.replace('x', ' by ')} grid, ${Number(layout[0]) * Number(layout[2])} squares`,
              disabled: bodyLayoutMode !== 'grid',
              testId: `builder-grid-layout-${layout}`,
            }))}
          />
        </FieldRow>
        <FieldRow label="Squares" controlClassName="w-[72%]">
          <Segmented
            ariaLabel="Grid square content"
            testId="builder-grid-content-mode-select"
            value={gridContentMode}
            onChange={onChangeGridContentMode}
            options={[
              {
                value: 'duplicate',
                label: 'Duplicate all',
                disabled: bodyLayoutMode !== 'grid',
                testId: 'builder-grid-content-duplicate',
              },
              {
                value: 'individual',
                label: 'Individual',
                disabled: bodyLayoutMode !== 'grid',
                testId: 'builder-grid-content-individual',
              },
            ]}
          />
        </FieldRow>
        <FieldRow label="Max pages" controlClassName="w-[72%]">
          <Segmented
            ariaLabel="Maximum pages"
            testId="builder-max-pages-select"
            value={String(maxPages)}
            onChange={(value) => onChangeMaxPages(Number(value))}
            options={[1, 2, 3, 4, 5].map((pageCount) => ({
              value: String(pageCount),
              label: String(pageCount),
              testId: `builder-max-pages-${pageCount}`,
            }))}
          />
        </FieldRow>
      </InspectorSection>
      <InspectorSection title="Header & footer">
        <FieldRow label="Header (pt)" htmlFor="page-header-height">
          <Input
            id="page-header-height"
            data-testid="builder-page-header-input"
            type="number"
            min={0}
            max={headerMax}
            className="h-8 text-xs md:text-xs"
            value={headerInput}
            onChange={(event) => setHeaderInput(event.target.value)}
            onBlur={(event) => commit(event.target.value, headerMax, headerHeight, onCommitHeader)}
            onKeyDown={blurOnEnter}
          />
        </FieldRow>
        <FieldRow label="Footer (pt)" htmlFor="page-footer-height">
          <Input
            id="page-footer-height"
            data-testid="builder-page-footer-input"
            type="number"
            min={0}
            max={footerMax}
            className="h-8 text-xs md:text-xs"
            value={footerInput}
            onChange={(event) => setFooterInput(event.target.value)}
            onBlur={(event) => commit(event.target.value, footerMax, footerHeight, onCommitFooter)}
            onKeyDown={blurOnEnter}
          />
        </FieldRow>
      </InspectorSection>
      <InspectorSection title="Print">
        <FieldRow label="Sides" controlClassName="w-[72%]">
          <Segmented
            ariaLabel="Print mode"
            testId="builder-print-mode-select"
            value={printMode}
            onChange={onChangePrintMode}
            options={[
              { value: 'single-sided', label: 'Single-sided' },
              { value: 'two-sided-duplicate', label: 'Make 2-sided' },
            ]}
          />
        </FieldRow>
        <SwitchRow
          id="builder-include-category-icons"
          label="Category icons"
          checked={includeCategoryIcons}
          onCheckedChange={onChangeIncludeCategoryIcons}
        />
      </InspectorSection>
    </div>
  );
}

const DROPDOWN_ANIMATE_RESET_MS = 800;

function useDropdownAnimateMount() {
  const [animateMount, setAnimateMount] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (isOpen) {
      setAnimateMount(true);
      timerRef.current = setTimeout(() => {
        setAnimateMount(false);
        timerRef.current = null;
      }, DROPDOWN_ANIMATE_RESET_MS);
    } else {
      setAnimateMount(false);
    }
  }, []);
  return { animateMount, handleOpenChange };
}

function SectionTableRowActionsMenu({
  row,
  clearanceLabel,
  onEdit,
  onMarkOutOfStock,
  onMarkClearance,
  onChangeCategory,
  onDelete,
}: {
  row: { id: string; item: string; foodItemId?: number };
  clearanceLabel: string;
  onEdit: () => void;
  onMarkOutOfStock: () => void;
  onMarkClearance: () => void;
  onChangeCategory: () => void;
  onDelete: () => void;
}) {
  const { animateMount, handleOpenChange } = useDropdownAnimateMount();
  return (
    <DropdownMenu modal={false} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          data-testid="builder-section-row-actions"
          aria-label={`Manage ${row.item}`}
        >
          <AnimateIcon animate={animateMount} animateOnHover animateOnTap>
            <MoreHorizontalIcon size={16} />
          </AnimateIcon>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{row.item}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <AnimateIcon asChild animate={animateMount} animateOnHover animateOnTap>
          <DropdownMenuItem data-testid="builder-row-action-edit" onSelect={onEdit}>
            <SquarePenIcon size={16} className="mr-2" />
            Edit
          </DropdownMenuItem>
        </AnimateIcon>
        <AnimateIcon asChild animate={animateMount} animateOnHover animateOnTap>
          <DropdownMenuItem data-testid="builder-row-action-out-of-stock" onSelect={onMarkOutOfStock}>
            <PackageXIcon size={16} className="mr-2" />
            Mark Out of Stock
          </DropdownMenuItem>
        </AnimateIcon>
        <AnimateIcon asChild animate={animateMount} animateOnHover animateOnTap>
          <DropdownMenuItem data-testid="builder-row-action-clearance" onSelect={onMarkClearance}>
            <TagIcon size={16} className="mr-2" />
            {clearanceLabel}
          </DropdownMenuItem>
        </AnimateIcon>
        <AnimateIcon asChild animate={animateMount} animateOnHover animateOnTap>
          <DropdownMenuItem data-testid="builder-row-action-change-category" onSelect={onChangeCategory}>
            <ArrowLeftRightIcon size={16} className="mr-2" />
            Change Category
          </DropdownMenuItem>
        </AnimateIcon>
        <DropdownMenuSeparator />
        <AnimateIcon asChild animate={animateMount} animateOnHover animateOnTap>
          <DropdownMenuItem
            data-testid="builder-row-action-delete"
            className="text-destructive focus:text-destructive"
            onSelect={onDelete}
          >
            <Trash2Icon size={16} className="mr-2" />
            Delete
          </DropdownMenuItem>
        </AnimateIcon>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SavedComponentActionsMenu({
  savedComponent,
  onRename,
  onEdit,
  onDelete,
}: {
  savedComponent: SavedBuilderComponent;
  onRename: (sc: SavedBuilderComponent) => void;
  onEdit: (sc: SavedBuilderComponent) => void;
  onDelete: (sc: SavedBuilderComponent) => void;
}) {
  const { animateMount, handleOpenChange } = useDropdownAnimateMount();
  return (
    <DropdownMenu modal={false} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid="saved-component-actions"
          className="h-8 w-8 shrink-0"
          aria-label={`Manage ${savedComponent.name}`}
        >
          <AnimateIcon animate={animateMount} animateOnHover animateOnTap>
            <MoreHorizontalIcon size={16} />
          </AnimateIcon>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Saved Component</DropdownMenuLabel>
        <AnimateIcon asChild animate={animateMount} animateOnHover animateOnTap>
          <DropdownMenuItem onSelect={() => onRename(savedComponent)}>
            <PencilIcon size={16} className="mr-2" />
            Rename
          </DropdownMenuItem>
        </AnimateIcon>
        <AnimateIcon asChild animate={animateMount} animateOnHover animateOnTap>
          <DropdownMenuItem onSelect={() => onEdit(savedComponent)}>
            <SquarePenIcon size={16} className="mr-2" />
            Edit
          </DropdownMenuItem>
        </AnimateIcon>
        <DropdownMenuSeparator />
        <AnimateIcon asChild animate={animateMount} animateOnHover animateOnTap>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => onDelete(savedComponent)}
          >
            <Trash2Icon size={16} className="mr-2" />
            Delete
          </DropdownMenuItem>
        </AnimateIcon>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// B3: shared instance for reading the org-wide Global Limit (the value shown
// in the Limit column for no-limit rows when a section table opts in).
const globalLimitService = new GlobalLimitService();

export function ShoppingListBuilder() {
  const terminology = useTerminology();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showSuccess, showWarning } = useMessage();
  const { categories, updateCategory, isSaving: isSavingCategory } = useCategoryContext();
  const {
    foodItems,
    refreshFoodItems,
    updateFoodItem,
    deleteFoodItem,
    createFoodItem,
    isSaving: isSavingFoodItem,
  } = useFoodItemContext();
  const [template, setTemplate] = useState(() => normalizeLegacyBuilderTemplateGeometry(createDefaultBuilderTemplate()));
  const [selectedId, setSelectedId] = useState<string>('');
  // Serialized template as of the last open / save / new-blank. Comparing it
  // with the live template tells the user whether there is anything to save.
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(template));
  const [templateHistory, setTemplateHistory] = useState<Array<{ template: ShoppingListBuilderTemplate; selectedId: string }>>([]);
  // One-shot mount animation flag for persistent builder chrome (top action
  // bar, canvas toolbar). Per the documented animate-prop stuck-state
  // pitfall, this flips back to false after ~1s so subsequent hovers replay
  // the animation reliably. Satisfies Rule 4 (animate interactive icons on
  // page load) without breaking hover triggers on re-interaction.
  const [animateBuilderChromeMount, setAnimateBuilderChromeMount] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setAnimateBuilderChromeMount(false), 1000);
    return () => clearTimeout(t);
  }, []);
  const [zoom, setZoom] = useState(CANVAS_DEFAULT_ZOOM);
  const [showCanvasGuides, setShowCanvasGuides] = useState(true);
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSavingComponent, setIsSavingComponent] = useState(false);
  const [editingSavedComponentSource, setEditingSavedComponentSource] = useState<EditingSavedComponentSource | null>(null);
  const [renameSavedComponent, setRenameSavedComponent] = useState<SavedBuilderComponent | null>(null);
  const [renameSavedComponentName, setRenameSavedComponentName] = useState('');
  const [componentPendingDelete, setComponentPendingDelete] = useState<SavedBuilderComponent | null>(null);
  const [isDeletingSavedComponent, setIsDeletingSavedComponent] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [activeSavedTemplateId, setActiveSavedTemplateId] = useState<number | null>(null);
  const [isLoadingSavedComponents, setIsLoadingSavedComponents] = useState(false);
  const [isLoadingSavedTemplates, setIsLoadingSavedTemplates] = useState(false);
  const [isLoadingInventorySections, setIsLoadingInventorySections] = useState(false);
  const [savedComponents, setSavedComponents] = useState<SavedBuilderComponent[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SavedBuilderTemplate[]>([]);
  const [hasLoadedSavedTemplates, setHasLoadedSavedTemplates] = useState(false);
  const [inventorySections, setInventorySections] = useState<InventorySectionComponent[]>([]);
  // B3: org-wide Global Limit value, shown in the Limit column for no-limit
  // rows when a section table has Show Global Limit enabled. Defaults to 10
  // (matching the backend) until the live value loads.
  const [globalLimit, setGlobalLimit] = useState<number>(10);
  const [editingFoodItem, setEditingFoodItem] = useState<FoodItem | null>(null);
  const [foodItemPendingDelete, setFoodItemPendingDelete] = useState<FoodItem | null>(null);
  const [isDeletingFoodItem, setIsDeletingFoodItem] = useState(false);
  const [changeCategoryItem, setChangeCategoryItem] = useState<FoodItem | null>(null);
  const [changeCategoryTargetId, setChangeCategoryTargetId] = useState<string>('');
  const [isChangingCategory, setIsChangingCategory] = useState(false);
  const [addItemContext, setAddItemContext] = useState<{ categoryId: number; categoryName: string } | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  // Canvas-wide translation preview state. `previewLanguage === ''` means
  // "no preview" -- the canvas renders the original English content. Any
  // other value triggers a one-shot preflight fetch (see effect below)
  // and provides cached translations to PreviewText via context. State is
  // NOT persisted on the template; it resets when the builder mounts.
  const [previewLanguage, setPreviewLanguage] = useState<string>('');
  const [previewTranslations, setPreviewTranslations] = useState<Record<string, string>>({});
  const [previewInventoryTranslations, setPreviewInventoryTranslations] = useState<{
    categories: Record<number, string>;
    foodItems: Record<number, string>;
  }>({ categories: {}, foodItems: {} });
  const [isFetchingPreviewTranslations, setIsFetchingPreviewTranslations] = useState(false);
  const [missingPreviewTranslations, setMissingPreviewTranslations] = useState<{
    language: string;
    missingStrings: string[];
    cached: Record<string, string>;
  } | null>(null);
  const [isUpdatingPreviewTranslations, setIsUpdatingPreviewTranslations] = useState(false);
  // Enabled-languages list for the action-bar Preview language Select.
  // Radix Select doesn't allow empty-string item values, so we use a
  // sentinel for the "English (no preview)" option and translate at the
  // change site.
  const { languages: allLanguagesForPreview, isLoading: isLoadingLanguages } = useLanguageContext();
  const enabledNonEnglishLanguages = useMemo(
    () => allLanguagesForPreview.filter((lang) => lang.isEnabled && lang.name !== 'English'),
    [allLanguagesForPreview],
  );
  const PREVIEW_LANGUAGE_NONE_SENTINEL = '__english__';
  // Translation Settings dialog open-state: we store the component id whose
  // settings are being edited rather than a boolean so the dialog re-mounts
  // (and resets its local state) when the user opens it for a different
  // text component without first closing the dialog.
  const [translationSettingsTargetId, setTranslationSettingsTargetId] = useState<string | null>(null);
  const [sectionTableTranslationSettingsTargetId, setSectionTableTranslationSettingsTargetId] = useState<string | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    originalX: number;
    originalY: number;
    hasMoved: boolean;
  } | null>(null);
  const reorderRef = useRef<{
    componentId: string;
    pointerId: number;
  } | null>(null);
  const [reorderState, setReorderState] = useState<{
    componentId: string;
    target: GuidedInsertTarget | null;
  } | null>(null);
  const loadedTemplateFromUrlRef = useRef<number | null>(null);

  const editTemplateId = useMemo(() => {
    const rawTemplateId = searchParams.get('templateId');
    if (!rawTemplateId) return null;

    const parsedTemplateId = Number(rawTemplateId);
    return Number.isInteger(parsedTemplateId) && parsedTemplateId > 0
      ? parsedTemplateId
      : null;
  }, [searchParams]);

  const selectedComponent = useMemo(
    () => template.components.find((component) => component.id === selectedId) ?? null,
    [selectedId, template.components],
  );

  const bodyLayoutMode = getTemplateBodyLayoutMode(template);
  const isGridLayout = bodyLayoutMode === 'grid';
  // A grid is always Guided: its squares are the layout.
  const layoutMode: BuilderLayoutMode = isGridLayout ? 'guided' : getTemplateLayoutMode(template);
  const gridLayout = getTemplateGridLayout(template);
  const gridContentMode = getTemplateGridContentMode(template);
  const gridCellCount = getTemplateGridCellCount(template);
  const isIndividualGrid = isGridLayout && gridContentMode === 'individual';
  // The square that click-inserts go to in an 'individual' grid. Follows the
  // selection and a click on an empty square.
  const [activeGridCellState, setActiveGridCell] = useState(0);
  const activeGridCell = Math.min(activeGridCellState, gridCellCount - 1);
  const gridSize = getTemplateGridSize(template);
  const headerHeight = getTemplateHeaderHeight(template);
  const footerHeight = getTemplateFooterHeight(template);
  const bodyColumnGap = getTemplateBodyColumnGap(template);
  const maxPages = getTemplateMaxPages(template);
  const printMode = getTemplatePrintMode(template);
  const includeCategoryIcons = getTemplateIncludeCategoryIcons(template);
  const sectionTableMeasurement = useMemo<SectionTableMeasurementOptions | undefined>(() => (
    previewLanguage
      ? {
        language: previewLanguage,
        translations: previewTranslations,
        inventoryTranslations: previewInventoryTranslations,
      }
      : undefined
  ), [previewLanguage, previewInventoryTranslations, previewTranslations]);
  const flowingTablePlan = useMemo(
    () => createFlowingTablePlan(template, sectionTableMeasurement),
    [template, sectionTableMeasurement],
  );
  // Inventory sections behave like a "move from palette to canvas" model: once
  // a section's category is referenced by any section-table component on the
  // canvas, hide it from the scroll area. Deleting the canvas component (or
  // changing its inventorySource) restores the section to the palette pool.
  const placedInventoryCategoryIds = useMemo(() => {
    const ids = new Set<number>();
    template.components.forEach((component) => {
      if (component.type !== 'section-table') return;
      const categoryId = component.inventorySource?.categoryId;
      if (typeof categoryId === 'number') ids.add(categoryId);
    });
    return ids;
  }, [template.components]);
  const availableInventorySections = useMemo(
    () => inventorySections.filter((section) => !placedInventoryCategoryIds.has(section.categoryId)),
    [inventorySections, placedInventoryCategoryIds],
  );
  const selectedComponentRegion = selectedComponent ? getComponentRegion(selectedComponent, template) : null;
  const isEditingSelectedSavedComponent = (
    editingSavedComponentSource != null
    && editingSavedComponentSource.canvasComponentId === selectedComponent?.id
  );

  const snapCoord = useCallback(
    (value: number) => (layoutMode === 'guided' ? snapToGrid(value, gridSize) : value),
    [gridSize, layoutMode],
  );

  const getClickInsertXForBodyComponent = (objectWidth: number): number => {
    if (layoutMode !== 'guided' || bodyLayoutMode === 'full') {
      return snapCoord(48);
    }

    return getCenteredXInBodyHalf(template.paper.width, objectWidth, 'left', gridSize);
  };

  const setLayoutMode = (nextMode: BuilderLayoutMode) => {
    if (nextMode === layoutMode) return;
    pushHistory();
    setTemplate((current) => {
      const nextTemplate = { ...current, layoutMode: nextMode };
      return nextMode === 'guided'
        ? clampTemplateComponentsToRegions(nextTemplate, { avoidCollisions: true })
        : nextTemplate;
    });
  };

  const setBodyLayoutMode = (nextMode: BuilderBodyLayoutMode) => {
    if (nextMode === bodyLayoutMode) return;
    pushHistory();
    setTemplate((current) => clampTemplateComponentsToRegions(
      nextMode === 'grid'
        ? {
          ...current,
          bodyLayoutMode: nextMode,
          // Stored explicitly so the saved template says what it is rather
          // than relying on defaults that could change.
          layoutMode: 'guided',
          gridLayout: getTemplateGridLayout(current),
          gridContentMode: getTemplateGridContentMode(current),
        }
        : { ...current, bodyLayoutMode: nextMode },
      { avoidCollisions: true },
    ));
  };

  const setGridLayout = (nextLayout: BuilderGridLayout) => {
    if (nextLayout === gridLayout) return;
    pushHistory();
    setTemplate((current) => ({ ...current, gridLayout: nextLayout }));
  };

  // Switching to Duplicate All keeps each component's stored square, so
  // switching back to Individual restores the arrangement.
  const setGridContentMode = (nextMode: BuilderGridContentMode) => {
    if (nextMode === gridContentMode) return;
    pushHistory();
    setTemplate((current) => ({ ...current, gridContentMode: nextMode }));
  };

  const gridCellAtPoint = (x: number, y: number): number => {
    const column = x >= template.paper.width / 2 ? 1 : 0;
    const rowCount = getTemplateGridRowCount(template);
    let row = rowCount - 1;
    for (let index = 0; index < rowCount; index += 1) {
      if (y < getTemplateGridRowBounds(template, index).bottom) {
        row = index;
        break;
      }
    }
    return row * BUILDER_GRID_COLUMNS + column;
  };

  // Square a newly inserted body component joins: the one under the drop
  // point, or the active square for a click-insert. Undefined outside an
  // 'individual' grid, where squares are not chosen per component.
  const insertGridCellFor = (point?: { x: number; y: number }): number | undefined => {
    if (!isIndividualGrid) return undefined;
    return point ? gridCellAtPoint(point.x, point.y) : activeGridCell;
  };

  const setSelectedComponentGridCell = (cellIndex: number) => {
    if (!selectedComponent) return;
    setActiveGridCell(cellIndex);
    updateSelectedComponent({ gridCell: cellIndex });
    revealSelection();
  };

  const setMaxPages = (value: number) => {
    const nextMaxPages = clamp(Math.round(value), 1, 5);
    if (nextMaxPages === maxPages) return;
    pushHistory();
    setTemplate((current) => ({ ...current, maxPages: nextMaxPages }));
  };

  const setPrintMode = (nextMode: BuilderPrintMode) => {
    if (nextMode === printMode) return;
    pushHistory();
    setTemplate((current) => ({ ...current, printMode: nextMode }));
  };

  const setIncludeCategoryIcons = (value: boolean) => {
    if (value === includeCategoryIcons) return;
    pushHistory();
    setTemplate((current) => ({ ...current, includeCategoryIcons: value }));
  };

  const setHeaderHeight = (value: number) => {
    if (value === headerHeight) return;
    pushHistory();
    setTemplate((current) => clampTemplateComponentsToRegions(
      { ...current, headerHeight: value },
      { avoidCollisions: true },
    ));
  };

  const setFooterHeight = (value: number) => {
    if (value === footerHeight) return;
    pushHistory();
    setTemplate((current) => clampTemplateComponentsToRegions(
      { ...current, footerHeight: value },
      { avoidCollisions: true },
    ));
  };

  const loadSavedComponents = useCallback(async () => {
    try {
      setIsLoadingSavedComponents(true);
      const components = await shoppingListBuilderService.getSavedComponents();
      setSavedComponents(components);
    } catch (error) {
      ErrorHandlerService.handleError(error, 'shoppingListBuilderLoadSavedComponents');
    } finally {
      setIsLoadingSavedComponents(false);
    }
  }, []);

  const loadSavedTemplates = useCallback(async () => {
    try {
      setIsLoadingSavedTemplates(true);
      const templates = await shoppingListBuilderService.getSavedTemplates();
      setSavedTemplates(templates);
    } catch (error) {
      ErrorHandlerService.handleError(error, 'shoppingListBuilderLoadSavedTemplates');
    } finally {
      setHasLoadedSavedTemplates(true);
      setIsLoadingSavedTemplates(false);
    }
  }, []);

  const loadInventorySections = useCallback(async () => {
    try {
      setIsLoadingInventorySections(true);
      const sections = await shoppingListBuilderService.getInventorySections();
      setInventorySections(sections);
    } catch (error) {
      ErrorHandlerService.handleError(error, 'shoppingListBuilderLoadInventorySections');
    } finally {
      setIsLoadingInventorySections(false);
    }
  }, []);

  const loadGlobalLimit = useCallback(async () => {
    try {
      const limit = await globalLimitService.getGlobalLimit();
      setGlobalLimit(limit);
    } catch (error) {
      // Non-fatal: the canvas falls back to the default until this succeeds.
      ErrorHandlerService.handleError(error, 'shoppingListBuilderLoadGlobalLimit');
    }
  }, []);

  useEffect(() => {
    void loadSavedComponents();
    void loadSavedTemplates();
    void loadInventorySections();
    void refreshFoodItems();
    void loadGlobalLimit();
  }, [loadInventorySections, loadSavedComponents, loadSavedTemplates, refreshFoodItems, loadGlobalLimit]);

  // Build a stable, sorted signature of every translation-eligible string
  // in the current template. The fetch effect below depends on this
  // signature rather than the full `template` object so it only fires
  // when the strings themselves change -- not on every drag, resize, or
  // unrelated edit.
  const translatableStringsSignature = React.useMemo(() => {
    const strings: string[] = [];
    for (const component of template.components) {
      if (component.type !== 'text') continue;
      const mode = component.translationMode ?? DEFAULT_BUILDER_TRANSLATION_MODE;
      if (mode === 'skip') continue;
      const content = (component.content ?? '').trim();
      if (!content) continue;
      strings.push(component.content);
    }
    return Array.from(new Set(strings)).sort().join('');
  }, [template.components]);

  // Fetch cached translations when the user picks a preview language (or
  // when the template's translatable strings change while a preview is
  // already active). A preview language is only applied silently when every
  // eligible string has a cached translation. If any are missing, the user
  // chooses whether to fill the cache now or return to English.
  useEffect(() => {
    if (!previewLanguage) {
      // Clear stale translations when the user reverts to English so the
      // canvas snaps back immediately without a flash of stale content.
      setPreviewTranslations({});
      setPreviewInventoryTranslations({ categories: {}, foodItems: {} });
      setIsFetchingPreviewTranslations(false);
      setMissingPreviewTranslations(null);
      return;
    }
    let cancelled = false;
    setIsFetchingPreviewTranslations(true);
    (async () => {
      try {
        const result = await shoppingListBuilderService.translationPreflight(template, previewLanguage);
        if (cancelled) return;
        const decision = resolvePreviewTranslationPreflight(result);
        if (decision.status === 'missing') {
          setPreviewTranslations({});
          setPreviewInventoryTranslations(result.inventory ?? { categories: {}, foodItems: {} });
          setMissingPreviewTranslations({
            language: previewLanguage,
            missingStrings: decision.missingStrings,
            cached: decision.cached,
          });
          return;
        }
        setPreviewTranslations(decision.translations);
        setPreviewInventoryTranslations(result.inventory ?? { categories: {}, foodItems: {} });
        setMissingPreviewTranslations(null);
      } catch (error) {
        if (cancelled) return;
        ErrorHandlerService.handleError(error, 'shoppingListBuilderPreviewLanguageFetch');
        setPreviewTranslations({});
        setPreviewInventoryTranslations({ categories: {}, foodItems: {} });
        setMissingPreviewTranslations(null);
      } finally {
        if (!cancelled) setIsFetchingPreviewTranslations(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // template intentionally pulled by reference -- the actual dep is
    // translatableStringsSignature which captures the strings that
    // matter; we read `template` inside the effect for the API payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewLanguage, translatableStringsSignature]);

  const cancelPreviewTranslationUpdate = () => {
    setMissingPreviewTranslations(null);
    setPreviewTranslations({});
    setPreviewInventoryTranslations({ categories: {}, foodItems: {} });
    setPreviewLanguage('');
  };

  const updatePreviewTranslations = async () => {
    if (!missingPreviewTranslations || missingPreviewTranslations.missingStrings.length === 0) return;
    try {
      setIsUpdatingPreviewTranslations(true);
      const result = await shoppingListBuilderService.translateMissingStrings(
        missingPreviewTranslations.missingStrings,
        missingPreviewTranslations.language,
      );
      setPreviewTranslations(mergePreviewTranslations(
        missingPreviewTranslations.cached,
        result.translations,
      ));
      showSuccess(`Preview translations updated for ${missingPreviewTranslations.language}.`);
      setMissingPreviewTranslations(null);
    } catch (error) {
      ErrorHandlerService.handleError(error, 'shoppingListBuilderPreviewLanguageTranslateMissing');
    } finally {
      setIsUpdatingPreviewTranslations(false);
    }
  };

  useEffect(() => {
    if (editTemplateId == null) {
      loadedTemplateFromUrlRef.current = null;
      return;
    }

    if (!hasLoadedSavedTemplates || loadedTemplateFromUrlRef.current === editTemplateId) {
      return;
    }

    const savedTemplate = savedTemplates.find((current) => current.id === editTemplateId);
    if (!savedTemplate) {
      loadedTemplateFromUrlRef.current = editTemplateId;
      showWarning('Unable to open that saved template. It may have been deleted or belongs to another user.');
      return;
    }

    loadedTemplateFromUrlRef.current = editTemplateId;

    const loadTemplateForEditing = async () => {
      try {
        const refreshedTemplate = await shoppingListBuilderService.refreshTemplateInventory(savedTemplate.templateData);
        const templateToApply = normalizeLegacyBuilderTemplateGeometry(annotateTemplateComponentRegions({
          ...refreshedTemplate,
          name: limitTemplateName(refreshedTemplate.name),
        }));

        setTemplate(templateToApply);
        setSavedSnapshot(JSON.stringify(templateToApply));
        setSelectedId('');
        setActiveSavedTemplateId(savedTemplate.id);
        setEditingSavedComponentSource(null);
        setTemplateHistory([]);
      } catch (error) {
        loadedTemplateFromUrlRef.current = null;
        ErrorHandlerService.handleError(error, 'shoppingListBuilderApplyTemplate');
      }
    };

    void loadTemplateForEditing();
  }, [editTemplateId, hasLoadedSavedTemplates, savedTemplates, showWarning]);

  const pushHistory = useCallback(() => {
    setTemplateHistory((current) => [
      { template: cloneTemplate(template), selectedId },
      ...current,
    ].slice(0, 50));
  }, [selectedId, template]);

  const undoLastChange = () => {
    const previous = templateHistory[0];
    if (!previous) {
      showWarning('There is nothing to undo.');
      return;
    }

    setTemplate(normalizeLegacyBuilderTemplateGeometry(previous.template));
    setSelectedId(previous.selectedId);
    setEditingSavedComponentSource(null);
    setTemplateHistory((current) => current.slice(1));
  };

  const updateComponent = (
    id: string,
    updater: (component: BuilderComponent) => BuilderComponent,
    options: { recordHistory?: boolean } = {},
  ) => {
    if (options.recordHistory !== false) {
      pushHistory();
    }

    setTemplate((current) => ({
      ...current,
      components: current.components.map((component) => (
        component.id === id
          ? clampComponentToTemplateRegion(updater(component), current, undefined, {
            avoidCollisions: true,
            excludeComponentId: id,
          })
          : component
      )),
    }));
  };

  const updateSelectedComponent = (
    updates: Partial<BuilderComponent>,
    options: { recordHistory?: boolean } = {},
  ) => {
    if (!selectedComponent) return;
    updateComponent(
      selectedComponent.id,
      (component) => ({ ...component, ...updates }) as BuilderComponent,
      options,
    );
  };

  const updateSelectedSectionTableTranslationHeightAdjustment = (nextValue: number) => {
    if (!selectedComponent || selectedComponent.type !== 'section-table' || !previewLanguage) return;
    const normalized = normalizeSectionTableTranslationHeightAdjustment(nextValue);
    const nextAdjustments = { ...(selectedComponent.translationHeightAdjustments ?? {}) };
    if (normalized === 0) {
      delete nextAdjustments[previewLanguage];
    } else {
      nextAdjustments[previewLanguage] = normalized;
    }
    updateSelectedComponent({
      translationHeightAdjustments: Object.keys(nextAdjustments).length > 0 ? nextAdjustments : undefined,
    } as Partial<SectionTableBuilderComponent>);
  };

  const changeComponentRegion = (componentId: string, region: BuilderComponentRegion) => {
    const component = template.components.find((current) => current.id === componentId);
    if (!component) return;

    if (isInventorySectionTable(component) && region !== 'body') {
      showWarning('Inventory section tables must stay in the Body region.');
      return;
    }

    if (!canPlaceComponentInRegion(component, template, region)) {
      showWarning(
        `${component.name} cannot fit in the ${componentRegionLabel(region).toLowerCase()} region. Increase that region or choose Body.`,
      );
      return;
    }

    pushHistory();
    setTemplate((current) => ({
      ...current,
      components: current.components.map((currentComponent) => (
        currentComponent.id === componentId
          ? clampComponentToTemplateRegion(
            {
              ...currentComponent,
              region,
            } as BuilderComponent,
            current,
            region,
            { avoidCollisions: true, excludeComponentId: componentId },
          )
          : currentComponent
      )),
    }));
    setSelectedId(componentId);
    // The component may have jumped to the other end of the page.
    revealSelection();
  };

  const changeComponentRepeatMode = (componentId: string, mode: BuilderHeaderFooterRepeatMode) => {
    const component = template.components.find((current) => current.id === componentId);
    if (!component) return;
    if ((component.repeatMode ?? 'every') === mode) return;
    pushHistory();
    setTemplate((current) => ({
      ...current,
      components: current.components.map((currentComponent) => (
        currentComponent.id === componentId
          ? ({ ...currentComponent, repeatMode: mode } as BuilderComponent)
          : currentComponent
      )),
    }));
    setSelectedId(componentId);
  };

  const addComponent = (type: BuilderComponentType, x = 48, y?: number) => {
    pushHistory();
    const defaultBodyY = getTemplateRegionBounds(template, 'body').top + gridSize;
    const requestedY = y ?? defaultBodyY;
    const requestedX = y == null
      ? getClickInsertXForBodyComponent(DEFAULT_BUILDER_COMPONENT_WIDTH)
      : x;
    const snappedX = snapCoord(requestedX);
    const snappedY = snapCoord(requestedY);
    const createdComponent = createBuilderComponent(type, snappedX, snappedY);
    const region = y == null ? 'body' : getRegionForPoint(snappedY, template);
    const component = clampComponentToTemplateRegion(
      {
        ...createdComponent,
        x: snappedX,
        y: snappedY,
        region,
      } as BuilderComponent,
      template,
      region,
      { avoidCollisions: true, excludeComponentId: createdComponent.id },
    );
    const insertCell = region === 'body'
      ? insertGridCellFor(y == null ? undefined : { x: snappedX, y: snappedY })
      : undefined;
    setTemplate((current) => ({
      ...current,
      components: [...current.components, insertCell == null ? component : { ...component, gridCell: insertCell }],
    }));
    setSelectedId(component.id);
    setEditingSavedComponentSource(null);
    // Add, then type: focus lands in the new component's main field.
    requestPrimaryFieldFocus();
    revealSelection();
  };

  const deleteSelectedComponent = () => {
    if (!selectedComponent) {
      showWarning('Select a component before deleting it.');
      return;
    }

    const deletedId = selectedComponent.id;
    pushHistory();
    // Clear the selection rather than jumping to another component: a second
    // Delete press must never remove something the user did not pick.
    setSelectedId('');
    setTemplate((current) => ({
      ...current,
      components: current.components.filter((component) => component.id !== deletedId),
    }));
    if (editingSavedComponentSource?.canvasComponentId === deletedId) {
      setEditingSavedComponentSource(null);
    }
  };

  const duplicateSelectedComponent = () => {
    if (!selectedComponent) {
      showWarning('Select a component before duplicating it.');
      return;
    }

    const copyId = `${selectedComponent.id}-copy-${Date.now()}`;
    const copy = clampComponentToTemplateRegion({
      ...selectedComponent,
      id: copyId,
      name: `${selectedComponent.name} copy`,
      region: selectedComponentRegion ?? getComponentRegion(selectedComponent, template),
      x: snapCoord(selectedComponent.x + 16),
      y: snapCoord(selectedComponent.y + 16),
    } as BuilderComponent, template, undefined, {
      avoidCollisions: true,
      excludeComponentId: copyId,
    });

    pushHistory();
    setTemplate((current) => ({ ...current, components: [...current.components, copy] }));
    setSelectedId(copy.id);
    setEditingSavedComponentSource(null);
    revealSelection();
  };

  const saveSelectedComponent = async () => {
    if (!selectedComponent) {
      showWarning('Select a component before saving it.');
      return;
    }

    try {
      setIsSavingComponent(true);
      const componentToSave = {
        ...selectedComponent,
        region: getComponentRegion(selectedComponent, template),
      } as BuilderComponent;
      const existingByName = savedComponents.find((component) => (
        normalizeSavedEntityName(component.name) === normalizeSavedEntityName(selectedComponent.name)
      ));
      const updateTargetId = isEditingSelectedSavedComponent && editingSavedComponentSource != null
        ? editingSavedComponentSource.savedComponentId
        : existingByName?.id;
      const savedComponent = updateTargetId == null
        ? await shoppingListBuilderService.createSavedComponent(selectedComponent.name, componentToSave)
        : await shoppingListBuilderService.updateSavedComponent(
          updateTargetId,
          selectedComponent.name,
          componentToSave,
        );
      setSavedComponents((current) => [
        savedComponent,
        ...current.filter((component) => component.id !== savedComponent.id),
      ]);
      setEditingSavedComponentSource({
        savedComponentId: savedComponent.id,
        canvasComponentId: selectedComponent.id,
      });
      showSuccess(
        updateTargetId == null
          ? 'Component saved. It is available in Saved Components.'
          : 'Saved component updated. Future inserts will use the new version.',
      );
    } catch (error) {
      ErrorHandlerService.handleError(error, 'shoppingListBuilderSaveComponent');
    } finally {
      setIsSavingComponent(false);
    }
  };

  const saveCurrentTemplate = async () => {
    try {
      setIsSavingTemplate(true);
      const refreshedTemplate = await shoppingListBuilderService.refreshTemplateInventory(template);
      const savedTemplateName = limitTemplateName(refreshedTemplate.name.trim());
      const templateToSave = annotateTemplateComponentRegions({
        ...refreshedTemplate,
        name: savedTemplateName,
      });
      const existingByName = savedTemplates.find((currentTemplate) => (
        normalizeSavedEntityName(currentTemplate.name) === normalizeSavedEntityName(savedTemplateName)
      ));
      const updateTargetId = activeSavedTemplateId ?? existingByName?.id;
      const savedTemplate = updateTargetId == null
        ? await shoppingListBuilderService.createSavedTemplate(savedTemplateName, templateToSave)
        : await shoppingListBuilderService.updateSavedTemplate(updateTargetId, savedTemplateName, templateToSave);
      const normalizedSavedTemplate = normalizeLegacyBuilderTemplateGeometry(templateToSave);
      setTemplate(normalizedSavedTemplate);
      setSavedSnapshot(JSON.stringify(normalizedSavedTemplate));
      setActiveSavedTemplateId(savedTemplate.id);
      setSavedTemplates((current) => [
        savedTemplate,
        ...current.filter((currentTemplate) => currentTemplate.id !== savedTemplate.id),
      ]);
      showSuccess(
        updateTargetId == null
          ? 'Page template saved. It is available in Saved Templates.'
          : 'Page template updated. Saved Templates now use this version.',
      );
    } catch (error) {
      ErrorHandlerService.handleError(error, 'shoppingListBuilderSaveTemplate');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const applySavedTemplate = async (savedTemplate: SavedBuilderTemplate) => {
    try {
      const refreshedTemplate = await shoppingListBuilderService.refreshTemplateInventory(savedTemplate.templateData);
      const templateToApply = normalizeLegacyBuilderTemplateGeometry(annotateTemplateComponentRegions({
        ...refreshedTemplate,
        name: limitTemplateName(refreshedTemplate.name),
      }));
      pushHistory();
      setTemplate(templateToApply);
      setSavedSnapshot(JSON.stringify(templateToApply));
      // Open on the Page inspector: nothing is selected until the user picks.
      setSelectedId('');
      setActiveSavedTemplateId(savedTemplate.id);
      setEditingSavedComponentSource(null);
      showSuccess(`${savedTemplate.name} applied to the canvas with current inventory.`);
    } catch (error) {
      ErrorHandlerService.handleError(error, 'shoppingListBuilderApplyTemplate');
    }
  };

  const insertSavedComponent = (
    savedComponent: SavedBuilderComponent,
    x?: number,
    y?: number,
    options: { editSource?: boolean } = {},
  ) => {
    const placementRegion = x != null && y != null
      ? getRegionForPoint(snapCoord(y), template)
      : getComponentRegion(savedComponent.componentData, template);
    const shouldCenterClickInsertedBodyComponent = (
      x == null
      && y == null
      && placementRegion === 'body'
    );
    const placementX = shouldCenterClickInsertedBodyComponent
      ? getClickInsertXForBodyComponent(savedComponent.componentData.width)
      : x ?? 48;
    const component = clampComponentToTemplateRegion(cloneComponentForCanvas(
      {
        ...savedComponent.componentData,
        x: snapCoord(placementX),
        y: snapCoord(y ?? getTemplateRegionBounds(template, placementRegion).top + gridSize),
        region: placementRegion,
      },
      template.paper.width,
      template.paper.height,
    ), template, placementRegion, {
      avoidCollisions: true,
      excludeComponentId: savedComponent.componentData.id,
    });

    const insertCell = placementRegion === 'body'
      ? insertGridCellFor(x != null && y != null ? { x, y } : undefined)
      : undefined;
    pushHistory();
    setTemplate((current) => ({
      ...current,
      components: [...current.components, insertCell == null ? component : { ...component, gridCell: insertCell }],
    }));
    setSelectedId(component.id);
    setEditingSavedComponentSource(options.editSource
      ? { savedComponentId: savedComponent.id, canvasComponentId: component.id }
      : null);
    revealSelection();
    if (options.editSource) {
      showSuccess(`${savedComponent.name} added for editing. Save it when your changes are ready.`);
    }
  };

  const buildInventorySectionComponent = (
    inventorySection: InventorySectionComponent,
    targetTemplate: ShoppingListBuilderTemplate,
    x?: number,
    y?: number,
  ): BuilderComponent => {
    const placementRegion: BuilderComponentRegion = 'body';
    // In Guided mode the planner ignores component.x/y for flowing tables and
    // derives positions from the user's add sequence (template.components order).
    // The placeholder Y here is just so the component has valid initial state if
    // it's later flipped to Freeform; the planner overwrites it on every render.
    // In Freeform mode, fall back to a cascading offset so manually-placed
    // tables stagger rather than stacking on top of each other.
    const isGuided = getTemplateLayoutMode(targetTemplate) === 'guided';
    const bodyTop = getTemplateRegionBounds(targetTemplate, 'body').top;
    const placementY = y ?? (isGuided
      ? bodyTop
      : Math.max(48 + (targetTemplate.components.length % 6) * 24, bodyTop));
    const insertCell = insertGridCellFor(x != null && y != null ? { x, y } : undefined);
    return clampComponentToTemplateRegion(cloneComponentForCanvas(
      {
        ...inventorySection.component,
        ...(insertCell == null ? {} : { gridCell: insertCell }),
        x: snapCoord(x ?? 48),
        y: snapCoord(placementY),
        region: placementRegion,
        flowMode: 'flowing',
        repeatHeaderRows: true,
        keepHeaderWithFirstRow: true,
        keepRowsTogether: true,
      },
      targetTemplate.paper.width,
      targetTemplate.paper.height,
    ), targetTemplate, placementRegion, {
      avoidCollisions: !isGuided,
      excludeComponentId: inventorySection.component.id,
    });
  };

  // Adding one component is its own feedback: it appears selected on the
  // page. No toast, so a run of inserts does not stack messages over the
  // header. Bulk and "for editing" inserts still confirm in words.
  const insertInventorySection = (inventorySection: InventorySectionComponent, x?: number, y?: number) => {
    const component = buildInventorySectionComponent(inventorySection, template, x, y);
    pushHistory();
    setTemplate((current) => ({
      ...current,
      components: [...current.components, component],
    }));
    setSelectedId(component.id);
    setEditingSavedComponentSource(null);
    revealSelection();
  };

  const resetTemplate = () => {
    const nextTemplate = normalizeLegacyBuilderTemplateGeometry(createDefaultBuilderTemplate());
    pushHistory();
    setTemplate(nextTemplate);
    setSavedSnapshot(JSON.stringify(nextTemplate));
    setSelectedId('');
    setActiveSavedTemplateId(null);
    setEditingSavedComponentSource(null);
  };

  const openRenameSavedComponent = (savedComponent: SavedBuilderComponent) => {
    window.setTimeout(() => {
      setRenameSavedComponent(savedComponent);
      setRenameSavedComponentName(savedComponent.name);
    }, DROPDOWN_TO_DIALOG_OPEN_DELAY_MS);
  };

  const openDeleteSavedComponent = (savedComponent: SavedBuilderComponent) => {
    window.setTimeout(() => {
      setComponentPendingDelete(savedComponent);
    }, DROPDOWN_TO_DIALOG_OPEN_DELAY_MS);
  };

  const confirmRenameSavedComponent = async () => {
    if (!renameSavedComponent) return;

    try {
      const updated = await shoppingListBuilderService.updateSavedComponent(
        renameSavedComponent.id,
        renameSavedComponentName,
        renameSavedComponent.componentData,
      );
      setSavedComponents((current) => current.map((component) => (
        component.id === updated.id ? updated : component
      )));
      setRenameSavedComponent(null);
      setRenameSavedComponentName('');
      showSuccess('Saved component renamed.');
    } catch (error) {
      ErrorHandlerService.handleError(error, 'shoppingListBuilderRenameComponent');
    }
  };

  const confirmDeleteSavedComponent = async () => {
    const savedComponent = componentPendingDelete;
    if (!savedComponent) return;

    try {
      setIsDeletingSavedComponent(true);
      await shoppingListBuilderService.deleteSavedComponent(savedComponent.id);
      setSavedComponents((current) => current.filter((component) => component.id !== savedComponent.id));
      if (editingSavedComponentSource?.savedComponentId === savedComponent.id) {
        setEditingSavedComponentSource(null);
      }
      setComponentPendingDelete(null);
      showSuccess('Saved component deleted.');
    } catch (error) {
      ErrorHandlerService.handleError(error, 'shoppingListBuilderDeleteComponent');
    } finally {
      setIsDeletingSavedComponent(false);
    }
  };

  const editSavedComponent = (savedComponent: SavedBuilderComponent) => {
    if (
      getComponentRegion(savedComponent.componentData, template) === 'body'
    ) {
      insertSavedComponent(savedComponent, undefined, undefined, { editSource: true });
      return;
    }

    insertSavedComponent(savedComponent, 48, 48, { editSource: true });
  };

  const updateInventoryRowLimit = async (row: SectionTableRow, nextLimit: string) => {
    if (!selectedComponent || selectedComponent.type !== 'section-table' || !row.foodItemId) {
      return;
    }

    try {
      const response = await shoppingListBuilderService.updateInventoryItemLimit(
        row.foodItemId,
        nextLimit.trim() === '' ? null : nextLimit.trim(),
      );
      updateComponent(
        selectedComponent.id,
        (component) => {
          if (component.type !== 'section-table') {
            return component;
          }

          return {
            ...component,
            rows: component.rows.map((currentRow) => (
              currentRow.id === row.id
                ? {
                  ...currentRow,
                  limit: response.foodItem.effectiveLimit,
                  limitSource: response.foodItem.limitSource,
                }
                : currentRow
            )),
          };
        },
        { recordHistory: false },
      );
      await loadInventorySections();
      showSuccess('Inventory limit updated. Templates will use the current item limit.');
    } catch (error) {
      ErrorHandlerService.handleError(error, 'shoppingListBuilderUpdateInventoryLimit');
    }
  };

  const refreshTemplateInventoryFromServer = useCallback(async () => {
    try {
      const refreshed = await shoppingListBuilderService.refreshTemplateInventory(template);
      setTemplate(normalizeLegacyBuilderTemplateGeometry(annotateTemplateComponentRegions(refreshed)));
    } catch (error) {
      ErrorHandlerService.handleError(error, 'shoppingListBuilderRefreshInventory');
    }
  }, [template]);

  const removeInventoryRowFromTemplate = useCallback((foodItemId: number) => {
    setTemplate((current) => ({
      ...current,
      components: current.components.map((component) => {
        if (component.type !== 'section-table' || !component.inventorySource) return component;
        return {
          ...component,
          rows: component.rows.filter((row) => row.foodItemId !== foodItemId),
        };
      }),
    }));
  }, []);

  const findFoodItemForRow = useCallback((row: SectionTableRow): FoodItem | null => {
    if (!row.foodItemId) return null;
    return foodItems.find((item) => item.id === row.foodItemId) ?? null;
  }, [foodItems]);

  const handleEditInventoryRow = (row: SectionTableRow) => {
    const item = findFoodItemForRow(row);
    if (!item) {
      showWarning('Food item details are still loading. Try again in a moment.');
      void refreshFoodItems();
      return;
    }
    // Defer the dialog open so the dropdown menu's auto-close completes first.
    // Without this, both menu and dialog hold their focus traps simultaneously
    // and the body stays in `pointer-events: none` after either closes.
    window.setTimeout(() => setEditingFoodItem(item), DROPDOWN_TO_DIALOG_OPEN_DELAY_MS);
  };

  const updateFoodItemStatus = async (
    item: FoodItem,
    nextFlags: StatusFlags,
    successMessage: string,
    supplyUpdate?: FoodItemSupply,
  ) => {
    try {
      await updateFoodItem({
        id: item.id,
        name: item.name,
        limit: item.limit,
        limitType: item.limitType,
        categoryId: item.categoryId,
        statusFlags: nextFlags,
        dietaryFlags: item.dietaryFlags,
        supplyUpdate,
      });
      if (!nextFlags.isInStock) {
        removeInventoryRowFromTemplate(item.id);
      }
      await Promise.all([refreshFoodItems(), loadInventorySections(), refreshTemplateInventoryFromServer()]);
      showSuccess(successMessage);
    } catch (error) {
      ErrorHandlerService.handleError(error, 'shoppingListBuilderUpdateInventoryStatus');
    }
  };

  const handleMarkOutOfStock = (row: SectionTableRow) => {
    const item = findFoodItemForRow(row);
    if (!item) {
      showWarning('Food item details are still loading. Try again in a moment.');
      void refreshFoodItems();
      return;
    }
    void updateFoodItemStatus(
      item,
      { isInStock: false, isLimited: false, isClearance: false },
      `${item.name} marked out of stock.`,
    );
  };

  const handleMarkClearance = (row: SectionTableRow) => {
    const item = findFoodItemForRow(row);
    if (!item) {
      showWarning('Food item details are still loading. Try again in a moment.');
      void refreshFoodItems();
      return;
    }
    void updateFoodItemStatus(
      item,
      { ...item.statusFlags, isClearance: !item.statusFlags.isClearance },
      item.statusFlags.isClearance
        ? `${item.name} cleared from clearance.`
        : `${item.name} marked clearance.`,
    );
  };

  const handleOpenChangeCategory = (row: SectionTableRow) => {
    const item = findFoodItemForRow(row);
    if (!item) {
      showWarning('Food item details are still loading. Try again in a moment.');
      void refreshFoodItems();
      return;
    }
    window.setTimeout(() => {
      setChangeCategoryItem(item);
      setChangeCategoryTargetId(String(item.categoryId));
    }, DROPDOWN_TO_DIALOG_OPEN_DELAY_MS);
  };

  const confirmChangeCategory = async () => {
    if (!changeCategoryItem) return;
    const targetId = Number(changeCategoryTargetId);
    if (!Number.isInteger(targetId) || targetId === changeCategoryItem.categoryId) {
      setChangeCategoryItem(null);
      return;
    }

    try {
      setIsChangingCategory(true);
      await updateFoodItem({
        id: changeCategoryItem.id,
        name: changeCategoryItem.name,
        limit: changeCategoryItem.limit,
        limitType: changeCategoryItem.limitType,
        categoryId: targetId,
        statusFlags: changeCategoryItem.statusFlags,
        dietaryFlags: changeCategoryItem.dietaryFlags,
      });
      removeInventoryRowFromTemplate(changeCategoryItem.id);
      await Promise.all([refreshFoodItems(), loadInventorySections(), refreshTemplateInventoryFromServer()]);
      showSuccess(`${changeCategoryItem.name} moved to a new category.`);
      setChangeCategoryItem(null);
    } catch (error) {
      ErrorHandlerService.handleError(error, 'shoppingListBuilderChangeCategory');
    } finally {
      setIsChangingCategory(false);
    }
  };

  const handleOpenDeleteFoodItem = (row: SectionTableRow) => {
    const item = findFoodItemForRow(row);
    if (!item) {
      showWarning('Food item details are still loading. Try again in a moment.');
      void refreshFoodItems();
      return;
    }
    window.setTimeout(() => setFoodItemPendingDelete(item), DROPDOWN_TO_DIALOG_OPEN_DELAY_MS);
  };

  const confirmDeleteFoodItem = async () => {
    if (!foodItemPendingDelete) return;
    const target = foodItemPendingDelete;
    try {
      setIsDeletingFoodItem(true);
      await deleteFoodItem(target.id);
      removeInventoryRowFromTemplate(target.id);
      await Promise.all([refreshFoodItems(), loadInventorySections(), refreshTemplateInventoryFromServer()]);
      showSuccess(`${target.name} deleted from inventory.`);
      setFoodItemPendingDelete(null);
    } catch (error) {
      ErrorHandlerService.handleError(error, 'shoppingListBuilderDeleteFoodItem');
    } finally {
      setIsDeletingFoodItem(false);
    }
  };

  const handleSaveEditedFoodItem = async (
    update: Partial<FoodItem> & { keepTranslations?: boolean },
  ) => {
    if (!editingFoodItem) return;
    try {
      await updateFoodItem({
        id: editingFoodItem.id,
        name: update.name ?? editingFoodItem.name,
        limit: update.limit ?? editingFoodItem.limit,
        limitType: update.limitType ?? editingFoodItem.limitType,
        categoryId: update.categoryId ?? editingFoodItem.categoryId,
        statusFlags: update.statusFlags ?? editingFoodItem.statusFlags,
        dietaryFlags: update.dietaryFlags ?? editingFoodItem.dietaryFlags,
        supplyUpdate: update.supply,
        keepTranslations: update.keepTranslations,
      });
      await Promise.all([refreshFoodItems(), loadInventorySections(), refreshTemplateInventoryFromServer()]);
      setEditingFoodItem(null);
      showSuccess('Food item updated.');
    } catch (error) {
      ErrorHandlerService.handleError(error, 'shoppingListBuilderEditFoodItem');
    }
  };

  const handleCreateFoodItem = async (data: {
    name: string;
    limit: number;
    limitType: 'person' | 'household';
    categoryId: number;
    statusFlags: StatusFlags;
    dietaryFlags: DietaryFlags;
    supply: FoodItemSupply;
  }) => {
    try {
      await createFoodItem({ ...data, supplyUpdate: data.supply });
      await Promise.all([refreshFoodItems(), loadInventorySections(), refreshTemplateInventoryFromServer()]);
      showSuccess(`${data.name} added to inventory.`);
      return true;
    } catch (error) {
      // Duplicate-name conflicts get a "Mark In Stock" toast action; on
      // success the builder's inventory sections + canvas are refreshed so
      // the (formerly out-of-stock) item becomes available. Every other
      // error is already toasted by the shared food-item data hook, so this
      // catch only needs the duplicate-name notifier.
      notifyFoodItemCreateError(error, {
        onMarkedInStock: () => Promise.all([
          refreshFoodItems(),
          loadInventorySections(),
          refreshTemplateInventoryFromServer(),
        ]),
      });
      return false;
    }
  };

  const handleAddOutOfStockItem = async (item: FoodItem) => {
    try {
      await updateFoodItem({
        id: item.id,
        name: item.name,
        limit: item.limit,
        limitType: item.limitType,
        categoryId: item.categoryId,
        statusFlags: { ...item.statusFlags, isInStock: true },
        dietaryFlags: item.dietaryFlags,
      });
      await Promise.all([refreshFoodItems(), loadInventorySections(), refreshTemplateInventoryFromServer()]);
      showSuccess(`${item.name} marked back in stock.`);
    } catch (error) {
      ErrorHandlerService.handleError(error, 'shoppingListBuilderRestockFoodItem');
    }
  };

  const handleSaveCategoryEdit = async (
    update: Partial<Category> & { keepTranslations?: boolean },
  ) => {
    if (editingCategoryId == null) return;
    const existing = categories.find((category) => category.id === editingCategoryId);
    if (!existing) return;
    try {
      await updateCategory({
        id: existing.id,
        name: update.name ?? existing.name,
        limit: update.limit ?? existing.limit,
        limitType: update.limitType ?? existing.limitType,
        icon: update.icon ?? existing.icon,
        keepTranslations: update.keepTranslations,
      });
      await Promise.all([loadInventorySections(), refreshTemplateInventoryFromServer()]);
      setEditingCategoryId(null);
      showSuccess('Category updated.');
    } catch (error) {
      ErrorHandlerService.handleError(error, 'shoppingListBuilderUpdateCategory');
    }
  };

  const outOfStockItemsForCategory = useMemo(() => {
    if (!selectedComponent || selectedComponent.type !== 'section-table' || !selectedComponent.inventorySource) {
      return [] as FoodItem[];
    }
    return foodItems
      .filter((item) => item.categoryId === selectedComponent.inventorySource?.categoryId && !item.statusFlags.isInStock)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [foodItems, selectedComponent]);

  const editingCategory = useMemo(() => (
    editingCategoryId == null
      ? null
      : categories.find((category) => category.id === editingCategoryId) ?? null
  ), [categories, editingCategoryId]);

  const handlePaletteDragStart = (event: React.DragEvent<HTMLButtonElement>, type: BuilderComponentType) => {
    setBuilderDragData(event, BUILDER_COMPONENT_DRAG_TYPE, type, componentTypeLabel(type));
  };

  const handleSavedComponentDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    savedComponent: SavedBuilderComponent,
  ) => {
    setBuilderDragData(
      event,
      SAVED_COMPONENT_DRAG_TYPE,
      String(savedComponent.id),
      savedComponent.name,
    );
  };

  const handleInventorySectionDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    inventorySection: InventorySectionComponent,
  ) => {
    setBuilderDragData(
      event,
      INVENTORY_SECTION_DRAG_TYPE,
      String(inventorySection.categoryId),
      inventorySection.categoryName,
    );
  };

  // When Guided + Split body is active and the user drops a component into the
  // body region, snap the dropped object's X so it sits centered inside the
  // page half the pointer landed in. We center across the visible page-half
  // span (page edge <-> center line) rather than the narrower lane bounds
  // (which exclude a 9pt buffer to the center line) so the resulting margins
  // are visually balanced against the page edge and the center divider.
  // The collision/clamp logic later in the insert helpers still keeps the
  // object inside the lane proper.
  const centerDroppedXInBodyLane = (pointerX: number, pointerY: number, objectWidth: number): number => {
    if (layoutMode !== 'guided' || bodyLayoutMode === 'full') {
      return snapCoord(pointerX);
    }
    if (getRegionForPoint(pointerY, template) !== 'body') {
      return snapCoord(pointerX);
    }
    const center = template.paper.width / 2;
    return getCenteredXInBodyHalf(
      template.paper.width,
      objectWidth,
      pointerX >= center ? 'right' : 'left',
      gridSize,
    );
  };

  // Resize the canvas zoom so the page width fills the visible canvas area.
  // The Radix ScrollArea root contains a `[data-radix-scroll-area-viewport]`
  // child; we use the viewport's clientWidth so the calculation matches what
  // the user actually sees (excluding scroll-bar gutters).
  const fitPageToWidth = useCallback(() => {
    const root = canvasScrollRef.current;
    if (!root) return;
    const viewport = root.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    const containerWidth = (viewport ?? root).clientWidth;
    if (!Number.isFinite(containerWidth) || containerWidth <= 0) return;
    // Leave a 24pt visual breathing margin (matches `mx-auto my-6` rhythm) so
    // the page edges don't collide with the canvas border.
    const targetScale = Math.max(0.1, (containerWidth - 24) / template.paper.width);
    const targetZoom = Math.round((targetScale * 100) / CANVAS_ZOOM_SCALE_FACTOR / CANVAS_ZOOM_STEP)
      * CANVAS_ZOOM_STEP;
    setZoom(clamp(targetZoom, CANVAS_MIN_ZOOM, CANVAS_MAX_ZOOM));
  }, [template.paper.width]);

  const handlePaperDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!paperRef.current) return;

    const bounds = paperRef.current.getBoundingClientRect();
    const scale = getCanvasScale(zoom);
    const pointerX = Math.round((event.clientX - bounds.left) / scale);
    const pointerY = Math.round((event.clientY - bounds.top) / scale);
    const y = snapCoord(pointerY);

    const type = getBuilderDragData(event, BUILDER_COMPONENT_DRAG_TYPE) as BuilderComponentType;
    if (type) {
      const dropX = centerDroppedXInBodyLane(pointerX, pointerY, DEFAULT_BUILDER_COMPONENT_WIDTH);
      addComponent(type, dropX, y);
      return;
    }

    const savedComponentValue = getBuilderDragData(event, SAVED_COMPONENT_DRAG_TYPE);
    if (savedComponentValue) {
      const savedComponentId = Number(savedComponentValue);
      const savedComponent = savedComponents.find((component) => component.id === savedComponentId);
      if (savedComponent) {
        const dropX = centerDroppedXInBodyLane(pointerX, pointerY, savedComponent.componentData.width);
        insertSavedComponent(savedComponent, dropX, y);
      }
      return;
    }

    const inventorySectionValue = getBuilderDragData(event, INVENTORY_SECTION_DRAG_TYPE);
    if (inventorySectionValue) {
      const categoryId = Number(inventorySectionValue);
      // Only react if the section is still in the scroll-area pool. A category
      // that's already on the canvas is filtered out of `availableInventorySections`,
      // and a stale drag from a now-placed section would otherwise duplicate it.
      const inventorySection = availableInventorySections.find((section) => section.categoryId === categoryId);
      if (inventorySection) {
        const dropX = centerDroppedXInBodyLane(pointerX, pointerY, inventorySection.component.width);
        insertInventorySection(inventorySection, dropX, y);
      }
    }
  };

  // Any body component handled by the Guided planner — flowing tables AND
  // single-placement components (text, fixed tables, form fields, lines,
  // dates, saved). Drag gestures on these reorder their sequence position
  // instead of moving x/y.
  const isGuidedPlannedBodyComponent = (component: BuilderComponent) => (
    layoutMode === 'guided' && flowingTablePlan.plannedBodyComponentIds.has(component.id)
  );

  // Convert a pointer event into paper-local coordinates by walking up to the
  // nearest .shopping-list-print-page element. Returns null if the pointer is
  // not currently over a rendered page (e.g. the gesture left the canvas).
  const pointerToPaperCoords = (event: React.PointerEvent): { pageIndex: number; x: number; y: number } | null => {
    const pageEl = (event.target as HTMLElement | null)?.closest('.shopping-list-print-page') as HTMLElement | null;
    let resolvedPageEl: HTMLElement | null = pageEl;
    if (!resolvedPageEl) {
      // Fallback: hit-test all rendered pages by viewport rect.
      const pages = document.querySelectorAll<HTMLElement>('.shopping-list-print-page');
      for (const candidate of Array.from(pages)) {
        const rect = candidate.getBoundingClientRect();
        if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
          resolvedPageEl = candidate;
          break;
        }
      }
    }
    if (!resolvedPageEl) return null;
    const pageIndexAttr = resolvedPageEl.getAttribute('data-page-index');
    const pageIndex = pageIndexAttr != null ? Number(pageIndexAttr) : 0;
    const rect = resolvedPageEl.getBoundingClientRect();
    const scale = getCanvasScale(zoom);
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;
    return { pageIndex, x, y };
  };

  const handleComponentPointerDown = (event: React.PointerEvent<HTMLDivElement>, component: BuilderComponent) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(component.id);
    // preventDefault above also suppresses the browser's focus move, so focus
    // is set explicitly: canvas shortcuts then act on this component, and a
    // field left focused in the inspector cannot swallow them.
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (isGuidedPlannedBodyComponent(component)) {
      reorderRef.current = {
        componentId: component.id,
        pointerId: event.pointerId,
      };
      setReorderState({ componentId: component.id, target: null });
      return;
    }
    dragRef.current = {
      id: component.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originalX: component.x,
      originalY: component.y,
      hasMoved: false,
    };
  };

  const handleComponentPointerMove = (event: React.PointerEvent<HTMLDivElement>, component: BuilderComponent) => {
    const reorder = reorderRef.current;
    if (reorder && reorder.componentId === component.id) {
      const cursor = pointerToPaperCoords(event);
      if (!cursor) {
        setReorderState((prev) => (prev ? { ...prev, target: null } : prev));
        return;
      }
      const targets = computeGuidedInsertTargets(template, flowingTablePlan, component.id);
      // Tolerance: ~3 grid cells (27pt) so the line snaps when the pointer is
      // anywhere near a valid gap, but disappears in dead zones.
      const tolerance = gridSize * 3;
      const target = findNearestInsertTarget(targets, template.paper.height, cursor, tolerance, gridSize * 12);
      setReorderState((prev) => (prev ? { ...prev, target } : prev));
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.id !== component.id) return;

    const scale = getCanvasScale(zoom);
    if (!drag.hasMoved) {
      pushHistory();
      drag.hasMoved = true;
    }
    const displayHeight = getCanvasComponentHeight(component);
    const nextX = clamp(snapCoord(Math.round(drag.originalX + (event.clientX - drag.startX) / scale)), 0, template.paper.width - component.width);
    const nextY = clamp(snapCoord(Math.round(drag.originalY + (event.clientY - drag.startY) / scale)), 0, template.paper.height - displayHeight);

    updateComponent(
      component.id,
      (current) => ({ ...current, x: nextX, y: nextY }) as BuilderComponent,
      { recordHistory: false },
    );
  };

  const handleComponentPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const reorder = reorderRef.current;
    if (reorder && reorder.pointerId === event.pointerId) {
      const finalState = reorderState;
      reorderRef.current = null;
      setReorderState(null);
      if (finalState && finalState.target) {
        const draggedId = reorder.componentId;
        const targetIndex = finalState.target.sequenceIndex;
        const targetGridCell = finalState.target.gridCell;
        if (targetGridCell != null) setActiveGridCell(targetGridCell);
        pushHistory();
        setTemplate((current) => {
          const remaining = current.components.filter((c) => c.id !== draggedId);
          const original = current.components.find((c) => c.id === draggedId);
          if (!original) return current;
          // Dropping into another grid square moves the component there.
          const dragged = targetGridCell == null
            ? original
            : ({ ...original, gridCell: targetGridCell } as BuilderComponent);
          const clampedIndex = Math.max(0, Math.min(targetIndex, remaining.length));
          const nextComponents = [
            ...remaining.slice(0, clampedIndex),
            dragged,
            ...remaining.slice(clampedIndex),
          ];
          return { ...current, components: nextComponents };
        });
      }
      return;
    }
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const downloadPreviewPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const refreshedTemplate = await shoppingListBuilderService.refreshTemplateInventory(template);
      const printableTemplate = annotateTemplateComponentRegions(refreshedTemplate);
      setTemplate(normalizeLegacyBuilderTemplateGeometry(printableTemplate));
      // When the user has a non-English Preview language active in the
      // action bar, download a print-ready PDF in that language. The
      // backend already accepts `targetLanguage` and uses cached text-
      // component translations + denormalized CategoryTranslation /
      // FoodItemTranslation rows; missing translations silently fall
      // back to English (same contract the canvas preview uses).
      const activeTargetLanguage = previewLanguage.trim();
      const pdf = await shoppingListBuilderService.createPreviewPdf(
        printableTemplate,
        activeTargetLanguage ? { targetLanguage: activeTargetLanguage } : {},
      );
      const url = URL.createObjectURL(pdf);
      const link = document.createElement('a');
      link.href = url;
      // Encode the language into the filename so multiple downloads in
      // different languages don't collide in the user's downloads folder.
      const filenameLanguageSegment = activeTargetLanguage
        ? `-${activeTargetLanguage.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`
        : '';
      link.download = `shopping-list-builder-preview${filenameLanguageSegment}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showSuccess(
        activeTargetLanguage
          ? `PDF preview downloaded in ${activeTargetLanguage}. Open it to compare the page with the canvas.`
          : 'PDF preview downloaded. Open it to compare the page with the canvas.',
      );
    } catch (error) {
      ErrorHandlerService.handleError(error, 'shoppingListBuilderPreviewPdf');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // ---------------------------------------------------------------------
  // Builder chrome (v1.9 UX rework). Everything below is presentation
  // state: which inspector tab is showing, how the workspace fits the
  // viewport, and the shortcuts/bulk actions that shorten common tasks.
  // None of it changes what a template can contain.
  // ---------------------------------------------------------------------
  const [inspectorTab, setInspectorTab] = useState<'selection' | 'page'>('page');
  const [placementOpen, setPlacementOpen] = useState(false);
  const [rowsOpen, setRowsOpen] = useState(true);
  const [zoomMode, setZoomMode] = useState<'auto' | 'manual'>('auto');
  const [focusRequest, setFocusRequest] = useState(0);
  const [revealRequest, setRevealRequest] = useState(0);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const inspectorRef = useRef<HTMLDivElement | null>(null);
  const [workspaceLayout, setWorkspaceLayout] = useState<{
    columns: 'wide' | 'compact' | 'stacked';
    height: number | null;
  }>({ columns: 'wide', height: null });

  // The inspector is contextual, the convention in design tools: it shows
  // the selected component, and the page when nothing is selected. The Page
  // tab stays one click away while a component is selected.
  useEffect(() => {
    setInspectorTab(selectedId ? 'selection' : 'page');
  }, [selectedId]);

  // In an 'individual' grid the active square follows the selection, so the
  // next click-insert lands beside the component just picked.
  const selectedGridCell = selectedComponent && isIndividualGrid && selectedComponentRegion === 'body'
    ? getComponentGridCell(selectedComponent, template)
    : null;
  useEffect(() => {
    if (selectedGridCell != null) setActiveGridCell(selectedGridCell);
  }, [selectedGridCell]);

  // Fit the three-column workspace to the viewport so the panels scroll
  // internally and the page itself never does. Measured rather than written
  // as a `calc()` constant because the header row above wraps at narrower
  // widths, which moves the workspace's top edge.
  useEffect(() => {
    const element = workspaceRef.current;
    if (!element) return undefined;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const columns = rect.width >= 1120 ? 'wide' : rect.width >= 760 ? 'compact' : 'stacked';
      const top = rect.top + window.scrollY;
      const height = Math.max(440, Math.floor(window.innerHeight - top - 24));
      setWorkspaceLayout((current) => (
        current.columns === columns && current.height === height ? current : { columns, height }
      ));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.parentElement) observer.observe(element.parentElement);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const getCanvasViewportSize = useCallback(() => {
    const root = canvasScrollRef.current;
    if (!root) return null;
    const viewport = root.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    const target = viewport ?? root;
    if (target.clientWidth <= 0 || target.clientHeight <= 0) return null;
    return { width: target.clientWidth, height: target.clientHeight };
  }, []);

  const zoomForScale = useCallback((scale: number) => clamp(
    Math.floor((scale * 100) / CANVAS_ZOOM_SCALE_FACTOR / CANVAS_ZOOM_STEP) * CANVAS_ZOOM_STEP,
    CANVAS_MIN_ZOOM,
    CANVAS_MAX_ZOOM,
  ), []);

  const getFitWidthZoom = useCallback(() => {
    const size = getCanvasViewportSize();
    if (!size) return null;
    return zoomForScale((size.width - CANVAS_FIT_MARGIN) / template.paper.width);
  }, [getCanvasViewportSize, template.paper.width, zoomForScale]);

  const fitWholePage = () => {
    const size = getCanvasViewportSize();
    if (!size) return;
    setZoomMode('manual');
    setZoom(zoomForScale(Math.min(
      (size.width - CANVAS_FIT_MARGIN) / template.paper.width,
      (size.height - CANVAS_FIT_MARGIN) / template.paper.height,
    )));
  };

  const setManualZoom = (value: number) => {
    setZoomMode('manual');
    setZoom(clamp(value, CANVAS_MIN_ZOOM, CANVAS_MAX_ZOOM));
  };

  // Until the user picks a zoom, the page tracks the canvas width (never
  // above 100%), so the whole page width is visible at any window size
  // instead of opening cropped on a smaller screen.
  useEffect(() => {
    if (zoomMode !== 'auto') return undefined;
    const root = canvasScrollRef.current;
    if (!root) return undefined;
    const apply = () => {
      const fit = getFitWidthZoom();
      if (fit != null) setZoom(Math.min(fit, CANVAS_DEFAULT_ZOOM));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(root);
    return () => observer.disconnect();
  }, [getFitWidthZoom, zoomMode]);

  // Move keyboard focus to the selected component's main field (its text,
  // or a table's title) so "add, then type" needs no extra click.
  const requestPrimaryFieldFocus = () => setFocusRequest((current) => current + 1);
  useEffect(() => {
    if (focusRequest === 0) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const field = inspectorRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        '[data-builder-primary-field]',
      );
      if (!field) return;
      field.focus({ preventScroll: false });
      field.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusRequest]);

  // Bring a just-inserted component into view. A planned body component can
  // land below the fold or on page 2, where the insert would otherwise look
  // like nothing happened.
  const revealSelection = () => setRevealRequest((current) => current + 1);
  useEffect(() => {
    if (revealRequest === 0 || !selectedId) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const element = canvasScrollRef.current?.querySelector(
        `[data-component-id="${CSS.escape(selectedId)}"]`,
      );
      element?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [revealRequest, selectedId]);

  const insertAllInventorySections = () => {
    if (availableInventorySections.length === 0) return;
    pushHistory();
    let working = template;
    availableInventorySections.forEach((inventorySection) => {
      const component = buildInventorySectionComponent(inventorySection, working);
      working = { ...working, components: [...working.components, component] };
    });
    const added = working.components.slice(template.components.length);
    setTemplate((current) => ({ ...current, components: [...current.components, ...added] }));
    setSelectedId('');
    setEditingSavedComponentSource(null);
    showSuccess(
      added.length === 1
        ? `${availableInventorySections[0].categoryName} inventory table added to the page.`
        : `${added.length} inventory sections added to the page in category order.`,
    );
  };

  // Copies the selected table's columns and appearance to every other
  // section table. Titles, rows, limits, translation settings and placement
  // are per-table content and are left alone.
  const applySelectedTableStyleToAllTables = () => {
    if (!selectedComponent || selectedComponent.type !== 'section-table') return;
    const sourceId = selectedComponent.id;
    const otherTableCount = template.components.filter((component) => (
      component.type === 'section-table' && component.id !== sourceId
    )).length;
    if (otherTableCount === 0) {
      showWarning('This is the only section table on the page. Add another table before copying its style.');
      return;
    }
    const style: Partial<SectionTableBuilderComponent> = {
      fontSize: selectedComponent.fontSize,
      rowHeight: selectedComponent.rowHeight,
      limitWidth: selectedComponent.limitWidth,
      wantWidth: selectedComponent.wantWidth,
      cornerRadius: selectedComponent.cornerRadius,
      showLimit: selectedComponent.showLimit,
      showGlobalLimit: selectedComponent.showGlobalLimit,
      showWant: selectedComponent.showWant,
      wantControl: selectedComponent.wantControl,
      showColumnDividers: selectedComponent.showColumnDividers,
      showBorders: selectedComponent.showBorders,
      showStatusIcons: selectedComponent.showStatusIcons,
      alternateRows: selectedComponent.alternateRows,
    };
    pushHistory();
    setTemplate((current) => ({
      ...current,
      components: current.components.map((component) => (
        component.type === 'section-table' && component.id !== sourceId
          ? clampComponentToTemplateRegion({ ...component, ...style }, current, undefined, {
            avoidCollisions: true,
            excludeComponentId: component.id,
          })
          : component
      )),
    }));
    showSuccess(
      `Columns and style copied to ${otherTableCount} other section ${otherTableCount === 1 ? 'table' : 'tables'}. Use Undo to revert.`,
    );
  };

  const nudgeSelectedComponent = (dx: number, dy: number) => {
    if (!selectedComponent || isGuidedPlannedBodyComponent(selectedComponent)) return;
    const step = layoutMode === 'guided' ? gridSize : 1;
    // Resolve the move the same way a drag would (region clamp + Guided
    // collision placement), then accept it only if the component actually
    // travelled the way the arrow points. Guided collision placement can
    // otherwise relocate a blocked component in the opposite direction.
    const resolved = clampComponentToTemplateRegion(
      {
        ...selectedComponent,
        x: selectedComponent.x + dx * step,
        y: selectedComponent.y + dy * step,
      } as BuilderComponent,
      template,
      undefined,
      { avoidCollisions: true, excludeComponentId: selectedComponent.id },
    );
    const movedX = resolved.x - selectedComponent.x;
    const movedY = resolved.y - selectedComponent.y;
    const followsArrow = (dx !== 0 && Math.sign(movedX) === dx && movedY === 0)
      || (dy !== 0 && Math.sign(movedY) === dy && movedX === 0);
    if (!followsArrow) return;
    updateSelectedComponent({ x: resolved.x, y: resolved.y });
  };

  // Canvas keyboard shortcuts. Scoped to the canvas (or no focused control)
  // so Delete/Backspace typed into an inspector field never removes a
  // component. Handlers are read through a ref so the listener is bound once.
  const shortcutActionsRef = useRef({
    undo: undoLastChange,
    remove: deleteSelectedComponent,
    duplicate: duplicateSelectedComponent,
    nudge: nudgeSelectedComponent,
    hasSelection: Boolean(selectedComponent),
    canUndo: templateHistory.length > 0,
  });
  useEffect(() => {
    shortcutActionsRef.current = {
      undo: undoLastChange,
      remove: deleteSelectedComponent,
      duplicate: duplicateSelectedComponent,
      nudge: nudgeSelectedComponent,
      hasSelection: Boolean(selectedComponent),
      canUndo: templateHistory.length > 0,
    };
  });
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      // Never act on a key typed into a field, or pressed inside a menu,
      // list or slider that uses the same keys for its own navigation.
      if (
        target.isContentEditable
        || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
        || target.closest('[role="menu"],[role="listbox"],[role="slider"],[role="combobox"]')
      ) {
        return;
      }
      const inCanvas = target === document.body || Boolean(canvasScrollRef.current?.contains(target));
      // Dialogs and popovers portal outside the builder root, so they are
      // excluded here without being named.
      const inBuilder = inCanvas || Boolean(workspaceRef.current?.contains(target));
      if (!inBuilder) return;
      const actions = shortcutActionsRef.current;
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (modifier && !event.shiftKey && key === 'z') {
        if (!actions.canUndo) return;
        event.preventDefault();
        actions.undo();
        return;
      }
      if (!actions.hasSelection) return;
      if (modifier && key === 'd') {
        event.preventDefault();
        actions.duplicate();
        return;
      }
      if (modifier || event.altKey) return;
      if (key === 'delete' || key === 'backspace') {
        event.preventDefault();
        actions.remove();
      } else if (key === 'escape') {
        setSelectedId('');
      } else if (!inCanvas) {
        // Arrow keys move focus within toolbars, tabs and toggle groups;
        // they only nudge when the canvas itself has focus.
      } else if (key === 'arrowleft' || key === 'arrowright' || key === 'arrowup' || key === 'arrowdown') {
        // The app sidebar listens for arrow keys on `document` and moves
        // focus into the navigation. With a component selected on the canvas
        // the arrows belong to it, so the event stops here.
        event.preventDefault();
        event.stopPropagation();
        if (key === 'arrowleft') actions.nudge(-1, 0);
        else if (key === 'arrowright') actions.nudge(1, 0);
        else if (key === 'arrowup') actions.nudge(0, -1);
        else actions.nudge(0, 1);
      }
    };
    // Capture phase, so this runs before document-level listeners.
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const fontSizeOptions = (current: number, list: readonly number[] = BUILDER_FONT_SIZES) => (
    list.includes(current) ? [...list] : [...list, current].sort((a, b) => a - b)
  );

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(template) !== savedSnapshot,
    [savedSnapshot, template],
  );

  const pageSummary = [
    'Letter',
    isGridLayout
      ? `Grid ${gridLayout.replace('x', '×')} · ${gridContentMode === 'individual' ? 'individual squares' : 'duplicated'}`
      : bodyLayoutModeLabel(bodyLayoutMode),
    `up to ${maxPages} ${maxPages === 1 ? 'page' : 'pages'}`,
    printModeLabel(printMode),
  ].join(' · ');

  const renderTypographyControls = (
    component: TextBuilderComponent | DateBuilderComponent | LanguageTagBuilderComponent,
    idPrefix: string,
    onFontSizeChange: (size: number) => void,
  ) => (
    <>
      <div className="flex items-center gap-1.5">
        <Select value={String(component.fontSize)} onValueChange={(value) => onFontSizeChange(Number(value))}>
          <SelectTrigger id={`${idPrefix}-font-size`} aria-label="Font size" className="h-8 w-[84px] shrink-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fontSizeOptions(component.fontSize).map((size) => (
              <SelectItem key={String(size)} value={String(size)}>
                {size} pt
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ToggleGroup
          type="multiple"
          aria-label="Text weight"
          className="w-auto shrink-0"
          value={component.fontWeight === 'bold' ? ['bold'] : []}
          onValueChange={(value) => updateSelectedComponent({
            fontWeight: value.includes('bold') ? 'bold' : 'normal',
          })}
        >
          <ToggleGroupItem value="bold" aria-label="Bold">
            <Bold size={14} />
          </ToggleGroupItem>
        </ToggleGroup>
        <Segmented
          ariaLabel="Alignment"
          value={component.align}
          onChange={(align) => updateSelectedComponent({ align })}
          options={[
            { value: 'left', ariaLabel: 'Align left', label: <AlignLeft size={14} /> },
            { value: 'center', ariaLabel: 'Align center', label: <AlignCenter size={14} /> },
            { value: 'right', ariaLabel: 'Align right', label: <AlignRight size={14} /> },
          ]}
        />
      </div>
      <FieldRow label="Line height" htmlFor={`${idPrefix}-line-height`}>
        <Input
          id={`${idPrefix}-line-height`}
          type="number"
          step="0.05"
          className="h-8 text-xs md:text-xs"
          value={component.lineHeight}
          onChange={(event) => updateSelectedComponent({ lineHeight: toNumber(event.target.value, component.lineHeight) })}
        />
      </FieldRow>
    </>
  );

  const renderRegionControls = (component: BuilderComponent) => {
    if (isInventorySectionTable(component)) return null;
    const region = selectedComponentRegion ?? getComponentRegion(component, template);
    return (
      <>
        <FieldRow label="Page region" controlClassName="w-[66%]">
          <Segmented
            ariaLabel="Page region"
            testId="builder-selected-component-region-select"
            value={region}
            onChange={(next) => changeComponentRegion(component.id, next)}
            options={BUILDER_COMPONENT_REGIONS.map((option) => ({
              value: option,
              label: componentRegionLabel(option),
              disabled: !canPlaceComponentInRegion(component, template, option),
            }))}
          />
        </FieldRow>
        {isIndividualGrid && (
          <FieldRow label="Grid square" controlClassName="w-[66%]">
            <Segmented
              ariaLabel="Grid square"
              testId="builder-selected-component-grid-cell"
              value={String(region === 'body' ? getComponentGridCell(component, template) : -1)}
              onChange={(value) => setSelectedComponentGridCell(Number(value))}
              options={Array.from({ length: gridCellCount }, (_, cellIndex) => ({
                value: String(cellIndex),
                label: String(cellIndex + 1),
                ariaLabel: `Square ${cellIndex + 1}`,
                disabled: region !== 'body',
              }))}
            />
          </FieldRow>
        )}
        {/*
          Always rendered: body content does not repeat, so the control
          disables there instead of appearing and pushing the sections below
          it down the moment a region is picked.
        */}
        <FieldRow label="Repeats on">
          <Select
            value={region === 'body' ? 'body' : component.repeatMode ?? 'every'}
            onValueChange={(value) => changeComponentRepeatMode(component.id, value as BuilderHeaderFooterRepeatMode)}
            disabled={region === 'body'}
          >
            <SelectTrigger aria-label="Repeat on pages" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {region === 'body' && <SelectItem value="body">Flows with the body</SelectItem>}
              {BUILDER_HEADER_FOOTER_REPEAT_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {headerFooterRepeatModeLabel(mode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
      </>
    );
  };

  const renderGeometrySection = (component: BuilderComponent) => (
    <InspectorSection
      title="Position & size"
      collapsible
      open={placementOpen}
      onOpenChange={setPlacementOpen}
      testId="builder-geometry-section"
    >
      <div className="grid grid-cols-2 gap-1.5">
        <GeometryInput
          id="component-x"
          prefix="X"
          label="X position"
          value={component.x}
          onChange={(raw) => updateSelectedComponent({ x: toNumber(raw, component.x) })}
        />
        <GeometryInput
          id="component-y"
          prefix="Y"
          label="Y position"
          value={component.y}
          onChange={(raw) => updateSelectedComponent({ y: toNumber(raw, component.y) })}
        />
        <GeometryInput
          id="component-width"
          prefix="W"
          label="Width"
          value={component.width}
          onChange={(raw) => updateSelectedComponent({ width: toNumber(raw, component.width) })}
        />
        <GeometryInput
          id="component-height"
          prefix="H"
          label="Height"
          value={Math.round(getComponentHeight(component, sectionTableMeasurement))}
          onChange={(raw) => updateSelectedComponent({ height: toNumber(raw, component.height) })}
          disabled={component.type === 'section-table'}
        />
      </div>
    </InspectorSection>
  );

  const renderCanvasComponent = (
    component: BuilderComponent,
    options: {
      key: React.Key;
      left?: number;
      top?: number;
      height?: number;
      rows?: SectionTableRow[];
      rowHeights?: number[];
      isDraggable?: boolean;
      showRegionBadge?: boolean;
      isContinuation?: boolean;
    },
  ) => {
    const selected = component.id === selectedId;
    const displayHeight = options.height ?? getCanvasComponentHeight(component, sectionTableMeasurement);
    const componentRegion = getComponentRegion(component, template);
    const isDraggable = options.isDraggable ?? true;
    const showRegionBadge = selected && (options.showRegionBadge ?? true);
    const isReorderingThis = reorderState?.componentId === component.id;
    const canChangeRegion = !isInventorySectionTable(component);

    return (
      <div
        key={options.key}
        className={cn(
          'absolute select-none rounded-[2px] outline-hidden focus-visible:ring-2 focus-visible:ring-primary/60',
          selected ? 'z-20' : 'z-10 hover:ring-1 hover:ring-primary/40',
        )}
        data-region={componentRegion}
        data-component-id={component.id}
        data-flow-continuation={options.isContinuation ? 'true' : undefined}
        style={{
          left: options.left ?? component.x,
          top: options.top ?? component.y,
          width: component.width,
          height: displayHeight,
          cursor: isDraggable ? 'move' : 'pointer',
          opacity: isReorderingThis ? 0.4 : undefined,
        }}
        onPointerDown={isDraggable
          ? (event) => handleComponentPointerDown(event, component)
          : (event) => {
            event.preventDefault();
            event.stopPropagation();
            setSelectedId(component.id);
            event.currentTarget.focus({ preventScroll: true });
          }}
        onDoubleClick={() => {
          setSelectedId(component.id);
          setInspectorTab('selection');
          requestPrimaryFieldFocus();
        }}
        onPointerMove={isDraggable ? (event) => handleComponentPointerMove(event, component) : undefined}
        onPointerUp={isDraggable ? handleComponentPointerUp : undefined}
        onPointerCancel={isDraggable ? handleComponentPointerUp : undefined}
        role="button"
        tabIndex={0}
        aria-label={`Select ${component.name}`}
      >
        {selected && (
          <div className="pointer-events-none absolute inset-[-3px] z-30 rounded-[4px] border-2 border-primary" />
        )}
        {showRegionBadge && (
          // Floating selection toolbar. Counter-scaled so it stays one size
          // at every zoom; anchored above the component's top-left corner.
          <div
            className="pointer-events-auto absolute bottom-full left-0 z-40 mb-1.5 flex origin-bottom-left items-center gap-1"
            style={{ transform: `scale(${1 / getCanvasScale(zoom)})` }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            {canChangeRegion && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="builder-component-region-trigger"
                    className={cn(
                      'h-6 gap-1 rounded-full px-2 text-[11px]',
                      componentRegionBadgeClass(componentRegion),
                    )}
                  >
                    {componentRegionLabel(componentRegion)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Page Region</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {BUILDER_COMPONENT_REGIONS.map((region) => (
                    <DropdownMenuItem
                      key={region}
                      disabled={!canPlaceComponentInRegion(component, template, region)}
                      onSelect={() => changeComponentRegion(component.id, region)}
                    >
                      <span className="flex flex-col">
                        <span>{componentRegionLabel(region)}</span>
                        <span className="text-xs text-muted-foreground">
                          {componentRegionDescription(region)}
                        </span>
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {(componentRegion === 'header' || componentRegion === 'footer') && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="builder-component-repeat-mode-trigger"
                    className={cn(
                      'h-6 gap-1 rounded-full px-2 text-[11px]',
                      componentRegionBadgeClass(componentRegion),
                    )}
                  >
                    {headerFooterRepeatModeShortLabel(component.repeatMode ?? 'every')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Repeat on pages</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {BUILDER_HEADER_FOOTER_REPEAT_MODES.map((mode) => (
                    <DropdownMenuItem
                      key={mode}
                      data-testid={`builder-component-repeat-mode-${mode}`}
                      onSelect={() => changeComponentRepeatMode(component.id, mode)}
                    >
                      <span className="flex flex-col">
                        <span>{headerFooterRepeatModeLabel(mode)}</span>
                        <span className="text-xs text-muted-foreground">
                          {headerFooterRepeatModeDescription(mode)}
                        </span>
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <div className="flex h-6 items-center rounded-full border border-border bg-background shadow-sm">
              <button
                type="button"
                aria-label="Duplicate"
                title="Duplicate"
                data-testid="builder-canvas-duplicate"
                onClick={duplicateSelectedComponent}
                className="flex h-6 w-7 items-center justify-center rounded-l-full text-foreground transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
              >
                <CopyIcon size={12} />
              </button>
              <button
                type="button"
                aria-label="Delete"
                title="Delete"
                data-testid="builder-canvas-delete"
                onClick={deleteSelectedComponent}
                className="flex h-6 w-7 items-center justify-center rounded-r-full text-foreground transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Trash2Icon size={12} />
              </button>
            </div>
          </div>
        )}
        <div className="relative z-10 h-full w-full">
          {component.type === 'section-table' && options.rows
            ? <PreviewSectionTable component={component} rows={options.rows} rowHeights={options.rowHeights} includeCategoryIcons={includeCategoryIcons} />
            : <PreviewComponent component={component} includeCategoryIcons={includeCategoryIcons} />}
        </div>
      </div>
    );
  };

  return (
    // Provide canvas-wide preview-language state to every translation-aware
    // child (PreviewText today; PreviewSectionTable / PreviewFormFields in
    // future slices). When `language === ''` the canvas renders English;
    // otherwise each text component renders per its own translationMode
    // against the fetched `translations` map.
    <PreviewLanguageContext.Provider
      value={{
        language: previewLanguage,
        translations: previewTranslations,
        inventoryTranslations: previewInventoryTranslations,
        globalLimit,
      }}
    >
      <TooltipProvider>
        <div className="min-w-0 w-full space-y-4 pt-6" data-testid="shopping-list-builder">
        {/*
          One header row: page identity on the left, the document's own
          controls (name, open, preview language, save, download) on the
          right. It wraps under the title on narrower windows.
        */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          {/*
            The title block gives way first (its description wraps) so the
            controls stay on the title's row; only when even that does not
            fit do the controls drop beneath as one row of their own.
          */}
          <div className="min-w-0 flex-[1_1_340px]">
            <SectionHeader
              title="Shopping List Builder"
              description={terminology.format('Compose printable shopping list templates from constrained {pantry} components')}
              icon={ShoppingListBuilderTitleIcon}
            />
          </div>
          {/* flex-none keeps the group whole beside the title; flex-wrap lets it
              break only when it is wider than the page itself. */}
          <div className="flex min-w-0 max-w-full flex-none flex-wrap items-center gap-2">
            <div className="relative w-[200px] min-w-[150px] shrink 2xl:w-[300px]">
              <Input
                id="builder-template-name"
                aria-label="Template name"
                placeholder="Template name"
                className="h-9 pr-14 font-medium"
                title={template.name}
                value={template.name}
                maxLength={MAX_SAVED_TEMPLATE_NAME_LENGTH}
                onChange={(event) =>
                  setTemplate((current) => ({
                    ...current,
                    name: limitTemplateName(event.target.value),
                  }))
                }
              />
              <span
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
              >
                {template.name.length}/{MAX_SAVED_TEMPLATE_NAME_LENGTH}
              </span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  id="builder-apply-saved-template"
                  type="button"
                  variant="outline"
                  data-testid="saved-template-apply-trigger"
                  className="h-9 gap-2"
                >
                  <AnimateIcon asChild animate={animateBuilderChromeMount} animateOnHover animateOnTap>
                    <LayoutTemplateIcon size={16} className="shrink-0" />
                  </AnimateIcon>
                  Open
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Saved templates</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {savedTemplates.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    {isLoadingSavedTemplates ? 'Loading saved templates…' : 'No saved templates yet. Save this page to reuse it.'}
                  </div>
                ) : (
                  <ScrollArea
                    data-testid="saved-template-apply-scroll-area"
                    className={cn(savedTemplates.length > 5 ? 'h-[260px] pr-2' : '')}
                  >
                    <div className="space-y-1">
                      {savedTemplates.map((savedTemplate) => (
                        <DropdownMenuItem
                          key={savedTemplate.id}
                          data-testid="saved-template-apply-item"
                          title={savedTemplate.name}
                          className="flex-col items-start gap-0 py-2"
                          onSelect={() => void applySavedTemplate(savedTemplate)}
                        >
                          <span className="flex w-full items-center justify-between gap-2 text-sm font-medium">
                            <span className="min-w-0 truncate">
                              {truncateMiddle(savedTemplate.name, MAX_SAVED_TEMPLATE_NAME_LENGTH)}
                            </span>
                            {savedTemplate.id === activeSavedTemplateId && (
                              <Badge variant="secondary" className="shrink-0 text-[10px]">Current</Badge>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {savedTemplate.templateData.components.length} components
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                <DropdownMenuSeparator />
                <AnimateIcon asChild animateOnHover animateOnTap>
                  <DropdownMenuItem data-testid="builder-new-blank-template" onSelect={resetTemplate}>
                    <RotateCcwIcon size={16} className="mr-2" />
                    New blank template
                  </DropdownMenuItem>
                </AnimateIcon>
              </DropdownMenuContent>
            </DropdownMenu>
            {/*
              Canvas-wide translation preview. Picking a language re-renders
              every translation-aware component per its own translation
              mode. "English (no preview)" reverts the canvas immediately
              and skips any network call.
            */}
            <Select
              value={previewLanguage || PREVIEW_LANGUAGE_NONE_SENTINEL}
              onValueChange={(value) => {
                setPreviewLanguage(value === PREVIEW_LANGUAGE_NONE_SENTINEL ? '' : value);
              }}
              disabled={isLoadingLanguages}
            >
              <SelectTrigger
                className="h-9 w-[176px] shrink-0"
                aria-label="Preview language"
                data-testid="builder-preview-language-select"
              >
                {/*
                  `flex!` overrides the SelectTrigger's `[&>span]:line-clamp-1`
                  utility, which forces display: -webkit-box and stacks the
                  icon above the value text.
                */}
                <span className="flex! min-w-0 items-center gap-2">
                  <AnimateIcon asChild animate={animateBuilderChromeMount} animateOnHover animateOnTap>
                    <LanguagesIcon size={16} className="shrink-0" />
                  </AnimateIcon>
                  <span className="truncate">
                    <SelectValue placeholder="Preview language" />
                  </span>
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PREVIEW_LANGUAGE_NONE_SENTINEL}>English (no preview)</SelectItem>
                {enabledNonEnglishLanguages.map((lang) => (
                  <SelectItem key={lang.name} value={lang.name}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AnimateIcon asChild animate={animateBuilderChromeMount} animateOnHover animateOnTap>
              <Button variant="outline" className="h-9" onClick={saveCurrentTemplate} disabled={isSavingTemplate}>
                {isSavingTemplate ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SaveIcon size={16} />
                )}
                Save Template
                {hasUnsavedChanges && (
                  <span
                    data-testid="builder-unsaved-dot"
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                  />
                )}
              </Button>
            </AnimateIcon>
            <AnimateIcon asChild animate={animateBuilderChromeMount} animateOnHover animateOnTap>
              <Button className="h-9" onClick={downloadPreviewPdf} disabled={isGeneratingPdf}>
                <DownloadIcon size={16} />
                {isGeneratingPdf ? 'Preparing PDF' : 'Download PDF'}
              </Button>
            </AnimateIcon>
          </div>
        </div>

        <div
          ref={workspaceRef}
          className={cn(
            'grid min-w-0 gap-3',
            workspaceLayout.columns === 'wide' && 'grid-cols-[264px_minmax(0,1fr)_336px]',
            workspaceLayout.columns === 'compact' && 'grid-cols-[216px_minmax(0,1fr)_288px]',
            workspaceLayout.columns === 'stacked' && 'grid-cols-1',
          )}
          style={workspaceLayout.columns !== 'stacked' && workspaceLayout.height != null
            ? { height: workspaceLayout.height }
            : undefined}
          data-workspace-columns={workspaceLayout.columns}
          data-testid="builder-workspace-grid"
        >
          <aside
            aria-label="Insert components"
            className={cn(
              'flex min-h-0 flex-col overflow-hidden rounded-md border bg-card',
              workspaceLayout.columns === 'stacked' && 'h-[420px]',
            )}
          >
            <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3 text-sm font-semibold">
              <BetweenHorizontalStartIcon size={16} className="text-muted-foreground" />
              Insert
            </div>
            {/*
              Definite height comes from the flex column (min-h-0 + flex-1).
              Radix wraps viewport content in a `display: table` div, which
              sizes to max-content and defeats `truncate`; forcing it to
              block keeps every row inside the panel's width.
            */}
            <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:block!">
              <div className="space-y-4 p-3">
                <div className="space-y-2">
                  <PanelHeading>Components</PanelHeading>
                  <div className="grid grid-cols-3 gap-1.5">
                    {paletteItems.map((item) => (
                      <AnimateIcon key={item.type} asChild animateOnHover animateOnTap>
                        <button
                          type="button"
                          draggable
                          title={`Add ${item.label.toLowerCase()} — click, or drag onto the page`}
                          data-testid={`builder-palette-${item.type}`}
                          onDragStart={(event) => handlePaletteDragStart(event, item.type)}
                          onClick={() => addComponent(item.type)}
                          className="flex h-[58px] cursor-grab flex-col items-center justify-center gap-1 rounded-md border bg-background px-1 text-center text-[11px] leading-tight transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                        >
                          <item.icon size={16} className="shrink-0 text-muted-foreground" />
                          <span className="line-clamp-2">{item.label}</span>
                        </button>
                      </AnimateIcon>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <PanelHeading
                    count={inventorySections.length > 0
                      ? `${inventorySections.length - availableInventorySections.length}/${inventorySections.length} on page`
                      : undefined}
                    action={availableInventorySections.length > 1 ? (
                      <AnimateIcon asChild animateOnHover animateOnTap>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-testid="builder-add-all-inventory-sections"
                          className="h-7 shrink-0 gap-1 px-2 text-xs"
                          onClick={insertAllInventorySections}
                        >
                          <PlusIcon size={14} />
                          Add all
                        </Button>
                      </AnimateIcon>
                    ) : undefined}
                  >
                    Inventory
                  </PanelHeading>
                  {availableInventorySections.length > 0 ? (
                    <div className="space-y-1">
                      {availableInventorySections.map((inventorySection) => (
                        <button
                          key={inventorySection.categoryId}
                          type="button"
                          draggable
                          data-testid="inventory-section-drag-source"
                          data-inventory-section-name={inventorySection.categoryName}
                          onDragStart={(event) => handleInventorySectionDragStart(event, inventorySection)}
                          onClick={() => insertInventorySection(inventorySection)}
                          className="group flex h-9 w-full cursor-grab items-center justify-between gap-2 rounded-md border bg-background px-3 text-left text-xs transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                        >
                          <span className="min-w-0 truncate font-medium">{inventorySection.categoryName}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {inventorySection.itemCount} {inventorySection.itemCount === 1 ? 'item' : 'items'}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : inventorySections.length > 0 ? (
                    <p data-testid="inventory-sections-all-placed" className="text-xs text-muted-foreground">
                      Every in-stock category is on the page.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {isLoadingInventorySections
                        ? 'Loading inventory sections…'
                        : 'Inventory sections appear here when food items are in stock.'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <PanelHeading count={savedComponents.length > 0 ? savedComponents.length : undefined}>
                    Saved components
                  </PanelHeading>
                  {savedComponents.length > 0 ? (
                    <div className="space-y-1">
                      {savedComponents.map((savedComponent) => (
                        <div
                          key={savedComponent.id}
                          data-testid="saved-component-card"
                          data-saved-component-name={savedComponent.name}
                          className="flex h-10 w-full items-center rounded-md border bg-background pl-3 pr-0.5 text-xs transition-colors hover:border-primary/50 hover:bg-accent"
                        >
                          <button
                            type="button"
                            draggable
                            onDragStart={(event) => handleSavedComponentDragStart(event, savedComponent)}
                            onClick={() => insertSavedComponent(savedComponent)}
                            className="flex h-full min-w-0 flex-1 cursor-grab flex-col justify-center rounded-sm text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                          >
                            <span className="block truncate font-medium">{savedComponent.name}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {componentTypeLabel(savedComponent.componentType)}
                            </span>
                          </button>
                          <SavedComponentActionsMenu
                            savedComponent={savedComponent}
                            onRename={openRenameSavedComponent}
                            onEdit={editSavedComponent}
                            onDelete={openDeleteSavedComponent}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {isLoadingSavedComponents
                        ? 'Loading saved components…'
                        : 'Save a component from the page to reuse it on other templates.'}
                    </p>
                  )}
                </div>
              </div>
            </ScrollArea>
          </aside>

          <main
            className={cn(
              'flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border translation-options-column',
              workspaceLayout.columns === 'stacked' && 'h-[80vh]',
            )}
          >
            <div className="flex h-11 shrink-0 items-center gap-1.5 border-b px-2">
              <Segmented
                ariaLabel="Layout mode"
                className="w-auto shrink-0"
                value={layoutMode}
                onChange={setLayoutMode}
                options={[
                  {
                    value: 'guided',
                    testId: 'builder-layout-mode-guided',
                    label: (
                      <>
                        <Grid2x2CheckIcon size={14} />
                        Guided
                      </>
                    ),
                  },
                  {
                    value: 'freeform',
                    // A grid's squares are the layout, so it is always Guided.
                    disabled: isGridLayout,
                    testId: 'builder-layout-mode-freeform',
                    label: (
                      <>
                        <SquareDashedMousePointerIcon size={14} />
                        Freeform
                      </>
                    ),
                  },
                ]}
              />
              <ToolbarButton
                label={showCanvasGuides ? 'Hide grid and guides' : 'Show grid and guides'}
                pressed={showCanvasGuides}
                testId="builder-canvas-guides-toggle"
                data-grid-shown={showCanvasGuides ? 'true' : 'false'}
                onClick={() => setShowCanvasGuides((current) => !current)}
              >
                <Grid3x3Icon size={16} />
              </ToolbarButton>
              <Separator orientation="vertical" className="mx-0.5 h-5" />
              <ToolbarButton
                label="Undo"
                shortcut={undoShortcutLabel}
                onClick={undoLastChange}
                disabled={templateHistory.length === 0}
                testId="builder-undo"
              >
                <UndoIcon size={16} />
              </ToolbarButton>
              <div className="ml-auto flex items-center gap-0.5">
                <ToolbarButton
                  label="Zoom out"
                  onClick={() => setManualZoom(zoom - CANVAS_ZOOM_STEP * 2)}
                  disabled={zoom <= CANVAS_MIN_ZOOM}
                >
                  <ZoomOut size={16} />
                </ToolbarButton>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Zoom: ${zoom}%`}
                      className="h-8 w-[58px] px-0 text-xs tabular-nums"
                    >
                      <span data-testid="builder-zoom-value">{zoom}%</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      data-testid="builder-zoom-page-width"
                      onSelect={() => {
                        setZoomMode('manual');
                        fitPageToWidth();
                      }}
                    >
                      Fit width
                    </DropdownMenuItem>
                    <DropdownMenuItem data-testid="builder-zoom-fit-page" onSelect={fitWholePage}>
                      Fit whole page
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      data-testid="builder-zoom-full-page"
                      onSelect={() => setManualZoom(CANVAS_DEFAULT_ZOOM)}
                    >
                      100%
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-2">
                      <Slider
                        aria-label="Zoom"
                        value={[zoom]}
                        min={CANVAS_MIN_ZOOM}
                        max={CANVAS_MAX_ZOOM}
                        step={CANVAS_ZOOM_STEP}
                        onValueChange={([value]) => setManualZoom(value)}
                      />
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ToolbarButton
                  label="Zoom in"
                  onClick={() => setManualZoom(zoom + CANVAS_ZOOM_STEP * 2)}
                  disabled={zoom >= CANVAS_MAX_ZOOM}
                >
                  <ZoomIn size={16} />
                </ToolbarButton>
              </div>
            </div>
            <ScrollArea
              ref={canvasScrollRef}
              data-testid="shopping-list-builder-canvas-scroll"
              className="shopping-list-print-workspace min-h-0 flex-1 rounded-md border bg-background"
            >
              <div className="flex min-w-max flex-col items-center py-6">
                {Array.from({ length: flowingTablePlan.pageCount }, (_, pageIndex) => (
                  <div
                    key={pageIndex}
                    className="shopping-list-print-page-frame relative mx-auto mb-6 last:mb-0"
                    style={{
                      width: template.paper.width * getCanvasScale(zoom),
                      height: template.paper.height * getCanvasScale(zoom),
                    }}
                  >
                    <div
                      ref={pageIndex === 0 ? paperRef : undefined}
                      className="shopping-list-print-page print-theme absolute left-0 top-0 origin-top-left"
                      style={{
                        width: template.paper.width,
                        height: template.paper.height,
                        transform: `scale(${getCanvasScale(zoom)})`,
                      }}
                      data-testid={pageIndex === 0 ? 'shopping-list-builder-paper' : 'shopping-list-builder-paper-page'}
                      data-page-index={pageIndex}
                      data-component-count={template.components.length}
                      data-layout-mode={layoutMode}
                      data-body-layout-mode={bodyLayoutMode}
                      data-max-pages={maxPages}
                      data-print-mode={printMode}
                      onDragOver={pageIndex === 0 ? (event) => event.preventDefault() : undefined}
                      onDrop={pageIndex === 0 ? handlePaperDrop : undefined}
                      onPointerDown={(event) => {
                        setSelectedId('');
                        // Clicking an empty square makes it the target for
                        // click-inserts.
                        if (isIndividualGrid) {
                          const point = pointerToPaperCoords(event);
                          if (point && getRegionForPoint(point.y, template) === 'body') {
                            setActiveGridCell(gridCellAtPoint(point.x, point.y));
                          }
                        }
                      }}
                    >
                      {showCanvasGuides && layoutMode === 'guided' && (
                        <div
                          aria-hidden
                          data-testid={pageIndex === 0 ? 'shopping-list-builder-grid' : undefined}
                          className="pointer-events-none absolute inset-0"
                          style={{
                            backgroundImage:
                              'linear-gradient(to right, rgba(15,23,42,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.18) 1px, transparent 1px), linear-gradient(to right, rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.06) 1px, transparent 1px)',
                            backgroundSize: `${gridSize * 3}px ${gridSize * 3}px, ${gridSize * 3}px ${gridSize * 3}px, ${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px`,
                          }}
                        />
                      )}
                      {isGridLayout && showCanvasGuides && Array.from(
                        { length: getTemplateGridRowCount(template) - 1 },
                        (_, rowIndex) => (
                          <div
                            key={`grid-row-${rowIndex}`}
                            aria-hidden
                            data-testid={pageIndex === 0 ? 'shopping-list-builder-grid-row-line' : undefined}
                            className="pointer-events-none absolute left-0 right-0 z-6"
                            style={{
                              top: getTemplateGridRowBounds(template, rowIndex).bottom,
                              height: 1,
                              backgroundColor: BODY_SPLIT_GUIDE_COLOR,
                            }}
                          />
                        ),
                      )}
                      {isIndividualGrid && showCanvasGuides && pageIndex === 0 && (() => {
                        // Outline the square that click-inserts will land in.
                        const row = getTemplateGridRowBounds(template, Math.floor(activeGridCell / BUILDER_GRID_COLUMNS));
                        const isRightColumn = activeGridCell % BUILDER_GRID_COLUMNS === 1;
                        return (
                          <div
                            aria-hidden
                            data-testid="shopping-list-builder-active-grid-cell"
                            data-grid-cell={activeGridCell}
                            className="pointer-events-none absolute z-6"
                            style={{
                              left: isRightColumn ? template.paper.width / 2 : 0,
                              width: template.paper.width / 2,
                              top: row.top,
                              height: row.bottom - row.top,
                              boxShadow: `inset 0 0 0 2px ${BODY_SPLIT_GUIDE_COLOR}`,
                              backgroundColor: 'rgba(22, 163, 74, 0.05)',
                            }}
                          />
                        );
                      })()}
                      {showCanvasGuides && bodyLayoutMode !== 'full' && (
                        <div
                          aria-hidden
                          data-testid={pageIndex === 0 ? 'shopping-list-builder-split-line' : undefined}
                          data-body-column-gap={bodyColumnGap}
                          className="pointer-events-none absolute z-6"
                          style={{
                            left: template.paper.width / 2,
                            top: headerHeight,
                            bottom: footerHeight,
                            width: 1,
                            backgroundColor: BODY_SPLIT_GUIDE_COLOR,
                          }}
                        />
                      )}
                      {showCanvasGuides && headerHeight > 0 && (
                        <div
                          aria-hidden
                          data-testid={pageIndex === 0 ? 'shopping-list-builder-header-line' : undefined}
                          data-header-height={headerHeight}
                          className="pointer-events-none absolute left-0 right-0 z-5"
                          style={{
                            top: headerHeight,
                            height: 1,
                            backgroundColor: HEADER_FOOTER_LINE_COLOR,
                          }}
                        />
                      )}
                      {showCanvasGuides && footerHeight > 0 && (
                        <div
                          aria-hidden
                          data-testid={pageIndex === 0 ? 'shopping-list-builder-footer-line' : undefined}
                          data-footer-height={footerHeight}
                          className="pointer-events-none absolute left-0 right-0 z-5"
                          style={{
                            top: template.paper.height - footerHeight,
                            height: 1,
                            backgroundColor: HEADER_FOOTER_LINE_COLOR,
                          }}
                        />
                      )}
                      {template.components
                        .filter((component) => {
                          // Components fully governed by the plan render via the
                          // segments / bodyPlacements branches below.
                          if (flowingTablePlan.plannedBodyComponentIds.has(component.id)) {
                            return false;
                          }
                          const componentRegion = getComponentRegion(component, template);
                          if (componentRegion === 'header' || componentRegion === 'footer') {
                            return shouldRenderHeaderFooterOnPage(component.repeatMode, pageIndex);
                          }
                          // Non-planned body components render on page 0 from
                          // their stored x/y (Freeform Mode behavior).
                          return pageIndex === 0;
                        })
                        .map((component) => renderCanvasComponent(component, {
                          key: `${pageIndex}:${component.id}`,
                          isDraggable: pageIndex === 0,
                          showRegionBadge: pageIndex === 0,
                        }))}
                      {flowingTablePlan.bodyPlacements
                        .filter((placement) => placement.pageIndex === pageIndex)
                        .map((placement) => {
                          const component = template.components.find((c) => c.id === placement.componentId);
                          if (!component) return null;
                          return renderCanvasComponent(component, {
                            key: `placement:${pageIndex}:${placement.lane}:${component.id}`,
                            left: placement.x,
                            top: placement.y,
                            height: placement.height,
                            // A Duplicate All copy selects its original but
                            // is not itself dragged or given a toolbar.
                            isDraggable: !placement.isDuplicate,
                            showRegionBadge: !placement.isDuplicate,
                          });
                        })}
                      {flowingTablePlan.segments
                        .filter((segment) => segment.pageIndex === pageIndex)
                        .map((segment) => renderCanvasComponent(segment.component, {
                          key: `${segment.component.id}:${segment.pageIndex}:${segment.lane}:${segment.startRowIndex}`,
                          left: segment.x,
                          top: segment.y,
                          height: segment.height,
                          rows: segment.rows,
                          rowHeights: segment.rowHeights,
                          isDraggable: segment.isFirstSegment && !segment.isDuplicate,
                          showRegionBadge: segment.isFirstSegment && !segment.isDuplicate,
                          isContinuation: segment.isContinuation,
                        }))}
                      {reorderState?.target && reorderState.target.pageIndex === pageIndex && (
                        <div
                          aria-hidden
                          data-testid={pageIndex === 0 ? 'shopping-list-builder-reorder-line' : undefined}
                          className="pointer-events-none absolute z-50 rounded-[2px]"
                          style={{
                            left: reorderState.target.x,
                            top: reorderState.target.y - 4,
                            width: reorderState.target.width,
                            height: 8,
                            backgroundColor: 'rgba(220, 38, 38, 0.95)',
                            boxShadow: '0 0 0 1px rgba(127, 29, 29, 0.6)',
                          }}
                        />
                      )}
                      {pageIndex === 0 && template.components.length === 0 && (
                        <div
                          data-testid="builder-empty-canvas"
                          className="pointer-events-none absolute inset-x-0 z-30 flex justify-center"
                          style={{ top: headerHeight + 54 }}
                        >
                          {/* Counter-scaled so the starter card stays a readable size at any zoom. */}
                          <div
                            className="pointer-events-auto w-[340px] origin-top rounded-lg border border-dashed border-border bg-background p-4 text-foreground shadow-sm"
                            style={{ transform: `scale(${1 / getCanvasScale(zoom)})` }}
                            onPointerDown={(event) => event.stopPropagation()}
                          >
                            {savedTemplates.length > 0 ? (
                              <>
                                <p className="text-sm font-semibold">Start from a saved template</p>
                                <div className="mt-2 space-y-1">
                                  {savedTemplates.slice(0, 4).map((savedTemplate) => (
                                    <button
                                      key={savedTemplate.id}
                                      type="button"
                                      data-testid="builder-empty-canvas-template"
                                      onClick={() => void applySavedTemplate(savedTemplate)}
                                      className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left text-xs transition-colors hover:border-primary hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                                    >
                                      <span className="min-w-0 truncate font-medium">{savedTemplate.name}</span>
                                      <span className="shrink-0 text-muted-foreground">
                                        {savedTemplate.templateData.components.length} components
                                      </span>
                                    </button>
                                  ))}
                                </div>
                                <p className="mt-3 text-xs text-muted-foreground">
                                  Or start blank: click or drag anything from Insert.
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-sm font-semibold">This page is blank</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Click or drag anything from Insert to start building.
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <div className="flex h-8 shrink-0 items-center justify-between gap-3 border-t px-3 text-xs text-muted-foreground">
              <button
                type="button"
                data-testid="builder-page-summary"
                title="Open page settings"
                onClick={() => setInspectorTab('page')}
                className="min-w-0 truncate rounded-sm text-left transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                {pageSummary}
              </button>
              <div className="flex shrink-0 items-center gap-2">
                {flowingTablePlan.overflowRowCount > 0 && (
                  <Badge variant="destructive" data-testid="builder-flow-overflow-warning">
                    {flowingTablePlan.overflowRowCount} rows exceed max pages
                  </Badge>
                )}
                {flowingTablePlan.unplacedComponentCount > 0 && (
                  <Badge variant="destructive" data-testid="builder-unplaced-warning">
                    {flowingTablePlan.unplacedComponentCount}{' '}
                    {flowingTablePlan.unplacedComponentCount === 1 ? 'component does' : 'components do'} not fit
                  </Badge>
                )}
                <span data-testid="builder-save-state" aria-live="polite">
                  {hasUnsavedChanges
                    ? 'Unsaved changes'
                    : activeSavedTemplateId != null ? 'Saved' : ''}
                </span>
                <span className="tabular-nums">
                  {template.components.length} {template.components.length === 1 ? 'component' : 'components'}
                </span>
              </div>
            </div>
          </main>

          <aside
            aria-label="Inspector"
            className={cn(
              'flex min-h-0 flex-col overflow-hidden rounded-md border bg-card',
              workspaceLayout.columns === 'stacked' && 'h-[560px]',
            )}
          >
            <div className="flex h-11 shrink-0 items-center border-b px-2">
              <AnimatedTabs
                value={inspectorTab}
                onValueChange={(value) => setInspectorTab(value as 'selection' | 'page')}
                className="w-full"
              >
                <AnimatedTabsList className="grid h-8 w-full grid-cols-2">
                  <AnimatedTabsTrigger value="selection" data-testid="builder-inspector-selection-tab" className="text-xs">
                    Component
                  </AnimatedTabsTrigger>
                  <AnimatedTabsTrigger value="page" data-testid="builder-inspector-page-tab" className="text-xs">
                    Page
                  </AnimatedTabsTrigger>
                </AnimatedTabsList>
              </AnimatedTabs>
            </div>
            {/*
              Definite height comes from the flex column (min-h-0 + flex-1).
              Radix wraps viewport content in a `display: table` div, which
              sizes to max-content and defeats `truncate`; forcing it to
              block keeps every row inside the panel's width.
            */}
            <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:block!">
              <div ref={inspectorRef} className="space-y-3 p-3">
                {inspectorTab === 'page' && (
                  <PageInspector
                    layoutMode={layoutMode}
                    bodyLayoutMode={bodyLayoutMode}
                    gridSize={gridSize}
                    paperHeight={template.paper.height}
                    headerHeight={headerHeight}
                    footerHeight={footerHeight}
                    maxPages={maxPages}
                    printMode={printMode}
                    includeCategoryIcons={includeCategoryIcons}
                    onCommitHeader={setHeaderHeight}
                    onCommitFooter={setFooterHeight}
                    onChangeBodyLayoutMode={setBodyLayoutMode}
                    gridLayout={gridLayout}
                    gridContentMode={gridContentMode}
                    onChangeGridLayout={setGridLayout}
                    onChangeGridContentMode={setGridContentMode}
                    onChangeMaxPages={setMaxPages}
                    onChangePrintMode={setPrintMode}
                    onChangeIncludeCategoryIcons={setIncludeCategoryIcons}
                  />
                )}

                {inspectorTab === 'selection' && !selectedComponent && (
                  <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Select a component on the page to edit it.
                  </p>
                )}

                {inspectorTab === 'selection' && selectedComponent && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {componentTypeLabel(selectedComponent.type)}
                        </Badge>
                        <Input
                          id="component-name"
                          aria-label="Component name"
                          data-testid="builder-selected-component-name-input"
                          className="h-8 min-w-0 flex-1 text-xs font-medium md:text-xs"
                          value={selectedComponent.name}
                          onChange={(event) => updateSelectedComponent({ name: event.target.value })}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <AnimateIcon asChild animateOnHover animateOnTap>
                          <Button
                            type="button"
                            variant={isEditingSelectedSavedComponent ? 'default' : 'outline'}
                            size="sm"
                            data-testid="builder-save-selected-component"
                            className="h-8 min-w-0 flex-1 justify-center gap-1.5 text-xs"
                            onClick={saveSelectedComponent}
                            disabled={isSavingComponent}
                          >
                            {isSavingComponent ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <SaveIcon size={14} />
                            )}
                            <span className="truncate">
                              {isEditingSelectedSavedComponent ? 'Update saved component' : 'Save as component'}
                            </span>
                          </Button>
                        </AnimateIcon>
                        <ToolbarButton
                          label="Duplicate"
                          shortcut={duplicateShortcutLabel}
                          variant="outline"
                          onClick={duplicateSelectedComponent}
                          testId="builder-duplicate-selected"
                        >
                          <CopyIcon size={14} />
                        </ToolbarButton>
                        <ToolbarButton
                          label="Delete"
                          shortcut="Del"
                          variant="outline"
                          onClick={deleteSelectedComponent}
                          testId="builder-delete-selected"
                        >
                          <Trash2Icon size={14} />
                        </ToolbarButton>
                      </div>
                    </div>

                    {selectedComponent.type === 'text' && (
                      <>
                        <InspectorSection title="Text">
                          <Textarea
                            id="text-content"
                            aria-label="Text"
                            data-builder-primary-field
                            value={selectedComponent.content}
                            onChange={(event) => updateSelectedComponent({ content: event.target.value })}
                            className="min-h-[84px] text-sm"
                          />
                          {renderTypographyControls(selectedComponent, 'text', (newFontSize) => {
                            // Auto-snap height: estimate wrapped lines at the new
                            // font and snap up to the next grid multiple so the
                            // box always contains the rendered text.
                            const availableWidth = Math.max(
                              1,
                              selectedComponent.width - 2 * BUILDER_CELL_VERTICAL_PADDING_PT,
                            );
                            const lineCount = typographyEstimateLineCount(
                              selectedComponent.content,
                              availableWidth,
                              newFontSize,
                            );
                            const newHeight = typographySnapHeightForFontSize(
                              newFontSize,
                              lineCount,
                              selectedComponent.lineHeight,
                            );
                            updateSelectedComponent({ fontSize: newFontSize, height: newHeight });
                          })}
                        </InspectorSection>
                        <InspectorSection title="Placement">
                          {renderRegionControls(selectedComponent)}
                        </InspectorSection>
                        {/*
                          Per-component translation mode. The select changes it
                          in place; Preview opens the dialog that shows the
                          component rendered in a chosen language at each mode.
                        */}
                        <InspectorSection title="Translation">
                          <div className="flex items-center gap-1.5">
                            <Select
                              value={selectedComponent.translationMode ?? DEFAULT_BUILDER_TRANSLATION_MODE}
                              onValueChange={(value) => updateSelectedComponent({ translationMode: value as BuilderTranslationMode })}
                            >
                              <SelectTrigger aria-label="Translation mode" className="h-8 min-w-0 flex-1 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="skip">Do not translate</SelectItem>
                                <SelectItem value="translate">Translate</SelectItem>
                                <SelectItem value="translate-with-original">Include English</SelectItem>
                              </SelectContent>
                            </Select>
                            <AnimateIcon asChild animateOnHover animateOnTap>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 shrink-0 gap-1.5 text-xs"
                                onClick={() => setTranslationSettingsTargetId(selectedComponent.id)}
                              >
                                <LanguagesIcon size={14} />
                                Preview
                              </Button>
                            </AnimateIcon>
                          </div>
                        </InspectorSection>
                      </>
                    )}

                    {selectedComponent.type === 'date' && (
                      <>
                        <InspectorSection title="Date">
                          <FieldRow label="Format">
                            <Select
                              value={selectedComponent.formatId ?? DEFAULT_DATE_FORMAT_ID}
                              onValueChange={(value) => updateSelectedComponent({ formatId: value as BuilderDateFormatId })}
                            >
                              <SelectTrigger data-testid="builder-date-format-select" aria-label="Date format" className="h-8 text-xs">
                                {/* Trigger shows the label only; the example line is for the open list. */}
                                <span className="truncate">
                                  {BUILDER_DATE_FORMATS.find((entry) => entry.id === (selectedComponent.formatId ?? DEFAULT_DATE_FORMAT_ID))?.label}
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                {BUILDER_DATE_FORMATS.map((entry) => (
                                  <SelectItem key={entry.id} value={entry.id}>
                                    <span className="flex flex-col text-left">
                                      <span>{entry.label}</span>
                                      <span className="text-xs text-muted-foreground">{entry.example}</span>
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FieldRow>
                          <FieldRow label="Shows">
                            <Segmented
                              ariaLabel="Date source"
                              testId="builder-date-mode-select"
                              value={selectedComponent.dateMode}
                              onChange={(dateMode) => updateSelectedComponent({ dateMode })}
                              options={[
                                { value: 'today', label: 'Today' },
                                { value: 'custom', label: 'Custom date' },
                              ]}
                            />
                          </FieldRow>
                          {selectedComponent.dateMode === 'custom' && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  data-testid="builder-date-custom-trigger"
                                  className="h-8 w-full justify-start gap-2 text-xs"
                                >
                                  <AnimateIcon asChild animateOnHover animateOnTap>
                                    <CalendarDaysIcon size={14} />
                                  </AnimateIcon>
                                  {selectedComponent.customDate
                                    ? formatBuilderDate(
                                      parseBuilderCustomDate(selectedComponent.customDate) ?? new Date(),
                                      selectedComponent.formatId ?? DEFAULT_DATE_FORMAT_ID,
                                    )
                                    : 'Pick a date'}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  captionLayout="dropdown"
                                  selected={parseBuilderCustomDate(selectedComponent.customDate) ?? undefined}
                                  onSelect={(date) => {
                                    if (!date) return;
                                    updateSelectedComponent({ customDate: toBuilderCustomDateIso(date) });
                                  }}
                                  fromYear={new Date().getFullYear() - 5}
                                  toYear={new Date().getFullYear() + 5}
                                />
                              </PopoverContent>
                            </Popover>
                          )}
                          {renderTypographyControls(selectedComponent, 'date', (newFontSize) => {
                            // Date renders a single resolved-date line. Snap
                            // height so the box contains the larger font.
                            const newHeight = typographySnapHeightForFontSize(
                              newFontSize,
                              1,
                              selectedComponent.lineHeight,
                            );
                            updateSelectedComponent({ fontSize: newFontSize, height: newHeight });
                          })}
                        </InspectorSection>
                        <InspectorSection title="Placement">
                          {renderRegionControls(selectedComponent)}
                        </InspectorSection>
                        <InspectorSection title="Translation">
                          <Select
                            value={selectedComponent.translationMode ?? DEFAULT_BUILDER_TRANSLATION_MODE}
                            onValueChange={(value) => updateSelectedComponent({ translationMode: value as BuilderTranslationMode })}
                          >
                            <SelectTrigger aria-label="Translation mode" className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="skip">Do not translate</SelectItem>
                              <SelectItem value="translate">Translate</SelectItem>
                              <SelectItem value="translate-with-original">Include English</SelectItem>
                            </SelectContent>
                          </Select>
                        </InspectorSection>
                      </>
                    )}

                    {selectedComponent.type === 'language-tag' && (
                      <>
                        <InspectorSection title="Language tag">
                          <FieldRow label="Shows">
                            <Select
                              value={selectedComponent.mode ?? DEFAULT_LANGUAGE_TAG_MODE}
                              onValueChange={(value) => updateSelectedComponent({ mode: value as BuilderLanguageTagMode })}
                            >
                              <SelectTrigger data-testid="builder-language-tag-mode-select" aria-label="Rendering option" className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(['hide-english', 'english', 'native', 'native-with-english'] as BuilderLanguageTagMode[]).map((mode) => (
                                  <SelectItem key={mode} value={mode}>
                                    {languageTagModeLabel(mode)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FieldRow>
                          {renderTypographyControls(selectedComponent, 'language-tag', (newFontSize) => {
                            const newHeight = typographySnapHeightForFontSize(
                              newFontSize,
                              1,
                              selectedComponent.lineHeight,
                            );
                            updateSelectedComponent({ fontSize: newFontSize, height: newHeight });
                          })}
                        </InspectorSection>
                        <InspectorSection title="Placement">
                          {renderRegionControls(selectedComponent)}
                        </InspectorSection>
                      </>
                    )}

                    {selectedComponent.type === 'line' && (
                      <InspectorSection title="Line">
                        <FieldRow label="Direction">
                          <Segmented
                            ariaLabel="Line direction"
                            value={selectedComponent.direction}
                            onChange={(direction) => updateSelectedComponent({ direction })}
                            options={[
                              { value: 'horizontal', label: 'Horizontal' },
                              { value: 'vertical', label: 'Vertical' },
                            ]}
                          />
                        </FieldRow>
                        <FieldRow label="Stroke (pt)" htmlFor="line-stroke">
                          <Input
                            id="line-stroke"
                            type="number"
                            className="h-8 text-xs md:text-xs"
                            value={selectedComponent.strokeWidth}
                            onChange={(event) => updateSelectedComponent({ strokeWidth: toNumber(event.target.value, selectedComponent.strokeWidth) })}
                          />
                        </FieldRow>
                        {renderRegionControls(selectedComponent)}
                      </InspectorSection>
                    )}

                    {selectedComponent.type === 'legend' && (
                      <>
                        <InspectorSection title="Legend">
                          {([
                            ['showLimited', 'limitedLabel', 'Limited'],
                            ['showClearance', 'clearanceLabel', 'Clearance'],
                          ] as const).map(([showKey, labelKey, entryName]) => (
                            <div key={showKey} className="flex items-center gap-2">
                              <Switch
                                id={`legend-${showKey}`}
                                aria-label={`Show "${entryName}" entry`}
                                checked={selectedComponent[showKey]}
                                onCheckedChange={(checked) => updateSelectedComponent({ [showKey]: checked })}
                              />
                              <Input
                                id={`legend-${labelKey}`}
                                aria-label={`${entryName} label`}
                                className="h-8 min-w-0 flex-1 text-xs md:text-xs"
                                value={selectedComponent[labelKey]}
                                onChange={(event) => updateSelectedComponent({ [labelKey]: event.target.value })}
                                disabled={!selectedComponent[showKey]}
                              />
                            </div>
                          ))}
                          <FieldRow label="Layout">
                            <Segmented
                              ariaLabel="Legend layout"
                              value={selectedComponent.layout}
                              onChange={(layout) => updateSelectedComponent({ layout })}
                              options={[
                                { value: 'horizontal', label: 'Horizontal' },
                                { value: 'vertical', label: 'Vertical' },
                              ]}
                            />
                          </FieldRow>
                          <FieldRow label="Font size" htmlFor="legend-font-size">
                            <Select
                              value={String(selectedComponent.fontSize)}
                              onValueChange={(value) => updateSelectedComponent({ fontSize: Number(value) })}
                            >
                              <SelectTrigger id="legend-font-size" className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {fontSizeOptions(selectedComponent.fontSize).map((size) => (
                                  <SelectItem key={String(size)} value={String(size)}>{size} pt</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FieldRow>
                        </InspectorSection>
                        <InspectorSection title="Placement">
                          {renderRegionControls(selectedComponent)}
                        </InspectorSection>
                      </>
                    )}

                    {selectedComponent.type === 'form-field-group' && (
                      <>
                        <InspectorSection
                          title={`Fields (${selectedComponent.fields.length})`}
                          action={(
                            <AnimateIcon asChild animateOnHover animateOnTap>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs"
                                onClick={() => {
                                  const fieldId = `${selectedComponent.id}-field-${Date.now()}`;
                                  updateSelectedComponent({
                                    fields: [...selectedComponent.fields, { id: fieldId, label: 'New Field' }],
                                  });
                                }}
                              >
                                <PlusIcon size={14} />
                                Add
                              </Button>
                            </AnimateIcon>
                          )}
                        >
                          <div className="divide-y overflow-hidden rounded-md border bg-background/40">
                            {selectedComponent.fields.map((field, index) => {
                              const fieldMode = field.translationMode ?? DEFAULT_BUILDER_TRANSLATION_MODE;
                              return (
                                <div key={field.id} className="flex items-center gap-0.5 p-0.5" data-testid="builder-form-field-row">
                                  <Input
                                    aria-label={`Field ${index + 1} label`}
                                    data-builder-primary-field={index === 0 ? '' : undefined}
                                    className="h-8 min-w-0 flex-1 text-xs md:text-xs border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-input focus-visible:bg-background dark:border-transparent dark:hover:border-input"
                                    value={field.label}
                                    onChange={(event) =>
                                      updateSelectedComponent({
                                        fields: selectedComponent.fields.map((current) =>
                                          current.id === field.id ? { ...current, label: event.target.value } : current,
                                        ),
                                      })
                                    }
                                  />
                                  <DropdownMenu modal={false}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Translation for ${field.label}: ${translationModeLabel(fieldMode)}`}
                                            className={cn(
                                              'h-8 w-8 shrink-0',
                                              fieldMode !== DEFAULT_BUILDER_TRANSLATION_MODE && 'text-primary',
                                            )}
                                          >
                                            <AnimateIcon animateOnHover animateOnTap>
                                              <LanguagesIcon size={14} />
                                            </AnimateIcon>
                                          </Button>
                                        </DropdownMenuTrigger>
                                      </TooltipTrigger>
                                      <TooltipContent side="left">Translation: {translationModeLabel(fieldMode)}</TooltipContent>
                                    </Tooltip>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>Translation</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuRadioGroup
                                        value={fieldMode}
                                        onValueChange={(value) =>
                                          updateSelectedComponent({
                                            fields: selectedComponent.fields.map((current) =>
                                              current.id === field.id
                                                ? { ...current, translationMode: value as BuilderTranslationMode }
                                                : current,
                                            ),
                                          })
                                        }
                                      >
                                        <DropdownMenuRadioItem value="skip">Do not translate</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="translate">Translate</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="translate-with-original">Include English</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="translate-with-original-block">Include English (with line break)</DropdownMenuRadioItem>
                                      </DropdownMenuRadioGroup>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  <ToolbarButton
                                    label="Remove field"
                                    tooltipSide="left"
                                    onClick={() =>
                                      updateSelectedComponent({
                                        fields: selectedComponent.fields.filter((current) => current.id !== field.id),
                                      })
                                    }
                                  >
                                    <Trash2Icon size={14} />
                                  </ToolbarButton>
                                </div>
                              );
                            })}
                          </div>
                        </InspectorSection>
                        <InspectorSection title="Appearance">
                          <FieldRow label="Font size" htmlFor="form-font-size">
                            <Select
                              value={String(selectedComponent.fontSize)}
                              onValueChange={(value) => updateSelectedComponent({ fontSize: Number(value) })}
                            >
                              <SelectTrigger id="form-font-size" className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {fontSizeOptions(selectedComponent.fontSize).map((size) => (
                                  <SelectItem key={String(size)} value={String(size)}>
                                    {size} pt
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FieldRow>
                          <FieldRow label="Label width (pt)" htmlFor="form-label-width">
                            <Input
                              id="form-label-width"
                              type="number"
                              className="h-8 text-xs md:text-xs"
                              value={selectedComponent.labelWidth}
                              onChange={(event) => updateSelectedComponent({ labelWidth: toNumber(event.target.value, selectedComponent.labelWidth) })}
                            />
                          </FieldRow>
                          <FieldRow label="Corners">
                            <Segmented
                              ariaLabel="Corner radius"
                              value={String(selectedComponent.cornerRadius ?? 0)}
                              onChange={(value) => updateSelectedComponent({ cornerRadius: Number(value) })}
                              options={CORNER_RADIUS_OPTIONS}
                            />
                          </FieldRow>
                          <SwitchRow
                            id="form-show-dividers"
                            label="Column dividers"
                            checked={selectedComponent.showColumnDividers !== false}
                            onCheckedChange={(checked) => updateSelectedComponent({ showColumnDividers: checked })}
                          />
                          <SwitchRow
                            id="form-show-borders"
                            label="Table & cell borders"
                            checked={selectedComponent.showBorders !== false}
                            onCheckedChange={(checked) => updateSelectedComponent({ showBorders: checked })}
                          />
                        </InspectorSection>
                        <InspectorSection title="Placement">
                          {renderRegionControls(selectedComponent)}
                        </InspectorSection>
                      </>
                    )}
                    {selectedComponent.type === 'section-table' && (() => {
                      // Grid squares are as narrow as split lanes, so the same
                      // section-table font-size ceiling applies.
                      const isSplit = bodyLayoutMode !== 'full';
                      const tableFontSizes = fontSizeOptions(
                        selectedComponent.fontSize,
                        isSplit ? SPLIT_PAGE_FONT_SIZES : BUILDER_FONT_SIZES,
                      );
                      const SPLIT_PAGE_HINT = `Split-page layout limits section-table sizes to ${SPLIT_PAGE_MAX_BUILDER_FONT_SIZE} pt. Switch to Full page to use larger sizes.`;
                      const translationSettings = resolveSectionTableTranslationSettings(selectedComponent.translationSettings);
                      const previewAdjustment = normalizeSectionTableTranslationHeightAdjustment(
                        selectedComponent.translationHeightAdjustments?.[previewLanguage],
                      );
                      const otherTableCount = template.components.filter((component) => (
                        component.type === 'section-table' && component.id !== selectedComponent.id
                      )).length;
                      return (
                        <>
                          <InspectorSection title="Table">
                            <Input
                              id="table-title"
                              aria-label="Title"
                              data-builder-primary-field={selectedComponent.inventorySource ? undefined : ''}
                              className="h-8 text-xs font-medium md:text-xs"
                              value={selectedComponent.title}
                              onChange={(event) => updateSelectedComponent({ title: event.target.value })}
                            />
                            {selectedComponent.inventorySource && (
                              <div className="flex items-center justify-between gap-2 rounded-md border translation-options-column py-1.5 pl-3 pr-1.5 text-xs">
                                <div className="min-w-0">
                                  <div className="truncate font-medium text-foreground">
                                    {selectedComponent.inventorySource.categoryName} category
                                  </div>
                                  <div className="truncate text-muted-foreground">
                                    {selectedComponent.categoryLimit && selectedComponent.categoryLimit > 0
                                      ? `${formatCategoryLimitTag(selectedComponent.categoryLimit, selectedComponent.categoryLimitType)}`
                                      : 'No category limit set'}
                                  </div>
                                </div>
                                <AnimateIcon asChild animateOnHover animateOnTap>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    data-testid="builder-edit-category-trigger"
                                    className="h-7 shrink-0 gap-1 px-2 text-xs"
                                    onClick={() => {
                                      if (selectedComponent.inventorySource) {
                                        setEditingCategoryId(selectedComponent.inventorySource.categoryId);
                                      }
                                    }}
                                  >
                                    <SettingsIcon size={14} />
                                    Edit
                                  </Button>
                                </AnimateIcon>
                              </div>
                            )}
                            <FieldRow label="Behavior">
                              <Segmented
                                ariaLabel="Table behavior"
                                testId="builder-table-flow-mode-select"
                                value={getSectionTableFlowMode(selectedComponent)}
                                onChange={(value) => updateSelectedComponent({
                                  flowMode: value,
                                  repeatHeaderRows: value === 'flowing' ? true : selectedComponent.repeatHeaderRows,
                                  keepHeaderWithFirstRow: value === 'flowing' ? true : selectedComponent.keepHeaderWithFirstRow,
                                  keepRowsTogether: value === 'flowing' ? true : selectedComponent.keepRowsTogether,
                                })}
                                options={[
                                  { value: 'flowing', label: 'Flowing', testId: 'builder-table-flow-flowing' },
                                  { value: 'fixed', label: 'Fixed', testId: 'builder-table-flow-fixed' },
                                ]}
                              />
                            </FieldRow>
                            {renderRegionControls(selectedComponent)}
                          </InspectorSection>

                          <InspectorSection
                            title="Columns & style"
                            action={otherTableCount > 0 ? (
                              <Tooltip>
                                {/* Span anchor: see ToolbarButton for why the trigger is not the button. */}
                                <TooltipTrigger asChild>
                                  <span className="inline-flex shrink-0">
                                  <AnimateIcon asChild animateOnHover animateOnTap>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      data-testid="builder-apply-table-style-to-all"
                                      className="h-7 shrink-0 gap-1 px-2 text-xs"
                                      onClick={applySelectedTableStyleToAllTables}
                                    >
                                      <Paintbrush size={14} />
                                      Apply to all
                                    </Button>
                                  </AnimateIcon>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-[220px] text-xs">
                                  Copy this table&apos;s columns and style to the {otherTableCount} other section {otherTableCount === 1 ? 'table' : 'tables'} on the page.
                                </TooltipContent>
                              </Tooltip>
                            ) : undefined}
                          >
                            <SwitchRow
                              id="table-show-limit"
                              label="Limit column"
                              checked={selectedComponent.showLimit}
                              onCheckedChange={(checked) => updateSelectedComponent({ showLimit: checked })}
                            />
                            {/*
                              Sub-options stay in place and disable when their
                              column is off. Removing them would shift every
                              switch below while the user is working down the list.
                            */}
                            <SwitchRow
                              id="table-show-global-limit"
                              indent
                              label={`Global Limit (${globalLimit}) for no-limit items`}
                              checked={selectedComponent.showLimit && selectedComponent.showGlobalLimit !== false}
                              disabled={!selectedComponent.showLimit}
                              onCheckedChange={(checked) => updateSelectedComponent({ showGlobalLimit: checked })}
                            />
                            <SwitchRow
                              id="table-show-want"
                              label="Want column"
                              checked={selectedComponent.showWant !== false}
                              onCheckedChange={(checked) => updateSelectedComponent({ showWant: checked })}
                            />
                            <SwitchRow
                              id="table-want-checkbox"
                              indent
                              label="Checkbox in Want column"
                              checked={selectedComponent.showWant !== false && resolveSectionTableWantControl(selectedComponent) === 'checkbox'}
                              disabled={selectedComponent.showWant === false}
                              onCheckedChange={(checked) => updateSelectedComponent({ wantControl: checked ? 'checkbox' : 'blank' })}
                            />
                            <SwitchRow
                              id="table-show-status-icons"
                              label="Status icons (Limited / Clearance)"
                              checked={selectedComponent.showStatusIcons === true}
                              onCheckedChange={(checked) => updateSelectedComponent({ showStatusIcons: checked })}
                            />
                            <SwitchRow
                              id="table-alternate-rows"
                              label="Alternate row shading"
                              checked={selectedComponent.alternateRows}
                              onCheckedChange={(checked) => updateSelectedComponent({ alternateRows: checked })}
                            />
                            <SwitchRow
                              id="table-show-borders"
                              label="Table & cell borders"
                              checked={selectedComponent.showBorders !== false}
                              onCheckedChange={(checked) => updateSelectedComponent({ showBorders: checked })}
                            />
                            <SwitchRow
                              id="table-show-dividers"
                              label="Column dividers"
                              checked={selectedComponent.showColumnDividers !== false}
                              onCheckedChange={(checked) => updateSelectedComponent({ showColumnDividers: checked })}
                            />
                            <FieldRow label="Font size" htmlFor="table-font-size">
                              {/*
                                Section-table font size is gated to <=12pt while
                                the body is in Split-page layout. The current
                                value is always listed even when it is outside
                                the active set; muted options explain why.
                              */}
                              <Select
                                value={String(selectedComponent.fontSize)}
                                onValueChange={(value) => updateSelectedComponent({ fontSize: Number(value) })}
                              >
                                <SelectTrigger id="table-font-size" className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {tableFontSizes.map((size) => {
                                    const muted = isSplit
                                      && size > SPLIT_PAGE_MAX_BUILDER_FONT_SIZE
                                      && size !== selectedComponent.fontSize;
                                    if (muted) {
                                      // Not SelectItem's `disabled`: its
                                      // pointer-events:none would suppress the
                                      // tooltip. The item is muted and its
                                      // selection intercepted instead.
                                      return (
                                        <Tooltip key={String(size)} delayDuration={200}>
                                          <TooltipTrigger asChild>
                                            <SelectItem
                                              value={String(size)}
                                              className="cursor-not-allowed opacity-50 focus:bg-transparent focus:text-foreground"
                                              onSelect={(event) => event.preventDefault()}
                                            >
                                              {size} pt
                                            </SelectItem>
                                          </TooltipTrigger>
                                          <TooltipContent side="left" sideOffset={8} className="max-w-[220px] text-xs">
                                            {SPLIT_PAGE_HINT}
                                          </TooltipContent>
                                        </Tooltip>
                                      );
                                    }
                                    return (
                                      <SelectItem key={String(size)} value={String(size)}>
                                        {size} pt
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </FieldRow>
                            <FieldRow label="Corners">
                              <Segmented
                                ariaLabel="Corner radius"
                                value={String(selectedComponent.cornerRadius ?? 0)}
                                onChange={(value) => updateSelectedComponent({ cornerRadius: Number(value) })}
                                options={CORNER_RADIUS_OPTIONS}
                              />
                            </FieldRow>
                            <div className="grid grid-cols-3 gap-1.5">
                              <GeometryInput
                                id="table-row-height"
                                prefix="Row"
                                label="Row height"
                                value={selectedComponent.rowHeight}
                                onChange={(raw) => updateSelectedComponent({ rowHeight: toNumber(raw, selectedComponent.rowHeight) })}
                              />
                              <GeometryInput
                                id="table-limit-width"
                                prefix="Limit"
                                label="Limit column width"
                                value={selectedComponent.limitWidth}
                                onChange={(raw) => updateSelectedComponent({ limitWidth: toNumber(raw, selectedComponent.limitWidth) })}
                                disabled={!selectedComponent.showLimit}
                              />
                              <GeometryInput
                                id="table-want-width"
                                prefix="Want"
                                label="Want column width"
                                value={selectedComponent.wantWidth}
                                onChange={(raw) => updateSelectedComponent({ wantWidth: toNumber(raw, selectedComponent.wantWidth) })}
                                disabled={selectedComponent.showWant === false}
                              />
                            </div>
                          </InspectorSection>

                          {/*
                            Translation Settings apply to every section table,
                            inventory-backed and base-component alike: both share
                            the `translationSettings` field and the Headers /
                            Tags / Rows render contract.
                          */}
                          <InspectorSection
                            title="Translation"
                            action={(
                              <AnimateIcon asChild animateOnHover animateOnTap>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 shrink-0 gap-1 px-2 text-xs"
                                  onClick={() => setSectionTableTranslationSettingsTargetId(selectedComponent.id)}
                                >
                                  <LanguagesIcon size={14} />
                                  Configure
                                </Button>
                              </AnimateIcon>
                            )}
                          >
                            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs">
                              <dt className="text-muted-foreground">Headers</dt>
                              <dd className="truncate">{translationModeLabel(translationSettings.headers)}</dd>
                              <dt className="text-muted-foreground">Tags</dt>
                              <dd className="truncate">{translationModeLabel(translationSettings.tags)}</dd>
                              <dt className="text-muted-foreground">Rows</dt>
                              <dd className="truncate">{translationModeLabel(translationSettings.rows)}</dd>
                            </dl>
                            {selectedComponent.inventorySource && previewLanguage && (
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 text-xs">
                                  <div className="font-medium">Preview height</div>
                                  <div className="truncate text-muted-foreground">
                                    {previewLanguage}: {previewAdjustment > 0 ? `+${previewAdjustment}` : previewAdjustment} grid squares
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-0.5">
                                  <ToolbarButton
                                    label="Decrease translated table preview height"
                                    variant="outline"
                                    tooltipSide="left"
                                    onClick={() => updateSelectedSectionTableTranslationHeightAdjustment(previewAdjustment - 1)}
                                  >
                                    <MinusIcon size={14} />
                                  </ToolbarButton>
                                  <ToolbarButton
                                    label="Reset translated table preview height"
                                    variant="outline"
                                    tooltipSide="left"
                                    disabled={previewAdjustment === 0}
                                    onClick={() => updateSelectedSectionTableTranslationHeightAdjustment(0)}
                                  >
                                    <RotateCcwIcon size={14} />
                                  </ToolbarButton>
                                  <ToolbarButton
                                    label="Increase translated table preview height"
                                    variant="outline"
                                    tooltipSide="left"
                                    onClick={() => updateSelectedSectionTableTranslationHeightAdjustment(previewAdjustment + 1)}
                                  >
                                    <PlusIcon size={14} />
                                  </ToolbarButton>
                                </div>
                              </div>
                            )}
                          </InspectorSection>

                          <InspectorSection
                            title={`Rows (${selectedComponent.rows.length})`}
                            collapsible
                            open={rowsOpen}
                            onOpenChange={setRowsOpen}
                            testId="builder-rows-section"
                            action={selectedComponent.inventorySource ? (
                              <DropdownMenu
                                onOpenChange={(open) => {
                                  if (open) {
                                    void refreshFoodItems();
                                  }
                                }}
                              >
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    data-testid="builder-add-inventory-row-trigger"
                                    className="h-7 shrink-0 gap-1 px-2 text-xs"
                                  >
                                    <AnimateIcon asChild animateOnHover animateOnTap>
                                      <PlusIcon size={14} />
                                    </AnimateIcon>
                                    Add
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-72">
                                  <DropdownMenuLabel>Add to {selectedComponent.title}</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <AnimateIcon asChild animateOnHover animateOnTap>
                                    <DropdownMenuItem
                                      data-testid="builder-add-new-food-item"
                                      onSelect={() => {
                                        if (!selectedComponent.inventorySource) return;
                                        const ctx = {
                                          categoryId: selectedComponent.inventorySource.categoryId,
                                          categoryName: selectedComponent.inventorySource.categoryName,
                                        };
                                        window.setTimeout(() => setAddItemContext(ctx), DROPDOWN_TO_DIALOG_OPEN_DELAY_MS);
                                      }}
                                    >
                                      <CirclePlusIcon size={16} className="mr-2" />
                                      Add new item
                                    </DropdownMenuItem>
                                  </AnimateIcon>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                    Mark back in stock
                                  </DropdownMenuLabel>
                                  {outOfStockItemsForCategory.length === 0 ? (
                                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                      No out-of-stock items in this category.
                                    </div>
                                  ) : (
                                    <ScrollArea className={cn(outOfStockItemsForCategory.length > 6 ? 'h-[180px] pr-2' : '')}>
                                      {outOfStockItemsForCategory.map((item) => (
                                        <AnimateIcon key={item.id} asChild animateOnHover animateOnTap>
                                          <DropdownMenuItem
                                            data-testid="builder-restock-out-of-stock-item"
                                            onSelect={() => {
                                              window.setTimeout(() => void handleAddOutOfStockItem(item), 0);
                                            }}
                                          >
                                            <PackageXIcon size={16} className="mr-2" />
                                            {item.name}
                                          </DropdownMenuItem>
                                        </AnimateIcon>
                                      ))}
                                    </ScrollArea>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <AnimateIcon asChild animateOnHover animateOnTap>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 shrink-0 gap-1 px-2 text-xs"
                                  onClick={() => {
                                    setRowsOpen(true);
                                    updateSelectedComponent({
                                      rows: [
                                        ...selectedComponent.rows,
                                        { id: `${selectedComponent.id}-row-${Date.now()}`, item: 'New item', limit: '' },
                                      ],
                                    });
                                  }}
                                >
                                  <PlusIcon size={14} />
                                  Add
                                </Button>
                              </AnimateIcon>
                            )}
                          >
                            {selectedComponent.rows.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                {selectedComponent.inventorySource
                                  ? 'No in-stock items in this category. Use Add to restock or create one.'
                                  : 'No rows yet. Use Add to create the first row.'}
                              </p>
                            ) : (
                              // Inline-edit list: fields read as plain rows until
                              // hovered or focused, so a 17-row table is a list
                              // to scan rather than a wall of input boxes.
                              <div className="divide-y overflow-hidden rounded-md border bg-background/40">
                                {selectedComponent.rows.map((row, index) => (
                                  <div key={row.id} className="flex items-start gap-0.5 p-0.5" data-testid="builder-section-row">
                                    <Textarea
                                      aria-label={`Row ${index + 1} item`}
                                      rows={1}
                                      value={row.item}
                                      onChange={(event) =>
                                        updateSelectedComponent({
                                          rows: selectedComponent.rows.map((current) =>
                                            current.id === row.id ? { ...current, item: event.target.value } : current,
                                          ),
                                        })
                                      }
                                      className="field-sizing-content min-h-8 min-w-0 flex-1 resize-none px-2.5 py-1.5 text-xs md:text-xs border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-input focus-visible:bg-background dark:border-transparent dark:hover:border-input"
                                    />
                                    <div className="relative w-[88px] shrink-0">
                                      <Input
                                        aria-label={`Row ${index + 1} limit (${limitSourceLabel(row)})`}
                                        value={row.limit}
                                        placeholder={row.foodItemId ? '' : 'Limit'}
                                        className={cn('h-8 px-2.5 text-xs md:text-xs border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-input focus-visible:bg-background dark:border-transparent dark:hover:border-input', row.foodItemId && 'pr-[52px]')}
                                        onChange={(event) =>
                                          updateSelectedComponent({
                                            rows: selectedComponent.rows.map((current) =>
                                              current.id === row.id ? { ...current, limit: event.target.value } : current,
                                            ),
                                          })
                                        }
                                        onBlur={(event) => {
                                          if (row.foodItemId) {
                                            void updateInventoryRowLimit(row, event.currentTarget.value);
                                          }
                                        }}
                                      />
                                      {row.foodItemId && (
                                        <span
                                          aria-hidden
                                          title={`Limit source: ${limitSourceLabel(row)}`}
                                          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground"
                                        >
                                          {limitSourceLabel(row)}
                                        </span>
                                      )}
                                    </div>
                                    {row.foodItemId ? (
                                      <SectionTableRowActionsMenu
                                        row={row}
                                        clearanceLabel={findFoodItemForRow(row)?.statusFlags.isClearance ? 'Clear Clearance' : 'Mark Clearance'}
                                        onEdit={() => handleEditInventoryRow(row)}
                                        onMarkOutOfStock={() => handleMarkOutOfStock(row)}
                                        onMarkClearance={() => handleMarkClearance(row)}
                                        onChangeCategory={() => handleOpenChangeCategory(row)}
                                        onDelete={() => handleOpenDeleteFoodItem(row)}
                                      />
                                    ) : (
                                      <ToolbarButton
                                        label="Remove row"
                                        tooltipSide="left"
                                        onClick={() =>
                                          updateSelectedComponent({
                                            rows: selectedComponent.rows.filter((current) => current.id !== row.id),
                                          })
                                        }
                                      >
                                        <Trash2Icon size={14} />
                                      </ToolbarButton>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </InspectorSection>
                        </>
                      );
                    })()}

                    {renderGeometrySection(selectedComponent)}
                  </>
                )}
              </div>
            </ScrollArea>
          </aside>
        </div>

        <Dialog
          open={renameSavedComponent != null}
          onOpenChange={(open) => {
            if (!open) {
              setRenameSavedComponent(null);
              setRenameSavedComponentName('');
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Saved Component</DialogTitle>
              <DialogDescription>
                Use a short name that helps staff recognize when this component belongs on a template.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void confirmRenameSavedComponent();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="saved-component-name">Name</Label>
                <Input
                  id="saved-component-name"
                  value={renameSavedComponentName}
                  onChange={(event) => setRenameSavedComponentName(event.target.value)}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRenameSavedComponent(null)}>
                  Cancel
                </Button>
                <Button type="submit">Rename</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={componentPendingDelete != null}
          onOpenChange={(open) => {
            if (!open && !isDeletingSavedComponent) {
              setComponentPendingDelete(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Saved Component</AlertDialogTitle>
              <AlertDialogDescription>
                This removes {componentPendingDelete?.name ?? 'this saved component'} from your saved component list.
                Templates that already contain a copy of it will not be changed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingSavedComponent}>Cancel</AlertDialogCancel>
              <AnimateIcon asChild animateOnHover animateOnTap>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isDeletingSavedComponent}
                  data-testid="confirm-delete-saved-component"
                  onClick={() => void confirmDeleteSavedComponent()}
                >
                  {isDeletingSavedComponent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2Icon size={16} />
                  )}
                  Delete
                </Button>
              </AnimateIcon>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <FoodItemEditDialog
          foodItem={editingFoodItem}
          open={editingFoodItem != null}
          onOpenChange={(open) => {
            if (!open) setEditingFoodItem(null);
          }}
          onSave={handleSaveEditedFoodItem}
          isLoading={isSavingFoodItem}
        />

        <AddFoodItemDialog
          open={addItemContext != null}
          onOpenChange={(open) => {
            if (!open) setAddItemContext(null);
          }}
          initialCategoryId={addItemContext?.categoryId}
          onSave={async (data) => {
            const success = await handleCreateFoodItem(data);
            if (success) setAddItemContext(null);
            return success;
          }}
          isLoading={isSavingFoodItem}
        />

        <CategoryEditDialog
          category={editingCategory}
          open={editingCategory != null}
          onOpenChange={(open) => {
            if (!open) setEditingCategoryId(null);
          }}
          onSave={handleSaveCategoryEdit}
          isLoading={isSavingCategory}
        />

        <Dialog
          open={changeCategoryItem != null}
          onOpenChange={(open) => {
            if (!open && !isChangingCategory) {
              setChangeCategoryItem(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5" />
                Change Category
              </DialogTitle>
              <DialogDescription>
                Move {changeCategoryItem?.name ?? 'this item'} to a different category.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="builder-change-category-select">New Category</Label>
              <Select value={changeCategoryTargetId} onValueChange={setChangeCategoryTargetId}>
                <SelectTrigger id="builder-change-category-select" data-testid="builder-change-category-select">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setChangeCategoryItem(null)}
                disabled={isChangingCategory}
              >
                Cancel
              </Button>
              <Button
                type="button"
                data-testid="builder-change-category-confirm"
                onClick={() => void confirmChangeCategory()}
                disabled={isChangingCategory || !changeCategoryTargetId}
              >
                {isChangingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Move Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={foodItemPendingDelete != null}
          onOpenChange={(open) => {
            if (!open && !isDeletingFoodItem) {
              setFoodItemPendingDelete(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Food Item</AlertDialogTitle>
              <AlertDialogDescription>
                Permanently delete {foodItemPendingDelete?.name ?? 'this food item'} from inventory.
                This will remove the item from every shopping list section that references it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingFoodItem}>Cancel</AlertDialogCancel>
              <AnimateIcon asChild animateOnHover animateOnTap>
                <Button
                  type="button"
                  variant="destructive"
                  data-testid="confirm-delete-food-item"
                  disabled={isDeletingFoodItem}
                  onClick={() => void confirmDeleteFoodItem()}
                >
                  {isDeletingFoodItem ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2Icon size={16} />
                  )}
                  Delete Item
                </Button>
              </AnimateIcon>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/*
          Per-component Translation Settings modal. Rendered conditionally so
          the dialog re-mounts (and resets its preview state) when the user
          opens it for a different text component. The dialog reads + writes
          `translationMode` on the selected text component via
          updateSelectedComponent; persistence is handled by the existing
          template-save pipeline (no schema migration, the field rides in
          templateData JSON).
        */}
        {translationSettingsTargetId && (() => {
          const target = template.components.find((c) => c.id === translationSettingsTargetId);
          if (!target || target.type !== 'text') return null;
          return (
            <TranslationSettingsDialog
              component={target}
              open
              onOpenChange={(next) => {
                if (!next) setTranslationSettingsTargetId(null);
              }}
              onSave={(mode) => {
                // Use the same single-component update path as every other
                // Properties-panel control so undo / history / save flows
                // pick up the change without special-casing.
                if (selectedId !== target.id) setSelectedId(target.id);
                updateSelectedComponent({ translationMode: mode } as Partial<TextBuilderComponent>);
              }}
            />
          );
        })()}

        {sectionTableTranslationSettingsTargetId && (() => {
          const target = template.components.find((c) => c.id === sectionTableTranslationSettingsTargetId);
          if (!target || target.type !== 'section-table') return null;
          return (
            <SectionTableTranslationSettingsDialog
              component={target}
              open
              onOpenChange={(next) => {
                if (!next) setSectionTableTranslationSettingsTargetId(null);
              }}
              onSave={(settings) => {
                if (selectedId !== target.id) setSelectedId(target.id);
                updateSelectedComponent({ translationSettings: settings } as Partial<SectionTableBuilderComponent>);
              }}
            />
          );
        })()}

        <Dialog
          open={missingPreviewTranslations != null}
          onOpenChange={(open) => {
            if (!open && !isUpdatingPreviewTranslations) {
              cancelPreviewTranslationUpdate();
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                Missing Preview Translations
              </DialogTitle>
              <DialogDescription>
                {missingPreviewTranslations ? (
                  <>
                    {missingPreviewTranslations.missingStrings.length}
                    {' text '}
                    {missingPreviewTranslations.missingStrings.length === 1 ? 'block needs' : 'blocks need'}
                    {' '}
                    {missingPreviewTranslations.language}
                    {' translations before the canvas can preview this language.'}
                  </>
                ) : (
                  'Some text blocks need translations before the canvas can preview this language.'
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border translation-options-column p-3 text-sm text-muted-foreground">
              Update Translations will use the existing Shopping List Builder
              translation pipeline and cache the missing text. Cancel returns
              the preview dropdown to English.
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={cancelPreviewTranslationUpdate}
                disabled={isUpdatingPreviewTranslations}
              >
                Cancel
              </Button>
              <AnimateIcon asChild animateOnHover animateOnTap>
                <Button
                  onClick={() => void updatePreviewTranslations()}
                  disabled={isUpdatingPreviewTranslations}
                >
                  {isUpdatingPreviewTranslations ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LanguagesIcon size={16} />
                  )}
                  Update Translations
                </Button>
              </AnimateIcon>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </TooltipProvider>
    </PreviewLanguageContext.Provider>
  );
}
