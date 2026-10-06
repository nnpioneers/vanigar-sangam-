/**
 * Disbursements Controller (Phase 10.8)
 */

import type { Request, Response, NextFunction } from 'express';
import { DisbursementsService } from './disbursements.service.js';
import { DisbursementsRepository } from './disbursements.repository.js';
import { LoansRepository } from '../loans/loans.repository.js';
import { AgreementsRepository } from '../agreements/agreements.repository.js';
import type { CreateDisbursementInput } from './disbursements.types.js';

let disbursementsServiceInstance: DisbursementsService | null = null;
function getDisbursementsService(): DisbursementsService {
  if (!disbursementsServiceInstance) {
    disbursementsServiceInstance = new DisbursementsService(
      new DisbursementsRepository(),
      new LoansRepository(),
      new AgreementsRepository()
    );
  }
  return disbursementsServiceInstance;
}

export class DisbursementsController {
  async getDisbursementForLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { loanId } = req.params;
      const disbursement = await getDisbursementsService().getDisbursementForLoan(loanId as string);
      res.json({ data: { disbursement } });
    } catch (err) {
      next(err);
    }
  }

  async createDisbursement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { loanId } = req.params;
      const input = req.body as CreateDisbursementInput;
      const reqWithAuth = req as Request & { user?: { id: string }; auth?: { id: string } };
      const adminId = reqWithAuth.user?.id ?? reqWithAuth.auth?.id;
      
      if (!adminId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }
      
      const disbursement = await getDisbursementsService().createDisbursement(loanId as string, input, adminId);
      res.status(201).json({ data: { disbursement } });
    } catch (err) {
      next(err);
    }
  }
}

export const disbursementsController = new DisbursementsController();
