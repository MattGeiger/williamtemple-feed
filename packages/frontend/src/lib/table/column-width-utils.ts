import { ColumnDef } from "@tanstack/react-table"

/**
 * Column width calculation utilities for table truncation
 */

export interface ColumnSizeConfig {
  id: string
  size: number
  isFixed?: boolean
}

export interface CalculatedWidths {
  [columnId: string]: string
}

/**
 * Fixed column widths (in pixels) that are preserved
 */
export const FIXED_COLUMN_WIDTHS = {
  selection: '32px',
  actions: '72px'
} as const

/**
 * Calculate percentage widths for table columns based on size values
 * Preserves fixed widths for first (selection) and last (actions) columns
 */
export function calculateColumnWidths(columns: ColumnSizeConfig[]): CalculatedWidths {
  const widths: CalculatedWidths = {}
  
  // Identify fixed columns (selection and actions)
  const fixedColumns = columns.filter(col => 
    col.id === 'select' || 
    col.id === 'actions' || 
    col.isFixed
  )
  
  // Calculate flexible columns (exclude fixed ones)
  const flexibleColumns = columns.filter(col => 
    col.id !== 'select' && 
    col.id !== 'actions' && 
    !col.isFixed
  )
  
  // Apply fixed widths
  fixedColumns.forEach(col => {
    if (col.id === 'select') {
      widths[col.id] = FIXED_COLUMN_WIDTHS.selection
    } else if (col.id === 'actions') {
      widths[col.id] = FIXED_COLUMN_WIDTHS.actions
    } else {
      widths[col.id] = `${col.size}px`
    }
  })
  
  // Calculate total size for flexible columns
  const totalFlexibleSize = flexibleColumns.reduce((sum, col) => sum + col.size, 0)
  
  // Convert flexible column sizes to percentages
  if (totalFlexibleSize > 0) {
    flexibleColumns.forEach(col => {
      const percentage = (col.size / totalFlexibleSize) * 100
      widths[col.id] = `${percentage.toFixed(2)}%`
    })
  }
  
  return widths
}

/**
 * Extract column size configuration from TanStack Table column definitions
 */
export function extractColumnSizes<T>(columns: ColumnDef<T>[]): ColumnSizeConfig[] {
  return columns.map(col => ({
    id: col.id || String(col.accessorKey) || 'unknown',
    size: col.size || 100,
    isFixed: col.id === 'select' || col.id === 'actions'
  }))
}

/**
 * Generate CSS width style for a column
 */
export function getColumnWidthStyle(width: string): React.CSSProperties {
  return {
    width,
    minWidth: width,
    maxWidth: width
  }
}

/**
 * Generate CSS classes for proper text truncation in table cells
 */
export function getTruncationClasses(): string {
  return 'overflow-hidden text-ellipsis whitespace-nowrap min-w-0'
}