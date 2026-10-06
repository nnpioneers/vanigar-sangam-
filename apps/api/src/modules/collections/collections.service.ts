/**
 * Collections Service (Phase 6.8)
 *
 * Coordinates business rules, validation, and retrieval of collection financial events.
 */

import { NotFoundError } from '../../errors/app-error.js';
import type { ServiceContext } from '../module.types.js';
import type { CollectionsRepository } from './collections.repository.js';
import type {
  Collection,
  CollectionListFilter,
  CollectionListResult,
} from './collections.types.js';

export class CollectionsService {
  constructor(private readonly collectionsRepo: CollectionsRepository) {}

  /**
   * Retrieves a paginated list of collection records with aggregate financial recap summaries.
   */
  async listCollections(
    filter: CollectionListFilter,
    context?: ServiceContext
  ): Promise<CollectionListResult> {
    return this.collectionsRepo.findCollections(filter, context?.tx);
  }

  /**
   * Retrieves a single collection event by UUID.
   */
  async getCollectionById(id: string, context?: ServiceContext): Promise<Collection> {
    const item = await this.collectionsRepo.findById(id, context?.tx);
    if (!item) {
      throw new NotFoundError(`Collection with ID "${id}" not found`);
    }
    return item;
  }

  /**
   * Retrieves a single collection event originating from a specific Daily Sheet.
   */
  async getCollectionByDailySheetId(
    dailySheetId: string,
    context?: ServiceContext
  ): Promise<Collection | null> {
    return this.collectionsRepo.findByDailySheetId(dailySheetId, context?.tx);
  }
}
