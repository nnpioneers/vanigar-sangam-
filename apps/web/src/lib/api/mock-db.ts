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

  // --- MEMBERS ---
  if (basePath.startsWith('/members')) {
    if (method === 'GET' && basePath === '/members') {
      return { data: { members, totalCount: members.length, page: 1, pageSize: 100 } };
    }
    
    if (method === 'POST' && basePath === '/members') {
      const body = options.body as any;
      const newMember = {
        ...body,
        id: Math.random().toString(36).substring(7),
        memberNumber: body.memberNumber || `VS-10${Math.floor(100 + Math.random() * 900)}`,
        numberOfSheets: Number(body.numberOfSheets || 1),
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      members.push(newMember);
      return { data: { member: newMember } };
    }
    
    if (method === 'GET' && basePath.includes('/profile')) {
      const memberNumber = basePath.split('/')[2];
      const member = members.find(m => m.memberNumber === decodeURIComponent(memberNumber));
      if (member) return { data: { profile: member } };
      throw new Error("Not found");
    }
  }

  // --- DAILY SHEETS ---
  if (basePath.startsWith('/daily-sheets')) {
    if (method === 'POST' && basePath === '/daily-sheets') {
      const body = options.body as any;
      const sheet = {
        id: Math.random().toString(36).substring(7),
        ...body,
        status: 'PAID',
        createdAt: new Date().toISOString(),
      };
      dailySheets.push(sheet);
      
      const m = members.find(m => m.memberNumber === body.memberNumber);
      if (m) {
        collections.push({
          id: `trx-${sheet.id}`,
          transactedAt: new Date().toISOString(),
          transactionType: 'COLLECTION',
          memberName: m.memberName,
          amountPaise: body.actualPaidPaise,
          businessDate: today
        });
      }
      return { data: { dailySheet: sheet } };
    }
    
    if (method === 'GET' && basePath.includes('/member/')) {
       const memberNumber = basePath.split('/')[3];
       const history = dailySheets.filter(ds => ds.memberNumber === memberNumber);
       return { data: { items: history, pagination: { page: 1, pageSize: 20, total: history.length, totalPages: 1 } } };
    }
  }

  // --- LOANS ---
  if (basePath.startsWith('/loans')) {
    if (method === 'GET' && basePath === '/loans') {
       return { data: { items: loans, total: loans.length, page: 1, pageSize: 100, totalPages: 1 } };
    }
    
    // Guarantees Mock
    if (method === 'GET' && basePath.includes('/guarantees')) {
       return { data: { items: [], total: 0 } };
    }
    
    // Member Loans Mock
    if (method === 'GET' && basePath.includes('/member/') && !basePath.includes('/active')) {
       return { data: { loans: loans.filter(l => l.memberNumber === basePath.split('/')[3]) } };
    }
    // Member Active Loan Mock
    if (method === 'GET' && basePath.includes('/member/') && basePath.includes('/active')) {
       const l = loans.find(l => l.memberNumber === basePath.split('/')[3] && l.status === 'ACTIVE');
       return { data: { loan: l || null } };
    }
    // Guarantors Mock
    if (method === 'POST' && basePath.includes('/guarantors')) {
       return { guarantor: { id: 'g-123', status: 'ACTIVE' } };
    }

    if (method === 'POST' && basePath === '/loans') {
       const body = options.body as any;
       const member = members.find(m => m.memberNumber === body.memberNumber);
       if (member) member.hasActiveLoan = true;
       
       const newLoan = {
         id: Math.random().toString(36).substring(7),
         memberNumber: body.memberNumber,
         memberName: member?.memberName,
         requestedAmountPaise: body.requestedAmountPaise,
         approvedAmountPaise: body.requestedAmountPaise,
         repaidAmountPaise: 0,
         status: 'ACTIVE',
         applicationDate: body.applicationDate || today,
         createdAt: new Date().toISOString(),
       };
       loans.push(newLoan);
       collections.push({
         id: `trx-disb-${newLoan.id}`,
         transactedAt: new Date().toISOString(),
         transactionType: 'LOAN_DISBURSEMENT',
         memberName: member?.memberName || 'Unknown',
         amountPaise: body.requestedAmountPaise,
         businessDate: today
       });
       return { data: { loan: newLoan } };
    }
  }

  // --- COLLECTIONS ---
  if (basePath.startsWith('/collections')) {
    if (method === 'GET' && basePath === '/collections') {
      return { 
        items: collections, 
        totalCount: collections.length, 
        page: 1, 
        pageSize: 100,
        totalPages: 1,
        summary: {
          totalCount: collections.length,
          activeCount: collections.length,
          correctedCount: 0,
          totalAmountPaise: collections.reduce((a, c) => a + c.amountPaise, 0),
          totalGrossAmountPaise: collections.reduce((a, c) => a + c.amountPaise, 0),
          correctedAmountPaise: 0,
          cashAmountPaise: collections.reduce((a, c) => a + c.amountPaise, 0),
          digitalAmountPaise: 0,
        }
      };
    }
  }

  // --- DASHBOARD ---
  if (basePath.startsWith('/dashboard/summary')) {
    // Dynamically calculate metrics
    const totalLoansGivenPaise = loans.reduce((acc, l) => acc + (l.approvedAmountPaise || 0), 0);
    const totalLoanRepaidPaise = loans.reduce((acc, l) => acc + (l.repaidAmountPaise || 0), 0);
    
    // Collection stats for today
    const todayCollections = collections.filter(c => c.businessDate === today && c.transactionType === 'COLLECTION');
    const todayCollectionAmountPaise = todayCollections.reduce((acc, c) => acc + c.amountPaise, 0);

    return {
      data: {
        coreMetrics: { totalMembers: members.length, activeMembers: members.length, inactiveMembers: 0 },
        collectionMetrics: {
          todayCollectionAmountPaise,
          weeklyCollectionAmountPaise: todayCollectionAmountPaise * 6,
          monthlyCollectionAmountPaise: todayCollectionAmountPaise * 25,
          yearlyCollectionAmountPaise: todayCollectionAmountPaise * 300,
          todayCollectionCount: todayCollections.length,
          pendingCollectionsCount: members.length - todayCollections.length,
          advanceCollectionsCount: 0,
          totalCollectionAmountPaise: todayCollectionAmountPaise * 300,
          expectedTodayAmountPaise: members.reduce((acc, m) => acc + (Number(m.numberOfSheets || 1) * 200 * 100), 0)
        },
        loanMetrics: {
          totalLoans: loans.length,
          activeLoans: loans.filter(l => l.status === 'ACTIVE').length,
          partiallyRepaidLoans: 0,
          closedLoans: 0,
          totalLoansGivenPaise,
          totalLoanRepaidPaise,
          todayLoanRepaidPaise: 0,
          outstandingLoansPaise: totalLoansGivenPaise - totalLoanRepaidPaise
        },
        cashMetrics: { totalCashInHandPaise: 0, adminWiseCash: [] },
        overdueMetrics: { status: 'AVAILABLE', overdueCount: 0 },
        businessDate: today
      }
    };
  }

  if (path.startsWith('/dashboard/recent-transactions')) {
    return { data: { transactions: collections.sort((a, b) => new Date(b.transactedAt).getTime() - new Date(a.transactedAt).getTime()).slice(0, 10) } };
  }

  return null; // fallthrough to real fetch
}
