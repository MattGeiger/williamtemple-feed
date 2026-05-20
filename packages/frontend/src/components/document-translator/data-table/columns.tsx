// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { AlertTriangle, ArrowUpDown } from "@/components/ui/icons";
import { DownloadIcon } from "@/components/animate-ui/icons/download";
import { LanguagesIcon } from "@/components/animate-ui/icons/languages";
import { FileDownIcon } from "@/components/animate-ui/icons/file-down";
import { SquarePenIcon } from "@/components/animate-ui/icons/square-pen";
import { Trash2Icon } from "@/components/animate-ui/icons/trash-2";
import { Button } from "@/components/ui/button"
import { Document } from "../types"
import { TableRowAction } from "@/types/table"
import { Checkbox } from "@/components/ui/checkbox"
import { TableActionMenu } from "@/components/ui/table-action-menu"
import { ResponsiveTruncatedText } from "@/components/ui/responsive-truncated-text"
import { calculateColumnWidths, extractColumnSizes, getColumnWidthStyle } from "@/lib/table"

interface DocumentActionProps {
  onEdit: (document: Document) => void
  onDelete: (document: Document) => void
  onTranslate: (document: Document) => void
  onDownload: (document: Document) => void
  onDownloadAllTranslations: (document: Document) => Promise<void>
}

export function getColumns(
  onEdit: (document: Document) => void,
  onDelete: (document: Document) => void,
  onTranslate: (document: Document) => void,
  onDownload: (document: Document) => void,
  onDownloadAllTranslations: (document: Document) => Promise<void>,
): ColumnDef<Document>[] {
  const columnDefinitions: ColumnDef<Document>[] = [
    {
      id: "select",
      size: 10, // Fixed width for checkbox column
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getFilteredSelectedRowModel().rows.length > 0 &&
            table.getFilteredSelectedRowModel().rows.length === table.getFilteredRowModel().rows.length
          }
          onCheckedChange={(value) => {
            table.toggleAllPageRowsSelected(!!value)
          }}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => {
            row.toggleSelected(!!value)
          }}
          aria-label="Select row"
        />
      ),
    },
    {
      accessorKey: "name",
      size: 350, // Responsive width for name column
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
        const document = row.original
        // Use a dynamic check to ensure this works on initial render and updates
        const checkMobile = () => window.innerWidth < 768
        const [isMobile, setIsMobile] = React.useState(checkMobile())
        
        // Update on resize
        React.useEffect(() => {
          const handleResize = () => setIsMobile(checkMobile())
          window.addEventListener('resize', handleResize)
          return () => window.removeEventListener('resize', handleResize)
        }, [])
        
        return (
          <div className="min-w-0">
            <div className="font-medium flex items-center gap-2 min-w-0">
              <ResponsiveTruncatedText 
                text={document.name} 
                title="View full document name"
                className="flex-1 min-w-0"
              />
              {/* Show warning icon if file has integrity issues */}
              {document.hasIntegrityIssue && (
                <span className="flex-shrink-0" title={document.wasCleared ? 
                  "This file is missing and has been marked unavailable" : 
                  "This file has integrity issues and may not be accessible"}>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </span>
              )}
            </div>
            {/* Show mobile-only info for hidden columns */}
            {isMobile && (
              <div className="text-xs text-muted-foreground mt-1">
                {document.type === 'original' ? 'Original' : `Translation (${document.language})`}
                {document.fileSize && ` · ${document.fileSize}`}
                {document.hasIntegrityIssue && (
                  <span className="text-amber-500 ml-1">
                    {document.wasCleared ? '· Unavailable' : '· Warning'}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      }
    },
    {
      accessorKey: "type",
      size: 180, // Fixed width for type column
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
        const document = row.original
        return document.type === 'original' ? 'Original' : `Translation (${document.language})`
      }
    },
    {
      accessorKey: "fileSize",
      size: 100, // Fixed width for file size column
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Size
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => row.original.fileSize || '-'
    },
    {
      id: "lastUpdated",
      accessorFn: (row) => row.updatedAt || row.createdAt,
      size: 150, // Fixed width for date column
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
      size: 120, // Fixed width for actions column
      header: "Actions",
      cell: ({ row }) => {
        const document = row.original
        const actions: TableRowAction[] = []
        
        // Add Download action for all documents that don't have cleared files
        if (!document.wasCleared) {
          actions.push({
            label: document.hasIntegrityIssue ? "Try Download" : "Download",
            icon: DownloadIcon,
            onClick: () => onDownload(document)
          })
        }
        
        // Add Translate and Edit actions only for original documents
        if (document.type === 'original') {
          actions.push({
            label: "Translate",
            icon: LanguagesIcon,
            onClick: () => onTranslate(document)
          })
          
          // Add Download All Translations action if translations exist
          if (document.translationsCount && document.translationsCount > 0) {
            actions.push({
              label: `Download (${document.translationsCount}) Translation${document.translationsCount > 1 ? 's' : ''}`,
              icon: FileDownIcon,
              onClick: () => onDownloadAllTranslations(document)
            })
          }
          
          actions.push({
            label: "Edit",
            icon: SquarePenIcon,
            onClick: () => onEdit(document)
          })
        }
        
        // Add Delete action for all documents
        actions.push({
          label: "Delete",
          icon: Trash2Icon,
          onClick: () => onDelete(document),
          variant: "destructive",
        })
        
        return (
          <TableActionMenu
            actions={actions}
            triggerLabel="Open document actions"
            size="sm"
          />
        )
      }
    }
  ]

  // Calculate column widths based on size values
  const columnSizes = extractColumnSizes(columnDefinitions)
  const widths = calculateColumnWidths(columnSizes)

  // Apply calculated widths to columns
  columnDefinitions.forEach((col, index) => {
    const columnId = col.id || ('accessorKey' in col && col.accessorKey ? String(col.accessorKey) : `col-${index}`);
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
