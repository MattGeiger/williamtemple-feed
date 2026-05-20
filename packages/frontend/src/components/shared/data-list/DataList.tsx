import { useState, useRef, useImperativeHandle, forwardRef, type ComponentType } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { EnhancedDataTable } from "@/components/ui/enhanced-data-table"
import type { LucideIcon } from "lucide-react";
import { TableBulkAction } from "@/types/table"
import { SectionHeader } from "@/components/shared/section-header"
import { TranslationType } from "@/types/translation"

// Accepts Lucide and animate-ui icons (heterogeneous prop shapes). We
// only pass className/size, but slot variance requires a permissive
// type so all icon components are accepted.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolbarIcon = ComponentType<any>;

interface DataItem {
  id: number
  name: string
}

interface ToolbarAction {
  label: string
  icon: LucideIcon
  variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  action: () => void
}

interface DataListProps<T extends DataItem> {
  title: string
  description: string
  items: T[]
  columns: ColumnDef<T>[]
  isLoading: boolean
  bulkActions?: TableBulkAction<T>[]
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
  onError?: (error: Error) => void
  onUpdate?: (item: T) => Promise<void>
  toolbarActions?: ToolbarAction[]
  toolbarControls?: React.ReactNode
  toolbarIcon?: ToolbarIcon
  preservePageOnDataChange?: boolean
}

export const DataList = forwardRef(function DataList<T extends DataItem>({
  title,
  description,
  items,
  columns,
  isLoading,
  bulkActions = [],
  filterColumn = "name",
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
  onUpdate,
  toolbarActions = [],
  toolbarControls,
  toolbarIcon: Icon,
  preservePageOnDataChange = true
}: DataListProps<T>, ref) {
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const pendingUpdatesRef = useRef<Map<number, T>>(new Map());
  const tableRef = useRef<{ clearSelection?: () => void }>(null);

  useImperativeHandle(ref, () => ({
    clearSelection: () => {
      tableRef.current?.clearSelection?.();
      pendingUpdatesRef.current.clear();
    }
  }));

  const wrappedBulkActions: TableBulkAction<T>[] = bulkActions.map(action => ({
    ...action,
    action: async (selected: T[]) => {
      setIsBulkActionLoading(true);
      try {
        await action.action(selected);
      } catch (error) {
        // Handle error
      } finally {
        setIsBulkActionLoading(false);
      }
    }
  }));

  return (
    <div className="space-y-6 min-w-0 w-full pt-6" data-testid="data-list">
      {/* Use shared SectionHeader */}
      {Icon && (
        <div className="w-full min-w-0">
          <SectionHeader
            title={title}
            description={description}
            icon={Icon}
          />
        </div>
      )}

      {/* Table Section — outer overflow:auto removed so shadows on rows,
          pagination, and viewport-edge cells aren't clipped. EnhancedDataTable's
          inner wrapper still handles horizontal scroll for wide tables. */}
      <div className="w-full">
        <EnhancedDataTable 
          ref={tableRef}
          columns={columns}
          data={items}
          isLoading={isLoading || isBulkActionLoading}
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
          selection={bulkActions.length > 0 ? {
            enabled: true,
            selectionColumn: true,
            bulkActions: wrappedBulkActions
          } : undefined}
          onUpdate={onUpdate}
          toolbarActions={toolbarActions}
          toolbarControls={toolbarControls}
          preservePageOnDataChange={preservePageOnDataChange}
        />
      </div>
    </div>
  )
})
