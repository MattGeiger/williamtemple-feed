"use client";

import * as React from "react";
import type { LucideProps } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "motion/react";

import { BotIcon as AnimateBotIcon } from "@/components/animate-ui/icons/bot";
import { GaugeIcon as AnimateGaugeIcon } from "@/components/animate-ui/icons/gauge";
import { __iconNode as ActivityNode } from "lucide-react/dist/esm/icons/activity.js";
import { __iconNode as AlertCircleNode } from "lucide-react/dist/esm/icons/circle-alert.js";
import { __iconNode as AlertTriangleNode } from "lucide-react/dist/esm/icons/triangle-alert.js";
import { __iconNode as AlignLeftNode } from "lucide-react/dist/esm/icons/align-left.js";
import { __iconNode as AppleNode } from "lucide-react/dist/esm/icons/apple.js";
import { __iconNode as ArrowLeftNode } from "lucide-react/dist/esm/icons/arrow-left.js";
import { __iconNode as ArrowLeftRightNode } from "lucide-react/dist/esm/icons/arrow-left-right.js";
import { __iconNode as ArrowUpDownNode } from "lucide-react/dist/esm/icons/arrow-up-down.js";
import { __iconNode as AudioWaveformNode } from "lucide-react/dist/esm/icons/audio-waveform.js";
import { __iconNode as BanNode } from "lucide-react/dist/esm/icons/ban.js";
import { __iconNode as BarChartNode } from "lucide-react/dist/esm/icons/chart-no-axes-column-increasing.js";
import { __iconNode as BarChart3Node } from "lucide-react/dist/esm/icons/chart-column.js";
import { __iconNode as BeefNode } from "lucide-react/dist/esm/icons/beef.js";
import { __iconNode as BellNode } from "lucide-react/dist/esm/icons/bell.js";
import { __iconNode as BellDotNode } from "lucide-react/dist/esm/icons/bell-dot.js";
import { __iconNode as BlocksNode } from "lucide-react/dist/esm/icons/blocks.js";
import { __iconNode as BookOpenNode } from "lucide-react/dist/esm/icons/book-open.js";
import { __iconNode as BookmarkNode } from "lucide-react/dist/esm/icons/bookmark.js";
import { __iconNode as BoxNode } from "lucide-react/dist/esm/icons/box.js";
import { __iconNode as BrainNode } from "lucide-react/dist/esm/icons/brain.js";
import { __iconNode as CalendarNode } from "lucide-react/dist/esm/icons/calendar.js";
import { __iconNode as CalendarDaysNode } from "lucide-react/dist/esm/icons/calendar-days.js";
import { __iconNode as CarrotNode } from "lucide-react/dist/esm/icons/carrot.js";
import { __iconNode as CheckNode } from "lucide-react/dist/esm/icons/check.js";
import { __iconNode as CheckCircleNode } from "lucide-react/dist/esm/icons/circle-check-big.js";
import { __iconNode as CheckCircle2Node } from "lucide-react/dist/esm/icons/circle-check.js";
import { __iconNode as CheckSquareNode } from "lucide-react/dist/esm/icons/square-check-big.js";
import { __iconNode as ChevronDownNode } from "lucide-react/dist/esm/icons/chevron-down.js";
import { __iconNode as ChevronLeftNode } from "lucide-react/dist/esm/icons/chevron-left.js";
import { __iconNode as ChevronRightNode } from "lucide-react/dist/esm/icons/chevron-right.js";
import { __iconNode as ChevronUpNode } from "lucide-react/dist/esm/icons/chevron-up.js";
import { __iconNode as ChevronsUpDownNode } from "lucide-react/dist/esm/icons/chevrons-up-down.js";
import { __iconNode as CircleNode } from "lucide-react/dist/esm/icons/circle.js";
import { __iconNode as CircleDollarSignNode } from "lucide-react/dist/esm/icons/circle-dollar-sign.js";
import { __iconNode as CircleHelpNode } from "lucide-react/dist/esm/icons/circle-question-mark.js";
import { __iconNode as CirclePlusNode } from "lucide-react/dist/esm/icons/circle-plus.js";
import { __iconNode as ClipboardPenLineNode } from "lucide-react/dist/esm/icons/clipboard-pen-line.js";
import { __iconNode as ClockNode } from "lucide-react/dist/esm/icons/clock.js";
import { __iconNode as CoinsNode } from "lucide-react/dist/esm/icons/coins.js";
import { __iconNode as Columns2Node } from "lucide-react/dist/esm/icons/columns-2.js";
import { __iconNode as CommandNode } from "lucide-react/dist/esm/icons/command.js";
import { __iconNode as CopyNode } from "lucide-react/dist/esm/icons/copy.js";
import { __iconNode as CpuNode } from "lucide-react/dist/esm/icons/cpu.js";
import { __iconNode as DatabaseNode } from "lucide-react/dist/esm/icons/database.js";
import { __iconNode as DollarSignNode } from "lucide-react/dist/esm/icons/dollar-sign.js";
import { __iconNode as DownloadNode } from "lucide-react/dist/esm/icons/download.js";
import { __iconNode as EditNode } from "lucide-react/dist/esm/icons/square-pen.js";
import { __iconNode as Edit3Node } from "lucide-react/dist/esm/icons/pen-line.js";
import { __iconNode as EggNode } from "lucide-react/dist/esm/icons/egg.js";
import { __iconNode as EyeNode } from "lucide-react/dist/esm/icons/eye.js";
import { __iconNode as EyeOffNode } from "lucide-react/dist/esm/icons/eye-off.js";
import { __iconNode as FileCheckNode } from "lucide-react/dist/esm/icons/file-check.js";
import { __iconNode as FileDownNode } from "lucide-react/dist/esm/icons/file-down.js";
import { __iconNode as FileIconNode } from "lucide-react/dist/esm/icons/file.js";
import { __iconNode as FileOutputNode } from "lucide-react/dist/esm/icons/file-output.js";
import { __iconNode as FileSearchNode } from "lucide-react/dist/esm/icons/file-search.js";
import { __iconNode as FileTextNode } from "lucide-react/dist/esm/icons/file-text.js";
import { __iconNode as FileUpNode } from "lucide-react/dist/esm/icons/file-up.js";
import { __iconNode as FileWarningNode } from "lucide-react/dist/esm/icons/file-warning.js";
import { __iconNode as FileXNode } from "lucide-react/dist/esm/icons/file-x.js";
import { __iconNode as FilesNode } from "lucide-react/dist/esm/icons/files.js";
import { __iconNode as FilterNode } from "lucide-react/dist/esm/icons/funnel.js";
import { __iconNode as FolderNode } from "lucide-react/dist/esm/icons/folder.js";
import { __iconNode as FolderArchiveNode } from "lucide-react/dist/esm/icons/folder-archive.js";
import { __iconNode as FolderCheckNode } from "lucide-react/dist/esm/icons/folder-check.js";
import { __iconNode as FolderSyncNode } from "lucide-react/dist/esm/icons/folder-sync.js";
import { __iconNode as FormInputNode } from "lucide-react/dist/esm/icons/rectangle-ellipsis.js";
import { __iconNode as ForwardNode } from "lucide-react/dist/esm/icons/forward.js";
import { __iconNode as FrameNode } from "lucide-react/dist/esm/icons/frame.js";
import { __iconNode as GalleryVerticalEndNode } from "lucide-react/dist/esm/icons/gallery-vertical-end.js";
import { __iconNode as GlobeNode } from "lucide-react/dist/esm/icons/globe.js";
import { __iconNode as Globe2Node } from "lucide-react/dist/esm/icons/earth.js";
import { __iconNode as GlobeLockNode } from "lucide-react/dist/esm/icons/globe-lock.js";
import { __iconNode as Grid2x2CheckNode } from "lucide-react/dist/esm/icons/grid-2x2-check.js";
import { __iconNode as Grid3x3Node } from "lucide-react/dist/esm/icons/grid-3x3.js";
import { __iconNode as GripVerticalNode } from "lucide-react/dist/esm/icons/grip-vertical.js";
import { __iconNode as HashNode } from "lucide-react/dist/esm/icons/hash.js";
import { __iconNode as HistoryNode } from "lucide-react/dist/esm/icons/history.js";
import { __iconNode as HomeNode } from "lucide-react/dist/esm/icons/house.js";
import { __iconNode as InfoNode } from "lucide-react/dist/esm/icons/info.js";
import { __iconNode as KeyNode } from "lucide-react/dist/esm/icons/key.js";
import { __iconNode as KeyRoundNode } from "lucide-react/dist/esm/icons/key-round.js";
import { __iconNode as LanguagesNode } from "lucide-react/dist/esm/icons/languages.js";
import { __iconNode as LayoutGridNode } from "lucide-react/dist/esm/icons/layout-grid.js";
import { __iconNode as LayoutTemplateNode } from "lucide-react/dist/esm/icons/layout-template.js";
import { __iconNode as LibraryNode } from "lucide-react/dist/esm/icons/library.js";
import { __iconNode as LineChartNode } from "lucide-react/dist/esm/icons/chart-line.js";
import { __iconNode as ListNode } from "lucide-react/dist/esm/icons/list.js";
import { __iconNode as ListFilterNode } from "lucide-react/dist/esm/icons/list-filter.js";
import { __iconNode as ListPlusNode } from "lucide-react/dist/esm/icons/list-plus.js";
import { __iconNode as Loader2Node } from "lucide-react/dist/esm/icons/loader-circle.js";
import { __iconNode as LogOutNode } from "lucide-react/dist/esm/icons/log-out.js";
import { __iconNode as MailNode } from "lucide-react/dist/esm/icons/mail.js";
import { __iconNode as MapNode } from "lucide-react/dist/esm/icons/map.js";
import { __iconNode as Maximize2Node } from "lucide-react/dist/esm/icons/maximize-2.js";
import { __iconNode as MessageSquareMoreNode } from "lucide-react/dist/esm/icons/message-square-more.js";
import { __iconNode as MessageSquareQuoteNode } from "lucide-react/dist/esm/icons/message-square-quote.js";
import { __iconNode as MinusNode } from "lucide-react/dist/esm/icons/minus.js";
import { __iconNode as MoonStarNode } from "lucide-react/dist/esm/icons/moon-star.js";
import { __iconNode as MoreHorizontalNode } from "lucide-react/dist/esm/icons/ellipsis.js";
import { __iconNode as PackageNode } from "lucide-react/dist/esm/icons/package.js";
import { __iconNode as Package2Node } from "lucide-react/dist/esm/icons/package-2.js";
import { __iconNode as PackageXNode } from "lucide-react/dist/esm/icons/package-x.js";
import { __iconNode as PanelLeftNode } from "lucide-react/dist/esm/icons/panel-left.js";
import { __iconNode as PencilNode } from "lucide-react/dist/esm/icons/pencil.js";
import { __iconNode as PersonStandingNode } from "lucide-react/dist/esm/icons/person-standing.js";
import { __iconNode as PieChartNode } from "lucide-react/dist/esm/icons/chart-pie.js";
import { __iconNode as PlusNode } from "lucide-react/dist/esm/icons/plus.js";
import { __iconNode as PrinterNode } from "lucide-react/dist/esm/icons/printer.js";
import { __iconNode as RefreshCwNode } from "lucide-react/dist/esm/icons/refresh-cw.js";
import { __iconNode as RotateCcwNode } from "lucide-react/dist/esm/icons/rotate-ccw.js";
import { __iconNode as SaveNode } from "lucide-react/dist/esm/icons/save.js";
import { __iconNode as SearchNode } from "lucide-react/dist/esm/icons/search.js";
import { __iconNode as SearchCheckNode } from "lucide-react/dist/esm/icons/search-check.js";
import { __iconNode as ServerNode } from "lucide-react/dist/esm/icons/server.js";
import { __iconNode as SettingsNode } from "lucide-react/dist/esm/icons/settings.js";
import { __iconNode as Settings2Node } from "lucide-react/dist/esm/icons/settings-2.js";
import { __iconNode as ShapesNode } from "lucide-react/dist/esm/icons/shapes.js";
import { __iconNode as ShieldNode } from "lucide-react/dist/esm/icons/shield.js";
import { __iconNode as ShieldCheckNode } from "lucide-react/dist/esm/icons/shield-check.js";
import { __iconNode as ShoppingBagNode } from "lucide-react/dist/esm/icons/shopping-bag.js";
import { __iconNode as ShoppingCartNode } from "lucide-react/dist/esm/icons/shopping-cart.js";
import { __iconNode as SlidersNode } from "lucide-react/dist/esm/icons/sliders-vertical.js";
import { __iconNode as SnowflakeNode } from "lucide-react/dist/esm/icons/snowflake.js";
import { __iconNode as SoupNode } from "lucide-react/dist/esm/icons/soup.js";
import { __iconNode as SproutNode } from "lucide-react/dist/esm/icons/sprout.js";
import { __iconNode as SquareDashedMousePointerNode } from "lucide-react/dist/esm/icons/square-dashed-mouse-pointer.js";
import { __iconNode as SquarePenNode } from "lucide-react/dist/esm/icons/square-pen.js";
import { __iconNode as SquareTerminalNode } from "lucide-react/dist/esm/icons/square-terminal.js";
import { __iconNode as StarNode } from "lucide-react/dist/esm/icons/star.js";
import { __iconNode as StickyNoteNode } from "lucide-react/dist/esm/icons/sticky-note.js";
import { __iconNode as Table2Node } from "lucide-react/dist/esm/icons/table-2.js";
import { __iconNode as TagNode } from "lucide-react/dist/esm/icons/tag.js";
import { __iconNode as TextIconNode } from "lucide-react/dist/esm/icons/text.js";
import { __iconNode as TimerNode } from "lucide-react/dist/esm/icons/timer.js";
import { __iconNode as ToggleLeftNode } from "lucide-react/dist/esm/icons/toggle-left.js";
import { __iconNode as ToggleRightNode } from "lucide-react/dist/esm/icons/toggle-right.js";
import { __iconNode as Trash2Node } from "lucide-react/dist/esm/icons/trash-2.js";
import { __iconNode as TrendingUpNode } from "lucide-react/dist/esm/icons/trending-up.js";
import { __iconNode as TriangleAlertNode } from "lucide-react/dist/esm/icons/triangle-alert.js";
import { __iconNode as TypeNode } from "lucide-react/dist/esm/icons/type.js";
import { __iconNode as TypeOutlineNode } from "lucide-react/dist/esm/icons/type-outline.js";
import { __iconNode as UndoNode } from "lucide-react/dist/esm/icons/undo.js";
import { __iconNode as Undo2Node } from "lucide-react/dist/esm/icons/undo-2.js";
import { __iconNode as UploadNode } from "lucide-react/dist/esm/icons/upload.js";
import { __iconNode as UserNode } from "lucide-react/dist/esm/icons/user.js";
import { __iconNode as UtensilsCrossedNode } from "lucide-react/dist/esm/icons/utensils-crossed.js";
import { __iconNode as VeganNode } from "lucide-react/dist/esm/icons/vegan.js";
import { __iconNode as WheatOffNode } from "lucide-react/dist/esm/icons/wheat-off.js";
import { __iconNode as XNode } from "lucide-react/dist/esm/icons/x.js";
import { __iconNode as XCircleNode } from "lucide-react/dist/esm/icons/circle-x.js";
import { __iconNode as ZapNode } from "lucide-react/dist/esm/icons/zap.js";

type IconNode = ReadonlyArray<readonly [string, Record<string, string | number>]>;
type MotionSvgElement = typeof motion.path;
type FallbackKind = "draw" | "slide" | "scale" | "pulse" | "fade" | "spin";

type SvgPrimitive = "path" | "circle" | "line" | "polyline" | "polygon" | "rect";

const motionElements: Record<SvgPrimitive, MotionSvgElement> = {
  path: motion.path,
  circle: motion.circle,
  line: motion.line,
  polyline: motion.polyline,
  polygon: motion.polygon,
  rect: motion.rect,
};

const DEFAULT_SIZE = 24;

const curatedFallbackKinds: Record<string, FallbackKind> = {
  AlertCircle: "pulse",
  AlertTriangle: "pulse",
  Bell: "slide",
  BellDot: "slide",
  Check: "draw",
  CheckCircle: "draw",
  CheckCircle2: "draw",
  ChevronDown: "slide",
  ChevronLeft: "slide",
  ChevronRight: "slide",
  ChevronUp: "slide",
  Download: "slide",
  FileText: "draw",
  Languages: "slide",
  Loader2: "spin",
  Package: "scale",
  RefreshCw: "spin",
  Search: "draw",
  Settings: "spin",
  Trash2: "slide",
  Upload: "slide",
  X: "draw",
  XCircle: "draw",
};

const fallbackCycle: FallbackKind[] = ["draw", "slide", "scale", "pulse", "fade"];

function hashIconName(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function fallbackKindForIcon(name: string): FallbackKind {
  if (curatedFallbackKinds[name]) return curatedFallbackKinds[name];
  if (name.startsWith("Chevron") || name.startsWith("Arrow")) return "slide";
  if (name.includes("Check") || name.includes("Edit") || name.includes("Pencil")) return "draw";
  if (name.includes("Alert") || name.includes("Info")) return "pulse";
  if (name.includes("Refresh") || name.includes("Rotate")) return "spin";
  return fallbackCycle[hashIconName(name) % fallbackCycle.length];
}

function primitiveVariants(kind: FallbackKind, tag: string, index: number, total: number): Variants {
  const delay = Math.min(index * 0.055, 0.28);
  const baseTransition = { duration: 0.72, ease: [0.22, 1, 0.36, 1], delay };
  const side = index % 2 === 0 ? -1 : 1;

  if (kind === "draw" && tag !== "circle") {
    return {
      hidden: { opacity: 0, pathLength: 0, pathOffset: 0.08 },
      visible: { opacity: 1, pathLength: 1, pathOffset: 0, transition: baseTransition },
    };
  }

  if (kind === "slide") {
    return {
      hidden: { opacity: 0, x: side * 2.5, y: total > 2 ? (index - total / 2) * 0.45 : 0 },
      visible: { opacity: 1, x: 0, y: 0, transition: baseTransition },
    };
  }

  if (kind === "scale") {
    return {
      hidden: { opacity: 0, scale: 0.72, transformOrigin: "center" },
      visible: { opacity: 1, scale: 1, transition: baseTransition },
    };
  }

  if (kind === "pulse") {
    return {
      hidden: { opacity: 0.2, scale: 0.86, transformOrigin: "center" },
      visible: {
        opacity: 1,
        scale: [0.86, 1.08, 1],
        transition: { ...baseTransition, duration: 0.84 },
      },
    };
  }

  if (kind === "spin") {
    return {
      hidden: { opacity: 0, rotate: -35, transformOrigin: "center" },
      visible: { opacity: 1, rotate: 0, transition: baseTransition },
    };
  }

  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: baseTransition },
  };
}

function iconHoverForKind(kind: FallbackKind) {
  if (kind === "spin") return { rotate: 12, scale: 1.08 };
  if (kind === "slide") return { x: 1, y: -1, scale: 1.08 };
  if (kind === "pulse") return { scale: 1.12 };
  return { y: -1, scale: 1.1 };
}

function createFallbackIcon(iconName: string, iconNode: IconNode) {
  const FallbackIcon = React.forwardRef<SVGSVGElement, LucideProps>(
    (
      {
        color = "currentColor",
        size = DEFAULT_SIZE,
        strokeWidth = 2,
        absoluteStrokeWidth,
        children,
        className,
        ...props
      },
      ref
    ) => {
      const shouldReduceMotion = useReducedMotion();
      const kind = fallbackKindForIcon(iconName);
      const numericSize = typeof size === "number" ? size : DEFAULT_SIZE;
      const finalStrokeWidth = absoluteStrokeWidth
        ? (Number(strokeWidth) * DEFAULT_SIZE) / numericSize
        : strokeWidth;

      return (
        <motion.svg
          ref={ref}
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={finalStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          data-feed-animated-icon="true"
          data-feed-no-icon-motion="true"
          initial={shouldReduceMotion ? false : "hidden"}
          animate="visible"
          whileHover={shouldReduceMotion ? undefined : iconHoverForKind(kind)}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
          transition={{ type: "spring", stiffness: 320, damping: 20 }}
          {...props}
        >
          {iconNode.map(([tag, attrs], index) => {
            const MotionElement = motionElements[tag as SvgPrimitive] ?? motion.path;
            return (
              <MotionElement
                key={String(attrs.key ?? iconName + "-" + index)}
                {...attrs}
                variants={primitiveVariants(kind, tag, index, iconNode.length)}
              />
            );
          })}
          {children}
        </motion.svg>
      );
    }
  );

  FallbackIcon.displayName = iconName;
  return FallbackIcon;
}

function createAnimateUiIcon<T extends React.ComponentType<any>>(
  iconName: string,
  Icon: T,
  defaults: Record<string, unknown> = {}
) {
  const SourcedIcon = React.forwardRef<SVGSVGElement, LucideProps>(
    ({ size = 24, className, ...props }, ref) => (
      <Icon
        ref={ref}
        size={size}
        className={className}
        data-feed-animated-icon="true"
        data-feed-no-icon-motion="true"
        {...defaults}
        {...props}
      />
    )
  );

  SourcedIcon.displayName = iconName;
  return SourcedIcon;
}

export const Activity = createFallbackIcon("Activity", ActivityNode);
export const AlertCircle = createFallbackIcon("AlertCircle", AlertCircleNode);
export const AlertTriangle = createFallbackIcon("AlertTriangle", AlertTriangleNode);
export const AlignLeft = createFallbackIcon("AlignLeft", AlignLeftNode);
export const Apple = createFallbackIcon("Apple", AppleNode);
export const ArrowLeft = createFallbackIcon("ArrowLeft", ArrowLeftNode);
export const ArrowLeftRight = createFallbackIcon("ArrowLeftRight", ArrowLeftRightNode);
export const ArrowUpDown = createFallbackIcon("ArrowUpDown", ArrowUpDownNode);
export const AudioWaveform = createFallbackIcon("AudioWaveform", AudioWaveformNode);
export const Ban = createFallbackIcon("Ban", BanNode);
export const BarChart = createFallbackIcon("BarChart", BarChartNode);
export const BarChart3 = createFallbackIcon("BarChart3", BarChart3Node);
export const Beef = createFallbackIcon("Beef", BeefNode);
export const Bell = createFallbackIcon("Bell", BellNode);
export const BellDot = createFallbackIcon("BellDot", BellDotNode);
export const Blocks = createFallbackIcon("Blocks", BlocksNode);
export const BookOpen = createFallbackIcon("BookOpen", BookOpenNode);
export const Bookmark = createFallbackIcon("Bookmark", BookmarkNode);
export const Bot = createAnimateUiIcon("Bot", AnimateBotIcon, { animateOnHover: "blink", animateOnTap: "wink", animateOnView: true });
export const Box = createFallbackIcon("Box", BoxNode);
export const Brain = createFallbackIcon("Brain", BrainNode);
export const Calendar = createFallbackIcon("Calendar", CalendarNode);
export const CalendarDays = createFallbackIcon("CalendarDays", CalendarDaysNode);
export const Carrot = createFallbackIcon("Carrot", CarrotNode);
export const Check = createFallbackIcon("Check", CheckNode);
export const CheckCircle = createFallbackIcon("CheckCircle", CheckCircleNode);
export const CheckCircle2 = createFallbackIcon("CheckCircle2", CheckCircle2Node);
export const CheckSquare = createFallbackIcon("CheckSquare", CheckSquareNode);
export const ChevronDown = createFallbackIcon("ChevronDown", ChevronDownNode);
export const ChevronLeft = createFallbackIcon("ChevronLeft", ChevronLeftNode);
export const ChevronRight = createFallbackIcon("ChevronRight", ChevronRightNode);
export const ChevronUp = createFallbackIcon("ChevronUp", ChevronUpNode);
export const ChevronsUpDown = createFallbackIcon("ChevronsUpDown", ChevronsUpDownNode);
export const Circle = createFallbackIcon("Circle", CircleNode);
export const CircleDollarSign = createFallbackIcon("CircleDollarSign", CircleDollarSignNode);
export const CircleHelp = createFallbackIcon("CircleHelp", CircleHelpNode);
export const CirclePlus = createFallbackIcon("CirclePlus", CirclePlusNode);
export const ClipboardPenLine = createFallbackIcon("ClipboardPenLine", ClipboardPenLineNode);
export const Clock = createFallbackIcon("Clock", ClockNode);
export const Coins = createFallbackIcon("Coins", CoinsNode);
export const Columns2 = createFallbackIcon("Columns2", Columns2Node);
export const Command = createFallbackIcon("Command", CommandNode);
export const Copy = createFallbackIcon("Copy", CopyNode);
export const Cpu = createFallbackIcon("Cpu", CpuNode);
export const Database = createFallbackIcon("Database", DatabaseNode);
export const DollarSign = createFallbackIcon("DollarSign", DollarSignNode);
export const Download = createFallbackIcon("Download", DownloadNode);
export const Edit = createFallbackIcon("Edit", EditNode);
export const Edit3 = createFallbackIcon("Edit3", Edit3Node);
export const Egg = createFallbackIcon("Egg", EggNode);
export const Eye = createFallbackIcon("Eye", EyeNode);
export const EyeOff = createFallbackIcon("EyeOff", EyeOffNode);
export const FileCheck = createFallbackIcon("FileCheck", FileCheckNode);
export const FileDown = createFallbackIcon("FileDown", FileDownNode);
export const FileIcon = createFallbackIcon("FileIcon", FileIconNode);
export const FileOutput = createFallbackIcon("FileOutput", FileOutputNode);
export const FileSearch = createFallbackIcon("FileSearch", FileSearchNode);
export const FileText = createFallbackIcon("FileText", FileTextNode);
export const FileUp = createFallbackIcon("FileUp", FileUpNode);
export const FileWarning = createFallbackIcon("FileWarning", FileWarningNode);
export const FileX = createFallbackIcon("FileX", FileXNode);
export const Files = createFallbackIcon("Files", FilesNode);
export const Filter = createFallbackIcon("Filter", FilterNode);
export const Folder = createFallbackIcon("Folder", FolderNode);
export const FolderArchive = createFallbackIcon("FolderArchive", FolderArchiveNode);
export const FolderCheck = createFallbackIcon("FolderCheck", FolderCheckNode);
export const FolderSync = createFallbackIcon("FolderSync", FolderSyncNode);
export const FormInput = createFallbackIcon("FormInput", FormInputNode);
export const Forward = createFallbackIcon("Forward", ForwardNode);
export const Frame = createFallbackIcon("Frame", FrameNode);
export const GalleryVerticalEnd = createFallbackIcon("GalleryVerticalEnd", GalleryVerticalEndNode);
export const Gauge = createAnimateUiIcon("Gauge", AnimateGaugeIcon, { animateOnHover: true, animateOnTap: true, animateOnView: true });
export const Globe = createFallbackIcon("Globe", GlobeNode);
export const Globe2 = createFallbackIcon("Globe2", Globe2Node);
export const GlobeLock = createFallbackIcon("GlobeLock", GlobeLockNode);
export const Grid2x2Check = createFallbackIcon("Grid2x2Check", Grid2x2CheckNode);
export const Grid3x3 = createFallbackIcon("Grid3x3", Grid3x3Node);
export const GripVertical = createFallbackIcon("GripVertical", GripVerticalNode);
export const Hash = createFallbackIcon("Hash", HashNode);
export const History = createFallbackIcon("History", HistoryNode);
export const Home = createFallbackIcon("Home", HomeNode);
export const Info = createFallbackIcon("Info", InfoNode);
export const Key = createFallbackIcon("Key", KeyNode);
export const KeyRound = createFallbackIcon("KeyRound", KeyRoundNode);
export const Languages = createFallbackIcon("Languages", LanguagesNode);
export const LayoutGrid = createFallbackIcon("LayoutGrid", LayoutGridNode);
export const LayoutTemplate = createFallbackIcon("LayoutTemplate", LayoutTemplateNode);
export const Library = createFallbackIcon("Library", LibraryNode);
export const LineChart = createFallbackIcon("LineChart", LineChartNode);
export const List = createFallbackIcon("List", ListNode);
export const ListFilter = createFallbackIcon("ListFilter", ListFilterNode);
export const ListPlus = createFallbackIcon("ListPlus", ListPlusNode);
export const Loader2 = createFallbackIcon("Loader2", Loader2Node);
export const LogOut = createFallbackIcon("LogOut", LogOutNode);
export const Mail = createFallbackIcon("Mail", MailNode);
export const Map = createFallbackIcon("Map", MapNode);
export const Maximize2 = createFallbackIcon("Maximize2", Maximize2Node);
export const MessageSquareMore = createFallbackIcon("MessageSquareMore", MessageSquareMoreNode);
export const MessageSquareQuote = createFallbackIcon("MessageSquareQuote", MessageSquareQuoteNode);
export const Minus = createFallbackIcon("Minus", MinusNode);
export const MoonStar = createFallbackIcon("MoonStar", MoonStarNode);
export const MoreHorizontal = createFallbackIcon("MoreHorizontal", MoreHorizontalNode);
export const Package = createFallbackIcon("Package", PackageNode);
export const Package2 = createFallbackIcon("Package2", Package2Node);
export const PackageX = createFallbackIcon("PackageX", PackageXNode);
export const PanelLeft = createFallbackIcon("PanelLeft", PanelLeftNode);
export const Pencil = createFallbackIcon("Pencil", PencilNode);
export const PersonStanding = createFallbackIcon("PersonStanding", PersonStandingNode);
export const PieChart = createFallbackIcon("PieChart", PieChartNode);
export const Plus = createFallbackIcon("Plus", PlusNode);
export const Printer = createFallbackIcon("Printer", PrinterNode);
export const RefreshCw = createFallbackIcon("RefreshCw", RefreshCwNode);
export const RotateCcw = createFallbackIcon("RotateCcw", RotateCcwNode);
export const Save = createFallbackIcon("Save", SaveNode);
export const Search = createFallbackIcon("Search", SearchNode);
export const SearchCheck = createFallbackIcon("SearchCheck", SearchCheckNode);
export const Server = createFallbackIcon("Server", ServerNode);
export const Settings = createFallbackIcon("Settings", SettingsNode);
export const Settings2 = createFallbackIcon("Settings2", Settings2Node);
export const Shapes = createFallbackIcon("Shapes", ShapesNode);
export const Shield = createFallbackIcon("Shield", ShieldNode);
export const ShieldCheck = createFallbackIcon("ShieldCheck", ShieldCheckNode);
export const ShoppingBag = createFallbackIcon("ShoppingBag", ShoppingBagNode);
export const ShoppingCart = createFallbackIcon("ShoppingCart", ShoppingCartNode);
export const Sliders = createFallbackIcon("Sliders", SlidersNode);
export const Snowflake = createFallbackIcon("Snowflake", SnowflakeNode);
export const Soup = createFallbackIcon("Soup", SoupNode);
export const Sprout = createFallbackIcon("Sprout", SproutNode);
export const SquareDashedMousePointer = createFallbackIcon("SquareDashedMousePointer", SquareDashedMousePointerNode);
export const SquarePen = createFallbackIcon("SquarePen", SquarePenNode);
export const SquareTerminal = createFallbackIcon("SquareTerminal", SquareTerminalNode);
export const Star = createFallbackIcon("Star", StarNode);
export const StickyNote = createFallbackIcon("StickyNote", StickyNoteNode);
export const Table2 = createFallbackIcon("Table2", Table2Node);
export const Tag = createFallbackIcon("Tag", TagNode);
export const TextIcon = createFallbackIcon("TextIcon", TextIconNode);
export const Timer = createFallbackIcon("Timer", TimerNode);
export const ToggleLeft = createFallbackIcon("ToggleLeft", ToggleLeftNode);
export const ToggleRight = createFallbackIcon("ToggleRight", ToggleRightNode);
export const Trash2 = createFallbackIcon("Trash2", Trash2Node);
export const TrendingUp = createFallbackIcon("TrendingUp", TrendingUpNode);
export const TriangleAlert = createFallbackIcon("TriangleAlert", TriangleAlertNode);
export const Type = createFallbackIcon("Type", TypeNode);
export const TypeOutline = createFallbackIcon("TypeOutline", TypeOutlineNode);
export const Undo = createFallbackIcon("Undo", UndoNode);
export const Undo2 = createFallbackIcon("Undo2", Undo2Node);
export const Upload = createFallbackIcon("Upload", UploadNode);
export const User = createFallbackIcon("User", UserNode);
export const UtensilsCrossed = createFallbackIcon("UtensilsCrossed", UtensilsCrossedNode);
export const Vegan = createFallbackIcon("Vegan", VeganNode);
export const WheatOff = createFallbackIcon("WheatOff", WheatOffNode);
export const X = createFallbackIcon("X", XNode);
export const XCircle = createFallbackIcon("XCircle", XCircleNode);
export const Zap = createFallbackIcon("Zap", ZapNode);

export type { LucideIcon } from "lucide-react";
