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
  NotificationDto,
  ReservationDto,
  SharedSpaceDto,
  DocumentDto,
  AssemblyDto,
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
  getByCondominium: (condominiumId: string) => api.get<UserDto[]>(`/users/condominium/${condominiumId}`),
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
  getById: (id: string) => api.get<UnitDto>(`/units/${id}`),
  create: (data: CreateUnitRequest) => api.post<UnitDto>('/units', data),
  update: (id: string, data: Partial<CreateUnitRequest>) => api.put<UnitDto>(`/units/${id}`, data),
  delete: (id: string) => api.delete(`/units/${id}`),
};

export const maintenanceApi = {
  getAll: () => api.get<MaintenanceRequestDto[]>('/maintenance'),
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
  getSummary: (condominiumId: string) => api.get<FinancialSummaryDto>(`/financial/summary/${condominiumId}`),
  create: (data: CreateFinancialRecordRequest) => api.post<FinancialRecordDto>('/financial', data),
  delete: (id: string) => api.delete(`/financial/${id}`),
};

export const notificationsApi = {
  getAll: () => api.get<NotificationDto[]>('/notifications'),
  markRead: (id: string) => api.put<NotificationDto>(`/notifications/${id}/read`),
  delete: (id: string) => api.delete(`/notifications/${id}`),
};

export const reservationsApi = {
  getAll: () => api.get<ReservationDto[]>('/reservations'),
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
  getById: (id: string) => api.get<SharedSpaceDto>(`/shared-spaces/${id}`),
  create: (data: { name: string; description: string; capacity: number; condominiumId: string; rules: string }) => 
    api.post<SharedSpaceDto>('/shared-spaces', data),
  update: (id: string, data: { name: string; description: string; capacity: number; rules: string }) => 
    api.put<SharedSpaceDto>(`/shared-spaces/${id}`, data),
  delete: (id: string) => api.delete(`/shared-spaces/${id}`),
};

export const documentsApi = {
  getAll: () => api.get<DocumentDto[]>('/documents'),
  delete: (id: string) => api.delete(`/documents/${id}`),
};

export const assembliesApi = {
  getAll: () => api.get<AssemblyDto[]>('/assemblies'),
  getById: (id: string) => api.get<AssemblyDto>(`/assemblies/${id}`),
  create: (data: Omit<AssemblyDto, 'id'>) => api.post<AssemblyDto>('/assemblies', data),
  update: (id: string, data: Partial<AssemblyDto>) => api.put<AssemblyDto>(`/assemblies/${id}`, data),
  delete: (id: string) => api.delete(`/assemblies/${id}`),
};

export const suppliersApi = {
  getAll: () => api.get<SupplierDto[]>('/suppliers'),
  getById: (id: string) => api.get<SupplierDto>(`/suppliers/${id}`),
  create: (data: CreateSupplierRequest) => api.post<SupplierDto>('/suppliers', data),
  update: (id: string, data: UpdateSupplierRequest) => api.put<SupplierDto>(`/suppliers/${id}`, data),
  delete: (id: string) => api.delete(`/suppliers/${id}`),
};
