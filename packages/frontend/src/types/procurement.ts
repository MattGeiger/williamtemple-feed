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
  /**
   * Hash of the original unified export file. A unified upload always
   * produces two rows -- Warehouse and Fresh Alliance are permanently
   * separate source namespaces -- and this ties them back to one upload
   * action. Null only for an import that predates this column.
   */
  unifiedFileHash: string | null;
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

/** The OFB Order CSV Exporter v2.0.0 unified export: Warehouse Completed
 *  orders plus Fresh Alliance Pending and Completed pickups, in one file. */
export interface UnifiedImportResult {
  outcome: 'imported' | 'duplicate';
  rowCount: number;
  rangeStart: string;
  rangeEnd: string;
  /** `null` when the file contained no warehouse rows at all. */
  warehouse: ProcurementImportResult | null;
  /** `null` when the file contained no Fresh Alliance pickup rows at all. */
  freshAlliance: FreshAllianceImportResult | null;
}

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

export interface FreshAllianceDonorCategorySummary {
  /** `null` when the receipt has no donor on file — reported honestly, never inferred. */
  donorCode: string | null;
  donorName: string;
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
    /**
     * Weight already counted in every total above -- OFB's "Confirmed" flag
     * is an audit sign-off on data the agency already reported, not a
     * data-quality gate, so pending weight is included everywhere like any
     * other observation (D15). This describes the same weight a second time,
     * not a separate figure. `null` when nothing in the current range/filters
     * is pending.
     */
    freshAlliancePending: {
      weightHundredths: number;
      eventCount: number;
      earliestDeliveryDate: string;
      latestDeliveryDate: string;
    } | null;
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
  freshAllianceDonorCategories: FreshAllianceDonorCategorySummary[];
  donors: DonorSummary[];
  donorMonthlyWeight: Array<{
    month: string;
    donorCode: string;
    weightHundredths: number;
  }>;
  donorValue: DonorValueSummary;
}
