export type Role = 'ADMIN' | 'TECHNICIAN' | 'CASHIER' | 'MANAGER';

export const hasAnyRole = (userRole: string | undefined | null, allowed: Role[]): boolean => {
  if (!userRole) return false;
  return allowed.includes(userRole as Role);
};

