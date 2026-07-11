export type OperationalRangePreset =
  | 'last-30-days'
  | 'last-90-days'
  | 'last-6-months'
  | 'last-12-months'
  | 'ytd';

export interface OperationalReportRequest {
  preset: OperationalRangePreset;
  timeZone: string;
}

export interface AvailabilityTimelinePoint {
  date: string;
  trackedItems: number;
  available: number;
  unavailable: number;
  limitedSupply: number;
  clearance: number;
  itemRationed: number;
  availabilityPercent: number | null;
}

export interface UnavailableEpisode {
  itemId: number;
  itemName: string;
  categoryName: string;
  startedAt: string;
  endedAt: string | null;
  durationHours: number;
  resolution: 'restored' | 'deleted' | 'open_at_range_end';
}

export interface LimitChange {
  entityType: 'food_item' | 'category';
  entityId: number;
  entityName: string;
  categoryName: string | null;
  limit: number;
  limitType: string;
  isNoLimit: boolean;
  recordedAt: string;
}

export interface OperationalAnalyticsResult {
  dataAsOf: string;
  range: { startDate: string; endDate: string; timeZone: string };
  calculationVersion: string;
  correctionWindowMinutes: number;
  summary: {
    trackedItems: number;
    availableNow: number;
    unavailableNow: number;
    limitedSupplyNow: number;
    clearanceNow: number;
    itemRationedNow: number;
    categoryRationedNow: number;
    availabilityPercentNow: number | null;
    trackedAvailabilityPercent: number | null;
    unavailableEpisodes: number;
    medianRestorationHours: number | null;
  };
  timeline: AvailabilityTimelinePoint[];
  episodes: UnavailableEpisode[];
  limitChanges: LimitChange[];
}
