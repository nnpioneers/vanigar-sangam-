/**
 * Collections Domain Types (Phase 6.8)
 *
 * Defines collection entities, query filters, and financial summary aggregates.
 */

import type { PaymentMode } from '../daily-sheets/daily-sheets.types.js';

export type CollectionStatus = 'COLLECTED' | 'CORRECTED';

export interface Collection {
  id: string;
  dailySheetId: string;
  memberId: string;
  memberNumber: string;
  memberName: string;
  amountPaise: number;
  paymentMode: PaymentMode;
  cashTransactionId: string | null;
  businessDate: string;
  recordedByAdminId: string;
  recordedByAdminName: string | null;
  collectedAt: string;
  createdAt: string;
  status: CollectionStatus;
  isCorrected: boolean;
  correctionReason: string | null;
  correctedAt: string | null;
}

export interface CollectionSummary {
  totalCount: number;
  activeCount: number;
  correctedCount: number;
  totalAmountPaise: number; // Sum of active/uncorrected collections
  totalGrossAmountPaise: number; // Sum of all collections
  correctedAmountPaise: number; // Sum of corrected collections
  cashAmountPaise: number;
  digitalAmountPaise: number;
}

export interface CollectionListFilter {
  businessDate?: string;
  startDate?: string;
  endDate?: string;
  memberNumber?: string;
  paymentMode?: PaymentMode;
  status?: 'COLLECTED' | 'CORRECTED' | 'ALL';
  page?: number;
  pageSize?: number;
}

export interface CollectionListResult {
  items: Collection[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  summary: CollectionSummary;
}

export interface CreateCollectionInput {
  dailySheetId: string;
  memberId: string;
  amountPaise: number;
  paymentMode: PaymentMode;
  cashTransactionId?: string | null;
  businessDate: string;
  recordedByAdminId: string;
  collectedAt?: string | Date;
}
