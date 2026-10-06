export interface ReportFilter {
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  export?: boolean;
}

export interface DailyCollectionReportFilter extends ReportFilter {
  memberNumber?: string;
  memberName?: string;
  shopName?: string;
  paymentStatus?: string;
  paymentMode?: string;
  adminId?: string;
}

export interface CollectionsReportFilter extends ReportFilter {
  memberNumber?: string;
  memberName?: string;
  collectionType?: string;
  paymentMode?: string;
  adminId?: string;
  status?: string;
}

export interface LoanReportFilter extends ReportFilter {
  memberNumber?: string;
  memberName?: string;
  status?: string;
  sheetCount?: number;
}

export interface RepaymentReportFilter extends ReportFilter {
  memberNumber?: string;
  memberName?: string;
  loanId?: string;
  paymentMode?: string;
  adminId?: string;
}

export interface MemberReportFilter extends ReportFilter {
  memberNumber?: string;
  memberName?: string;
  shopName?: string;
  mobileNumber?: string;
  sheetCount?: number;
  status?: string;
}

export interface GuarantorReportFilter extends ReportFilter {
  guarantorMemberNumber?: string;
  guarantorName?: string;
  borrowerMemberNumber?: string;
  loanId?: string;
  loanStatus?: string;
  guarantorStatus?: string;
}

export interface CashReportFilter extends ReportFilter {
  adminId?: string;
  transactionType?: string;
  direction?: 'IN' | 'OUT';
}

export interface PaginatedReport<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary?: Record<string, any>;
}
