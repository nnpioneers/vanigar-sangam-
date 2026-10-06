import type { Request, Response } from 'express';
import { createRepayment, getLoanRepayments, getRepayment, calculateLoanOutstanding } from './repayments.service.js';
import { AppError } from '../../errors/app-error.js';

export async function createRepaymentController(req: Request, res: Response): Promise<void> {
  const adminId = req.auth?.id;
  if (!adminId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHENTICATED');
  }

  const loanId = req.params.loanId as string;
  const amountPaise = req.body.amountPaise;
  const repaymentDate = req.body.repaymentDate;
  const paymentMode = req.body.paymentMode;
  const referenceNumber = req.body.referenceNumber as string | undefined;
  const notes = req.body.notes as string | undefined;
  const idempotencyKey = req.body.idempotencyKey as string | undefined;

  if (!amountPaise || typeof amountPaise !== 'number') {
    throw new AppError('amountPaise must be a valid number.', 400, 'INVALID_INPUT');
  }

  if (!repaymentDate || typeof repaymentDate !== 'string') {
    throw new AppError('repaymentDate must be a string (YYYY-MM-DD).', 400, 'INVALID_INPUT');
  }

  if (!paymentMode || typeof paymentMode !== 'string') {
    throw new AppError('paymentMode must be a valid string.', 400, 'INVALID_INPUT');
  }

  const repayment = await createRepayment(
    { adminId, timestamp: new Date().toISOString() },
    {
      loanId,
      amountPaise,
      repaymentDate,
      paymentMode,
      referenceNumber,
      notes,
      idempotencyKey,
    }
  );

  res.status(201).json({
    data: repayment,
    error: null,
  });
}

export async function getLoanRepaymentsController(req: Request, res: Response): Promise<void> {
  const loanId = req.params.loanId as string;
  const items = await getLoanRepayments(loanId);
  
  res.status(200).json({
    data: { items },
    error: null,
  });
}

export async function getRepaymentController(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const repayment = await getRepayment(id);

  res.status(200).json({
    data: repayment,
    error: null,
  });
}

export async function getLoanOutstandingController(req: Request, res: Response): Promise<void> {
  const loanId = req.params.loanId as string;
  const outstanding = await calculateLoanOutstanding(loanId);

  res.status(200).json({
    data: outstanding,
    error: null,
  });
}
