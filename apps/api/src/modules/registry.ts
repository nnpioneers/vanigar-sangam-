/**
 * Business Module Registry
 *
 * Centralized declarative registry for mounting domain modules into the Express application.
 * Decouples `app.ts` from having hardcoded imports of every individual domain controller or router.
 */

import type { Express } from 'express';
import type { AppModule } from './module.types.js';

export class ModuleRegistry {
  private readonly modules: Map<string, AppModule> = new Map();

  /**
   * Registers a domain module. Throws if a module with the same name or path is already registered.
   */
  register(module: AppModule): void {
    if (this.modules.has(module.name)) {
      throw new Error(`Module with name "${module.name}" is already registered.`);
    }

    for (const existing of this.modules.values()) {
      if (existing.basePath === module.basePath) {
        throw new Error(
          `Module "${module.name}" cannot register basePath "${module.basePath}"; already used by "${existing.name}".`
        );
      }
    }

    this.modules.set(module.name, module);
  }

  /**
   * Returns all currently registered domain modules.
   */
  getAll(): readonly AppModule[] {
    return Array.from(this.modules.values());
  }

  /**
   * Mounts all registered modules onto the given Express application.
   */
  mountAll(target: Express): void {
    for (const mod of this.modules.values()) {
      target.use(mod.basePath, mod.router);
    }
  }

  /**
   * Clears all registered modules (used in testing).
   */
  clear(): void {
    this.modules.clear();
  }
}

/**
 * Singleton instance of the application module registry.
 */
export const defaultModuleRegistry = new ModuleRegistry();
