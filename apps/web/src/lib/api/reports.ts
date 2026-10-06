import { apiRequest } from './client';

export interface PaginatedReport<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary?: Record<string, unknown>;
}

export const downloadReportCsv = async (endpoint: string, params: Record<string, unknown> = {}) => {
  const q = new URLSearchParams();
  q.append('export', 'true');
  for (const [key, val] of Object.entries(params)) {
    if (val) q.append(key, String(val));
  }
  
  const response = await fetch(`/api/v1/reports/${endpoint}?${q.toString()}`, {
    headers: {
      'Accept': 'text/csv'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to download CSV');
  }
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${endpoint}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const fetchReport = async <T>(endpoint: string, params: Record<string, unknown> = {}): Promise<PaginatedReport<T>> => {
  const q = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val) q.append(key, String(val));
  }
  const res = await apiRequest<{ data: PaginatedReport<T> }>(`/reports/${endpoint}?${q.toString()}`);
  return res.data;
};
