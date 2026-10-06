'use client';

import { LoadingState } from '@/components/feedback/LoadingState';

/**
 * Next.js loading boundary for the Dashboard route hierarchy.
 */
export default function DashboardLoading() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LoadingState />
    </div>
  );
}
