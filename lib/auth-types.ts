export const USER_ROLES = ['ADMIN', 'USER'] as const

export type UserRole = (typeof USER_ROLES)[number]

export function normalizeUserRole(value: unknown): UserRole {
  return value === 'ADMIN' ? 'ADMIN' : 'USER'
}

export function isAdminRole(value: unknown): boolean {
  return normalizeUserRole(value) === 'ADMIN'
}
