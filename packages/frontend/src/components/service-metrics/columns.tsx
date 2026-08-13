// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { SortableHeader } from '@/components/ui/sortable-header';
import { TableActionMenu } from '@/components/ui/table-action-menu';
import { SquarePenIcon } from '@/components/animate-ui/icons/square-pen';
import { formatDate, formatDateRange } from '@/lib/formatting/date';
import type { ServiceMetricConfiguration, ServiceMetricSemanticRole } from '@/services/service';

const roleLabels: Record<ServiceMetricSemanticRole, string> = {
  served_household_method: 'Households served',
  unmet_demand: 'Unmet demand',
  ancillary_service: 'Other service',
  capacity_marker: 'Capacity marker',
  informational_custom: 'Custom',
};

const valueLabel = (metric: ServiceMetricConfiguration) => {
  const revision = metric.currentRevision;
  if (revision.valueType === 'boolean') return 'Yes or no';
  if (revision.valueType === 'time_of_day') return 'Time of day';
  return revision.unit[0].toUpperCase() + revision.unit.slice(1);
};

export const serviceMetricColumns = (
  onEdit: (metric: ServiceMetricConfiguration) => void,
): ColumnDef<ServiceMetricConfiguration>[] => [
  {
    id: 'name',
    accessorFn: (metric) => metric.currentRevision.displayName,
    size: 260,
    header: ({ column }) => <SortableHeader column={column}>Metric</SortableHeader>,
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="font-medium wrap-break-word">{row.original.currentRevision.displayName}</div>
        {row.original.currentRevision.description && (
          <div className="text-xs text-muted-foreground wrap-break-word">
            {row.original.currentRevision.description}
          </div>
        )}
      </div>
    ),
  },
  {
    id: 'role',
    accessorFn: (metric) => roleLabels[metric.currentRevision.semanticRole],
    size: 150,
    header: ({ column }) => <SortableHeader column={column}>Classification</SortableHeader>,
  },
  {
    id: 'value',
    accessorFn: valueLabel,
    size: 110,
    header: ({ column }) => <SortableHeader column={column}>Records</SortableHeader>,
  },
  {
    id: 'effective',
    accessorFn: (metric) => metric.currentRevision.effectiveStartDate,
    size: 155,
    header: ({ column }) => <SortableHeader column={column}>Effective</SortableHeader>,
    cell: ({ row }) => {
      const revision = row.original.currentRevision;
      return revision.effectiveEndDate
        ? formatDateRange(revision.effectiveStartDate, revision.effectiveEndDate)
        : `From ${formatDate(revision.effectiveStartDate)}`;
    },
  },
  {
    id: 'status',
    accessorFn: (metric) => metric.currentRevision.isActive ? 'Available' : 'Retired',
    size: 95,
    header: ({ column }) => <SortableHeader column={column}>Status</SortableHeader>,
    cell: ({ row }) => (
      <Badge variant={row.original.currentRevision.isActive ? 'default' : 'secondary'}>
        {row.original.currentRevision.isActive ? 'Available' : 'Retired'}
      </Badge>
    ),
  },
  {
    id: 'actions',
    size: 72,
    enableHiding: false,
    enableSorting: false,
    header: 'Actions',
    cell: ({ row }) => (
      <TableActionMenu
        actions={[{
          label: 'Edit',
          icon: SquarePenIcon,
          onClick: () => onEdit(row.original),
        }]}
        triggerLabel={`Open actions for ${row.original.currentRevision.displayName}`}
        size="sm"
      />
    ),
  },
];
