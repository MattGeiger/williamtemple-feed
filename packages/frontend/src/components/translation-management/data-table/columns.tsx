import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, Languages } from "@/components/ui/icons";
import { SquarePenIcon } from "@/components/animate-ui/icons/square-pen";
import { Trash2Icon } from "@/components/animate-ui/icons/trash-2";
import { RotateCcwIcon } from "@/components/animate-ui/icons/rotate-ccw";
import { RefreshCwIcon } from "@/components/animate-ui/icons/refresh-cw";
import { TableActionMenu } from "@/components/ui/table-action-menu"
import { Translation, TranslationCapabilities } from "@/types/translation"
import { Checkbox } from "@/components/ui/checkbox"

import { ResponsiveTruncatedText } from "@/components/ui/responsive-truncated-text"
import { isValidLanguageName } from "@/config/language-config"

import { StatusBadge } from "@/components/shared/status-badge";
import { calculateColumnWidths, extractColumnSizes, getColumnWidthStyle } from "@/lib/table"

export interface TranslationActions {
  onEdit: (translation: Translation) => void
  onDelete: (translation: Translation) => void
  onRetry: (translation: Translation) => void
  onToggleOriginal?: (translation: Translation) => void
  // DEPRECATED (2025-09-01): Skip/Enable removed
  // onToggleSkip?: (translation: Translation) => void
  capabilities?: TranslationCapabilities
}

export const columns = ({ onEdit, onDelete, onRetry, onToggleOriginal, capabilities }: TranslationActions): ColumnDef<Translation>[] => {
  const columnDefinitions: ColumnDef<Translation>[] = [
  {
    id: "select",
    size: 10, // Fixed width for checkbox column
    enableSorting: false,
    enableHiding: true,
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
  },
  {
    accessorKey: "originalText",
    size: 250, // Responsive width for original text column
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Original Text
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const text = row.getValue("originalText") as string;
      
      return (
        <div className="min-w-0">
          <ResponsiveTruncatedText 
            text={text || ''} 
            title="View full original text"
            className="min-w-0"
          />
        </div>
      );
    }
  },
  {
    accessorKey: "translatedText",
    size: 250, // Responsive width for translated text column
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Translation Text
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const text = row.getValue("translatedText") as string;
      
      return (
        <div className="min-w-0">
          <ResponsiveTruncatedText 
            text={text || ''} 
            title="View full translated text"
            className="min-w-0"
          />
        </div>
      );
    },
  },
  {
    accessorKey: "language",
    size: 120, // Fixed width for language column
    enableHiding: true,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Language
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const language = row.getValue("language") as string;
      
      // The application now consistently uses language names
      // so we directly return the language value
      return language;
    }
  },
  {
    accessorKey: "type",
    size: 140, // Fixed width for type column
    enableHiding: true,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Type
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const type = row.getValue("type") as string
      // Format type for display - convert camelCase to Title Case with spaces
      let displayType = type
      if (type === 'FoodItem') displayType = 'Food Item'
      if (type === 'Generated') displayType = 'Generated (Document)'
      return displayType
    }
  },
  {
    accessorKey: "status",
    size: 120, // Fixed width for status column
    enableHiding: true,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Status
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as string || 'pending'  // Default to pending if undefined
      return (
        <div className="flex items-center">
          <StatusBadge
            label={status.charAt(0).toUpperCase() + status.slice(1)}
            status={status === 'completed' ? 'success' : status === 'failed' ? 'danger' : 'warning'}
          />
        </div>
      )
    }
  },
  {
    id: "actions",
    size: 120, // Fixed width for actions column
    enableHiding: false,
    header: "Actions",
    cell: ({ row }) => {
      const translation = row.original

      return (
        <TableActionMenu
          actions={[
            {
              label: "Edit",
              icon: SquarePenIcon,
              onClick: () => onEdit(translation)
            },
            {
              label: translation.status === 'completed' ? "Restart Translation" : "Retry Translation",
              icon: translation.status === 'completed' ? RotateCcwIcon : RefreshCwIcon,
              onClick: () => onRetry(translation),
              title: translation.status === 'completed' ? 
                "Restart a completed translation (creates new tokens)" : 
                translation.status === 'pending' ?
                "Reset and restart a pending translation" :
                "Retry a failed translation",
              variant: translation.status === 'completed' ? 'default' : translation.status === 'pending' ? 'secondary' : 'default'
            },
            onToggleOriginal && (
              // Gate Include/Remove English by capabilities
              (!capabilities || capabilities[translation.type]?.some(a => a === 'includeOriginal' || a === 'removeOriginal'))
            ) && {
              // Determine whether text already has English included by checking if it contains the original text in parentheses
              label: translation.translatedText?.includes(`(${translation.originalText})`) ? 
                "Remove English" : 
                "Include English",
              icon: Languages,
              onClick: () => onToggleOriginal(translation),
              title: translation.translatedText?.includes(`(${translation.originalText})`) ?
                "Remove original English text from translation" :
                "Include original English text in parentheses"
            },
            /*
             * DEPRECATED (2025-09-01): Row-level Skip/Enable menu items are removed.
             * Preserved in history; leaving this block commented.
             */
            {
              label: "Delete",
              icon: Trash2Icon,
              onClick: () => onDelete(translation),
              variant: "destructive"
            }
          ].filter(Boolean)}
          triggerLabel="Open translation actions"
          size="sm"
        />
      )
    },
  },
  ]

  // Calculate column widths based on size values
  const columnSizes = extractColumnSizes(columnDefinitions)
  const widths = calculateColumnWidths(columnSizes)

  // Apply calculated widths to columns
  columnDefinitions.forEach((col, index) => {
    const columnId = col.id || String(col.accessorKey) || `col-${index}`
    const width = widths[columnId]
    if (width) {
      col.meta = { 
        ...col.meta, 
        style: getColumnWidthStyle(width) 
      }
    }
  })

  return columnDefinitions
}
