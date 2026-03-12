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

export const UserRole = {
  Manager: 0,
  Admin: 1,
  Resident: 2,
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

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
  hasExpense: boolean;
  expenseAmount?: number;
  invoiceDocumentId?: string;
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
  fiscalYear: number;
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

export interface ReserveFundDto {
  id: string;
  condominiumId: string;
  fiscalYear: number;
  openingBalance: number;
  deposits: number;
  withdrawals: number;
  closingBalance: number;
  createdAt: string;
  updatedAt?: string;
}

export interface UpdateReserveFundRequest {
  deposits?: number;
  withdrawals?: number;
}

export interface FinancialDashboardDto {
  currentYear: number;
  currentYearIncome: number;
  currentYearExpenses: number;
  currentYearBalance: number;
  reserveFundBalance: number;
  reserveFundDeposits: number;
  reserveFundWithdrawals: number;
  currentYearRecords: FinancialRecordDto[];
  availableFiscalYears: number[];
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
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
  context: string;
  description?: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
  condominiumId: string;
  unitId?: string;
  assemblyId?: string;
  maintenanceRequestId?: string;
  year?: number;
}

export interface AssemblyDto {
  id: string;
  title: string;
  description: string;
  scheduledAt: string;
  location: string;
  status: string;
  minutes?: string;
  notes?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt?: string;
  condominiumId: string;
}

export interface CreateAssemblyRequest {
  title: string;
  description: string;
  scheduledAt: string;
  location: string;
  condominiumId: string;
}

export interface UpdateAssemblyRequest {
  title?: string;
  description?: string;
  scheduledAt?: string;
  location?: string;
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

// Payment types
export interface PaymentDto {
  id: string;
  residentId: string;
  residentName: string;
  unitId: string;
  unitIdentifier: string;
  condominiumId: string;
  type: 'MonthlyFee' | 'ExtraordinaryFee' | 'Reservation' | 'Other';
  method: 'BankTransfer' | 'MBWay' | 'Card';
  amount: number;
  description: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  proofOfPaymentUrl?: string;
  createdDate: string;
  processedDate?: string;
  rejectionReason?: string;
  processedByUserName?: string;
  financialRecordId?: string;
  reservationId?: string;
  receiptNumber?: number;
  receiptYear?: number;
  receiptIssuedDate?: string;
  receiptIssuedByUserName?: string;
  hasReceipt?: boolean;
}

export interface CreatePaymentRequest {
  type: 'MonthlyFee' | 'ExtraordinaryFee' | 'Reservation' | 'Other';
  method: 'BankTransfer' | 'MBWay' | 'Card';
  amount: number;
  description: string;
  reservationId?: string;
}

export interface ApprovePaymentRequest {
  adminNotes?: string;
}

export interface RejectPaymentRequest {
  rejectionReason: string;
}

export interface PaymentMethodsDto {
  iban?: string;
  instructions?: string;
  mbWay?: string;
  mbReference?: string;
  bankTransferEnabled: boolean;
  mbWayEnabled: boolean;
  cardEnabled: boolean;
}

export interface UpdatePaymentMethodsRequest {
  iban?: string;
  instructions?: string;
  mbWay?: string;
  mbReference?: string;
  bankTransferEnabled: boolean;
  mbWayEnabled: boolean;
  cardEnabled: boolean;
}

