// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useTableFeatures } from "./hooks/useTableFeatures"
import { TableFeatureBar } from "./components/TableFeatureBar"
import { flexRender } from "@tanstack/react-table"
import { TablePagination } from "./components/TablePagination"
import { TableSelectionOptions } from "@/types/table"
import { useIsMobile } from "@/hooks/use-mobile"
import { TranslationType } from "@/types/translation"
import type { LucideIcon } from "lucide-react";
import { calculateVisibleColumnWidths } from "@/lib/table"

const mobileResponsiveColumnIds = [
  'lastUpdated',
  'dietaryFlags',
  'categoryId',
  'type',
  'language',
  'status',
  'limit',
  'statusFlags',
]

interface EnhancedDataTableProps<TData> {
  columns: ColumnDef<TData>[]
  data: TData[]
  isLoading?: boolean
  filterColumn?: string
  filterPlaceholder?: string
  enableColumnVisibility?: boolean
  enableFiltering?: boolean
  enableLanguageFilter?: boolean
  enableTypeFilter?: boolean
  selectedLanguage?: string
  selectedTypes?: TranslationType[]
  availableLanguages?: string[]
  onLanguageChange?: (language: string) => void
  onTypeChange?: (types: TranslationType[]) => void
  className?: string
  selection?: TableSelectionOptions<TData>
  defaultPageSize?: number
  preservePageOnDataChange?: boolean
  onUpdate?: (item: TData) => Promise<void>
  toolbarActions?: Array<{
    label: string
    icon?: LucideIcon
    variant: 'default' | 'destructive' | 'outline-solid' | 'secondary' | 'ghost' | 'link'
    action: () => void
  }>
  toolbarControls?: React.ReactNode
}

export const EnhancedDataTable = React.forwardRef(function EnhancedDataTable<TData>({
  columns,
  data,
  isLoading = false,
  filterColumn,
  filterPlaceholder,
  enableColumnVisibility = true,
  enableFiltering = true,
  enableLanguageFilter = false,
  enableTypeFilter = false,
  selectedLanguage,
  selectedTypes,
  availableLanguages,
  onLanguageChange,
  onTypeChange,
  className,
  selection,
  defaultPageSize = 5,
  preservePageOnDataChange = true,
  onUpdate,
  toolbarActions,
  toolbarControls,
}: EnhancedDataTableProps<TData>, ref: React.ForwardedRef<{ clearSelection?: () => void }>) {
  const isMobile = useIsMobile()
  const responsiveColumnVisibility = React.useMemo(() => {
    const availableColumnIds = new Set(
      columns.map((column, index) => {
        if ('id' in column && typeof column.id === 'string') {
          return column.id
        }

        if ('accessorKey' in column && typeof column.accessorKey === 'string') {
          return column.accessorKey
        }

        return `col-${index}`
      })
    )

    return Object.fromEntries(
      mobileResponsiveColumnIds
        .filter((columnId) => availableColumnIds.has(columnId))
        .map((columnId) => [columnId, !isMobile])
    )
  }, [columns, isMobile])

  const { table, selection: tableSelection } = useTableFeatures({
    ref,
    data,
    columns,
    selection,
    defaultPageSize,
    autoResetPageIndex: preservePageOnDataChange ? false : undefined,
    initialState: {
      columnVisibility: responsiveColumnVisibility,
    },
    meta: {
      onUpdate,
    },
  })

  // Update column visibility when screen size changes
  React.useEffect(() => {
    Object.keys(responsiveColumnVisibility).forEach((columnId) => {
      table.getColumn(columnId)?.toggleVisibility(!isMobile)
    })
  }, [isMobile, responsiveColumnVisibility, table])

  const handlePageSizeChange = (newPageSize: number) => {
    // If we're changing page size and the current page would be out of bounds,
    // this ensures we adjust to a valid page
    const currentPageIndex = table.getState().pagination.pageIndex
    const maxPageIndex = Math.ceil(data.length / newPageSize) - 1
    
    if (currentPageIndex > maxPageIndex && maxPageIndex >= 0) {
      table.setPageIndex(maxPageIndex)
    }
  }

  const compactColumnStyles = isMobile
    ? calculateVisibleColumnWidths(
        table.getVisibleLeafColumns().map((column) => ({
          id: column.id,
          size: column.columnDef.size ?? 100,
          isFixed: column.id === 'select' || column.id === 'actions',
        }))
      )
    : null

  const columnStyle = (
    column: ReturnType<typeof table.getVisibleLeafColumns>[number]
  ) =>
    compactColumnStyles?.[column.id] ?? column.columnDef.meta?.style

  if (isLoading) {
    return (
      <div className={cn("space-y-4 w-full", className)} data-testid="enhanced-table-container">
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        <Skeleton className="h-6 w-20" role="status" />
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: columns.length }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-6 w-20" role="status" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      <TableFeatureBar
        table={table}
        filterColumn={filterColumn}
        filterPlaceholder={filterPlaceholder}
        enableColumnVisibility={enableColumnVisibility}
        enableFiltering={enableFiltering}
        enableLanguageFilter={enableLanguageFilter}
        enableTypeFilter={enableTypeFilter}
        selectedLanguage={selectedLanguage}
        selectedTypes={selectedTypes}
        availableLanguages={availableLanguages}
        onLanguageChange={onLanguageChange}
        onTypeChange={onTypeChange}
        bulkActions={selection?.bulkActions}
        toolbarActions={toolbarActions}
        toolbarControls={toolbarControls}
        selectedRows={tableSelection?.selectedRows}
        onClearSelection={tableSelection?.clearSelection}
      />
      <div className="rounded-md border w-full overflow-x-auto relative" data-testid="table-wrapper">
        <div className="min-w-full">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} style={columnStyle(header.column)}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      row.getIsSelected() && "bg-muted/50"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} style={columnStyle(cell.column)}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center py-4 sm:py-6"
                  >
                    No results found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div data-testid="pagination-controls">
        <TablePagination 
          table={table} 
          pageSize={table.getState().pagination.pageSize} 
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
    </div>
  )
})
