// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import type { ColumnDef } from '@tanstack/react-table';

import { SectionHeader } from '@/components/shared/section-header';
import { createPageTitleIcon } from '@/components/layout/page-title-icon';
import { FileChartColumnIcon } from '@/components/ui/file-chart-column';
import { EnhancedDataTable } from '@/components/ui/enhanced-data-table';

interface ReportManagementRow {
  name: string;
  description: string;
  lastUpdated: string;
}

const PageTitleReportsIcon = createPageTitleIcon(FileChartColumnIcon);

const columns: ColumnDef<ReportManagementRow>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    size: 280,
  },
  {
    accessorKey: 'description',
    header: 'Description',
    size: 360,
  },
  {
    accessorKey: 'lastUpdated',
    header: 'Last Updated',
    size: 180,
  },
];

const reports: ReportManagementRow[] = [];

export function ReportsManagementWorkspace() {
  return (
    <div className="space-y-6 min-w-0 w-full pt-6">
      <SectionHeader
        title="Reports Management"
        description="Manage reusable report templates for consistent, repeatable reporting."
        icon={PageTitleReportsIcon}
      />

      <EnhancedDataTable
        columns={columns}
        data={reports}
        filterColumn="name"
        filterPlaceholder="Filter reports..."
        enableColumnVisibility
        defaultPageSize={5}
      />
    </div>
  );
}
