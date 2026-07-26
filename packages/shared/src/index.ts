export type UserRole = 'super_admin' | 'company_admin';
export type TemplateKind = 'certificate' | 'offer_letter';
export type DocumentStatus = 'pending' | 'processing' | 'sent' | 'failed';
export type EmailStatus = 'pending' | 'sent' | 'failed';
export type CompanyStatus = 'active' | 'blocked';

export * from './billing';
export * from './subscription';

export interface DashboardStats {
  totalGeneratedDocuments: number;
  remainingCredits: number;
  emailsSent: number;
  failedEmails: number;
  pendingEmails: number;
  totalBatches: number;
}

export interface BatchSummary {
  id: string;
  name: string;
  status: string;
  totalRows: number;
  processedRows: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

export interface EmailLogItem {
  id: string;
  recipientEmail: string;
  recipientName: string;
  status: EmailStatus;
  errorMessage: string | null;
  createdAt: string;
}

export interface CompanyPermissions {
  canCreateBatches: boolean;
  canRequestUpi: boolean;
  canViewReports: boolean;
}

export interface CompanySummary {
  companyId: string;
  companyName: string;
  status: CompanyStatus;
  creditsRemaining: number;
  canCreateBatches: boolean;
  canRequestUpi: boolean;
  canViewReports: boolean;
  blockedReason: string | null;
  blockedAt: string | null;
  userCount: number;
  batchCount: number;
  paymentCount: number;
  createdAt: string;
  updatedAt: string;
}
