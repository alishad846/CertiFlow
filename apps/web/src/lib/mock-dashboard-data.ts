/**
 * ⚠️ MOCK DATA — FOR CHART TESTING ONLY.
 *
 * Everything below is fabricated so the dashboard charts have something
 * rich to render while payments + time-series API endpoints don't exist yet.
 * Once billing/analytics endpoints are live, delete this file and fetch real
 * series from the API instead (see session-resume memory for the plan).
 */

const MONTHS = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

export type CertificateActivityPoint = { date: string; issued: number; credits: number };
export type RevenuePoint = { date: string; revenue: number };

export function mockCertificateActivity(): CertificateActivityPoint[] {
  const issued = [420, 480, 510, 560, 610, 590, 640, 700, 760, 810, 870, 940];
  const credits = [388, 452, 470, 521, 566, 549, 592, 651, 705, 748, 802, 869];
  return MONTHS.map((date, i) => ({ date, issued: issued[i], credits: credits[i] }));
}

export function mockDeliverySuccessRate(): number {
  return 96;
}

export function mockDeliveryCounts(): { delivered: number; retried: number } {
  return { delivered: 9840, retried: 412 };
}

export function mockRevenueSeries(): RevenuePoint[] {
  const revenue = [182000, 204000, 213500, 241000, 268000, 259500, 288000, 312000, 336500, 355000, 379000, 412500];
  return MONTHS.map((date, i) => ({ date, revenue: revenue[i] }));
}

export function mockActiveCompanyRate(): { rate: number; active: number; total: number } {
  return { rate: 88, active: 22, total: 25 };
}

export type MockCompanyRow = {
  companyId: string;
  companyName: string;
  plan: string;
  renews: string;
  credits: number;
};

export function mockTopCompaniesByCredits(): MockCompanyRow[] {
  return [
    { companyId: 'mock-1', companyName: 'Nimbus EdTech', plan: 'Growth', renews: '04 Aug', credits: 18400 },
    { companyId: 'mock-2', companyName: 'Solstice Academy', plan: 'Scale', renews: '11 Aug', credits: 15250 },
    { companyId: 'mock-3', companyName: 'Harborline HR', plan: 'Growth', renews: '18 Aug', credits: 12100 },
    { companyId: 'mock-4', companyName: 'Meridian Institute', plan: 'Starter', renews: '02 Sep', credits: 8700 },
    { companyId: 'mock-5', companyName: 'Cobalt Learning Co.', plan: 'Growth', renews: '09 Sep', credits: 6300 }
  ];
}

export function mockCompaniesTable(): MockCompanyRow[] {
  return [
    ...mockTopCompaniesByCredits(),
    { companyId: 'mock-6', companyName: 'Fennwick Skills Lab', plan: 'Starter', renews: '16 Sep', credits: 4150 },
    { companyId: 'mock-7', companyName: 'Aurora Certification', plan: 'Scale', renews: '23 Sep', credits: 3620 }
  ];
}

export const MOCK_RING_COLORS = ['#b48a5a', '#1e3a8a', '#0b1b3a', '#a1b2d6', '#8a7b52'];
