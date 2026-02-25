import api from './client';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  MaintenanceRequestDto,
  CreateMaintenanceRequest,
  FinancialRecordDto,
  FinancialSummaryDto,
  NotificationDto,
  ReservationDto,
  SharedSpaceDto,
  DocumentDto,
  AssemblyDto,
  ResidentDto,
  UnitDto,
} from '../types';

export const authApi = {
  login: (data: LoginRequest) => api.post<AuthResponse>('/auth/login', data),
  register: (data: RegisterRequest) => api.post<AuthResponse>('/auth/register', data),
};

export const residentsApi = {
  getAll: () => api.get<ResidentDto[]>('/residents'),
  getById: (id: string) => api.get<ResidentDto>(`/residents/${id}`),
  delete: (id: string) => api.delete(`/residents/${id}`),
};

export const unitsApi = {
  getAll: () => api.get<UnitDto[]>('/units'),
  getById: (id: string) => api.get<UnitDto>(`/units/${id}`),
};

export const maintenanceApi = {
  getAll: () => api.get<MaintenanceRequestDto[]>('/maintenance'),
  getById: (id: string) => api.get<MaintenanceRequestDto>(`/maintenance/${id}`),
  create: (data: CreateMaintenanceRequest) => api.post<MaintenanceRequestDto>('/maintenance', data),
  update: (id: string, data: Partial<CreateMaintenanceRequest> & { status?: string }) =>
    api.put<MaintenanceRequestDto>(`/maintenance/${id}`, data),
  delete: (id: string) => api.delete(`/maintenance/${id}`),
};

export const financialApi = {
  getAll: () => api.get<FinancialRecordDto[]>('/financial'),
  getSummary: (buildingId: string) => api.get<FinancialSummaryDto>(`/financial/summary/${buildingId}`),
  create: (data: Omit<FinancialRecordDto, 'id'>) => api.post<FinancialRecordDto>('/financial', data),
  delete: (id: string) => api.delete(`/financial/${id}`),
};

export const notificationsApi = {
  getAll: () => api.get<NotificationDto[]>('/notifications'),
  markRead: (id: string) => api.put<NotificationDto>(`/notifications/${id}/read`),
  delete: (id: string) => api.delete(`/notifications/${id}`),
};

export const reservationsApi = {
  getAll: () => api.get<ReservationDto[]>('/reservations'),
  create: (data: Omit<ReservationDto, 'id' | 'createdAt' | 'status'>) =>
    api.post<ReservationDto>('/reservations', data),
  delete: (id: string) => api.delete(`/reservations/${id}`),
};

export const sharedSpacesApi = {
  getAll: () => api.get<SharedSpaceDto[]>('/sharedspaces'),
  getById: (id: string) => api.get<SharedSpaceDto>(`/sharedspaces/${id}`),
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
