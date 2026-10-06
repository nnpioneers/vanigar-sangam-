/**
 * Collections Web API Client (Phase 6.8)
 *
 * Provides typed HTTP communication for Collections recap and history.
 */

import { apiRequest } from './client';
import type { PaymentMode } from './daily-sheets';

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
  status: 'COLLECTED' | 'CORRECTED';
  isCorrected: boolean;
  correctionReason: string | null;
  correctedAt: string | null;
}

export interface CollectionSummary {
  totalCount: number;
  activeCount: number;
  correctedCount: number;
  totalAmountPaise: number;
  totalGrossAmountPaise: number;
  correctedAmountPaise: number;
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

/**
 * Fetches collections with optional date, member, mode, and status filters.
 */
export async function fetchCollections(
  filter: CollectionListFilter = {}
): Promise<CollectionListResult> {
  const query = new URLSearchParams();

  if (filter.businessDate) query.set('businessDate', filter.businessDate);
  if (filter.startDate) query.set('startDate', filter.startDate);
  if (filter.endDate) query.set('endDate', filter.endDate);
  if (filter.memberNumber) query.set('memberNumber', filter.memberNumber);
  if (filter.paymentMode) query.set('paymentMode', filter.paymentMode);
  if (filter.status) query.set('status', filter.status);
  if (filter.page) query.set('page', String(filter.page));
  if (filter.pageSize) query.set('pageSize', String(filter.pageSize));

  const qs = query.toString();
  const endpoint = qs ? `/api/v1/collections?${qs}` : '/api/v1/collections';

  return apiRequest<CollectionListResult>(endpoint, { method: 'GET' });
}

/**
 * Fetches a single collection record by UUID.
 */
export async function fetchCollectionById(id: string): Promise<Collection> {
  if (!id || typeof id !== 'string') {
    throw new Error('Collection ID is required');
  }

  const res = await apiRequest<{ collection: Collection }>(
    `/api/v1/collections/${encodeURIComponent(id)}`,
    { method: 'GET' }
  );

  return res.collection;
}
