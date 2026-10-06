/**
 * Agreements Controller (Phase 10.2)
 */

import type { Request, Response, NextFunction } from 'express';
import { AgreementsService } from './agreements.service.js';
import { AgreementsRepository } from './agreements.repository.js';
import { LoansRepository } from '../loans/loans.repository.js';
import type { CreateAgreementInput } from './agreements.types.js';

let agreementsServiceInstance: AgreementsService | null = null;
function getAgreementsService(): AgreementsService {
  if (!agreementsServiceInstance) {
    agreementsServiceInstance = new AgreementsService(
      new AgreementsRepository(),
      new LoansRepository()
    );
  }
  return agreementsServiceInstance;
}

export class AgreementsController {
  async getAgreementForLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { loanId } = req.params;
      const agreement = await getAgreementsService().getAgreementForLoan(loanId as string);
      res.json({ data: { agreement } });
    } catch (err) {
      next(err);
    }
  }

  async createAgreement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { loanId } = req.params;
      const input = req.body as CreateAgreementInput;
      const reqWithAuth = req as Request & { user?: { id: string }; auth?: { id: string } };
      const adminId = reqWithAuth.user?.id ?? reqWithAuth.auth?.id;
      
      if (!adminId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }
      
      const agreement = await getAgreementsService().createAgreement(loanId as string, input, adminId);
      res.status(201).json({ data: { agreement } });
    } catch (err) {
      next(err);
    }
  }
}

export const agreementsController = new AgreementsController();
