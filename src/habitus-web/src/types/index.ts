export interface AuthResponse {
  token: string;
  email: string;
  name: string;
  role: string;
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

export interface ResidentDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  unitId: string;
  role: string;
  createdAt: string;
}

export interface UnitDto {
  id: string;
  number: string;
  floor: number;
  type: number;
  permillage: number;
  buildingId: string;
}

export interface CreateUnitRequest {
  buildingId: string;
  number: string;
  floor: number;
  type: number;
  permillage: number;
}

export interface MaintenanceRequestDto {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  unitId: string;
  createdBy: string;
  createdAt: string;
  resolvedAt?: string;
  photos: string[];
  location: string;
}

export interface CreateMaintenanceRequest {
  title: string;
  description: string;
  priority: string;
  unitId: string;
  createdBy: string;
  location: string;
}

export interface FinancialRecordDto {
  id: string;
  type: string;
  amount: number;
  description: string;
  date: string;
  category: string;
  buildingId: string;
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
  buildingId: string;
  type: string;
}

export interface ReservationDto {
  id: string;
  sharedSpaceId: string;
  residentId: string;
  startTime: string;
  endTime: string;
  status: string;
  createdAt: string;
}

export interface SharedSpaceDto {
  id: string;
  name: string;
  description: string;
  capacity: number;
  buildingId: string;
  isAvailable: boolean;
}

export interface DocumentDto {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  buildingId: string;
}

export interface AssemblyDto {
  id: string;
  title: string;
  description: string;
  scheduledAt: string;
  status: string;
  buildingId: string;
}
