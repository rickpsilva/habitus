export interface AuthResponse {
  token: string;
  email: string;
  name: string;
  role: UserRole;
  condominiumId?: string;
  unitId?: string;
  accessibleCondominiums?: string[];
  requiresTwoFactor?: boolean;
  challengeId?: string;
  availableTwoFactorMethods?: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CompleteTwoFactorLoginRequest {
  challengeId: string;
  code: string;
  useRecoveryCode: boolean;
}

export interface TwoFactorSetupResponse {
  isEnabled: boolean;
  manualEntryKey: string;
  otpauthUri: string;
}

export interface VerifyTwoFactorSetupRequest {
  code: string;
}

export interface TwoFactorSetupCompleteResponse {
  twoFactorEnabled: boolean;
  recoveryCodes: string[];
}

export interface DisableTwoFactorRequest {
  currentPassword: string;
  code: string;
  useRecoveryCode: boolean;
}

export interface RegenerateRecoveryCodesRequest {
  currentPassword: string;
  code: string;
  useRecoveryCode: boolean;
}

export interface RecoveryCodesResponse {
  recoveryCodes: string[];
}

export interface LinkedAuthProviderDto {
  provider: string;
  providerEmail: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface TwoFactorSecurityResponse {
  twoFactorEnabled: boolean;
  recoveryCodesRemaining: number;
  linkedProviders: LinkedAuthProviderDto[];
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phone: string;
  unitId?: string;
  condominiumId?: string;
  role?: 'Manager' | 'Admin' | 'Resident';
}

export interface RegisterResidentRequest {
  name: string;
  email: string;
  password: string;
  phone: string;
  unitId: string;
}

export interface CondominiumPublicDto {
  id: string;
  name: string;
  address: string;
}

export interface UnitPublicDto {
  id: string;
  number: string;
  floor: number;
  apartmentNumber?: string;
}

export interface PendingUserDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  unitId?: string;
  unitNumber?: string;
  condominiumId?: string;
  createdAt: string;
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

export interface CondominiumActiveUsersDto {
  condominiumId: string;
  condominiumName: string;
  activeUsersLastMonth: number;
}

export interface CondominiumDto {
  id: string;
  name: string;
  address: string;
  taxId: string;
  postalCode?: string;
  locality?: string;
  contactPhone?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
}

export interface CreateCondominiumRequest {
  name: string;
  address: string;
  taxId: string;
  email?: string;
  postalCode?: string;
  locality?: string;
  contactPhone?: string;
}

export interface UpdateCondominiumRequest {
  id: string;
  name: string;
  address: string;
  taxId: string;
  email?: string;
  postalCode?: string;
  locality?: string;
  contactPhone?: string;
  isActive: boolean;
}

export interface UnitDto {
  id: string;
  number: string;
  building?: string;
  floor: number;
  type: number;
  apartmentNumber?: string;
  permillage: number;
  monthlyQuota: number;
  condominiumId: string;
}

export interface CreateUnitRequest {
  condominiumId: string;
  number: string;
  building?: string;
  floor: number;
  type: number;
  apartmentNumber?: string;
  permillage: number;
  monthlyQuota: number;
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
  noiseAnnouncementsCurrentYear: number;
  noiseAnnouncementsPreviousYear: number;
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
  capacity?: number;
  condominiumId: string;
  rules: string;
  reservationFee: number;
  color: string;
}

export interface CreateSharedSpaceRequest {
  name: string;
  description: string;
  capacity?: number;
  condominiumId: string;
  rules: string;
  reservationFee?: number;
  color?: string;
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
  email: string;
  phone: string;
  address: string;
  specialty: string;
  isActive: boolean;
  condominiumId: string;
}

export interface CreateSupplierRequest {
  name: string;
  email: string;
  phone: string;
  address: string;
  specialty: string;
  condominiumId: string;
}

export interface UpdateSupplierRequest {
  name: string;
  email: string;
  phone: string;
  address: string;
  specialty: string;
  isActive: boolean;
}

export type UsefulContactCategory = 'Emergency' | 'Service' | 'Administrative' | number;

export interface UsefulContactDto {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  postalCode?: string;
  locality?: string;
  category: UsefulContactCategory;
  condominiumId: string;
}

export interface CreateUsefulContactRequest {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  postalCode?: string;
  locality?: string;
  category: UsefulContactCategory;
  condominiumId?: string;
}

export interface UpdateUsefulContactRequest {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  postalCode?: string;
  locality?: string;
  category: UsefulContactCategory;
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
  // Quota period fields
  quotaPeriodicity?: 'Monthly' | 'Quarterly' | 'Annual';
  quotaMonthStart?: number;
  quotaMonthEnd?: number;
  quotaYear?: number;
}

export interface CreatePaymentRequest {
  type: 'MonthlyFee' | 'Reservation' | 'Other';
  method: 'BankTransfer' | 'MBWay' | 'Card';
  amount: number;
  description: string;
  reservationId?: string;
  // Quota period fields (only when type == MonthlyFee)
  quotaPeriodicity?: 'Monthly' | 'Quarterly' | 'Annual';
  quotaMonthStart?: number;
  quotaMonthEnd?: number;
  quotaYear?: number;
}

export interface ApprovePaymentRequest {
  adminNotes?: string;
}

export interface RejectPaymentRequest {
  rejectionReason: string;
}

export interface PaymentMethodsDto {
  // Bank Transfer Configuration
  bankTransferEnabled: boolean;
  bankTransferIban?: string;
  bankTransferAccountHolder?: string;
  // MB Reference Configuration
  mbReferenceEnabled: boolean;
  mbReferenceEntity?: string;
  mbReferenceReference?: string;
  // MB Way Configuration
  mbWayEnabled: boolean;
  mbWayPhoneNumber?: string;
  // Card Payment Configuration
  cardEnabled: boolean;
  cardProvider?: string;
  cardPublicKey?: string;
}

export interface PaymentSettingsDto {
  id: string;
  condominiumId: string;
  // Bank Transfer Configuration
  bankTransferEnabled: boolean;
  bankTransferIban?: string;
  bankTransferAccountHolder?: string;
  // MB Reference Configuration
  mbReferenceEnabled: boolean;
  mbReferenceEntity?: string;
  mbReferenceReference?: string;
  // MB Way Configuration
  mbWayEnabled: boolean;
  mbWayPhoneNumber?: string;
  mbWayMerchantId?: string;
  // Card Payment Configuration
  cardEnabled: boolean;
  cardProvider?: string;
  cardPublicKey?: string;
  cardMerchantId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePaymentSettingsRequest {
  // Bank Transfer Configuration
  bankTransferEnabled: boolean;
  bankTransferIban?: string;
  bankTransferAccountHolder?: string;
  // MB Reference Configuration
  mbReferenceEnabled: boolean;
  mbReferenceEntity?: string;
  mbReferenceReference?: string;
  // MB Way Configuration
  mbWayEnabled: boolean;
  mbWayPhoneNumber?: string;
  mbWayMerchantId?: string;
  // Card Payment Configuration
  cardEnabled: boolean;
  cardProvider?: string;
  cardPublicKey?: string;
  cardSecretKey?: string;
  cardMerchantId?: string;
}

// Receipt Template Settings
export interface ReceiptTemplateSettingsDto {
  id: string;
  condominiumId: string;
  template?: string;
  templateMonthlyFee?: string;
  templateMonthlyFeeQuarterly?: string;
  templateMonthlyFeeAnnual?: string;
  templateExtraordinaryFee?: string;
  templateReservation?: string;
  templateOther?: string;
  includeCondominiumName: boolean;
  includeTaxId: boolean;
  includeAddress: boolean;
  includePostalCode: boolean;
  includeLocality: boolean;
  includeEmail: boolean;
  includeContactPhone: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateReceiptTemplateSettingsRequest {
  template?: string;
  templateMonthlyFee?: string;
  templateMonthlyFeeQuarterly?: string;
  templateMonthlyFeeAnnual?: string;
  templateExtraordinaryFee?: string;
  templateReservation?: string;
  templateOther?: string;
  includeCondominiumName: boolean;
  includeTaxId: boolean;
  includeAddress: boolean;
  includePostalCode: boolean;
  includeLocality: boolean;
  includeEmail: boolean;
  includeContactPhone: boolean;
}

export interface PlatformBillingSettingsDto {
  id: string;
  gatewayEnabled: boolean;
  gatewayProvider: string;
  publicKey?: string;
  merchantDisplayName?: string;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePlatformBillingSettingsRequest {
  gatewayEnabled: boolean;
  gatewayProvider: string;
  publicKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  merchantDisplayName?: string;
}

export interface PlatformUploadSettingsDto {
  id: string;
  maxUploadSizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePlatformUploadSettingsRequest {
  maxUploadSizeBytes: number;
}

// Communication Settings
export interface CommunicationSettingsDto {
  id: string;
  condominiumId: string;
  // Email Configuration
  emailEnabled: boolean;
  emailSmtpHost?: string;
  emailSmtpPort?: number;
  emailUsername?: string;
  emailUseSsl: boolean;
  // WhatsApp Configuration
  whatsAppEnabled: boolean;
  whatsAppPhoneNumber?: string;
  whatsAppApiProvider?: string;
  whatsAppGroupId?: string;
  // SMS Configuration
  smsEnabled: boolean;
  smsProvider?: string;
  smsFromNumber?: string;
  // Announcements Configuration
  allowAnnouncementComments: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCommunicationSettingsRequest {
  // Email Configuration
  emailEnabled: boolean;
  emailSmtpHost?: string;
  emailSmtpPort?: number;
  emailUsername?: string;
  emailPassword?: string;
  emailUseSsl: boolean;
  // WhatsApp Configuration
  whatsAppEnabled: boolean;
  whatsAppPhoneNumber?: string;
  whatsAppApiKey?: string;
  whatsAppApiProvider?: string;
  whatsAppGroupId?: string;
  // SMS Configuration
  smsEnabled: boolean;
  smsProvider?: string;
  smsApiKey?: string;
  smsFromNumber?: string;
  // Announcements Configuration
  allowAnnouncementComments: boolean;
}

// Quota Plans
export interface QuotaCalculationDto {
  id: string;
  unitId: string;
  unitNumber: string;
  baseMonthlyQuota: number;
  inflationAmount: number;
  monthlyQuota: number;
  quarterlyQuota: number;
  annualQuota: number;
}

export interface QuotaPlanDto {
  id: string;
  condominiumId: string;
  year: number;
  inflationRate: number;
  extraordinaryQuota: number;
  status: 'Draft' | 'Active' | 'Applied' | 'Archived';
  createdAt: string;
  appliedAt?: string;
  appliedBy?: string;
  calculations: QuotaCalculationDto[];
}

export interface CreateQuotaPlanRequest {
  year: number;
  inflationRate: number;
  extraordinaryQuota: number;
}

export interface UpdateQuotaPlanRequest {
  inflationRate: number;
  extraordinaryQuota: number;
}

// Announcements
export interface AnnouncementDto {
  id: string;
  title: string;
  content: string;
  category: string;
  status: string;
  isAnonymous: boolean;
  isPinned: boolean;
  validUntil?: string;
  createdAt: string;
  publishedAt?: string;
  updatedAt?: string;
  authorId: string;
  authorName: string;
  condominiumId: string;
  unitId?: string;
  unitNumber?: string;
  approvedByUserId?: string;
  approvedByUserName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  totalReads: number;
  totalComments: number;
  totalAttachments: number;
  isReadByCurrentUser: boolean;
  attachments: AnnouncementAttachmentDto[];
  comments: AnnouncementCommentDto[];
}

export interface AnnouncementAttachmentDto {
  id: string;
  announcementId: string;
  fileName: string;
  filePath: string;
  type: string;
  fileSize: number;
  contentType?: string;
  uploadedAt: string;
}

export interface AnnouncementCommentDto {
  id: string;
  announcementId: string;
  authorId: string;
  authorName: string;
  unitId?: string;
  unitNumber?: string;
  content: string;
  isAnonymous: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateAnnouncementRequest {
  title: string;
  content: string;
  category: string;
  isAnonymous?: boolean;
  validUntil?: string;
  publishImmediately?: boolean;
}

export interface UpdateAnnouncementRequest {
  title: string;
  content: string;
  category: string;
  isAnonymous: boolean;
  validUntil?: string;
}

export interface ApproveAnnouncementRequest {
  isApproved: boolean;
  rejectionReason?: string;
}

export interface CreateAnnouncementCommentRequest {
  content: string;
  isAnonymous?: boolean;
}

export interface AnnouncementStatsDto {
  totalAnnouncements: number;
  pendingApproval: number;
  published: number;
  myDrafts: number;
  unread: number;
}

export interface AnnouncementSettingsDto {
  allowAnnouncementComments: boolean;
}

// Subscription / Billing
export interface PlanFeatureDto {
  featureKey: string;
  featureLabel: string;
  isEnabled: boolean;
}

export interface FeatureCatalogItemDto {
  featureKey: string;
  featureLabel: string;
}

export interface SubscriptionPlanDto {
  id: string;
  name: string;
  tier: string;
  description: string;
  priceMonthly: number;
  annualDiscountPercent: number;
  quinquennialDiscountPercent: number;
  priceAnnual: number;
  priceQuinquennial: number;
  isActive: boolean;
  features: PlanFeatureDto[];
}

export interface PlanFeatureToggleRequest {
  featureKey: string;
  isEnabled: boolean;
}

export interface CreateSubscriptionPlanRequest {
  name: string;
  tier: string;
  description: string;
  priceMonthly: number;
  annualDiscountPercent: number;
  quinquennialDiscountPercent: number;
  isActive: boolean;
  features: PlanFeatureToggleRequest[];
}

export interface UpdateSubscriptionPlanRequest {
  name: string;
  tier: string;
  description: string;
  priceMonthly: number;
  annualDiscountPercent: number;
  quinquennialDiscountPercent: number;
  isActive: boolean;
  features: PlanFeatureToggleRequest[];
}

export interface CondominiumSubscriptionDto {
  id: string;
  condominiumId: string;
  condominiumName: string;
  plan: SubscriptionPlanDto;
  billingCycle: string;
  status: string;
  startDate: string;
  endDate?: string;
  nextBillingDate: string;
  priceAtPurchase: number;
}

export interface AssignSubscriptionRequest {
  condominiumId: string;
  planId: string;
  billingCycle: string;
}

export interface SubscriptionStatsDto {
  totalCondominiums: number;
  activeSubscriptions: number;
  monthlyBillingVolume: number;
}

// ============= Invoice / Billing =============

export interface InvoiceDto {
  id: string;
  number: number;
  series: string;
  year: number;
  invoiceRef: string;
  type: string;
  issuedDate: string;
  dueDate: string;
  paidDate?: string;
  condominiumId: string;
  condominiumName: string;
  customerName: string;
  planName: string;
  periodStartDate: string;
  periodEndDate: string;
  subtotalAmount: number;
  vatAmount: number;
  totalAmount: number;
  vatRate: number;
  status: 'Draft' | 'Emitted' | 'Paid' | 'Overdue' | 'Cancelled';
  pdfUrl?: string;
  isOverdue: boolean;
  cancellationReason?: string;
  notes?: string;
}

export interface MarkInvoicePaidRequest {
  paidDate?: string;
  notes?: string;
}

export interface CancelInvoiceRequest {
  reason: string;
  notes?: string;
}

export interface InitiateInvoicePaymentResponse {
  paymentUrl: string;
  sessionId: string;
}

// ============= System Email Settings =============

export interface SystemEmailSettingsDto {
  id: string;
  emailEnabled: boolean;
  smtpHost?: string;
  smtpPort: number;
  username?: string;
  hasPassword: boolean;
  useSsl: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateSystemEmailSettingsRequest {
  emailEnabled: boolean;
  smtpHost?: string;
  smtpPort: number;
  username?: string;
  password?: string;
  useSsl: boolean;
}

// ============= CSV Import =============

export interface CsvImportResult {
  message: string;
  created: number;
  updated: number;
  errors: string[];
}
