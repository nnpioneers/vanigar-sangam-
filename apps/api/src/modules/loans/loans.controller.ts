/**
 * Loans Controller (Phase 8.4, 8.6, 8.7)
 *
 * Handles HTTP requests and responses for the Loans module.
 */

import type { Request, Response } from 'express';
import { LoansService } from './loans.service.js';
import { LoansRepository } from './loans.repository.js';
import { MemberRepository } from '../members/members.repository.js';
import { sendSuccess } from '../../controllers/base.controller.js';
import { withTransaction } from '../../database/index.js';
import type { CreateLoanInput, LoanListFilter, LoanStatus } from './loans.types.js';

let loansServiceInstance: LoansService | null = null;

export function getLoansService(): LoansService {
  if (!loansServiceInstance) {
    loansServiceInstance = new LoansService(new LoansRepository(), new MemberRepository());
  }
  return loansServiceInstance;
}

export async function createLoanController(req: Request, res: Response): Promise<void> {
  const service = getLoansService();
  const input = req.validatedBody as CreateLoanInput;
  const reqWithAuth = req as Request & { user?: { id: string }; auth?: { id: string } };
  const adminId = reqWithAuth.user?.id ?? reqWithAuth.auth?.id;

  if (!adminId) {
    res.status(401).json({
      data: null,
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    });
    return;
  }

  // 8.4.6 Transaction safety: wrap creation in a database transaction
  const loan = await withTransaction(async (tx) => {
    return service.createLoan(input, adminId, { requestId: req.id, tx });
  });

  sendSuccess(res, { loan }, 201);
}

export async function getLoanByIdController(req: Request, res: Response): Promise<void> {
  const service = getLoansService();
  const id = req.params.id as string;
  const loan = await service.getLoanById(id, { requestId: req.id });
  sendSuccess(res, { loan });
}

export async function listLoansController(req: Request, res: Response): Promise<void> {
  const service = getLoansService();
  const filter = req.validatedQuery as LoanListFilter;
  const result = await service.listLoans(filter, { requestId: req.id });
  sendSuccess(res, result);
}

export async function getMemberLoansController(req: Request, res: Response): Promise<void> {
  const service = getLoansService();
  const memberNumber = req.params.memberNumber as string;
  const loans = await service.getLoansByMemberNumber(memberNumber, { requestId: req.id });
  sendSuccess(res, { loans });
}

export async function getActiveMemberLoanController(req: Request, res: Response): Promise<void> {
  const service = getLoansService();
  const memberNumber = req.params.memberNumber as string;
  const loan = await service.getActiveLoanByMemberNumber(memberNumber, { requestId: req.id });
  sendSuccess(res, { loan });
}

export async function updateLoanStatusController(req: Request, res: Response): Promise<void> {
  const service = getLoansService();
  const id = req.params.id as string;
  const body = req.validatedBody as { status: LoanStatus };
  const reqWithAuth = req as Request & { user?: { id: string }; auth?: { id: string } };
  const adminId = reqWithAuth.user?.id ?? reqWithAuth.auth?.id;

  if (!adminId) {
    res.status(401).json({
      data: null,
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    });
    return;
  }

  const updatedLoan = await withTransaction(async (tx) => {
    return service.transitionLoanStatus(id, body.status, adminId, { requestId: req.id, tx });
  });

  sendSuccess(res, { loan: updatedLoan });
}
