import { Request, Response, NextFunction } from 'express';
import { ReportsService } from './reports.service.js';

export class ReportsController {
  private service: ReportsService;

  constructor() {
    this.service = new ReportsService();
  }

  private parsePagination(req: Request) {
    const page = parseInt(req.query.page as string, 10);
    const pageSize = parseInt(req.query.pageSize as string, 10);
    return {
      page: isNaN(page) ? undefined : page,
      pageSize: isNaN(pageSize) ? undefined : pageSize,
      export: req.query.export === 'true'
    };
  }
  
  private escapeCsvValue(val: any): string {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private generateCsv(items: any[]): string {
    if (items.length === 0) return '';
    const headers = Object.keys(items[0]);
    const csvRows = [];
    csvRows.push(headers.map(h => this.escapeCsvValue(h)).join(','));
    
    for (const item of items) {
      csvRows.push(headers.map(h => this.escapeCsvValue(item[h])).join(','));
    }
    return csvRows.join('\n');
  }

  private sendResponse(res: Response, result: any, isExport: boolean, filename: string) {
    if (isExport) {
      res.header('Content-Type', 'text/csv');
      res.attachment(filename);
      return res.send(this.generateCsv(result.items));
    }
    return res.json({ data: result });
  }

  getDailyCollections = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = {
        ...this.parsePagination(req),
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        memberNumber: req.query.memberNumber as string,
        memberName: req.query.memberName as string,
        status: req.query.status as string,
      };
      const result = await this.service.getDailyCollections(filter);
      this.sendResponse(res, result, filter.export || false, 'daily_collections.csv');
    } catch (err) {
      next(err);
    }
  };

  getCollections = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = {
        ...this.parsePagination(req),
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        memberNumber: req.query.memberNumber as string,
        collectionType: req.query.collectionType as string,
        status: req.query.status as string,
      };
      const result = await this.service.getCollections(filter);
      this.sendResponse(res, result, filter.export || false, 'collections.csv');
    } catch (err) {
      next(err);
    }
  };

  getLoans = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = {
        ...this.parsePagination(req),
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        memberNumber: req.query.memberNumber as string,
        status: req.query.status as string,
      };
      const result = await this.service.getLoans(filter);
      this.sendResponse(res, result, filter.export || false, 'loans.csv');
    } catch (err) {
      next(err);
    }
  };

  getRepayments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = {
        ...this.parsePagination(req),
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        memberNumber: req.query.memberNumber as string,
        loanId: req.query.loanId as string,
      };
      const result = await this.service.getRepayments(filter);
      this.sendResponse(res, result, filter.export || false, 'repayments.csv');
    } catch (err) {
      next(err);
    }
  };

  getMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = {
        ...this.parsePagination(req),
        memberNumber: req.query.memberNumber as string,
        memberName: req.query.memberName as string,
        status: req.query.status as string,
      };
      const result = await this.service.getMembers(filter);
      this.sendResponse(res, result, filter.export || false, 'members.csv');
    } catch (err) {
      next(err);
    }
  };

  getGuarantors = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = {
        ...this.parsePagination(req),
        guarantorMemberNumber: req.query.guarantorMemberNumber as string,
        borrowerMemberNumber: req.query.borrowerMemberNumber as string,
        loanId: req.query.loanId as string,
        loanStatus: req.query.loanStatus as string,
      };
      const result = await this.service.getGuarantors(filter);
      this.sendResponse(res, result, filter.export || false, 'guarantors.csv');
    } catch (err) {
      next(err);
    }
  };

  getCashLedger = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = {
        ...this.parsePagination(req),
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        transactionType: req.query.transactionType as string,
        direction: req.query.direction as 'IN' | 'OUT',
      };
      const result = await this.service.getCashLedger(filter);
      this.sendResponse(res, result, filter.export || false, 'cash.csv');
    } catch (err) {
      next(err);
    }
  };
}
