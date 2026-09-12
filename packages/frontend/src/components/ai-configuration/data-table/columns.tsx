// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { ColumnDef } from "@tanstack/react-table"
import { Settings } from "@/components/ui/icons";
import { SquarePenIcon } from "@/components/animate-ui/icons/square-pen";
import { Trash2Icon } from "@/components/animate-ui/icons/trash-2";
import { ToggleLeftIcon } from "@/components/animate-ui/icons/toggle-left";
import { ToggleRightIcon } from "@/components/animate-ui/icons/toggle-right";
import { TableActionMenu } from "@/components/ui/table-action-menu"
import { AIConfiguration, CatalogueModel } from "../types"
import { UnifiedConfiguration } from "@/services/unified-config"
import { Checkbox } from "@/components/ui/checkbox"
import { StatusBadge } from "@/components/shared/status-badge"
import { SortableHeader } from "@/components/ui/sortable-header"
import { formatDate } from '@/lib/formatting/date'

export interface AIConfigurationActions {
  onEdit: (config: UnifiedConfiguration) => void
  onDelete: (config: UnifiedConfiguration) => void
  onToggleActive: (config: UnifiedConfiguration) => void
  /**
   * Looks a saved configuration's model up in the catalogue, offered or
   * withdrawn. Passed in because this is a plain function and cannot call a
   * hook; optional so the table renders unchanged before the catalogue
   * arrives, or if the request fails.
   */
  findModel?: (id?: string | null) => CatalogueModel | undefined
}

/**
 * What the list says about a model's remaining life.
 *
 * Until now a configuration pointing at a shut-down model looked exactly like
 * one pointing at a current model — the failure only surfaced when a
 * translation ran, and then as an unrelated-looking provider error. That is
 * defect 10 of ISSUES.md #84.
 */
const lifecycleNotice = (
  model: CatalogueModel | undefined
): { label: string; status: 'warning' | 'danger'; detail: string } | null => {
  if (!model) return null
  const { status, shutdownDate, replacement } = model.lifecycle

  const moveTo = replacement ? ` Move to ${replacement}.` : ''

  if (status === 'retired') {
    return {
      label: 'Retired',
      status: 'danger',
      detail: `${model.id} has been shut down and requests to it fail.${moveTo}`,
    }
  }

  if (status === 'deprecated') {
    return {
      label: shutdownDate ? `Ends ${shutdownDate}` : 'Deprecated',
      // A dated shutdown is the one staff must act on before it arrives.
      status: shutdownDate ? 'danger' : 'warning',
      detail: shutdownDate
        ? `${model.id} stops working on ${shutdownDate}.${moveTo}`
        : `${model.id} is deprecated.${moveTo}`,
    }
  }

  if (status === 'preview') {
    return {
      label: 'Preview',
      status: 'warning',
      detail: `${model.id} is a provider preview and may change or be withdrawn at short notice.`,
    }
  }

  return null
}

export const columns = ({ onEdit, onDelete, onToggleActive, findModel }: AIConfigurationActions): ColumnDef<UnifiedConfiguration>[] => {
  const columnDefinitions: ColumnDef<UnifiedConfiguration>[] = [
  {
    id: "select",
    size: 10,
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
    accessorKey: "name",
    size: 200,
    header: ({ column }) => (
      <SortableHeader column={column}>Configuration Name</SortableHeader>
    ),
    cell: ({ row }) => {
      const name = row.getValue("name") as string;
      return (
        <div className="font-medium">
          {name}
        </div>
      );
    }
  },
  {
    accessorKey: "type",
    size: 140,
    enableHiding: true,
    header: ({ column }) => (
      <SortableHeader column={column}>Type</SortableHeader>
    ),
    cell: ({ row }) => {
      const type = row.getValue("type") as string
      let displayType = type
      if (type === 'prompt') displayType = 'System Prompt'
      if (type === 'apikey') displayType = 'API Key'
      return displayType
    }
  },
  {
    accessorKey: "description",
    size: 300,
    header: ({ column }) => (
      <SortableHeader column={column}>Description</SortableHeader>
    ),
    cell: ({ row }) => {
      const config = row.original;
      const description = config.description;
      const type = config.type;
      
      // Show user description if available
      if (description && description.trim()) {
        return (
          <div className="text-sm">
            {description}
          </div>
        );
      }
      
      // Fallback to technical details when description is missing
      if (type === 'apikey') {
        const notice = lifecycleNotice(findModel?.(config.model));
        return (
          <div className="text-sm text-muted-foreground">
            <div className="font-medium">{config.serviceType} - {config.modelName}</div>
            {notice && (
              <div className="text-xs text-destructive">{notice.detail}</div>
            )}
            <div className="font-mono text-xs">••••••••••••••••</div>
          </div>
        );
      }
      
      if (type === 'prompt') {
        return (
          <div className="text-sm text-muted-foreground">
            <div className="font-medium">{config.promptCategory}</div>
            {config.serviceDescription && (
              <div className="text-xs">
                {config.serviceDescription.length > 50 
                  ? config.serviceDescription.substring(0, 50) + "..." 
                  : config.serviceDescription}
              </div>
            )}
          </div>
        );
      }
      
      return (
        <div className="text-sm text-muted-foreground">
          Not configured
        </div>
      );
    },
  },
  {
    accessorKey: "isActive",
    size: 120,
    enableHiding: true,
    header: ({ column }) => (
      <SortableHeader column={column}>Status</SortableHeader>
    ),
    cell: ({ row }) => {
      const isActive = row.getValue("isActive") as boolean
      const config = row.original
      const notice = config.type === 'apikey' ? lifecycleNotice(findModel?.(config.model)) : null

      return (
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge
            label={isActive ? 'Active' : 'Inactive'}
            status={isActive ? 'success' : 'neutral'}
          />
          {notice && (
            <StatusBadge label={notice.label} status={notice.status} title={notice.detail} />
          )}
        </div>
      )
    }
  },
  {
    accessorKey: "updatedAt",
    size: 140,
    enableHiding: true,
    header: ({ column }) => (
      <SortableHeader column={column}>Last Updated</SortableHeader>
    ),
    cell: ({ row }) => {
      const updatedAt = row.getValue("updatedAt") as string
      return formatDate(updatedAt)
    }
  },
  {
    id: "actions",
    size: 120,
    enableHiding: false,
    header: "Actions",
    cell: ({ row }) => {
      const config = row.original

      return (
        <TableActionMenu
          actions={[
            {
              label: "Edit",
              icon: SquarePenIcon,
              onClick: () => onEdit(config)
            },
            {
              label: config.isActive ? "Deactivate" : "Activate",
              icon: config.isActive ? ToggleRightIcon : ToggleLeftIcon,
              onClick: () => onToggleActive(config),
              title: config.isActive ?
                "Deactivate this configuration" :
                "Activate this configuration"
            },
            {
              label: "Delete",
              icon: Trash2Icon,
              onClick: () => onDelete(config),
              variant: "destructive"
            }
          ]}
          triggerLabel="Open configuration actions"
          size="sm"
        />
      )
    },
  },
  ]


  return columnDefinitions
}
