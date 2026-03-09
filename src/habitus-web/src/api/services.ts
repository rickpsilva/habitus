import api from './client';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  MaintenanceRequestDto,
  CreateMaintenanceRequest,
  FinancialRecordDto,
  CreateFinancialRecordRequest,
  FinancialSummaryDto,
  FinancialDashboardDto,
  ReserveFundDto,
  NotificationDto,
  PaginatedResponse,
  ReservationDto,
  SharedSpaceDto,
  DocumentDto,
  AssemblyDto,
  CreateAssemblyRequest,
  UpdateAssemblyRequest,
  ResidentDto,
  UserDto,
  CreateUserRequest,
  UpdateUserRequest,
  CondominiumDto,
  CreateCondominiumRequest,
  UpdateCondominiumRequest,
  UnitDto,
  CreateUnitRequest,
  SupplierDto,
  CreateSupplierRequest,
  UpdateSupplierRequest,
} from '../types';

export const authApi = {
  login: (data: LoginRequest) => api.post<AuthResponse>('/auth/login', data),
  register: (data: RegisterRequest) => api.post<AuthResponse>('/auth/register', data),
  forgotPassword: (data: { email: string }) => api.post('/auth/forgot-password', data),
  resetPassword: (data: { email: string; token: string; newPassword: string }) =>
    api.post('/auth/reset-password', data),
};

// New users API
export const usersApi = {
  getAll: () => api.get<UserDto[]>('/users'),
  getPaged: (page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<UserDto>>(`/users/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getByCondominium: (condominiumId: string) => api.get<UserDto[]>(`/users/condominium/${condominiumId}`),
  getByCondominiumPaged: (condominiumId: string, page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<UserDto>>(`/users/condominium/${condominiumId}/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getMe: () => api.get<UserDto>('/users/me'),
  getById: (id: string) => api.get<UserDto>(`/users/${id}`),
  create: (data: CreateUserRequest) => {
    // Convert role to string if it's a number
    const payload = {
      ...data,
      role: typeof data.role === 'number' ? data.role.toString() : data.role,
    };
    return api.post<UserDto>('/users', payload);
  },
  update: (id: string, data: UpdateUserRequest) => {
    // Convert role to string if it's a number for backend compatibility
    const payload = {
      ...data,
      role: typeof data.role === 'number' ? data.role.toString() : data.role,
    };
    return api.put<UserDto>(`/users/${id}`, payload);
  },
  updatePassword: (id: string, data: { currentPassword: string; newPassword: string }) =>
    api.put(`/users/${id}/password`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

// New condominiums API
export const condominiumsApi = {
  getAll: () => api.get<CondominiumDto[]>('/condominiums'),
  getPaged: (page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<CondominiumDto>>(`/condominiums/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getById: (id: string) => api.get<CondominiumDto>(`/condominiums/${id}`),
  create: (data: CreateCondominiumRequest) => api.post<CondominiumDto>('/condominiums', data),
  update: (id: string, data: UpdateCondominiumRequest) =>
    api.put<CondominiumDto>(`/condominiums/${id}`, data),
  delete: (id: string) => api.delete(`/condominiums/${id}`),
};

// Deprecated - use usersApi instead
export const residentsApi = {
  getAll: () => api.get<ResidentDto[]>('/residents'),
  getById: (id: string) => api.get<ResidentDto>(`/residents/${id}`),
  getByUnit: (unitId: string) => api.get<ResidentDto[]>(`/residents/unit/${unitId}`),
  delete: (id: string) => api.delete(`/residents/${id}`),
};

export const unitsApi = {
  getAll: () => api.get<UnitDto[]>('/units'),
  getPaged: (page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<UnitDto>>(`/units/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getById: (id: string) => api.get<UnitDto>(`/units/${id}`),
  create: (data: CreateUnitRequest) => api.post<UnitDto>('/units', data),
  update: (id: string, data: Partial<CreateUnitRequest>) => api.put<UnitDto>(`/units/${id}`, data),
  delete: (id: string) => api.delete(`/units/${id}`),
};

export const maintenanceApi = {
  getAll: () => api.get<MaintenanceRequestDto[]>('/maintenance'),
  getPaged: (page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<MaintenanceRequestDto>>(`/maintenance/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getById: (id: string) => api.get<MaintenanceRequestDto>(`/maintenance/${id}`),
  create: (data: CreateMaintenanceRequest) => api.post<MaintenanceRequestDto>('/maintenance', data),
  update: (id: string, data: Partial<CreateMaintenanceRequest> & { status?: string }) =>
    api.put<MaintenanceRequestDto>(`/maintenance/${id}`, data),
  updateStatus: (id: string, data: { status: string; supplierId?: string; adminComments?: string }) =>
    api.put<MaintenanceRequestDto>(`/maintenance/${id}/status`, data),
  delete: (id: string) => api.delete(`/maintenance/${id}`),
};

export const financialApi = {
  getAll: () => api.get<FinancialRecordDto[]>('/financial'),
  getPaged: (page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<FinancialRecordDto>>(`/financial/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getSummary: (condominiumId: string) => api.get<FinancialSummaryDto>(`/financial/summary/${condominiumId}`),
  getDashboard: (condominiumId: string, fiscalYear?: number) =>
    api.get<FinancialDashboardDto>(`/financial/dashboard/${condominiumId}${fiscalYear ? `?fiscalYear=${fiscalYear}` : ''}`),
  getFiscalYears: (condominiumId: string) => api.get<number[]>(`/financial/fiscal-years/${condominiumId}`),
  getByYear: (condominiumId: string, fiscalYear: number, page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<FinancialRecordDto>>(`/financial/by-year/${condominiumId}?fiscalYear=${fiscalYear}&page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  create: (data: CreateFinancialRecordRequest) => api.post<FinancialRecordDto>('/financial', data),
  delete: (id: string) => api.delete(`/financial/${id}`),
  
  // Reserve Fund
  getReserveFund: (condominiumId: string, fiscalYear?: number) =>
    api.get<ReserveFundDto>(`/financial/reserve-fund/${condominiumId}${fiscalYear ? `?fiscalYear=${fiscalYear}` : ''}`),
  getCurrentReserveFund: (condominiumId: string) =>
    api.get<ReserveFundDto>(`/financial/reserve-fund/${condominiumId}/current`),
  getReserveFundHistory: (condominiumId: string) =>
    api.get<ReserveFundDto[]>(`/financial/reserve-fund/${condominiumId}/history`),
  addDeposit: (condominiumId: string, amount: number) =>
    api.post<ReserveFundDto>(`/financial/reserve-fund/${condominiumId}/deposit`, { deposits: amount }),
  addWithdrawal: (condominiumId: string, amount: number) =>
    api.post<ReserveFundDto>(`/financial/reserve-fund/${condominiumId}/withdrawal`, { withdrawals: amount }),
};

export const notificationsApi = {
  getAll: (page: number = 1, pageSize: number = 10) => 
    api.get<PaginatedResponse<NotificationDto>>(`/notifications?page=${page}&pageSize=${pageSize}`),
  markRead: (id: string) => api.put<NotificationDto>(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/mark-all-read'),
  clearAll: () => api.delete('/notifications/clear-all'),
  delete: (id: string) => api.delete(`/notifications/${id}`),
};

export const reservationsApi = {
  getAll: () => api.get<ReservationDto[]>('/reservations'),
  getPaged: (page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<ReservationDto>>(`/reservations/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  create: (data: { spaceId: string; userId: string; startTime: string; endTime: string }) =>
    api.post<ReservationDto>('/reservations', data),
  update: (id: string, data: { spaceId: string; startTime: string; endTime: string }) =>
    api.put<ReservationDto>(`/reservations/${id}`, data),
  delete: (id: string) => api.delete(`/reservations/${id}`),
  approve: (id: string, adminComments?: string) =>
    api.post<ReservationDto>(`/reservations/${id}/approve`, { adminComments: adminComments || '' }),
  reject: (id: string, adminComments?: string) =>
    api.post<ReservationDto>(`/reservations/${id}/reject`, { adminComments: adminComments || '' }),
  requestCancellation: (id: string) =>
    api.post<ReservationDto>(`/reservations/${id}/request-cancellation`, {}),
  approveCancellation: (id: string, adminComments?: string) =>
    api.post<ReservationDto>(`/reservations/${id}/approve-cancellation`, { adminComments: adminComments || '' }),
  rejectCancellation: (id: string, adminComments?: string) =>
    api.post<ReservationDto>(`/reservations/${id}/reject-cancellation`, { adminComments: adminComments || '' }),
};

export const sharedSpacesApi = {
  getAll: () => api.get<SharedSpaceDto[]>('/shared-spaces'),
  getPaged: (page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<SharedSpaceDto>>(`/shared-spaces/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getById: (id: string) => api.get<SharedSpaceDto>(`/shared-spaces/${id}`),
  create: (data: { name: string; description: string; capacity: number; condominiumId: string; rules: string }) => 
    api.post<SharedSpaceDto>('/shared-spaces', data),
  update: (id: string, data: { name: string; description: string; capacity: number; rules: string }) => 
    api.put<SharedSpaceDto>(`/shared-spaces/${id}`, data),
  delete: (id: string) => api.delete(`/shared-spaces/${id}`),
};

export const documentsApi = {
  getAll: () => api.get<DocumentDto[]>('/documents'),
  getPaged: (page: number = 1, pageSize: number = 10, search?: string, context?: string) =>
    api.get<PaginatedResponse<DocumentDto>>(`/documents/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}${context ? `&context=${context}` : ''}`),
  getById: (id: string) => api.get<DocumentDto>(`/documents/${id}`),
  getByContext: (context: string) => api.get<DocumentDto[]>(`/documents/by-context/${context}`),
  getByUnit: (unitId: string) => api.get<DocumentDto[]>(`/documents/unit/${unitId}`),
  getByAssembly: (assemblyId: string) => api.get<DocumentDto[]>(`/documents/assembly/${assemblyId}`),
  getByMaintenance: (maintenanceId: string) => api.get<DocumentDto[]>(`/documents/maintenance/${maintenanceId}`),
  upload: (formData: FormData) => api.post<DocumentDto>('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadMultiple: (formData: FormData) => api.post<{ success: number; failed: number; documents: DocumentDto[]; errors: string[] }>('/documents/upload-multiple', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  download: (id: string) => `/api/documents/${id}/download`,
  delete: (id: string) => api.delete(`/documents/${id}`),
};

export const assembliesApi = {
  getAll: () => api.get<AssemblyDto[]>('/assemblies'),
  getPaged: (page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<AssemblyDto>>(`/assemblies/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getById: (id: string) => api.get<AssemblyDto>(`/assemblies/${id}`),
  create: (data: CreateAssemblyRequest) => api.post<AssemblyDto>('/assemblies', data),
  update: (id: string, data: UpdateAssemblyRequest) => api.put<AssemblyDto>(`/assemblies/${id}`, data),
  updateMinutes: (id: string, minutes: string) => api.put<AssemblyDto>(`/assemblies/${id}/minutes`, { minutes }),
  updateMinutesDraft: (id: string, minutes: string) => api.put<AssemblyDto>(`/assemblies/${id}/draft-minutes`, { minutes }),
  updateNotes: (id: string, notes: string) => api.put<AssemblyDto>(`/assemblies/${id}/notes`, { notes }),
  cancel: (id: string, cancellationReason: string) => api.put<AssemblyDto>(`/assemblies/${id}/cancel`, { cancellationReason }),
  delete: (id: string) => api.delete(`/assemblies/${id}`),
};

export const suppliersApi = {
  getAll: () => api.get<SupplierDto[]>('/suppliers'),
  getPaged: (page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<SupplierDto>>(`/suppliers/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getById: (id: string) => api.get<SupplierDto>(`/suppliers/${id}`),
  create: (data: CreateSupplierRequest) => api.post<SupplierDto>('/suppliers', data),
  update: (id: string, data: UpdateSupplierRequest) => api.put<SupplierDto>(`/suppliers/${id}`, data),
  delete: (id: string) => api.delete(`/suppliers/${id}`),
};
