/**
 * Collections Controller (Phase 6.8)
 *
 * Handles HTTP requests, session attribution, and standardized response formatting for Collections.
 */

import type { Request, Response } from 'express';
import { CollectionsService } from './collections.service.js';
import { CollectionsRepository } from './collections.repository.js';
import { sendSuccess } from '../../controllers/base.controller.js';
import type { CollectionListFilter } from './collections.types.js';

let collectionsServiceInstance: CollectionsService | null = null;

export function getCollectionsService(): CollectionsService {
  if (!collectionsServiceInstance) {
    collectionsServiceInstance = new CollectionsService(new CollectionsRepository());
  }
  return collectionsServiceInstance;
}

/**
 * GET /api/v1/collections
 * Lists collections with filtering, pagination, and financial recap totals.
 */
export async function listCollectionsController(req: Request, res: Response): Promise<void> {
  const service = getCollectionsService();
  const filter = (req.validatedQuery ?? req.query) as CollectionListFilter;
  const result = await service.listCollections(filter, { requestId: req.id });
  sendSuccess(res, result);
}

/**
 * GET /api/v1/collections/:id
 * Retrieves a single collection event by UUID.
 */
export async function getCollectionByIdController(req: Request, res: Response): Promise<void> {
  const service = getCollectionsService();
  const id = req.params.id as string;
  const collection = await service.getCollectionById(id, { requestId: req.id });
  sendSuccess(res, { collection });
}

/**
 * GET /api/v1/collections/export
 * Exports the filtered collections dataset as a CSV.
 */
export async function exportCollectionsController(req: Request, res: Response): Promise<void> {
  const service = getCollectionsService();
  const filter = (req.validatedQuery ?? req.query) as CollectionListFilter;
  
  // Set a practical max limit for export to protect memory (Phase 7.7.5)
  filter.page = 1;
  filter.pageSize = 10000;
  
  const result = await service.listCollections(filter, { requestId: req.id });
  const items = result.items;
  
  // Build CSV content
  const headers = ['Date', 'Member Number', 'Member Name', 'Daily Sheet ID', 'Amount (Rs)', 'Payment Mode', 'Status', 'Recorded By', 'Recorded Time'];
  const rows = items.map(item => [
    item.businessDate,
    item.memberNumber,
    `"${item.memberName.replace(/"/g, '""')}"`, // escape quotes
    item.dailySheetId,
    (item.amountPaise / 100).toFixed(2),
    item.paymentMode,
    item.status,
    `"${(item.recordedByAdminName || '').replace(/"/g, '""')}"`,
    new Date(item.collectedAt).toISOString()
  ]);
  
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="collections_export.csv"');
  res.status(200).send(csvContent);
}
