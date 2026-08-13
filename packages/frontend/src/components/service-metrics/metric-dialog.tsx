// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type {
  ServiceMetricConfiguration,
  ServiceMetricConfigurationInput,
  ServiceMetricSemanticRole,
  ServiceMetricUnit,
  ServiceMetricValueType,
} from '@/services/service';

interface MetricDialogProps {
  open: boolean;
  metric: ServiceMetricConfiguration | null;
  defaultDisplayOrder: number;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: ServiceMetricConfigurationInput) => Promise<void>;
}

const localToday = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const blankMetric = (displayOrder: number): ServiceMetricConfigurationInput => ({
  displayName: '',
  description: null,
  valueType: 'count',
  unit: 'households',
  semanticRole: 'served_household_method',
  contributesToOperationalTotal: true,
  capacityTarget: null,
  effectiveStartDate: localToday(),
  effectiveEndDate: null,
  displayOrder,
  isActive: true,
});

const inputFromMetric = (metric: ServiceMetricConfiguration): ServiceMetricConfigurationInput => {
  const revision = metric.currentRevision;
  return {
    displayName: revision.displayName,
    description: revision.description,
    valueType: revision.valueType,
    unit: revision.unit,
    semanticRole: revision.semanticRole,
    contributesToOperationalTotal: revision.contributesToOperationalTotal,
    capacityTarget: revision.capacityTarget,
    effectiveStartDate: revision.effectiveStartDate,
    effectiveEndDate: revision.effectiveEndDate,
    displayOrder: revision.displayOrder,
    isActive: revision.isActive,
  };
};

const roleLabels: Record<ServiceMetricSemanticRole, string> = {
  served_household_method: 'Households served by method',
  unmet_demand: 'Unmet demand',
  ancillary_service: 'Other service or request',
  capacity_marker: 'Capacity marker',
  informational_custom: 'Informational or custom',
};

const typeLabels: Record<ServiceMetricValueType, string> = {
  count: 'Count',
  boolean: 'Yes or no',
  time_of_day: 'Time of day',
};

const unitLabels: Record<ServiceMetricUnit, string> = {
  households: 'Households',
  people: 'People',
  requests: 'Requests',
  items: 'Items',
  marker: 'Marker',
};

export function MetricDialog({
  open,
  metric,
  defaultDisplayOrder,
  isSaving,
  onOpenChange,
  onSave,
}: MetricDialogProps) {
  const [form, setForm] = React.useState<ServiceMetricConfigurationInput>(() => blankMetric(defaultDisplayOrder));

  React.useEffect(() => {
    if (!open) return;
    setForm(metric ? inputFromMetric(metric) : blankMetric(defaultDisplayOrder));
  }, [defaultDisplayOrder, metric, open]);

  const set = <K extends keyof ServiceMetricConfigurationInput>(
    key: K,
    value: ServiceMetricConfigurationInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const setRole = (role: ServiceMetricSemanticRole) => {
    if (role === 'served_household_method') {
      setForm((current) => ({
        ...current,
        semanticRole: role,
        valueType: 'count',
        unit: 'households',
      }));
      return;
    }
    if (role === 'capacity_marker') {
      setForm((current) => ({
        ...current,
        semanticRole: role,
        valueType: current.valueType === 'count' ? 'time_of_day' : current.valueType,
        unit: 'marker',
        contributesToOperationalTotal: false,
        capacityTarget: null,
      }));
      return;
    }
    setForm((current) => ({
      ...current,
      semanticRole: role,
      contributesToOperationalTotal: false,
      capacityTarget: null,
    }));
  };

  const setValueType = (valueType: ServiceMetricValueType) => {
    setForm((current) => ({
      ...current,
      valueType,
      unit: valueType === 'count'
        ? (current.unit === 'marker' ? 'requests' : current.unit)
        : 'marker',
      contributesToOperationalTotal: valueType === 'count'
        ? current.contributesToOperationalTotal
        : false,
      capacityTarget: valueType === 'count' ? current.capacityTarget : null,
    }));
  };

  const immutableMeaning = Boolean(metric);
  const canContribute = form.semanticRole === 'served_household_method'
    && form.valueType === 'count'
    && form.unit === 'households';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{metric ? 'Edit Service Metric' : 'Add Service Metric'}</DialogTitle>
          <DialogDescription>
            {metric
              ? 'Save a new effective-dated revision without rewriting prior entries.'
              : 'Configure one field staff can record in the daily Service Log.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(85vh-13rem)]">
          {/* Padding belongs inside the Radix viewport. Padding its root only
              moves the viewport; full-width controls remain flush with its
              clipping edge. The inner inset preserves rings and shadows. */}
          <div className="space-y-5 p-4">
            <div className="space-y-2">
              <Label htmlFor="service-metric-name">Display name</Label>
              <Input
                id="service-metric-name"
                value={form.displayName}
                maxLength={80}
                onChange={(event) => set('displayName', event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-metric-description">Description</Label>
              <Textarea
                id="service-metric-description"
                value={form.description ?? ''}
                maxLength={500}
                onChange={(event) => set('description', event.target.value || null)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Classification</Label>
                <Select
                  value={form.semanticRole}
                  disabled={immutableMeaning}
                  onValueChange={(value) => setRole(value as ServiceMetricSemanticRole)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Value type</Label>
                <Select
                  value={form.valueType}
                  disabled={immutableMeaning || form.semanticRole === 'served_household_method'}
                  onValueChange={(value) => setValueType(value as ServiceMetricValueType)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Unit</Label>
                <Select
                  value={form.unit}
                  disabled={immutableMeaning || form.valueType !== 'count' || form.semanticRole === 'served_household_method'}
                  onValueChange={(value) => set('unit', value as ServiceMetricUnit)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(form.valueType === 'count'
                      ? ['households', 'people', 'requests', 'items']
                      : ['marker']
                    ).map((value) => (
                      <SelectItem key={value} value={value}>{unitLabels[value as ServiceMetricUnit]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="service-metric-order">Display order</Label>
                <Input
                  id="service-metric-order"
                  type="number"
                  min={0}
                  step={1}
                  value={form.displayOrder}
                  onChange={(event) => set('displayOrder', Math.max(0, Number(event.target.value) || 0))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="service-metric-start">Effective start</Label>
                <Input
                  id="service-metric-start"
                  type="date"
                  value={form.effectiveStartDate}
                  onChange={(event) => set('effectiveStartDate', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-metric-end">Effective end</Label>
                <Input
                  id="service-metric-end"
                  type="date"
                  value={form.effectiveEndDate ?? ''}
                  onChange={(event) => set('effectiveEndDate', event.target.value || null)}
                />
              </div>
            </div>

            {canContribute && (
              <div className="space-y-4 rounded-md border p-4">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="service-metric-total">Include in operational household total</Label>
                  <Switch
                    id="service-metric-total"
                    checked={form.contributesToOperationalTotal}
                    onCheckedChange={(checked) => set('contributesToOperationalTotal', checked)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service-metric-capacity">Optional daily capacity target</Label>
                  <Input
                    id="service-metric-capacity"
                    type="number"
                    min={0}
                    step={1}
                    value={form.capacityTarget ?? ''}
                    onChange={(event) => set('capacityTarget', event.target.value === '' ? null : Math.max(0, Number(event.target.value) || 0))}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 rounded-md border p-4">
              <Label htmlFor="service-metric-active">Available for daily entry</Label>
              <Switch
                id="service-metric-active"
                checked={form.isActive}
                onCheckedChange={(checked) => set('isActive', checked)}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button
            onClick={() => onSave(form)}
            disabled={isSaving || !form.displayName.trim() || !form.effectiveStartDate}
          >
            {isSaving ? 'Saving…' : metric ? 'Save Revision' : 'Add Metric'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
