/**
 * Guarantors Controller (Phase 9.2)
 */

import type { Request, Response, NextFunction } from 'express';
import { GuarantorsService } from './guarantors.service.js';
import { GuarantorsRepository } from './guarantors.repository.js';
import { MemberRepository } from '../members/members.repository.js';
import { LoansRepository } from '../loans/loans.repository.js';
import type { CreateGuarantorInput } from './guarantors.types.js';

let guarantorsServiceInstance: GuarantorsService | null = null;
function getGuarantorsService(): GuarantorsService {
  if (!guarantorsServiceInstance) {
    guarantorsServiceInstance = new GuarantorsService(
      new GuarantorsRepository(),
      new MemberRepository(),
      new LoansRepository()
    );
  }
  return guarantorsServiceInstance;
}

export class GuarantorsController {
  async getGuarantorsForLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { loanId } = req.params;
      const items = await getGuarantorsService().getGuarantorsForLoan(loanId as string);
      res.json({ data: { items } });
    } catch (err) {
      next(err);
    }
  }

  async getMemberGuarantees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { memberNumber } = req.params;
      const page = parseInt(req.query.page as string || '1', 10);
      const pageSize = parseInt(req.query.pageSize as string || '10', 10);
      const result = await getGuarantorsService().getGuaranteesByMemberNumber(memberNumber as string, page, pageSize);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getGuarantor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const guarantor = await getGuarantorsService().getGuarantor(id as string);
      res.json({ data: { guarantor } });
    } catch (err) {
      next(err);
    }
  }

  async addGuarantor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { loanId } = req.params;
      const input = req.body as CreateGuarantorInput;
      const reqWithAuth = req as Request & { user?: { id: string }; auth?: { id: string } };
      const adminId = reqWithAuth.user?.id ?? reqWithAuth.auth?.id;
      
      if (!adminId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }
      
      const guarantor = await getGuarantorsService().addGuarantor(loanId as string, input, adminId);
      res.status(201).json({ data: { guarantor } });
    } catch (err) {
      next(err);
    }
  }
}

export const guarantorsController = new GuarantorsController();
