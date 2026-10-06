import { ReportsRepository } from './reports.repository.js';
import type { 
  DailyCollectionReportFilter, 
  CollectionsReportFilter, 
  LoanReportFilter, 
  RepaymentReportFilter, 
  MemberReportFilter, 
  GuarantorReportFilter, 
  CashReportFilter, 
  PaginatedReport 
} from './reports.types.js';

export class ReportsService {
  constructor(private readonly repo: ReportsRepository = new ReportsRepository()) {}

  async getDailyCollections(filter: DailyCollectionReportFilter): Promise<PaginatedReport<any>> {
    return this.repo.getDailyCollections(filter);
  }

  async getCollections(filter: CollectionsReportFilter): Promise<PaginatedReport<any>> {
    return this.repo.getCollections(filter);
  }

  async getLoans(filter: LoanReportFilter): Promise<PaginatedReport<any>> {
    return this.repo.getLoans(filter);
  }

  async getRepayments(filter: RepaymentReportFilter): Promise<PaginatedReport<any>> {
    return this.repo.getRepayments(filter);
  }

  async getMembers(filter: MemberReportFilter): Promise<PaginatedReport<any>> {
    return this.repo.getMembers(filter);
  }

  async getGuarantors(filter: GuarantorReportFilter): Promise<PaginatedReport<any>> {
    return this.repo.getGuarantors(filter);
  }

  async getCashLedger(filter: CashReportFilter): Promise<PaginatedReport<any>> {
    return this.repo.getCashLedger(filter);
  }
}
