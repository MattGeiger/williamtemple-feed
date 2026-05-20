import { ColumnDef, Table } from "@tanstack/react-table"

export interface TableFeatureProps<TData> {
  table: Table<TData>
  filterColumn?: string
  filterPlaceholder?: string
  enableColumnVisibility?: boolean
  enableFiltering?: boolean
}

export interface UseTableFeaturesOptions<TData> {
  data: TData[]
  columns: ColumnDef<TData>[]
  initialVisibility?: Record<string, boolean>
  initialFilters?: Record<string, any>
}

export interface TableFeatureBarProps<TData> extends TableFeatureProps<TData> {
  className?: string
}