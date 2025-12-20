export type Role = 'ADMIN' | 'USER';

export const hasAnyRole = (userRole: string | undefined | null, allowed: Role[]): boolean => {
  if (!userRole) return false;
  return allowed.includes(userRole as Role);
};

