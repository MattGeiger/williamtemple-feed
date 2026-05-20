import React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Document } from "../types"
import { EnhancedDataTable } from "@/components/ui/enhanced-data-table"
import { TableBulkAction } from "@/types/table"
import { useIsMobile } from "@/hooks/use-mobile"

interface DataTableProps {
  columns: ColumnDef<Document>[]
  data: Document[]
  isLoading?: boolean
  bulkActions?: TableBulkAction<Document>[]
  onSelectionChange?: (selected: Document[]) => void
}

export function DataTable({
  columns,
  data,
  isLoading = false,
  bulkActions,
  onSelectionChange,
}: DataTableProps) {
  const isMobile = useIsMobile()
  const tableRef = React.useRef<{ clearSelection?: () => void }>(null)

  return (
    <EnhancedDataTable
      ref={tableRef}
      columns={columns}
      data={data}
      isLoading={isLoading}
      filterColumn="name"
      filterPlaceholder="Filter documents..."
      selection={{
        enabled: true,
        selectionColumn: true,
        onSelectionChange,
        bulkActions,
      }}
      enableColumnVisibility={true}
      enableFiltering={true}
      initialState={{
        pagination: {
          pageSize: 5,
          pageIndex: 0
        },
        columnVisibility: {
          type: !isMobile,
          fileSize: !isMobile,
          lastUpdated: !isMobile
        }
      }}
    />
  )
}