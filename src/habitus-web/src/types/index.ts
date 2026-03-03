export interface AuthResponse {
  token: string;
  email: string;
  name: string;
  role: UserRole;
  condominiumId?: string;
  unitId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phone: string;
  unitId: string;
}

// Deprecated - use UserDto instead
export interface ResidentDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  unitId: string;
  role: string;
  createdAt: string;
}

export enum UserRole {
  Manager = 0,
  Admin = 1,
  Resident = 2,
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  condominiumId?: string;
  unitId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: UserRole;
  condominiumId?: string;
  unitId?: string;
}

export interface UpdateUserRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  condominiumId?: string;
  unitId?: string;
  isActive: boolean;
}

export interface CondominiumDto {
  id: string;
  name: string;
  address: string;
  taxId: string;
  phone?: string;
  email?: string;
  isActive: boolean;
}

export interface CreateCondominiumRequest {
  name: string;
  address: string;
  taxId: string;
}

export interface UpdateCondominiumRequest {
  id: string;
  name: string;
  address: string;
  taxId: string;
  isActive: boolean;
}

export interface UnitDto {
  id: string;
  number: string;
  floor: number;
  type: number;
  apartmentNumber?: string;
  permillage: number;
  condominiumId: string;
}

export interface CreateUnitRequest {
  condominiumId: string;
  number: string;
  floor: number;
  type: number;
  apartmentNumber?: string;
  permillage: number;
}

export interface MaintenanceRequestDto {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  condominiumId: string;
  unitId: string;
  createdBy: string;
  supplierId?: string;
  adminComments?: string;
  createdAt: string;
  resolvedAt?: string;
  photos: string[];
  location: string;
}

export interface CreateMaintenanceRequest {
  title: string;
  description: string;
  priority: string;
  condominiumId: string;
  unitId: string;
  createdBy: string;
  location: string;
  photos?: string[];
}

export interface FinancialRecordDto {
  id: string;
  type: string;
  amount: number;
  description: string;
  date: string;
  category: string;
  condominiumId: string;
  receiptUrl?: string;
}

export interface CreateFinancialRecordRequest {
  type: string;
  amount: number;
  description: string;
  date: string; // ISO date string, will be converted to DateTime on backend
  category: string;
  condominiumId: string;
  receiptUrl?: string;
}

export interface FinancialSummaryDto {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  incomeByCategory: Record<string, number>;
  expensesByCategory: Record<string, number>;
}

export interface NotificationDto {
  id: string;
  title: string;
  message: string;
  sentAt: string;
  isRead: boolean;
  condominiumId: string;
  type: string;
}

export interface ReservationDto {
  id: string;
  condominiumId: string;
  spaceId: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: string;
  createdAt: string;
  adminComments?: string;
}

export interface SharedSpaceDto {
  id: string;
  name: string;
  description: string;
  capacity: number;
  condominiumId: string;
  rules: string;
}

export interface CreateSharedSpaceRequest {
  name: string;
  description: string;
  capacity: number;
  condominiumId: string;
  rules: string;
}

export interface DocumentDto {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  condominiumId: string;
}

export interface AssemblyDto {
  id: string;
  title: string;
  description: string;
  scheduledAt: string;
  status: string;
  condominiumId: string;
}

export interface SupplierDto {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  specialty: string;
  isActive: boolean;
  condominiumId: string;
}

export interface CreateSupplierRequest {
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  specialty: string;
  condominiumId: string;
}

export interface UpdateSupplierRequest {
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  specialty: string;
  isActive: boolean;
}
