// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import type { AnalyticsRangePreset } from '@/types/analytics';

export type ProcurementImportStatus = 'active' | 'rolled_back';
export type ProcurementChannel = 'ofb_warehouse' | 'fresh_alliance';
export type AcquisitionClass = 'DONATED' | 'PURCH-DON' | 'GOVERNMENT' | 'PURCHASED';

export interface ProcurementOrderSummary {
  id: number;
  sourceOrderReference: string;
  deliveryDate: string;
  revision: number;
  warningCodes: string[];
  isCurrent: boolean;
  lineCount: number;
}

export interface ProcurementImportRecord {
  id: number;
  source: 'ofb';
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

export interface ProcurementDataStatus {
  hasData: boolean;
  latestDeliveryDate: string | null;
  daysSinceLatestDelivery: number | null;
  isStale: boolean;
  staleAfterDays: number;
}

export interface ProcurementAnalyticsFilters {
  preset?: AnalyticsRangePreset;
  startDate?: string;
  endDate?: string;
  channel?: ProcurementChannel;
  acquisitionClass?: AcquisitionClass;
}

export interface ProcurementProductContinuity {
  productCode: string;
  description: string;
  acquisitionClass: AcquisitionClass;
  procurementChannel: ProcurementChannel;
  receiptDateCount: number;
  activeMonthCount: number;
  observedMonthSpan: number;
  activeMonthShare: number;
  receiptsPerActiveMonth: number;
  totalWeightHundredths: number;
  averageWeightPerReceiptHundredths: number;
  medianGapDays: number | null;
  firstReceivedDate: string;
  lastReceivedDate: string;
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
    sourceOrderCount: number;
    receivingDateCount: number;
    medianOrderWeightHundredths: number | null;
    lowerQuartileOrderWeightHundredths: number | null;
    upperQuartileOrderWeightHundredths: number | null;
    medianLinesPerOrder: number | null;
    supplierProductCodes: number;
    productsReceivedOnce: number;
    productsReceivedTenOrMore: number;
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
  recurrenceDistribution: Array<{ label: string; productCount: number }>;
  productContinuity: ProcurementProductContinuity[];
}
