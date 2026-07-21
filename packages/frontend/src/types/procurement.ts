// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import type { AnalyticsRangePreset } from '@/types/analytics';

export type ProcurementImportStatus = 'active' | 'rolled_back';
export type ProcurementChannel = 'ofb_warehouse' | 'fresh_alliance';
export type ProcurementEventKind = 'ofb_warehouse_order' | 'fresh_alliance_receipt';
export type AcquisitionClass = 'DONATED' | 'PURCH-DON' | 'GOVERNMENT' | 'PURCHASED';

export interface ProcurementOrderSummary {
  id: number;
  sourceOrderReference: string;
  eventKind: ProcurementEventKind;
  deliveryDate: string;
  revision: number;
  warningCodes: string[];
  isCurrent: boolean;
  lineCount: number;
}

export interface ProcurementImportRecord {
  id: number;
  source: 'ofb' | 'ofb_pickup';
  status: ProcurementImportStatus;
  schemaVersion: number;
  rowCount: number;
  orderCount: number;
  warningCount: number;
  warnings: ProcurementWarning[];
  rangeStart: string;
  rangeEnd: string;
  importedAt: string;
  rolledBackAt: string | null;
  restoredAt: string | null;
  orders: ProcurementOrderSummary[];
}

export interface ProcurementWarning {
  code: string;
  message: string;
  deliveryDate: string;
  rowNumbers: number[];
}

export interface ProcurementImportResult {
  outcome: 'imported' | 'duplicate';
  importId: number | null;
  rowCount: number;
  orderCount: number;
  skippedOrderCount: number;
  warningCount: number;
  rangeStart: string;
  rangeEnd: string;
  warnings: ProcurementWarning[];
}

export interface ProcurementChannelCoverage {
  eventCount: number;
  earliestDeliveryDate: string | null;
  latestDeliveryDate: string | null;
}

export interface ProcurementDataStatus {
  hasData: boolean;
  latestDeliveryDate: string | null;
  daysSinceLatestDelivery: number | null;
  isStale: boolean;
  staleAfterDays: number;
  /**
   * Each channel is reported on its own schedule and their windows are never
   * assumed equal. This describes what FEED can currently see — it is not a
   * completeness score or a performance signal.
   */
  coverage: {
    warehouse: ProcurementChannelCoverage;
    freshAlliance: ProcurementChannelCoverage;
  };
}

export type OfbExportKind = 'completed_orders' | 'agency_pickups';

export interface FreshAllianceImportResult {
  outcome: 'imported' | 'duplicate';
  importId: number | null;
  rowCount: number;
  pickupCount: number;
  skippedPickupCount: number;
  supersededEventCount: number;
  warningCount: number;
  rangeStart: string;
  rangeEnd: string;
  warnings: ProcurementWarning[];
}

export type DetectedImportResult =
  | ({ exportKind: 'completed_orders' } & ProcurementImportResult)
  | ({ exportKind: 'agency_pickups' } & FreshAllianceImportResult);

export interface ProcurementAnalyticsFilters {
  preset?: AnalyticsRangePreset;
  startDate?: string;
  endDate?: string;
  channel?: ProcurementChannel;
  acquisitionClass?: AcquisitionClass;
}

export interface ProcurementWarehouseProductSummary {
  productCode: string;
  description: string;
  acquisitionClass: AcquisitionClass;
  procurementChannel: ProcurementChannel;
  receiptDateCount: number;
  totalWeightHundredths: number;
  averageWeightPerReceiptHundredths: number;
  medianGapDays: number | null;
  firstReceivedDate: string;
  lastReceivedDate: string;
}

export interface FreshAllianceCategorySummary {
  productCode: string;
  description: string;
  receiptEventCount: number;
  receivingDateCount: number;
  totalWeightHundredths: number;
  firstReceivedDate: string;
  lastReceivedDate: string;
}

export interface PaidProcurementProductSummary {
  productCode: string;
  description: string;
  receiptDateCount: number;
  totalSpendCents: number;
  paidWeightHundredths: number;
  costPerPaidPoundCents: number | null;
  firstReceivedDate: string;
  lastReceivedDate: string;
}

export interface DonorCategoryObservation {
  productCode: string;
  description: string;
  weightHundredths: number;
}

export interface DonorSummary {
  donorCode: string;
  donorName: string;
  pickupCount: number;
  receivingDateCount: number;
  weightHundredths: number;
  averageWeightPerPickupHundredths: number;
  valuedWeightHundredths: number;
  unvaluedWeightHundredths: number;
  recordedValueCents: number;
  firstReceivedDate: string;
  lastReceivedDate: string;
  categories: DonorCategoryObservation[];
}

export interface DonorValueSummary {
  recordedValueCents: number;
  valuedWeightHundredths: number;
  totalWeightHundredths: number;
  unvaluedWeightHundredths: number;
}

export interface ProcurementAnalytics {
  dataAsOf: string;
  status: ProcurementDataStatus;
  range: {
    preset: AnalyticsRangePreset;
    startDate: string;
    endDate: string;
    timeZone: string;
  };
  filters: {
    channel: ProcurementChannel | null;
    acquisitionClass: AcquisitionClass | null;
  };
  availableYears: string[];
  summary: {
    totalWeightHundredths: number;
    sourceEventCount: number;
    warehouseOrderCount: number;
    freshAllianceReceiptCount: number;
    receivingDateCount: number;
    medianReceivingGapDays: number | null;
    medianEventWeightHundredths: number | null;
    lowerQuartileEventWeightHundredths: number | null;
    upperQuartileEventWeightHundredths: number | null;
    medianLinesPerEvent: number | null;
    warehouseProductCodes: number;
    freshAllianceCategoryCodes: number;
    zeroInboundLineCount: number;
    calculatedGrossProductChargesCents: number;
    sourceReportedProductChargesCents: number;
    costAdjustmentsAttributable: boolean;
    serviceFeesCents: number | null;
    grantsAppliedCents: number | null;
    netRecordedCostCents: number | null;
    priceMismatchLineCount: number;
  };
  acquisitionMix: Array<{
    acquisitionClass: AcquisitionClass;
    weightHundredths: number;
  }>;
  channelMix: Array<{
    channel: ProcurementChannel;
    weightHundredths: number;
  }>;
  monthlyWeight: Array<{
    month: string;
    donatedWeightHundredths: number;
    purchDonWeightHundredths: number;
    governmentWeightHundredths: number;
    purchasedWeightHundredths: number;
    ofbWarehouseWeightHundredths: number;
    freshAllianceWeightHundredths: number;
  }>;
  seasonalWeight: Array<{
    year: string;
    month: number;
    weightHundredths: number;
  }>;
  seasonalChannelWeight: Array<{
    year: string;
    month: number;
    channel: ProcurementChannel;
    weightHundredths: number;
  }>;
  warehouseProducts: ProcurementWarehouseProductSummary[];
  paidProducts: PaidProcurementProductSummary[];
  freshAllianceCategories: FreshAllianceCategorySummary[];
  donors: DonorSummary[];
  donorMonthlyWeight: Array<{
    month: string;
    donorCode: string;
    weightHundredths: number;
  }>;
  donorValue: DonorValueSummary;
}
