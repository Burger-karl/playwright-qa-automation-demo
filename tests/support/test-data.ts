import path from 'path';

export const STORAGE = {
  admin: path.join(__dirname, '../../playwright/.auth/admin.json'),
  staff: path.join(__dirname, '../../playwright/.auth/staff.json'),
};

export const USERS = {
  admin: { name: 'Ada Admin', email: 'admin@demo.test', password: 'Admin123!', role: 'admin' },
  staff: { name: 'Sam Staff', email: 'staff@demo.test', password: 'Staff123!', role: 'staff' },
} as const;

export type Applicant = {
  fullName: string;
  email: string;
  phone: string;
  track: 'creator' | 'sales' | 'operations';
};

// Tests run in parallel against one server, so every applicant gets a unique email.
export function uniqueEmail(prefix = 'applicant'): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}+${id}@example.com`;
}

export function buildApplicant(overrides: Partial<Applicant> = {}): Applicant {
  return {
    fullName: 'Chiamaka Obi',
    email: uniqueEmail(),
    phone: '+2348012345678',
    track: 'creator',
    ...overrides,
  };
}
