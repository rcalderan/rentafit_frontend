export interface IEmployee {
  id: string;
  name: string;
  document?: string;
  email?: string;
  initials?: string;
  roleLevel?: number;
  legacyId?: number;
}

export type AttendantRole = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';

export interface IEmployeeCheckResponse {
  id: string;
  initials?: string;
  name?: string;
  role?: AttendantRole | string;
}

export interface IActiveAttendant {
  id: string;
  name: string;
  role: AttendantRole;
}
