import type { ApiRequestOptions } from './client';

let members: any[] = [
  {
    id: "random-id-123",
    memberNumber: "VS-1001",
    memberName: "Mohammed Nasim",
    mobileNumber: "9876543210",
    numberOfSheets: 1,
    dailyCollectionAmount: 200,
    shopName: "Nasim Stores",
    shopCategory: "Grocery",
    address: "123 Market Street",
    relatedPersonName: "Ali",
    relatedPersonRelationship: "FATHER",
    status: "ACTIVE",
    joinDate: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];
let loans: any[] = [];
let collections: any[] = [];
let dailySheets: any[] = [];

export function interceptApiRequest(path: string, options: ApiRequestOptions): any {
  const method = options.method || 'GET';
  const today = new Date().toISOString().slice(0, 10);
  let basePath = path.split('?')[0];
  if (basePath.startsWith('/api/v1')) {
    basePath = basePath.replace('/api/v1', '');
  }

  // --- AUTH ---
  if (basePath.startsWith('/auth')) {
    if (method === 'POST' && basePath === '/auth/login') {
      return { data: { user: { id: '00000000-0000-0000-0000-000000000000', role: 'SUPER_ADMIN', fullName: 'Test Admin', status: 'ACTIVE' } } };
    }
    if (method === 'GET' && basePath === '/auth/me') {
      return { data: { user: { id: '00000000-0000-0000-0000-000000000000', role: 'SUPER_ADMIN', fullName: 'Test Admin', status: 'ACTIVE' } } };
    }
    if (method === 'POST' && basePath === '/auth/logout') {
      return { data: { message: 'Logged out successfully' } };
    }
  }

  // --- MEMBERS (Removed mock to use real database) ---


  return null; // fallthrough to real fetch
}
