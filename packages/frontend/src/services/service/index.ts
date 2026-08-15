// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import config from '@/config/config';
import { BaseApiService } from '@/services/base';

export type ServiceMetricValueType = 'count' | 'boolean' | 'time_of_day';
export type ServiceMetricUnit = 'households' | 'people' | 'requests' | 'items' | 'marker';
export type ServiceMetricSemanticRole =
  | 'served_household_method'
  | 'unmet_demand'
  | 'ancillary_service'
  | 'capacity_marker'
  | 'informational_custom';
export type ServiceEntryState = 'draft' | 'finalized';
export type ServicePantryStatus = 'open' | 'closed';

export interface ServiceMetricRevision {
  id: number;
  metricId: number;
  revision: number;
  displayName: string;
  description: string | null;
  iconName: string;
  valueType: ServiceMetricValueType;
  unit: ServiceMetricUnit;
  semanticRole: ServiceMetricSemanticRole;
  contributesToOperationalTotal: boolean;
  capacityTarget: number | null;
  effectiveStartDate: string;
  effectiveEndDate: string | null;
  displayOrder: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface ServiceMetricConfiguration {
  id: number;
  metricKey: string;
  createdAt: string;
  currentRevision: ServiceMetricRevision;
  revisionCount: number;
  hasObservations: boolean;
  displayPosition: number;
}

export interface ServiceMetricConfigurationInput {
  displayName: string;
  description: string | null;
  iconName: string;
  valueType: ServiceMetricValueType;
  unit: ServiceMetricUnit;
  semanticRole: ServiceMetricSemanticRole;
  contributesToOperationalTotal: boolean;
  capacityTarget: number | null;
  effectiveStartDate: string;
  effectiveEndDate: string | null;
  displayPosition: number;
  isActive: boolean;
}

export interface ServiceMetricDayDefinition {
  id: number;
  metricKey: string;
  definitionRevisionId: number;
  definitionRevision: number;
  displayName: string;
  description: string | null;
  iconName: string;
  valueType: ServiceMetricValueType;
  unit: ServiceMetricUnit;
  semanticRole: ServiceMetricSemanticRole;
  contributesToOperationalTotal: boolean;
  capacityTarget: number | null;
  displayOrder: number;
  observation: {
    countValue: number | null;
    booleanValue: boolean | null;
    timeValue: string | null;
  } | null;
}

export interface ServiceDay {
  serviceDate: string;
  pantryStatus: ServicePantryStatus;
  entryState: ServiceEntryState;
  dayRevision: number;
  metrics: ServiceMetricDayDefinition[];
  operationalTotal: {
    value: number | null;
    recordedMetricCount: number;
    expectedMetricCount: number;
    complete: boolean;
  };
  capacityPlan: {
    planKey: string;
    revision: number;
    displayName: string;
    description: string | null;
    timezone: string;
    targets: Array<{
      id: number;
      targetKey: string;
      displayName: string;
      unit: string;
      targetValue: number;
      metricId: number | null;
      displayOrder: number;
    }>;
  } | null;
}

export interface SaveServiceDayInput {
  pantryStatus: ServicePantryStatus;
  entryState: ServiceEntryState;
  observations: Array<{
    metricId: number;
    countValue: number | null;
    booleanValue: boolean | null;
    timeValue: string | null;
  }>;
}

class ServiceApi extends BaseApiService {
  constructor() {
    super(config.api.endpoints.service.base);
  }

  async listMetrics(): Promise<ServiceMetricConfiguration[]> {
    return (await this.get<{ metrics: ServiceMetricConfiguration[] }>('/metrics')).metrics;
  }

  async createMetric(input: ServiceMetricConfigurationInput): Promise<void> {
    await this.post('/metrics', input);
  }

  async updateMetric(
    metricId: number,
    input: ServiceMetricConfigurationInput & { expectedRevision: number },
  ): Promise<void> {
    await this.put(`/metrics/${metricId}`, input);
  }

  async seedWthDefaults(): Promise<{
    metricsCreated: number;
    metricsSkipped: number;
    capacityPlanCreated: boolean;
  }> {
    return this.post('/metrics/wth-defaults', {});
  }

  async getDay(serviceDate: string): Promise<ServiceDay> {
    return (await this.get<{ day: ServiceDay }>(`/days/${serviceDate}`)).day;
  }

  async saveDay(serviceDate: string, input: SaveServiceDayInput): Promise<ServiceDay> {
    return (await this.put<{ day: ServiceDay }>(`/days/${serviceDate}`, input)).day;
  }

  async getAnalytics(filters: {
    preset: string; startDate?: string; endDate?: string;
  }): Promise<ServiceAnalytics> {
    const query = new URLSearchParams(
      Object.entries(filters).filter(([, value]) => value !== undefined) as [string, string][],
    ).toString();
    return (await this.get<{ analytics: ServiceAnalytics }>(`/analytics?${query}`)).analytics;
  }
}

/** Mirrors `getServiceAnalytics` in the backend service. */
export type ServiceBucketGranularity = 'day' | 'week' | 'month';

export interface ServiceMethodDefinition {
  metricKey: string;
  displayName: string;
  unit: string;
  /** Administrator-configured icon, so the interface keeps no list of its own. */
  iconName: string;
  /** First date this metric was recorded with a non-zero value, if ever. */
  firstRecordedDate?: string | null;
}

export interface ServiceAnalytics {
  coverage: {
    startDate: string;
    endDate: string;
    granularity: ServiceBucketGranularity;
    sources: Array<{ source: string; firstDate: string; lastDate: string; encounters: number }>;
    hasIntake: boolean;
    hasServiceLog: boolean;
    serviceLogFirstDate: string | null;
    serviceLogLastDate: string | null;
  };
  summary: {
    visits: number;
    peopleServed: number;
    identityUnavailableVisits: number;
    bulkEntryVisits: number;
    bulkEntryPeople: number;
    households: number;
    householdsSource: 'service_log' | 'intake' | 'none';
    methods: Array<ServiceMethodDefinition & { households: number }>;
    otherServices: Array<ServiceMethodDefinition & { total: number }>;
  };
  overTime: Array<{
    month: string;
    /** Null where the record does not cover the day — the line breaks there. */
    link2feedHouseholds: number | null;
    link2feedIndividuals: number | null;
    simcHouseholds: number | null;
    simcIndividuals: number | null;
    serviceLogHouseholds: number | null;
  }>;
  seasonal: {
    years: string[];
    months: Array<Record<string, string | number>>;
  };
  methodSeries: {
    granularity: ServiceBucketGranularity;
    methods: ServiceMethodDefinition[];
    buckets: Array<Record<string, string | number>>;
  };
  recordAgreement: {
    sharedDays: number;
    intakeTotal: number;
    serviceLogTotal: number;
    meanAbsoluteDailyDifference: number;
    agreementPercent: number;
  };
  householdSize: Array<{ people: number; visits: number }>;
  reachAndFrequency: Array<{
    year: string;
    households: number;
    visits: number;
    visitsPerHousehold: number;
  }>;
}

export const serviceApi = new ServiceApi();
