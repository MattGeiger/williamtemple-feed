import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowUpDown, Box, AlertCircle, Carrot, Vegan, WheatOff, Sprout, MoonStar, Star, UtensilsCrossed, PersonStanding, Home } from "@/components/ui/icons";
import { SquarePenIcon } from "@/components/animate-ui/icons/square-pen";
import { Trash2Icon } from "@/components/animate-ui/icons/trash-2";
import { XIcon } from "@/components/animate-ui/icons/x";
import { TagIcon } from "@/components/animate-ui/icons/tag";
import { ArrowLeftRightIcon } from "@/components/animate-ui/icons/arrow-left-right";
import { PackageIcon } from "@/components/animate-ui/icons/package";
import { AlertTriangleIcon } from "@/components/animate-ui/icons/alert-triangle";
import { TableActionMenu } from "@/components/ui/table-action-menu"
import { 
  FoodItem, 
  StatusDisplay, 
  STATUS_DISPLAY_CONFIG 
} from "@/types/food-item"
import { Category } from "@/types/category"
import { StatusBadge } from "@/components/ui/status-badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ResponsiveTruncatedText } from "@/components/ui/responsive-truncated-text"
import { calculateColumnWidths, extractColumnSizes, getColumnWidthStyle } from "@/lib/table"

export interface FoodItemActions {
  onEdit: (item: FoodItem) => void
  onDelete: (item: FoodItem) => void
  onCategoryChange?: (item: FoodItem) => void
  onUpdateStatus?: (item: FoodItem, statusFlags: FoodItem['statusFlags']) => Promise<void>
}

export interface FoodItemColumnProps extends FoodItemActions {
  categories: Category[]
}

/**
 * Calculate a numerical sort value for status flags using the following weights:
 * Out of stock = 0 (lowest value)
 * Limited Stock = 1
 * Clearance = 2
 * In Stock = 4
 * 
 * When multiple flags are active, values are summed:
 * Out of stock = 0
 * Out of stock + Limited = 1 (this shouldn't occur in practice)
 * Out of stock + Clearance = 2 (this shouldn't occur in practice)
 * Out of stock + Limited + Clearance = 3 (this shouldn't occur in practice)
 * In Stock = 4
 * In Stock + Limited = 5
 * In Stock + Clearance = 6
 * In Stock + Limited + Clearance = 7
 */
const getStatusSortValue = (statusFlags: FoodItem['statusFlags']): number => {
  let value = 0;
  
  if (statusFlags.isInStock) value += 4;
  if (statusFlags.isLimited) value += 1;
  if (statusFlags.isClearance) value += 2;
  
  return value;
};

const getStatusDisplays = (item: FoodItem): StatusDisplay[] => {
  const displays: StatusDisplay[] = [];
  const { statusFlags } = item;
  
  if (!statusFlags.isInStock) {
    displays.push({
      ...STATUS_DISPLAY_CONFIG.OUT_OF_STOCK,
      icon: STATUS_DISPLAY_CONFIG.OUT_OF_STOCK.icon
    });
    return displays;
  } 
  
  displays.push({
    ...STATUS_DISPLAY_CONFIG.IN_STOCK,
    icon: STATUS_DISPLAY_CONFIG.IN_STOCK.icon
  });

  if (statusFlags.isLimited) {
    displays.push({
      ...STATUS_DISPLAY_CONFIG.LIMITED,
      icon: STATUS_DISPLAY_CONFIG.LIMITED.icon
    });
  }

  if (statusFlags.isClearance) {
    displays.push({
      ...STATUS_DISPLAY_CONFIG.CLEARANCE,
      icon: STATUS_DISPLAY_CONFIG.CLEARANCE.icon
    });
  }

  return displays;
};

export const columns = ({ onEdit, onDelete, categories, onCategoryChange, onUpdateStatus }: FoodItemColumnProps): ColumnDef<FoodItem>[] => {
  const columnDefinitions: ColumnDef<FoodItem>[] = [
  {
    id: "select",
    size: 10, // Fixed width for checkbox column
    enableSorting: false,
    enableHiding: false,
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
    id: "name",
    accessorKey: "name",
    size: 250, // Responsive width for name column
    enableHiding: false,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const name = row.getValue("name") as string;
      return (
        <div className="font-medium min-w-0">
          <ResponsiveTruncatedText 
            text={name} 
            title="View full food item name"
            className="min-w-0"
          />
        </div>
      );
    }
  },
  {
    id: "categoryId",
    accessorKey: "categoryId",
    size: 150, // Fixed width for category column
    enableHiding: true,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Category
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const categoryId = row.getValue("categoryId") as number
      const category = categories.find(c => c.id === categoryId)
      return category?.name || 'Unknown Category'
    }
  },
  {
    id: "statusFlags",
    accessorKey: "statusFlags",
    size: 180, // Fixed width for status column
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
      const item = row.original;
      const displays = getStatusDisplays(item);
      const showLabels = displays.length === 1;

      return (
        <div className="flex gap-1 items-center h-8">
          {displays.map((display, idx) => {
            const badge = (
              <StatusBadge
                key={idx}
                label={display.label}
                color={display.color}
                icon={display.icon as "box" | "package" | "alert-circle" | "alert-triangle" | "tag" | "x"}
                showLabel={showLabels}
                className="text-xs"
              />
            );

            return showLabels ? badge : (
              <Tooltip key={idx}>
                <TooltipTrigger>
                  {badge}
                </TooltipTrigger>
                <TooltipContent>
                  <p>{display.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      const valueA = getStatusSortValue(rowA.original.statusFlags);
      const valueB = getStatusSortValue(rowB.original.statusFlags);
      return valueA - valueB;
    }
  },
  {
    id: "limit",
    accessorKey: "limit",
    size: 100, // Fixed width for limit column
    enableHiding: true,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Limit
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const limit = row.getValue("limit") as number
      const limitType = row.original.limitType
      
      if (limit === 100) return "No Limit"
      
      return (
        <div className="flex items-center gap-1">
          <span>{limit.toString()}</span>
          <Tooltip>
            <TooltipTrigger>
              {limitType === 'person' ? (
                <PersonStanding className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Home className="h-4 w-4 text-muted-foreground" />
              )}
            </TooltipTrigger>
            <TooltipContent>
              <p>{limitType === 'person' ? 'Per Person' : 'Per Household'}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )
    },
  },
  {
    id: "dietaryFlags",
    accessorKey: "dietaryFlags",
    size: 140, // Fixed width for dietary flags column
    enableHiding: true,
    header: "Dietary",
    cell: ({ row }) => {
      const { dietaryFlags } = row.original
      const flags = [
        { key: 'glutenFree', icon: WheatOff, label: 'Gluten Free' },
        { key: 'vegan', icon: Vegan, label: 'Vegan' },
        { key: 'vegetarian', icon: Carrot, label: 'Vegetarian' },
        { key: 'halal', icon: MoonStar, label: 'Halal' },
        { key: 'kosher', icon: Star, label: 'Kosher' },
        { key: 'organic', icon: Sprout, label: 'Organic' },
        { key: 'readyToEat', icon: UtensilsCrossed, label: 'Ready to Eat' }
      ] as const

      const activeFlags = flags.filter(({ key }) => dietaryFlags[key])
      if (activeFlags.length === 0) return '-'

      return (
        <div className="flex flex-wrap gap-1 max-w-[80px] sm:max-w-full">
          {activeFlags.map(({ key, icon: Icon, label }) => (
            <Tooltip key={key}>
              <TooltipTrigger>
                <Icon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )
    }
  },
  {
    id: "lastUpdated",
    accessorKey: "updatedAt",
    size: 140, // Fixed width for date column
    enableHiding: true,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Last Updated
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const value = row.original.updatedAt;
      if (!value) return '-';
      try {
        return new Date(value).toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
      } catch (e) {
        console.error('Date parsing error:', e);
        return value;
      }
    }
  },
  {
    id: "actions",
    size: 100, // Fixed width for actions column
    enableHiding: false,
    header: "Actions",
    cell: ({ row }) => {
      const item = row.original
      const { statusFlags } = item
      
      // Build context-aware actions based on current item state
      const actions = []
      
      // Edit action - always available
      actions.push({
        label: "Edit",
        icon: SquarePenIcon,
        onClick: () => onEdit(item)
      })
      
      // Status actions - context-aware based on current state
      if (!statusFlags.isInStock) {
        // Item is out of stock - show only "Mark In Stock"
        actions.push({
          label: "Mark In Stock",
          icon: PackageIcon,
          onClick: async () => {
            if (onUpdateStatus) {
              await onUpdateStatus(item, {
                isInStock: true,
                isLimited: false,
                isClearance: false
              })
            }
          }
        })
      } else {
        // Item is in stock - show relevant status options
        actions.push({
          label: "Mark Out of Stock",
          icon: XIcon,
          onClick: async () => {
            if (onUpdateStatus) {
              await onUpdateStatus(item, {
                isInStock: false,
                isLimited: false,
                isClearance: false
              })
            }
          }
        })
        
        // Show Limited Supply option if not already limited
        if (!statusFlags.isLimited) {
          actions.push({
            label: "Mark Limited Supply",
            icon: AlertTriangleIcon,
            onClick: async () => {
              if (onUpdateStatus) {
                await onUpdateStatus(item, {
                  isInStock: true,
                  isLimited: true,
                  isClearance: false
                })
              }
            }
          })
        }
        
        // Show Clearance option if not already on clearance
        if (!statusFlags.isClearance) {
          actions.push({
            label: "Mark Clearance",
            icon: TagIcon,
            onClick: async () => {
              if (onUpdateStatus) {
                await onUpdateStatus(item, {
                  isInStock: true,
                  isLimited: false,
                  isClearance: true
                })
              }
            }
          })
        }
      }
      
      // Change Category - always available
      actions.push({
        label: "Change Category",
        icon: ArrowLeftRightIcon,
        onClick: () => {
          if (onCategoryChange) {
            onCategoryChange(item)
          } else {
            // Fallback to edit dialog if no specific handler provided
            onEdit(item)
          }
        }
      })
      
      // Delete action - always available at the end
      actions.push({
        label: "Delete",
        icon: Trash2Icon,
        onClick: () => onDelete(item),
        variant: "destructive"
      })

      return (
        <TableActionMenu
          actions={actions}
          triggerLabel="Open food item actions"
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
