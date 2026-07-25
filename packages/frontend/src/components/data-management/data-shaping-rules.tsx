// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import * as React from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import type { DataShapingRule } from '@/types/procurement';
import { flagLabel } from './data-shaping-rule-dialog';

const sourceLabel = (source: string | null) => {
  if (!source) return 'every source';
  if (source === 'ofb') return 'OFB Completed Orders';
  if (source === 'ofb_pickup') return 'OFB Agency Pickups';
  if (source === 'legacy_community') return 'legacy community records';
  return source;
};

/** Plain-language restatement of what a rule matches, so nobody has to read the fields. */
function describeScope(rule: DataShapingRule): string {
  const parts: string[] = [];
  switch (rule.scope) {
    case 'donor':
      parts.push(`Donations from ${rule.donorName ?? rule.donorCode}`);
      if (rule.donorName && rule.donorCode) parts.push(`(code ${rule.donorCode})`);
      break;
    case 'category':
      parts.push(`Lines with product code ${rule.productCode}`);
      break;
    case 'date_range':
      parts.push('Everything received');
      break;
    case 'event':
      parts.push(`One event (revision ${rule.orderRevisionId})`);
      break;
    default:
      break;
  }
  if (rule.startDate && rule.endDate) parts.push(`between ${rule.startDate} and ${rule.endDate}`);
  else if (rule.startDate) parts.push(`from ${rule.startDate}`);
  else if (rule.endDate) parts.push(`until ${rule.endDate}`);
  parts.push(`· ${sourceLabel(rule.source)}`);
  return parts.join(' ');
}

interface DataShapingRulesProps {
  rules: DataShapingRule[];
  isLoading: boolean;
  onAdd: () => void;
  onEdit: (rule: DataShapingRule) => void;
  onToggle: (rule: DataShapingRule, enabled: boolean) => void;
  onDelete: (rule: DataShapingRule) => void;
}

export function DataShapingRules({
  rules,
  isLoading,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
}: DataShapingRulesProps) {
  const exclusions = rules.filter(
    (rule) => rule.flag === 'pass_through' || rule.flag === 'other_exclusion'
  );

  return (
    <Card className="min-w-0">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="min-w-0">
          <CardTitle>Data Rules</CardTitle>
          <CardDescription>
            How your agency reads its own data. Rules never change or delete what was imported —
            they record context, and Analytics decides which flags to honor. They apply to data
            already imported as well as to everything imported later.
          </CardDescription>
        </div>
        <Button size="sm" onClick={onAdd} className="shrink-0">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Add Rule
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading rules…</p>
        ) : rules.length === 0 ? (
          <div className="rounded-md border border-dashed py-8 text-center">
            <p className="text-sm font-medium">No rules yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              FEED counts everything it imports. Add a rule when your operation knows something the
              data does not — for example, that a donor&apos;s pickups are couriered to another
              agency and were never your inventory.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {rules.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        rule.flag === 'pass_through' || rule.flag === 'other_exclusion'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {flagLabel(rule.flag)}
                    </Badge>
                    {!rule.enabled && <Badge variant="outline">Paused</Badge>}
                  </div>
                  <p className="mt-1 text-sm">{describeScope(rule)}</p>
                  {rule.note && (
                    <p className="mt-1 text-xs text-muted-foreground">{rule.note}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) => onToggle(rule, checked)}
                    aria-label={`${rule.enabled ? 'Pause' : 'Enable'} rule`}
                  />
                  <Button variant="ghost" size="icon" onClick={() => onEdit(rule)} aria-label="Edit rule">
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(rule)} aria-label="Delete rule">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {exclusions.length > 0 && (
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            {exclusions.length} rule{exclusions.length === 1 ? ' removes' : 's remove'} weight from
            supply totals. Analytics states what was excluded wherever it applies — excluded weight
            is never silently dropped.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
