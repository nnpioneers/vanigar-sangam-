import type { UserRole } from '@vanigar/shared-types';

export interface NavItem {
  id: string;
  labelKey: string;
  path: string;
  iconName: string;
  roles: UserRole[];
  badge?: string;
}

export interface NavGroup {
  id: string;
  titleKey: string;
  items: NavItem[];
}

export const NAVIGATION_GROUPS: NavGroup[] = [
  {
    id: 'main',
    titleKey: 'navigation.dashboard',
    items: [
      {
        id: 'dashboard',
        labelKey: 'navigation.dashboard',
        path: '/dashboard',
        iconName: 'home',
        roles: ['SUPER_ADMIN', 'ADMIN', 'CASHIER'],
      },
    ],
  },
  {
    id: 'operations',
    titleKey: 'navigation.dailySheet',
    items: [
      {
        id: 'members',
        labelKey: 'navigation.members',
        path: '/members',
        iconName: 'users',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        id: 'daily-sheet',
        labelKey: 'navigation.dailySheet',
        path: '/daily-sheets',
        iconName: 'clipboard',
        roles: ['SUPER_ADMIN', 'ADMIN', 'CASHIER'],
      },
      {
        id: 'collections',
        labelKey: 'navigation.collections',
        path: '/collections',
        iconName: 'banknotes',
        roles: ['SUPER_ADMIN', 'ADMIN', 'CASHIER'],
      },
    ],
  },
  {
    id: 'finance',
    titleKey: 'navigation.loans',
    items: [
      {
        id: 'loans',
        labelKey: 'navigation.loans',
        path: '/loans',
        iconName: 'credit-card',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        id: 'guarantors',
        labelKey: 'navigation.guarantors',
        path: '/dashboard/guarantors',
        iconName: 'shield-check',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        id: 'cash',
        labelKey: 'navigation.cashManagement',
        path: '/dashboard/cash',
        iconName: 'cash',
        roles: ['SUPER_ADMIN', 'ADMIN', 'CASHIER'],
      },
    ],
  },
  {
    id: 'administration',
    titleKey: 'navigation.reports',
    items: [
      {
        id: 'reports',
        labelKey: 'navigation.reports',
        path: '/reports',
        iconName: 'chart-bar',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        id: 'audit',
        labelKey: 'navigation.auditLog',
        path: '/dashboard/audit',
        iconName: 'lock-closed',
        roles: ['SUPER_ADMIN'],
      },
    ],
  },
];

/**
 * Filters navigation groups and items based on the user's role.
 */
export function getFilteredNavigation(userRole?: UserRole): NavGroup[] {
  if (!userRole) {
    return [];
  }

  return NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(userRole)),
  })).filter((group) => group.items.length > 0);
}
