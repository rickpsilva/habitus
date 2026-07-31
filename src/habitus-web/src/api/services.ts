import api from './client';
import type {
  AuthResponse,
  LoginRequest,
  CompleteTwoFactorLoginRequest,
  RegisterRequest,
  RegisterResidentRequest,
  TwoFactorSecurityResponse,
  TwoFactorSetupResponse,
  VerifyTwoFactorSetupRequest,
  TwoFactorSetupCompleteResponse,
  DisableTwoFactorRequest,
  RegenerateRecoveryCodesRequest,
  RecoveryCodesResponse,
  CondominiumPublicDto,
  UnitPublicDto,
  MembershipsResponse,
  SetActiveContextRequest,
  PendingUserDto,
  MaintenanceRequestDto,
  CreateMaintenanceRequest,
  FinancialRecordDto,
  CreateFinancialRecordRequest,
  FinancialSummaryDto,
  FinancialDashboardDto,
  ReserveFundDto,
  NotificationDto,
  PaginatedResponse,
  MaintenanceStatusCountsDto,
  PaymentStatusCountsDto,
  ReservationDto,
  SharedSpaceDto,
  DocumentDto,
  AssemblyDto,
  CreateAssemblyRequest,
  UpdateAssemblyRequest,
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
  UsefulContactDto,
  CreateUsefulContactRequest,
  UpdateUsefulContactRequest,
  PaymentDto,
  CreatePaymentRequest,
  ApprovePaymentRequest,
  RejectPaymentRequest,
  PaymentMethodsDto,
  PaymentSettingsDto,
  UpdatePaymentSettingsRequest,
  ReceiptTemplateSettingsDto,
  UpdateReceiptTemplateSettingsRequest,
  PlatformBillingSettingsDto,
  UpdatePlatformBillingSettingsRequest,
  PlatformUploadSettingsDto,
  UpdatePlatformUploadSettingsRequest,
  CommunicationSettingsDto,
  UpdateCommunicationSettingsRequest,
  QuotaPlanDto,
  CreateQuotaPlanRequest,
  UpdateQuotaPlanRequest,
  AnnouncementDto,
  AnnouncementAttachmentDto,
  AnnouncementCommentDto,
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
  ApproveAnnouncementRequest,
  CreateAnnouncementCommentRequest,
  AnnouncementStatsDto,
  AnnouncementSettingsDto,
  SubscriptionPlanDto,
  FeatureCatalogItemDto,
  CondominiumSubscriptionDto,
  AssignSubscriptionRequest,
  SubscriptionStatsDto,
  CreateSubscriptionPlanRequest,
  UpdateSubscriptionPlanRequest,
  CondominiumActiveUsersDto,
  InvoiceDto,
  MarkInvoicePaidRequest,
  CancelInvoiceRequest,
  InitiateInvoicePaymentResponse,
  SystemEmailSettingsDto,
  UpdateSystemEmailSettingsRequest,
  CsvImportResult,
  ConsentStatusResponse,
  RecordConsentRequest,
  ConsentDefinitionDto,
  UpdateConsentDefinitionRequest,
  PublishConsentVersionRequest,
  ErasureRequest,
  ErasureResult,
  MeLocalizationDto,
  SetLanguageRequest,
  PlatformLocalizationSettingsDto,
  UpdatePlatformLocalizationSettingsRequest,
  PublicLocalizationDefaultDto,
} from '../types';

export const authApi = {
  login: (data: LoginRequest) => api.post<AuthResponse>('/platform/auth/login', data),
  completeTwoFactorLogin: (data: CompleteTwoFactorLoginRequest) => api.post<AuthResponse>('/platform/auth/login/2fa', data),
  register: (data: RegisterRequest) => api.post<AuthResponse>('/platform/auth/register', data),
  forgotPassword: (data: { email: string }) => api.post('/platform/auth/forgot-password', data),
  resetPassword: (data: { email: string; token: string; newPassword: string }) =>
    api.post('/platform/auth/reset-password', data),
  getSecurityOverview: () => api.get<TwoFactorSecurityResponse>('/platform/auth/security'),
  setupTwoFactor: () => api.post<TwoFactorSetupResponse>('/platform/auth/2fa/setup'),
  verifyTwoFactorSetup: (data: VerifyTwoFactorSetupRequest) =>
    api.post<TwoFactorSetupCompleteResponse>('/platform/auth/2fa/verify-setup', data),
  disableTwoFactor: (data: DisableTwoFactorRequest) => api.post('/platform/auth/2fa/disable', data),
  regenerateRecoveryCodes: (data: RegenerateRecoveryCodesRequest) =>
    api.post<RecoveryCodesResponse>('/platform/auth/2fa/recovery-codes/regenerate', data),
  unlinkProvider: (provider: 'google' | 'microsoft') => api.delete(`/platform/auth/providers/${provider}`),
};

// Current user memberships & active-context switching (REQ-AUTH-006)
export const meApi = {
  getMemberships: () => api.get<MembershipsResponse>('/platform/me/memberships'),
  setActiveContext: (data: SetActiveContextRequest) =>
    api.post<AuthResponse>('/platform/me/active-context', data),
  getConsents: () => api.get<ConsentStatusResponse>('/platform/me/consents'),
  recordConsent: (data: RecordConsentRequest) =>
    api.post<ConsentStatusResponse>('/platform/me/consents', data),
  // RGPD/GDPR self-service (REQ-SEC-006). Export returns a JSON file download;
  // the blob is handled by the caller (object URL + temporary anchor).
  exportData: () => api.get('/platform/me/export', { responseType: 'blob' }),
  eraseData: (data: ErasureRequest) =>
    api.post<ErasureResult>('/platform/me/personal-data/erasure', data),
  getLocalization: () => api.get<MeLocalizationDto>('/platform/me/localization'),
  setLanguage: (data: SetLanguageRequest) =>
    api.put<MeLocalizationDto>('/platform/me/language', data),
};

// Platform-wide localization settings (REQ-I18N-001). Read allowed for any
// authenticated user; PUT is Manager-only server-side.
export const platformLocalizationApi = {
  get: () =>
    api.get<PlatformLocalizationSettingsDto>('/platform/localization-settings'),
  update: (data: UpdatePlatformLocalizationSettingsRequest) =>
    api.put<PlatformLocalizationSettingsDto>('/platform/localization-settings', data),
  getPublicDefault: () =>
    api.get<PublicLocalizationDefaultDto>('/platform/localization-settings/public'),
};

// Manager-only consent authoring & versioning (REQ-SEC-008). All endpoints are
// Manager-only server-side; a non-Manager receives HTTP 403.
export const consentAdminApi = {
  list: () => api.get<ConsentDefinitionDto[]>('/platform/consents'),
  update: (id: string, data: UpdateConsentDefinitionRequest) =>
    api.put<ConsentDefinitionDto>(`/platform/consents/${id}`, data),
  publish: (data: PublishConsentVersionRequest) =>
    api.post<ConsentDefinitionDto>('/platform/consents', data),
};

// New users API
export const usersApi = {
  getAll: () => api.get<UserDto[]>('/platform/users'),
  getPaged: (page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<UserDto>>(`/platform/users/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getByCondominium: (condominiumId: string) => api.get<UserDto[]>(`/platform/users/condominium/${condominiumId}`),
  getByCondominiumPaged: (condominiumId: string, page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<UserDto>>(`/platform/users/condominium/${condominiumId}/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getMe: () => api.get<UserDto>('/platform/users/me'),
  getById: (id: string) => api.get<UserDto>(`/platform/users/${id}`),
  create: (data: CreateUserRequest) => {
    // Convert role to string if it's a number
    const payload = {
      ...data,
      role: typeof data.role === 'number' ? data.role.toString() : data.role,
    };
    return api.post<UserDto>('/platform/users', payload);
  },
  update: (id: string, data: UpdateUserRequest) => {
    // Convert role to string if it's a number for backend compatibility
    const payload = {
      ...data,
      role: typeof data.role === 'number' ? data.role.toString() : data.role,
    };
    return api.put<UserDto>(`/platform/users/${id}`, payload);
  },
  updatePassword: (id: string, data: { currentPassword: string; newPassword: string }) =>
    api.put(`/platform/users/${id}/password`, data),
  getActiveLastMonthByCondominium: () =>
    api.get<CondominiumActiveUsersDto[]>('/platform/users/active-last-month-by-condominium'),
  delete: (id: string) => api.delete(`/platform/users/${id}`),
};

// New condominiums API
export const condominiumsApi = {
  getAll: () => api.get<CondominiumDto[]>('/platform/condominiums'),
  getPublic: () => api.get<CondominiumPublicDto[]>('/platform/condominiums/public'),
  getUnitsPublic: (condominiumId: string) =>
    api.get<UnitPublicDto[]>(`/platform/condominiums/${condominiumId}/units/public`),
  getPaged: (page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<CondominiumDto>>(`/platform/condominiums/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getById: (id: string) => api.get<CondominiumDto>(`/platform/condominiums/${id}`),
  create: (data: CreateCondominiumRequest) => api.post<CondominiumDto>('/platform/condominiums', data),
  update: (id: string, data: UpdateCondominiumRequest) =>
    api.put<CondominiumDto>(`/platform/condominiums/${id}`, data),
  updateEmail: (id: string, email?: string) =>
    api.put<CondominiumDto>(`/platform/condominiums/${id}/email`, { email }),
  updateContactPhone: (id: string, contactPhone?: string) =>
    api.put<CondominiumDto>(`/platform/condominiums/${id}/contact-phone`, { contactPhone }),
  delete: (id: string) => api.delete(`/platform/condominiums/${id}`),
};

export const unitsApi = {
  getAll: (condominiumId: string) => api.get<UnitDto[]>(`/condominiums/${condominiumId}/units`),
  getPaged: (condominiumId: string, page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<UnitDto>>(`/condominiums/${condominiumId}/units/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getById: (condominiumId: string, id: string) => api.get<UnitDto>(`/condominiums/${condominiumId}/units/${id}`),
  create: (condominiumId: string, data: CreateUnitRequest) => api.post<UnitDto>(`/condominiums/${condominiumId}/units`, data),
  update: (condominiumId: string, id: string, data: Partial<CreateUnitRequest>) => api.put<UnitDto>(`/condominiums/${condominiumId}/units/${id}`, data),
  delete: (condominiumId: string, id: string) => api.delete(`/condominiums/${condominiumId}/units/${id}`),
  importCsv: (condominiumId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<CsvImportResult>(`/condominiums/${condominiumId}/units/import-csv`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const maintenanceApi = {
  getAll: (condominiumId: string) => api.get<MaintenanceRequestDto[]>(`/condominiums/${condominiumId}/maintenance`),
  getPaged: (condominiumId: string, page: number = 1, pageSize: number = 10, search?: string, status?: string) =>
    api.get<PaginatedResponse<MaintenanceRequestDto>>(`/condominiums/${condominiumId}/maintenance/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}${status ? `&status=${encodeURIComponent(status)}` : ''}`),
  getStatusCounts: (condominiumId: string) =>
    api.get<MaintenanceStatusCountsDto>(`/condominiums/${condominiumId}/maintenance/status-counts`),
  getById: (condominiumId: string, id: string) => api.get<MaintenanceRequestDto>(`/condominiums/${condominiumId}/maintenance/${id}`),
  create: (condominiumId: string, data: CreateMaintenanceRequest) => api.post<MaintenanceRequestDto>(`/condominiums/${condominiumId}/maintenance`, data),
  update: (condominiumId: string, id: string, data: Partial<CreateMaintenanceRequest> & { status?: string }) =>
    api.put<MaintenanceRequestDto>(`/condominiums/${condominiumId}/maintenance/${id}`, data),
  updateStatus: (condominiumId: string, id: string, data: { 
    status: string; 
    supplierId?: string; 
    adminComments?: string;
    hasExpense?: boolean;
    expenseAmount?: number;
    invoiceDocumentId?: string;
  }) =>
    api.put<MaintenanceRequestDto>(`/condominiums/${condominiumId}/maintenance/${id}/status`, data),
  delete: (condominiumId: string, id: string) => api.delete(`/condominiums/${condominiumId}/maintenance/${id}`),
};

export const financialApi = {
  getAll: (condominiumId: string) => api.get<FinancialRecordDto[]>(`/condominiums/${condominiumId}/financial`),
  getPaged: (condominiumId: string, page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<FinancialRecordDto>>(`/condominiums/${condominiumId}/financial/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getSummary: (condominiumId: string) => api.get<FinancialSummaryDto>(`/condominiums/${condominiumId}/financial/summary`),
  getDashboard: (condominiumId: string, fiscalYear?: number) =>
    api.get<FinancialDashboardDto>(`/condominiums/${condominiumId}/financial/dashboard${fiscalYear ? `?fiscalYear=${fiscalYear}` : ''}`),
  getFiscalYears: (condominiumId: string) => api.get<number[]>(`/condominiums/${condominiumId}/financial/fiscal-years`),
  getByYear: (condominiumId: string, fiscalYear: number, page: number = 1, pageSize: number = 10, search?: string, type?: string) =>
    api.get<PaginatedResponse<FinancialRecordDto>>(`/condominiums/${condominiumId}/financial/by-year?fiscalYear=${fiscalYear}&page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}${type ? `&type=${encodeURIComponent(type)}` : ''}`),
  create: (condominiumId: string, data: CreateFinancialRecordRequest) => api.post<FinancialRecordDto>(`/condominiums/${condominiumId}/financial`, data),
  delete: (condominiumId: string, id: string) => api.delete(`/condominiums/${condominiumId}/financial/${id}`),
  
  // Reserve Fund
  getReserveFund: (condominiumId: string, fiscalYear?: number) =>
    api.get<ReserveFundDto>(`/condominiums/${condominiumId}/financial/reserve-fund${fiscalYear ? `?fiscalYear=${fiscalYear}` : ''}`),
  getCurrentReserveFund: (condominiumId: string) =>
    api.get<ReserveFundDto>(`/condominiums/${condominiumId}/financial/reserve-fund/current`),
  getReserveFundHistory: (condominiumId: string) =>
    api.get<ReserveFundDto[]>(`/condominiums/${condominiumId}/financial/reserve-fund/history`),
  addDeposit: (condominiumId: string, amount: number) =>
    api.post<ReserveFundDto>(`/condominiums/${condominiumId}/financial/reserve-fund/deposit`, { deposits: amount }),
  addWithdrawal: (condominiumId: string, amount: number) =>
    api.post<ReserveFundDto>(`/condominiums/${condominiumId}/financial/reserve-fund/withdrawal`, { withdrawals: amount }),
};

export const notificationsApi = {
  getAll: (condominiumId: string, page: number = 1, pageSize: number = 10) => 
    api.get<PaginatedResponse<NotificationDto>>(`/condominiums/${condominiumId}/notifications?page=${page}&pageSize=${pageSize}`),
  markRead: (condominiumId: string, id: string) => api.put<NotificationDto>(`/condominiums/${condominiumId}/notifications/${id}/read`),
  markAllRead: (condominiumId: string) => api.put(`/condominiums/${condominiumId}/notifications/mark-all-read`),
  clearAll: (condominiumId: string) => api.delete(`/condominiums/${condominiumId}/notifications/clear-all`),
  delete: (condominiumId: string, id: string) => api.delete(`/condominiums/${condominiumId}/notifications/${id}`),
};

export const reservationsApi = {
  getAll: (condominiumId: string) => api.get<ReservationDto[]>(`/condominiums/${condominiumId}/reservations`),
  getPaged: (condominiumId: string, page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<ReservationDto>>(`/condominiums/${condominiumId}/reservations/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  create: (condominiumId: string, data: { spaceId: string; userId: string; startTime: string; endTime: string }) =>
    api.post<ReservationDto>(`/condominiums/${condominiumId}/reservations`, data),
  update: (condominiumId: string, id: string, data: { spaceId: string; startTime: string; endTime: string }) =>
    api.put<ReservationDto>(`/condominiums/${condominiumId}/reservations/${id}`, data),
  delete: (condominiumId: string, id: string) => api.delete(`/condominiums/${condominiumId}/reservations/${id}`),
  approve: (condominiumId: string, id: string, adminComments?: string) =>
    api.post<ReservationDto>(`/condominiums/${condominiumId}/reservations/${id}/approve`, { adminComments: adminComments || '' }),
  reject: (condominiumId: string, id: string, adminComments?: string) =>
    api.post<ReservationDto>(`/condominiums/${condominiumId}/reservations/${id}/reject`, { adminComments: adminComments || '' }),
  requestCancellation: (condominiumId: string, id: string) =>
    api.post<ReservationDto>(`/condominiums/${condominiumId}/reservations/${id}/request-cancellation`, {}),
  approveCancellation: (condominiumId: string, id: string, adminComments?: string) =>
    api.post<ReservationDto>(`/condominiums/${condominiumId}/reservations/${id}/approve-cancellation`, { adminComments: adminComments || '' }),
  rejectCancellation: (condominiumId: string, id: string, adminComments?: string) =>
    api.post<ReservationDto>(`/condominiums/${condominiumId}/reservations/${id}/reject-cancellation`, { adminComments: adminComments || '' }),
};

export const sharedSpacesApi = {
  getAll: (condominiumId: string) => api.get<SharedSpaceDto[]>(`/condominiums/${condominiumId}/shared-spaces`),
  getPaged: (condominiumId: string, page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<SharedSpaceDto>>(`/condominiums/${condominiumId}/shared-spaces/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getById: (condominiumId: string, id: string) => api.get<SharedSpaceDto>(`/condominiums/${condominiumId}/shared-spaces/${id}`),
  create: (condominiumId: string, data: { name: string; description: string; capacity?: number; condominiumId: string; rules: string; reservationFee?: number; color?: string }) => 
    api.post<SharedSpaceDto>(`/condominiums/${condominiumId}/shared-spaces`, data),
  update: (condominiumId: string, id: string, data: { name: string; description: string; capacity?: number; rules: string; reservationFee?: number; color?: string }) => 
    api.put<SharedSpaceDto>(`/condominiums/${condominiumId}/shared-spaces/${id}`, data),
  delete: (condominiumId: string, id: string) => api.delete(`/condominiums/${condominiumId}/shared-spaces/${id}`),
};

export const documentsApi = {
  getAll: (condominiumId: string) => api.get<DocumentDto[]>(`/condominiums/${condominiumId}/documents`),
  getPaged: (condominiumId: string, page: number = 1, pageSize: number = 10, search?: string, context?: string) =>
    api.get<PaginatedResponse<DocumentDto>>(`/condominiums/${condominiumId}/documents/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}${context ? `&context=${context}` : ''}`),
  getById: (condominiumId: string, id: string) => api.get<DocumentDto>(`/condominiums/${condominiumId}/documents/${id}`),
  getByContext: (condominiumId: string, context: string) => api.get<DocumentDto[]>(`/condominiums/${condominiumId}/documents/by-context/${context}`),
  getByUnit: (condominiumId: string, unitId: string) => api.get<DocumentDto[]>(`/condominiums/${condominiumId}/documents/unit/${unitId}`),
  getByAssembly: (condominiumId: string, assemblyId: string) => api.get<DocumentDto[]>(`/condominiums/${condominiumId}/documents/assembly/${assemblyId}`),
  getByMaintenance: (condominiumId: string, maintenanceId: string) => api.get<DocumentDto[]>(`/condominiums/${condominiumId}/documents/maintenance/${maintenanceId}`),
  upload: (condominiumId: string, formData: FormData) => api.post<DocumentDto>(`/condominiums/${condominiumId}/documents/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadMultiple: (condominiumId: string, formData: FormData) => api.post<{ success: number; failed: number; documents: DocumentDto[]; errors: string[] }>(`/condominiums/${condominiumId}/documents/upload-multiple`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  download: async (condominiumId: string, id: string, fileName: string) => {
    const response = await api.get(`/condominiums/${condominiumId}/documents/${id}/download`, {
      responseType: 'blob',
    });
    // Get the content type from response headers
    const contentType = String(response.headers['content-type'] || 'application/octet-stream');
    
    // Try to extract filename from Content-Disposition header if available
    const contentDisposition = String(response.headers['content-disposition'] || '');
    let downloadFileName = fileName;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        downloadFileName = filenameMatch[1].replace(/['"]/g, '');
      }
    }
    
    const blob = new Blob([response.data], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', downloadFileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  delete: (condominiumId: string, id: string) => api.delete(`/condominiums/${condominiumId}/documents/${id}`),
};

export const assembliesApi = {
  getAll: (condominiumId: string) => api.get<AssemblyDto[]>(`/condominiums/${condominiumId}/assemblies`),
  getPaged: (condominiumId: string, page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<AssemblyDto>>(`/condominiums/${condominiumId}/assemblies/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getById: (condominiumId: string, id: string) => api.get<AssemblyDto>(`/condominiums/${condominiumId}/assemblies/${id}`),
  create: (condominiumId: string, data: CreateAssemblyRequest) => api.post<AssemblyDto>(`/condominiums/${condominiumId}/assemblies`, data),
  update: (condominiumId: string, id: string, data: UpdateAssemblyRequest) => api.put<AssemblyDto>(`/condominiums/${condominiumId}/assemblies/${id}`, data),
  updateMinutes: (condominiumId: string, id: string, minutes: string) => api.put<AssemblyDto>(`/condominiums/${condominiumId}/assemblies/${id}/minutes`, { minutes }),
  updateMinutesDraft: (condominiumId: string, id: string, minutes: string) => api.put<AssemblyDto>(`/condominiums/${condominiumId}/assemblies/${id}/draft-minutes`, { minutes }),
  updateNotes: (condominiumId: string, id: string, notes: string) => api.put<AssemblyDto>(`/condominiums/${condominiumId}/assemblies/${id}/notes`, { notes }),
  cancel: (condominiumId: string, id: string, cancellationReason: string) => api.put<AssemblyDto>(`/condominiums/${condominiumId}/assemblies/${id}/cancel`, { cancellationReason }),
  delete: (condominiumId: string, id: string) => api.delete(`/condominiums/${condominiumId}/assemblies/${id}`),
};

export const suppliersApi = {
  getAll: (condominiumId: string) => api.get<SupplierDto[]>(`/condominiums/${condominiumId}/suppliers`),
  getPaged: (condominiumId: string, page: number = 1, pageSize: number = 10, search?: string) =>
    api.get<PaginatedResponse<SupplierDto>>(`/condominiums/${condominiumId}/suppliers/paged?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getById: (condominiumId: string, id: string) => api.get<SupplierDto>(`/condominiums/${condominiumId}/suppliers/${id}`),
  create: (condominiumId: string, data: CreateSupplierRequest) => api.post<SupplierDto>(`/condominiums/${condominiumId}/suppliers`, data),
  update: (condominiumId: string, id: string, data: UpdateSupplierRequest) => api.put<SupplierDto>(`/condominiums/${condominiumId}/suppliers/${id}`, data),
  delete: (condominiumId: string, id: string) => api.delete(`/condominiums/${condominiumId}/suppliers/${id}`),
};

export const usefulContactsApi = {
  getAll: (condominiumId: string) =>
    api.get<UsefulContactDto[]>(`/condominiums/${condominiumId}/useful-contacts`),
  getById: (condominiumId: string, id: string) =>
    api.get<UsefulContactDto>(`/condominiums/${condominiumId}/useful-contacts/${id}`),
  create: (condominiumId: string, data: CreateUsefulContactRequest) =>
    api.post<UsefulContactDto>(`/condominiums/${condominiumId}/useful-contacts`, data),
  update: (condominiumId: string, id: string, data: UpdateUsefulContactRequest) =>
    api.put<UsefulContactDto>(`/condominiums/${condominiumId}/useful-contacts/${id}`, data),
  delete: (condominiumId: string, id: string) =>
    api.delete(`/condominiums/${condominiumId}/useful-contacts/${id}`),
};

export const paymentsApi = {
  // Resident endpoints
  create: (condominiumId: string, data: CreatePaymentRequest) => api.post<PaymentDto>(`/condominiums/${condominiumId}/payments`, data),
  getMyPayments: (condominiumId: string) => api.get<PaymentDto[]>(`/condominiums/${condominiumId}/payments`),
  getMyPaymentsPaged: (condominiumId: string, page: number = 1, pageSize: number = 10, opts?: { status?: string; search?: string }) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (opts?.status && opts.status !== 'All') params.set('status', opts.status);
    if (opts?.search) params.set('search', opts.search);
    return api.get<PaginatedResponse<PaymentDto>>(`/condominiums/${condominiumId}/payments/my/paged?${params.toString()}`);
  },
  getMyStatusCounts: (condominiumId: string) =>
    api.get<PaymentStatusCountsDto>(`/condominiums/${condominiumId}/payments/my/status-counts`),
  getById: (condominiumId: string, id: string) => api.get<PaymentDto>(`/condominiums/${condominiumId}/payments/${id}`),
  uploadProof: (condominiumId: string, id: string, proofUrl: string) => api.post(`/condominiums/${condominiumId}/payments/${id}/proof`, { proofUrl }),
  downloadProof: async (condominiumId: string, id: string, description: string) => {
    const response = await api.get(`/condominiums/${condominiumId}/payments/${id}/proof/download`, {
      responseType: 'blob',
    });

    const contentType = String(response.headers['content-type'] || 'application/octet-stream');
    const contentDisposition = String(response.headers['content-disposition'] || '');
    let fileName = `Comprovativo - ${description}.pdf`;

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        fileName = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    const blob = new Blob([response.data], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
  cancel: (condominiumId: string, id: string) => api.put<PaymentDto>(`/condominiums/${condominiumId}/payments/${id}/cancel`),
  
  // Admin endpoints
  getPending: (condominiumId: string) => api.get<PaymentDto[]>(`/condominiums/${condominiumId}/payments/pending`),
  getPaged: (condominiumId: string, page: number = 1, pageSize: number = 10) =>
    api.get<PaginatedResponse<PaymentDto>>(`/condominiums/${condominiumId}/payments/paged?page=${page}&pageSize=${pageSize}`),
  approve: (condominiumId: string, id: string, data?: ApprovePaymentRequest) => api.put<PaymentDto>(`/condominiums/${condominiumId}/payments/${id}/approve`, data || {}),
  reject: (condominiumId: string, id: string, data: RejectPaymentRequest) => api.put<PaymentDto>(`/condominiums/${condominiumId}/payments/${id}/reject`, data),
  issueReceipt: (condominiumId: string, id: string) => api.post(`/condominiums/${condominiumId}/payments/${id}/issue-receipt`),
  downloadReceipt: async (condominiumId: string, id: string, receiptNumber: number, receiptYear: number) => {
    const response = await api.get(`/condominiums/${condominiumId}/payments/${id}/receipt`, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Recibo_${receiptNumber}_${receiptYear}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

export const paymentMethodsApi = {
  get: (condominiumId: string) => api.get<PaymentMethodsDto>(`/condominiums/${condominiumId}/payment-methods`),
};

export const paymentSettingsApi = {
  get: (condominiumId: string) => api.get<PaymentSettingsDto>(`/condominiums/${condominiumId}/payment-settings`),
  update: (condominiumId: string, data: UpdatePaymentSettingsRequest) => 
    api.put<PaymentSettingsDto>(`/condominiums/${condominiumId}/payment-settings`, data),
};

export const receiptTemplateSettingsApi = {
  get: (condominiumId: string) => api.get<ReceiptTemplateSettingsDto>(`/condominiums/${condominiumId}/receipt-template-settings`),
  update: (condominiumId: string, data: UpdateReceiptTemplateSettingsRequest) => 
    api.put<ReceiptTemplateSettingsDto>(`/condominiums/${condominiumId}/receipt-template-settings`, data),
};

export const communicationSettingsApi = {
  get: (condominiumId: string) => api.get<CommunicationSettingsDto>(`/condominiums/${condominiumId}/communication-settings`),
  update: (condominiumId: string, data: UpdateCommunicationSettingsRequest) => 
    api.put<CommunicationSettingsDto>(`/condominiums/${condominiumId}/communication-settings`, data),
};

export const quotaPlansApi = {
  getAll: (condominiumId: string) => api.get<QuotaPlanDto[]>(`/condominiums/${condominiumId}/quota-plans`),
  getById: (condominiumId: string, id: string) => api.get<QuotaPlanDto>(`/condominiums/${condominiumId}/quota-plans/${id}`),
  create: (condominiumId: string, data: CreateQuotaPlanRequest) => 
    api.post<QuotaPlanDto>(`/condominiums/${condominiumId}/quota-plans`, data),
  update: (condominiumId: string, id: string, data: UpdateQuotaPlanRequest) => 
    api.put<QuotaPlanDto>(`/condominiums/${condominiumId}/quota-plans/${id}`, data),
  apply: (condominiumId: string, id: string) => 
    api.post<{ message: string }>(`/condominiums/${condominiumId}/quota-plans/${id}/apply`, {}),
  delete: (condominiumId: string, id: string) => 
    api.delete(`/condominiums/${condominiumId}/quota-plans/${id}`),
};

export const announcementsApi = {
  getAll: (condominiumId: string, status?: string) =>
    api.get<AnnouncementDto[]>(`/condominiums/${condominiumId}/announcements${status ? `?status=${status}` : ''}`),
  getPaged: (condominiumId: string, page: number = 1, pageSize: number = 10, opts?: { status?: string; category?: string; search?: string }) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (opts?.status && opts.status !== 'All') params.set('status', opts.status);
    if (opts?.category && opts.category !== 'All') params.set('category', opts.category);
    if (opts?.search) params.set('search', opts.search);
    return api.get<PaginatedResponse<AnnouncementDto>>(`/condominiums/${condominiumId}/announcements/paged?${params.toString()}`);
  },
  getById: (condominiumId: string, id: string) =>
    api.get<AnnouncementDto>(`/condominiums/${condominiumId}/announcements/${id}`),
  getStats: (condominiumId: string) =>
    api.get<AnnouncementStatsDto>(`/condominiums/${condominiumId}/announcements/stats`),
  getSettings: (condominiumId: string) =>
    api.get<AnnouncementSettingsDto>(`/condominiums/${condominiumId}/announcements/settings`),
  create: (condominiumId: string, data: CreateAnnouncementRequest) =>
    api.post<AnnouncementDto>(`/condominiums/${condominiumId}/announcements`, data),
  update: (condominiumId: string, id: string, data: UpdateAnnouncementRequest) =>
    api.put<AnnouncementDto>(`/condominiums/${condominiumId}/announcements/${id}`, data),
  publish: (condominiumId: string, id: string) =>
    api.post<{ message: string }>(`/condominiums/${condominiumId}/announcements/${id}/publish`, {}),
  approve: (condominiumId: string, id: string, data: ApproveAnnouncementRequest) =>
    api.post<{ message: string }>(`/condominiums/${condominiumId}/announcements/${id}/approve`, data),
  togglePin: (condominiumId: string, id: string) =>
    api.post<{ isPinned: boolean }>(`/condominiums/${condominiumId}/announcements/${id}/pin`, {}),
  delete: (condominiumId: string, id: string) =>
    api.delete(`/condominiums/${condominiumId}/announcements/${id}`),
  addComment: (condominiumId: string, id: string, data: CreateAnnouncementCommentRequest) =>
    api.post<AnnouncementCommentDto>(`/condominiums/${condominiumId}/announcements/${id}/comments`, data),
  deleteComment: (condominiumId: string, announcementId: string, commentId: string) =>
    api.delete(`/condominiums/${condominiumId}/announcements/${announcementId}/comments/${commentId}`),
  uploadAttachment: (condominiumId: string, id: string, formData: FormData) =>
    api.post<AnnouncementAttachmentDto>(`/condominiums/${condominiumId}/announcements/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  downloadAttachment: (condominiumId: string, announcementId: string, attachmentId: string) =>
    api.get(`/condominiums/${condominiumId}/announcements/${announcementId}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    }),
  deleteAttachment: (condominiumId: string, announcementId: string, attachmentId: string) =>
    api.delete(`/condominiums/${condominiumId}/announcements/${announcementId}/attachments/${attachmentId}`),
};

export const subscriptionsApi = {
  getPlans: () => api.get<SubscriptionPlanDto[]>('/platform/subscriptions/plans'),
  getPlanById: (id: string) => api.get<SubscriptionPlanDto>(`/platform/subscriptions/plans/${id}`),
  getFeatureCatalog: () => api.get<FeatureCatalogItemDto[]>('/platform/subscriptions/features/catalog'),
  createPlan: (data: CreateSubscriptionPlanRequest) => api.post<SubscriptionPlanDto>('/platform/subscriptions/plans', data),
  updatePlan: (id: string, data: UpdateSubscriptionPlanRequest) => api.put<SubscriptionPlanDto>(`/platform/subscriptions/plans/${id}`, data),
  resetDefaultPlans: () => api.post<SubscriptionPlanDto[]>('/platform/subscriptions/plans/reset-defaults', {}),
  getAll: () => api.get<CondominiumSubscriptionDto[]>('/platform/subscriptions'),
  getStats: () => api.get<SubscriptionStatsDto>('/platform/subscriptions/stats'),
  getMy: () => api.get<CondominiumSubscriptionDto>('/platform/subscriptions/my'),
  assign: (data: AssignSubscriptionRequest) => api.post<CondominiumSubscriptionDto>('/platform/subscriptions', data),
  cancel: (id: string) => api.delete(`/platform/subscriptions/${id}`),
};

export const userRegistrationApi = {
  registerResident: (condominiumId: string, data: RegisterResidentRequest) =>
    api.post<{ message: string }>(`/platform/userregistration/register/${condominiumId}/resident`, data),
  getPendingUsers: () => api.get<PendingUserDto[]>('/platform/userregistration/pending'),
  approveUser: (userId: string) => api.post<{ message: string }>(`/platform/userregistration/pending/${userId}/approve`, {}),
  rejectUser: (userId: string) => api.delete<{ message: string }>(`/platform/userregistration/pending/${userId}/reject`),
};

export const invoicesApi = {
  list: (condominiumId: string) =>
    api.get<InvoiceDto[]>(`/platform/invoices/${condominiumId}`),
  get: (invoiceId: string) =>
    api.get<InvoiceDto>(`/platform/invoices/detail/${invoiceId}`),
  markPaid: (invoiceId: string, data: MarkInvoicePaidRequest) =>
    api.post<InvoiceDto>(`/platform/invoices/detail/${invoiceId}/mark-paid`, data),
  cancel: (invoiceId: string, data: CancelInvoiceRequest) =>
    api.post<InvoiceDto>(`/platform/invoices/detail/${invoiceId}/cancel`, data),
  generateDue: () =>
    api.post<{ message: string }>('/platform/invoices/generate-due', {}),
  initiatePayment: (invoiceId: string) =>
    api.post<InitiateInvoicePaymentResponse>(`/platform/invoices/detail/${invoiceId}/initiate-payment`, {}),
  exportSaftJson: (condominiumId: string, year: number) =>
    api.get(`/platform/invoices/${condominiumId}/saft?year=${year}`),
  saftXmlUrl: (condominiumId: string, year: number) =>
    `/api/platform/invoices/${condominiumId}/saft?year=${year}&format=xml`,
  downloadSaftXml: async (condominiumId: string, year: number, fileName?: string) => {
    const response = await api.get(`/platform/invoices/${condominiumId}/saft?year=${year}&format=xml`, { responseType: 'blob' });
    const contentType = String(response.headers['content-type'] || 'application/xml');
    const contentDisposition = String(response.headers['content-disposition'] || '');
    let downloadFileName = fileName || `SAFT-${condominiumId}_${year}.xml`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        downloadFileName = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    const blob = new Blob([response.data], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
  downloadPdf: async (invoiceId: string, fileName?: string) => {
    const response = await api.get(`/platform/invoices/detail/${invoiceId}/pdf`, { responseType: 'blob' });
    const contentType = String(response.headers['content-type'] || 'application/pdf');
    const contentDisposition = String(response.headers['content-disposition'] || '');
    let downloadFileName = fileName || `Invoice_${invoiceId}.pdf`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        downloadFileName = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    const blob = new Blob([response.data], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

export const platformBillingSettingsApi = {
  get: () => api.get<PlatformBillingSettingsDto>('/platform/platformbillingsettings'),
  update: (data: UpdatePlatformBillingSettingsRequest) =>
    api.put<PlatformBillingSettingsDto>('/platform/platformbillingsettings', data),
};



export const systemEmailSettingsApi = {
  get: () => api.get<SystemEmailSettingsDto>('/platform/systememailsettings'),
  update: (data: UpdateSystemEmailSettingsRequest) =>
    api.put<SystemEmailSettingsDto>('/platform/systememailsettings', data),
  test: () => api.post<{ message: string }>('/platform/systememailsettings/test', {}),
};

export const uploadSettingsApi = {
  get: () => api.get<PlatformUploadSettingsDto>('/platform/uploadsettings'),
  update: (data: UpdatePlatformUploadSettingsRequest) =>
    api.put<PlatformUploadSettingsDto>('/platform/uploadsettings', data),
};
