import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Lock, Save, Building2, Home, Shield, FileText, Download, Trash2, Upload, TrendingUp, Moon, Sun, Link2, RefreshCcw, ShieldCheck, ShieldAlert, Star, ExternalLink, Settings, BookOpen } from 'lucide-react';
import QRCode from 'qrcode';
import { authApi, usersApi, condominiumsApi, unitsApi, documentsApi, meApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import FileUpload from '../components/FileUpload';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { PageHeader, Spinner, Button, Card, Skeleton, Badge, AsyncState } from '../components/ui';
import { getIsDarkMode, onThemeChanged, toggleTheme } from '../utils/theme';
import { getCookieConsent, setCookieConsent } from '../utils/cookieConsent';
import type { CookieConsent } from '../utils/cookieConsent';
import { useTranslation } from '../i18n/I18nProvider';
import type { TranslationKey, TranslateFn } from '../i18n/types';
import type { UpdateUserRequest, UserDto, CondominiumDto, UnitDto, DocumentDto, TwoFactorSecurityResponse, TwoFactorSetupResponse, DisableTwoFactorRequest, RegenerateRecoveryCodesRequest, MembershipCondominiumDto, ConsentItem, ErasureRequest } from '../types';
import { ConsentDecision, ErasureType } from '../types';

// i18n overrides for well-known consent keys; unknown keys keep the DB title.
const consentTitleKeys: Record<string, TranslationKey> = {
  terms: 'consent.terms.title',
  privacy: 'consent.privacy.title',
};

const roleLabels = (t: TranslateFn): Record<number, string> => ({
  0: t('profile.role.manager'),
  1: t('profile.role.admin'),
  2: t('profile.role.resident'),
});

const unitDocumentTypes = (t: TranslateFn): Record<string, string> => ({
  UnitInsurance: t('profile.documents.typeInsurance'),
  UnitOwnershipProof: t('profile.documents.typeDeed'),
  UnitOther: t('profile.documents.typeOther'),
});

const unitDocumentColors: Record<string, string> = {
  UnitInsurance: 'bg-blue-100 text-blue-700',
  UnitOwnershipProof: 'bg-purple-100 text-purple-700',
  UnitOther: 'bg-control text-ink-muted',
};

export default function ProfilePage() {
  const { user, isManager, logout } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const { t, formatDate, formatDateTime } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences' | 'documents' | 'privacy'>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserDto | null>(null);
  const [condominium, setCondominium] = useState<CondominiumDto | null>(null);
  const [unit, setUnit] = useState<UnitDto | null>(null);
  const [memberships, setMemberships] = useState<MembershipCondominiumDto[]>([]);
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [unitDocuments, setUnitDocuments] = useState<DocumentDto[]>([]);
  const [consents, setConsents] = useState<ConsentItem[]>([]);
  const [loadingConsents, setLoadingConsents] = useState(true);
  const [consentsError, setConsentsError] = useState<string | null>(null);
  const [consentActionKey, setConsentActionKey] = useState<string | null>(null);
  const [detailConsent, setDetailConsent] = useState<ConsentItem | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    type: 'UnitInsurance',
    description: '',
  });
  const [uploading, setUploading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(getIsDarkMode());
  const [cookieConsent, setCookieConsentState] = useState<CookieConsent | null>(() => getCookieConsent());
  // GDPR self-service (REQ-SEC-006): export + erasure modal state.
  const [exporting, setExporting] = useState(false);
  const [showEraseModal, setShowEraseModal] = useState(false);
  const [eraseType, setEraseType] = useState<ErasureType>(ErasureType.Full);
  const [erasePhone, setErasePhone] = useState(true);
  const [erasePhrase, setErasePhrase] = useState('');
  const [erasePassword, setErasePassword] = useState('');
  const [erasing, setErasing] = useState(false);
  const [eraseError, setEraseError] = useState<string | null>(null);
  const [securityData, setSecurityData] = useState<TwoFactorSecurityResponse | null>(null);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [processingSecurity, setProcessingSecurity] = useState(false);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetupResponse | null>(null);
  const [twoFactorSetupCode, setTwoFactorSetupCode] = useState('');
  const [twoFactorQrCode, setTwoFactorQrCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showDisableTwoFactor, setShowDisableTwoFactor] = useState(false);
  const [showRegenerateRecoveryCodes, setShowRegenerateRecoveryCodes] = useState(false);
  const [disableTwoFactorData, setDisableTwoFactorData] = useState<DisableTwoFactorRequest>({
    currentPassword: '',
    code: '',
    useRecoveryCode: false,
  });
  const [regenerateRecoveryCodesData, setRegenerateRecoveryCodesData] = useState<RegenerateRecoveryCodesRequest>({
    currentPassword: '',
    code: '',
    useRecoveryCode: false,
  });

  useEffect(() => {
    return onThemeChanged(() => {
      setIsDarkMode(getIsDarkMode());
    });
  }, []);

  // Load the user's memberships so the profile can list every fraction the user
  // holds in the active condominium (REQ-UNITS-002 / REQ-UNITS-003).
  useEffect(() => {
    if (!user) return;
    meApi.getMemberships()
      .then((r) => setMemberships(r.data.condominiums ?? []))
      .catch(() => {
        // Silent: falls back to the single active-unit display below.
      });
  }, [user]);

  // RGPD/GDPR consents load in their own effect so the privacy panel is
  // independent of the profile/security/documents data (F4).
  useEffect(() => {
    if (!user) return;
    meApi.getConsents()
      .then((r) => {
        setConsents(r.data.consents);
        setConsentsError(null);
        setLoadingConsents(false);
      })
      .catch(() => {
        setConsentsError(t('profile.privacy.errorLoad'));
        setLoadingConsents(false);
      });
  }, [user, t]);

  useEffect(() => {
    const securityStatus = searchParams.get('securityStatus');
    if (!securityStatus) return;

    const messages: Record<string, string> = {
      linked_google: t('profile.security.linkedGoogle'),
      linked_microsoft: t('profile.security.linkedMicrosoft'),
      link_failed: t('profile.security.linkFailed'),
    };

    const message = messages[securityStatus];
    if (message) {
      if (securityStatus.startsWith('linked_')) {
        setSuccess(message);
      } else {
        setError(message);
      }
    }
  }, [searchParams, t]);

  const handleToggleTheme = () => {
    const nextIsDark = toggleTheme();
    setIsDarkMode(nextIsDark);
  };

  const handleConsentDecision = async (consent: ConsentItem, accepted: boolean) => {
    setConsentActionKey(consent.key);
    try {
      const res = await meApi.recordConsent({
        key: consent.key,
        version: consent.version,
        accepted,
      });
      setConsents(res.data.consents);
      setSuccess(accepted ? t('profile.privacy.recorded') : t('profile.privacy.withdrawnMsg'));
    } catch {
      toastError(t('profile.privacy.errorUpdate'));
    } finally {
      setConsentActionKey(null);
    }
  };

  // GDPR export: fetch the JSON blob and trigger a browser download via a
  // temporary object-URL anchor (no new dependency).
  const handleExportData = async () => {
    setExporting(true);
    try {
      const res = await meApi.exportData();
      const blob = res.data instanceof Blob ? res.data : new Blob([JSON.stringify(res.data)], { type: 'application/json' });
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `habitus-export-${stamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toastSuccess(t('gdpr.export.success'));
    } catch {
      toastError(t('gdpr.export.error'));
    } finally {
      setExporting(false);
    }
  };

  const closeEraseModal = () => {
    setShowEraseModal(false);
    setEraseType(ErasureType.Full);
    setErasePhone(true);
    setErasePhrase('');
    setErasePassword('');
    setEraseError(null);
  };

  // GDPR erasure. The confirmation phrase gate is enforced both by the disabled
  // button and here; backend validation codes are surfaced inline in the modal.
  const handleEraseData = async () => {
    setEraseError(null);
    setErasing(true);
    const payload: ErasureRequest = {
      type: eraseType,
      confirmationPhrase: erasePhrase,
    };
    if (erasePassword.trim().length > 0) {
      payload.currentPassword = erasePassword;
    }
    if (eraseType === ErasureType.Partial) {
      payload.fields = erasePhone ? ['phone'] : [];
    }
    try {
      const res = await meApi.eraseData(payload);
      if (res.data.loginDisabled) {
        toastSuccess(t('gdpr.erase.successFull'));
        logout();
        navigate('/login');
        return;
      }
      // Partial success: re-fetch the profile so the removed field disappears.
      toastSuccess(t('gdpr.erase.successPartial'));
      try {
        const me = await usersApi.getMe();
        setUserData(me.data);
        setProfileData({ name: me.data.name, email: me.data.email, phone: me.data.phone });
      } catch {
        // Non-fatal: the erasure succeeded even if the refresh fails.
      }
      closeEraseModal();
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string } } }).response?.data?.code;
      if (code === 'invalid_confirmation_phrase') {
        setEraseError(t('gdpr.erase.errorPhrase'));
      } else if (code === 'password_required') {
        setEraseError(t('gdpr.erase.errorPasswordRequired'));
      } else if (code === 'invalid_password') {
        setEraseError(t('gdpr.erase.errorPassword'));
      } else {
        setEraseError(t('gdpr.erase.errorGeneric'));
      }
    } finally {
      setErasing(false);
    }
  };

  // Account-identity fields (id, role, isActive and the editable name/email/phone
  // form) come from getMe and are independent of the active fraction.
  useEffect(() => {
    const loadUserData = async () => {
      setLoading(true);
      try {
        const userResponse = await usersApi.getMe();
        const currentUser = userResponse.data;
        setUserData(currentUser);

        setProfileData({
          name: currentUser.name,
          email: currentUser.email,
          phone: currentUser.phone,
        });
      } catch (error) {
        console.error('Failed to load user data:', error);
        setError(t('profile.error.loadUser'));
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadUserData();
    }
  }, [user, t]);

  // The active fraction (condominium, unit + quotas, and unit documents) follows
  // the auth-context active context, which the backend re-scopes on fraction
  // switch. Re-fetch whenever that context changes so Quotas and fraction
  // details track the selected fraction instead of the persisted default.
  useEffect(() => {
    const condominiumId = user?.condominiumId;
    const unitId = user?.unitId;

    if (!condominiumId) return;

    condominiumsApi.getById(condominiumId)
      .then((condoResponse) => setCondominium(condoResponse.data))
      .catch((err) => {
        console.error('Failed to load condominium:', err);
      });

    if (!unitId) return;

    unitsApi.getById(condominiumId, unitId)
      .then((unitResponse) => setUnit(unitResponse.data))
      .catch((err) => {
        console.error('Failed to load unit:', err);
      });

    loadUnitDocuments(condominiumId, unitId);
  }, [user?.condominiumId, user?.unitId]);

  useEffect(() => {
    if (user) {
      loadSecurityOverview();
    }
  }, [user]);

  useEffect(() => {
    if (!twoFactorSetup?.otpauthUri) return;

    QRCode.toDataURL(twoFactorSetup.otpauthUri)
      .then(setTwoFactorQrCode)
      .catch(() => setTwoFactorQrCode(''));
  }, [twoFactorSetup]);

  async function loadSecurityOverview() {
    setLoadingSecurity(true);
    try {
      const response = await authApi.getSecurityOverview();
      setSecurityData(response.data);
    } catch (err) {
      console.error('Failed to load security data:', err);
    } finally {
      setLoadingSecurity(false);
    }
  }

  const handleStartTwoFactorSetup = async () => {
    setProcessingSecurity(true);
    setError('');
    try {
      const response = await authApi.setupTwoFactor();
      setTwoFactorSetup(response.data);
      setTwoFactorSetupCode('');
    } catch {
      setError(t('profile.security.setupError'));
    } finally {
      setProcessingSecurity(false);
    }
  };

  const handleVerifyTwoFactorSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingSecurity(true);
    setError('');
    try {
      const response = await authApi.verifyTwoFactorSetup({ code: twoFactorSetupCode });
      setRecoveryCodes(response.data.recoveryCodes);
      setTwoFactorSetup(null);
      setTwoFactorSetupCode('');
      setSuccess(t('profile.security.enabledSuccess'));
      loadSecurityOverview();
    } catch {
      setError(t('profile.security.invalidCode'));
    } finally {
      setProcessingSecurity(false);
    }
  };

  const handleDisableTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingSecurity(true);
    setError('');
    try {
      await authApi.disableTwoFactor(disableTwoFactorData);
      setSuccess(t('profile.security.disabledSuccess'));
      setShowDisableTwoFactor(false);
      setDisableTwoFactorData({ currentPassword: '', code: '', useRecoveryCode: false });
      loadSecurityOverview();
    } catch {
      setError(t('profile.security.disableError'));
    } finally {
      setProcessingSecurity(false);
    }
  };

  const handleRegenerateRecoveryCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingSecurity(true);
    setError('');
    try {
      const response = await authApi.regenerateRecoveryCodes(regenerateRecoveryCodesData);
      setRecoveryCodes(response.data.recoveryCodes);
      setSuccess(t('profile.security.recoveryRegenerated'));
      setShowRegenerateRecoveryCodes(false);
      setRegenerateRecoveryCodesData({ currentPassword: '', code: '', useRecoveryCode: false });
      loadSecurityOverview();
    } catch {
      setError(t('profile.security.recoveryRegenerateError'));
    } finally {
      setProcessingSecurity(false);
    }
  };

  const handleStartProviderLink = (provider: 'google' | 'microsoft') => {
    window.location.assign(`/api/platform/auth/external/${provider}/link`);
  };

  const handleUnlinkProvider = async (provider: 'google' | 'microsoft') => {
    try {
      await authApi.unlinkProvider(provider);
      setSuccess(t('profile.security.providerUnlinked'));
      loadSecurityOverview();
    } catch {
      setError(t('profile.security.providerUnlinkError'));
    }
  };

  async function loadUnitDocuments(condominiumId: string, unitId: string) {
    try {
      const response = await documentsApi.getPaged(condominiumId, 1, 100, '', 'Unit');
      // Filter documents by unitId
      const unitDocs = response.data.items.filter(doc => doc.unitId === unitId);
      setUnitDocuments(unitDocs);
    } catch (err) {
      console.error('Failed to load unit documents:', err);
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !user?.unitId || !user.condominiumId) return;

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('name', uploadForm.name);
      formData.append('type', uploadForm.type);
      formData.append('context', 'Unit');
      formData.append('description', uploadForm.description);
      formData.append('unitId', user.unitId);

      await documentsApi.upload(user.condominiumId, formData);
      setSuccess(t('profile.documents.uploadSuccess'));
      setTimeout(() => setSuccess(''), 3000);
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadForm({ name: '', type: 'UnitInsurance', description: '' });
      loadUnitDocuments(user.condominiumId, user.unitId);
    } catch (err) {
      setError(t('profile.documents.uploadError'));
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteDocId(id);
  };

  const confirmDeleteDoc = async () => {
    if (!deleteDocId || !user?.unitId || !user.condominiumId) return;
    try {
      await documentsApi.delete(user.condominiumId, deleteDocId);
      setSuccess(t('profile.documents.deleteSuccess'));
      setTimeout(() => setSuccess(''), 3000);
      loadUnitDocuments(user.condominiumId, user.unitId);
    } catch (err) {
      toastError(t('profile.documents.deleteError'));
      console.error(err);
    } finally {
      setDeleteDocId(null);
    }
  };

  const handleDownload = async (id: string, fileName: string) => {
    if (!user?.condominiumId) {
      setError(t('profile.documents.noCondominium'));
      return;
    }

    try {
      await documentsApi.download(user.condominiumId, id, fileName);
    } catch (err) {
      setError(t('profile.documents.downloadError'));
      console.error(err);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updateData: UpdateUserRequest = {
        id: userData.id,
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone,
        role: userData.role,
        condominiumId: userData.condominiumId,
        unitId: userData.unitId,
        isActive: userData.isActive,
      };

      await usersApi.update(userData.id, updateData);
      setSuccess(t('profile.personal.updateSuccess'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(t('profile.personal.updateError'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError(t('profile.password.mismatch'));
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError(t('profile.password.tooShort'));
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await usersApi.updatePassword(userData.id, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setSuccess(t('profile.password.updateSuccess'));
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(t('profile.password.updateError'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton variant="card" rows={4} />
      </div>
    );
  }

  const activeCondoUnits =
    memberships.find((c) => c.condominiumId === user?.condominiumId)?.units ?? [];
  const activeUnitNumber = activeCondoUnits.find((u) => u.unitId === user?.unitId)?.unitNumber;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <ConfirmModal
        open={deleteDocId !== null}
        title={t('profile.documents.confirmTitle')}
        message={t('profile.documents.confirmMessage')}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={confirmDeleteDoc}
        onCancel={() => setDeleteDocId(null)}
      />
      {/* Header */}
      <PageHeader
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
      />

      {/* Tabs */}
      <div className="border-b border-line">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'profile'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-ink-subtle hover:text-ink-muted'
            }`}
          >
            <User className="w-4 h-4" />
            {t('profile.tab.profile')}
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'security'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-ink-subtle hover:text-ink-muted'
            }`}
          >
            <Shield className="w-4 h-4" />
            {t('profile.tab.security')}
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'preferences'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-ink-subtle hover:text-ink-muted'
            }`}
          >
            <Settings className="w-4 h-4" />
            {t('profile.preferences.tab')}
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'privacy'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-ink-subtle hover:text-ink-muted'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            {t('profile.privacy.tab')}
          </button>
          {!isManager && unit && (
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
                activeTab === 'documents'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-ink-subtle hover:text-ink-muted'
              }`}
            >
              <FileText className="w-4 h-4" />
              {t('profile.tab.documents')}
            </button>
          )}
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Profile Information */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 text-indigo-700">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink">{t('profile.personal.title')}</h2>
                <p className="text-sm text-ink-subtle">{t('profile.personal.subtitle')}</p>
              </div>
            </div>

            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {t('common.name')}
                  </div>
                </label>
                <input
                  type="text"
                  required
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {t('common.email')}
                  </div>
                </label>
                <input
                  type="email"
                  value={profileData.email || ''}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {t('common.phone')}
                  </div>
                </label>
                <input
                  type="tel"
                  required
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-4">
                <Button type="submit" icon={Save} loading={saving}>
                  {t('profile.personal.save')}
                </Button>
              </div>
            </form>
          </Card>

          {/* User Info Display (Read-only) */}
          <div className="bg-surface-muted rounded-xl border border-line p-6">
            <h3 className="font-semibold text-ink mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-ink-muted" />
              {t('profile.account.title')}
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-line">
                <span className="text-ink-muted flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  {t('profile.account.role')}
                </span>
                <span className="font-medium text-ink">
                  {userData && roleLabels(t)[userData.role]}
                </span>
              </div>
              
              {!isManager && condominium && (
                <div className="flex items-center justify-between py-2 border-b border-line">
                  <span className="text-ink-muted flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {t('profile.account.condominium')}
                  </span>
                  <span className="font-medium text-ink">{condominium.name}</span>
                </div>
              )}

              {!isManager && condominium && (
                <div className="flex items-center justify-between py-2 border-b border-line">
                  <span className="text-ink-muted flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {t('profile.account.condominiumEmail')}
                  </span>
                  <span className="font-medium text-ink">{condominium.email || t('profile.account.noEmail')}</span>
                </div>
              )}
              
              {!isManager && unit && activeCondoUnits.length <= 1 && (
                <div className="flex items-center justify-between py-2 border-b border-line">
                  <span className="text-ink-muted flex items-center gap-2">
                    <Home className="w-4 h-4" />
                    {t('profile.account.unit')}
                  </span>
                  <span className="font-medium text-ink">
                    {t('profile.account.unitFloor', { number: unit.number, floor: unit.floor })}
                  </span>
                </div>
              )}

              {!isManager && activeCondoUnits.length > 1 && (
                <div className="py-2 border-b border-line">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Home className="w-4 h-4 text-ink-muted" />
                      <span className="text-ink-muted font-medium">{t('profile.account.myUnits')}</span>
                    </div>
                    {activeUnitNumber && (
                      <span className="flex items-center gap-1.5 text-sm text-ink-muted">
                        {t('profile.account.activeUnit')}
                        <span className="font-semibold text-ink">{t('common.fraction', { number: activeUnitNumber })}</span>
                      </span>
                    )}
                  </div>
                  <ul className="ml-6 space-y-2">
                    {activeCondoUnits.map((u) => {
                      const isActive = u.unitId === user?.unitId;
                      return (
                        <li
                          key={u.unitId}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="text-sm font-medium text-ink">
                            {t('common.fraction', { number: u.unitNumber })}
                          </span>
                          <span className="flex items-center gap-1.5">
                            {u.isPrimary && (
                              <Badge variant="brand" icon={Star}>
                                {t('profile.account.primary')}
                              </Badge>
                            )}
                            {isActive && <Badge variant="success">{t('profile.account.unitActive')}</Badge>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              
              {!isManager && unit && unit.monthlyQuota > 0 && (
                <div className="py-2 border-b border-line">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    <span className="text-ink-muted font-medium">
                      {t('profile.account.quotas', { year: new Date().getFullYear() })}
                    </span>
                  </div>
                  <div className="ml-6 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-ink-muted">{t('profile.account.monthly')}</span>
                      <span className="text-sm font-semibold text-ink">
                        €{unit.monthlyQuota.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-ink-muted">{t('profile.account.quarterly')}</span>
                      <span className="text-sm font-semibold text-ink">
                        €{(unit.monthlyQuota * 3).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-ink-muted">{t('profile.account.annual')}</span>
                      <span className="text-sm font-semibold text-indigo-600">
                        €{(unit.monthlyQuota * 12).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {userData && (
                <div className="flex items-center justify-between py-2 border-b border-line">
                  <span className="text-ink-muted flex items-center gap-2">
                    {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    {t('profile.account.theme')}
                  </span>
                  <Button size="sm" onClick={handleToggleTheme}>
                    {isDarkMode ? t('profile.account.switchLight') : t('profile.account.switchDark')}
                  </Button>
                </div>
              )}

              {userData && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-ink-muted">{t('profile.account.status')}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    userData.isActive 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {userData.isActive ? t('common.active') : t('common.inactive')}
                  </span>
                </div>
              )}
              
              <div className="pt-3 mt-2 border-t border-line">
                <p className="text-xs text-ink-subtle">
                  <strong>{t('profile.account.noteLabel')}</strong> {isManager
                    ? t('profile.account.noteManager')
                    : t('profile.account.noteResident')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-ink">{t('profile.security.twoFactorTitle')}</h2>
                  <p className="text-sm text-ink-subtle">{t('profile.security.twoFactorSubtitle')}</p>
                </div>
              </div>
              {securityData && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${securityData.twoFactorEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-control text-ink-muted'}`}>
                  {securityData.twoFactorEnabled ? t('profile.security.enabled') : t('profile.security.disabled')}
                </span>
              )}
            </div>

            {loadingSecurity ? (
              <p className="text-sm text-ink-subtle">
                {loadingSecurity ? (
                  <span className="flex items-center gap-2"><Spinner size="sm" label={t('profile.security.loading')} /></span>
                ) : null}
              </p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm text-ink-muted">
                  {t('profile.security.recoveryRemaining')} <span className="font-semibold text-ink">{securityData?.recoveryCodesRemaining ?? 0}</span>
                </div>

                {!securityData?.twoFactorEnabled && !twoFactorSetup && (
                  <Button
                    variant="success"
                    onClick={handleStartTwoFactorSetup}
                    loading={processingSecurity}
                  >
                    {t('profile.security.setup2fa')}
                  </Button>
                )}

                {twoFactorSetup && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5 space-y-4">
                    <div>
                      <h3 className="font-semibold text-indigo-900">{t('profile.security.setupTitle')}</h3>
                      <p className="text-sm text-indigo-700 mt-1">{t('profile.security.setupInstructions')}</p>
                    </div>

                    {twoFactorSetup?.otpauthUri && twoFactorQrCode && (
                      <div className="flex justify-center">
                        <img src={twoFactorQrCode} alt={t('profile.security.qrAlt')} className="w-44 h-44 rounded-lg border border-[#ffffff] shadow-sm bg-[#ffffff] p-3" />
                      </div>
                    )}

                    <div className="rounded-lg border border-indigo-200 bg-surface px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-ink-subtle mb-1">{t('profile.security.manualKey')}</p>
                      <p className="font-mono text-sm text-ink break-all">{twoFactorSetup.manualEntryKey}</p>
                    </div>

                    <form onSubmit={handleVerifyTwoFactorSetup} className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-indigo-900 mb-1">{t('profile.security.verificationCode')}</label>
                        <input
                          type="text"
                          value={twoFactorSetupCode}
                          onChange={(e) => setTwoFactorSetupCode(e.target.value)}
                          className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="123456"
                          required
                        />
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setTwoFactorSetup(null);
                            setTwoFactorSetupCode('');
                          }}
                          className="border border-line"
                        >
                          {t('common.cancel')}
                        </Button>
                        <Button type="submit" loading={processingSecurity}>
                          {t('profile.security.verifyActivate')}
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {securityData?.twoFactorEnabled && (
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="ghost"
                      icon={RefreshCcw}
                      onClick={() => setShowRegenerateRecoveryCodes((value) => !value)}
                      className="border border-line"
                    >
                      {t('profile.security.regenerateRecovery')}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setShowDisableTwoFactor((value) => !value)}
                    >
                      {t('profile.security.disable2fa')}
                    </Button>
                  </div>
                )}

                {showDisableTwoFactor && (
                  <form onSubmit={handleDisableTwoFactor} className="rounded-lg border border-red-100 bg-red-50 p-4 space-y-3">
                    <h3 className="font-semibold text-red-900">{t('profile.security.disableTitle')}</h3>
                    <input
                      type="password"
                      value={disableTwoFactorData.currentPassword}
                      onChange={(e) => setDisableTwoFactorData({ ...disableTwoFactorData, currentPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder={t('profile.security.currentPassword')}
                      required
                    />
                    <input
                      type="text"
                      value={disableTwoFactorData.code}
                      onChange={(e) => setDisableTwoFactorData({ ...disableTwoFactorData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder={disableTwoFactorData.useRecoveryCode ? t('profile.security.recoveryCode') : t('profile.security.authCode')}
                      required
                    />
                    <label className="flex items-center gap-2 text-sm text-red-800">
                      <input
                        type="checkbox"
                        checked={disableTwoFactorData.useRecoveryCode}
                        onChange={(e) => setDisableTwoFactorData({ ...disableTwoFactorData, useRecoveryCode: e.target.checked })}
                      />
                      {t('profile.security.useRecoveryCode')}
                    </label>
                    <Button type="submit" variant="danger" loading={processingSecurity}>
                      {t('profile.security.confirmDisable')}
                    </Button>
                  </form>
                )}

                {showRegenerateRecoveryCodes && (
                  <form onSubmit={handleRegenerateRecoveryCodes} className="rounded-lg border border-amber-100 bg-amber-50 p-4 space-y-3">
                    <h3 className="font-semibold text-amber-900">{t('profile.security.regenerateRecovery')}</h3>
                    <input
                      type="password"
                      value={regenerateRecoveryCodesData.currentPassword}
                      onChange={(e) => setRegenerateRecoveryCodesData({ ...regenerateRecoveryCodesData, currentPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder={t('profile.security.currentPassword')}
                      required
                    />
                    <input
                      type="text"
                      value={regenerateRecoveryCodesData.code}
                      onChange={(e) => setRegenerateRecoveryCodesData({ ...regenerateRecoveryCodesData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder={regenerateRecoveryCodesData.useRecoveryCode ? t('profile.security.recoveryCode') : t('profile.security.authCode')}
                      required
                    />
                    <label className="flex items-center gap-2 text-sm text-amber-800">
                      <input
                        type="checkbox"
                        checked={regenerateRecoveryCodesData.useRecoveryCode}
                        onChange={(e) => setRegenerateRecoveryCodesData({ ...regenerateRecoveryCodesData, useRecoveryCode: e.target.checked })}
                      />
                      {t('profile.security.useRecoveryCode')}
                    </label>
                    <Button type="submit" variant="warning" loading={processingSecurity}>
                      {t('profile.security.generateNew')}
                    </Button>
                  </form>
                )}

                {recoveryCodes.length > 0 && (
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 space-y-2">
                    <h3 className="font-semibold text-emerald-900">{t('profile.security.recoveryCodesTitle')}</h3>
                    <p className="text-sm text-emerald-700">{t('profile.security.recoveryCodesHint')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {recoveryCodes.map((code) => (
                        <div key={code} className="font-mono text-sm bg-surface rounded border border-emerald-100 px-3 py-2 text-ink">
                          {code}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-700">
                <Link2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink">{t('profile.security.linkedAccounts')}</h2>
                <p className="text-sm text-ink-subtle">{t('profile.security.linkedAccountsSubtitle')}</p>
              </div>
            </div>

            <div className="space-y-3">
              {(['Google', 'Microsoft'] as const).map((provider) => {
                const linkedProvider = securityData?.linkedProviders.find((item) => item.provider === provider);
                const providerKey = provider.toLowerCase() as 'google' | 'microsoft';

                return (
                  <div key={provider} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-4 py-3">
                    <div>
                      <p className="font-medium text-ink">{provider}</p>
                      <p className="text-sm text-ink-subtle">
                        {linkedProvider ? t('profile.security.linkedTo', { email: linkedProvider.providerEmail ?? '' }) : t('profile.security.notLinked')}
                      </p>
                    </div>
                    {linkedProvider ? (
                      <Button
                        variant="ghost"
                        onClick={() => handleUnlinkProvider(providerKey)}
                        className="border border-red-200 text-red-700 hover:bg-red-50"
                      >
                        {t('profile.security.unlink')}
                      </Button>
                    ) : (
                      <Button onClick={() => handleStartProviderLink(providerKey)}>
                        {t('profile.security.linkProvider', { provider })}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-700">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink">{t('profile.password.title')}</h2>
                <p className="text-sm text-ink-subtle">{t('profile.password.subtitle')}</p>
              </div>
            </div>

            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('profile.password.current')}</label>
                <input
                  type="password"
                  required
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('profile.password.new')}</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-ink-subtle mt-1">{t('profile.password.minHint')}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">{t('profile.password.confirm')}</label>
                <input
                  type="password"
                  required
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-4">
                <Button type="submit" variant="warning" icon={Lock} loading={saving}>
                  {t('profile.password.title')}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 text-indigo-700">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">{t('profile.preferences.title')}</h2>
              <p className="text-sm text-ink-subtle">{t('profile.preferences.subtitle')}</p>
            </div>
          </div>
          <div className="max-w-md border border-line rounded-lg p-4 bg-surface">
            <label className="block text-sm font-medium text-ink-muted mb-1">{t('profile.preferences.language')}</label>
            <LanguageSwitcher variant="full" />
            <p className="mt-2 text-xs text-ink-subtle">{t('profile.preferences.languageScope')}</p>
          </div>
        </Card>
      )}

      {/* Documents Tab */}
      {/* Privacy / RGPD Tab */}
      {activeTab === 'privacy' && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 text-indigo-700">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">{t('profile.privacy.title')}</h2>
              <p className="text-sm text-ink-subtle">
                {t('profile.privacy.subtitle')}
              </p>
            </div>
          </div>

          <AsyncState
            loading={loadingConsents}
            error={consentsError}
            isEmpty={consents.length === 0}
            onRetry={() => {
              setLoadingConsents(true);
              setConsentsError(null);
              meApi.getConsents()
                .then((r) => {
                  setConsents(r.data.consents);
                  setLoadingConsents(false);
                })
                .catch(() => {
                  setConsentsError(t('profile.privacy.errorLoad'));
                  setLoadingConsents(false);
                });
            }}
            skeleton="list"
            skeletonRows={2}
            empty={
              <div className="text-center py-12 text-ink-subtle">
                <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t('profile.privacy.empty')}</p>
              </div>
            }
          >
            <div className="space-y-3">
              {consents.map((consent) => {
                const accepted = consent.decision === ConsentDecision.Accepted;
                const withdrawn = consent.decision === ConsentDecision.Withdrawn;
                const busy = consentActionKey === consent.key;
                return (
                  <div
                    key={consent.key}
                    className="flex flex-col gap-3 p-4 border border-line rounded-lg sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-medium text-ink">{consentTitleKeys[consent.key] ? t(consentTitleKeys[consent.key]) : consent.title}</p>
                        {accepted && <Badge variant="success">{t('consent.statusAccepted')}</Badge>}
                        {withdrawn && <Badge variant="danger">{t('consent.statusWithdrawn')}</Badge>}
                        {!accepted && !withdrawn && <Badge variant="warning">{t('consent.statusPending')}</Badge>}
                        {consent.isMandatory && (
                          <Badge variant="neutral">{t('consent.mandatory')}</Badge>
                        )}
                      </div>
                      {consent.decidedAt && (
                        <p className="text-xs text-ink-subtle">
                          {t('consent.lastDecision', { date: formatDateTime(consent.decidedAt) })}
                        </p>
                      )}
                      {consent.body ? (
                        <button
                          type="button"
                          onClick={() => setDetailConsent(consent)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 mt-1"
                        >
                          {t('consent.readDetails')}
                          <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      ) : consent.url ? (
                        <a
                          href={consent.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 mt-1"
                        >
                          {t('consent.readDetails')}
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {accepted ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={busy}
                          onClick={() => handleConsentDecision(consent, false)}
                        >
                          {t('consent.withdraw')}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          loading={busy}
                          onClick={() => handleConsentDecision(consent, true)}
                        >
                          {t('consent.accept')}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </AsyncState>

          {/* GDPR self-service: export + erasure of personal data (REQ-SEC-006) */}
          <div className="mt-8 pt-6 border-t border-line">
            <div className="flex items-start gap-2 mb-4">
              <ShieldAlert className="w-5 h-5 text-ink-muted shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h3 className="text-base font-semibold text-ink">{t('gdpr.sectionTitle')}</h3>
                <p className="text-sm text-ink-subtle">{t('gdpr.sectionSubtitle')}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="secondary"
                icon={Download}
                loading={exporting}
                onClick={handleExportData}
              >
                {exporting ? t('gdpr.export.downloading') : t('gdpr.export.button')}
              </Button>
              <Button
                variant="danger"
                icon={Trash2}
                onClick={() => setShowEraseModal(true)}
              >
                {t('gdpr.erase.button')}
              </Button>
            </div>
          </div>

          {/* Cookie consent — a privacy/consent matter (REQ-SEC-006) */}
          <div className="mt-6 max-w-md border border-line rounded-lg p-4 bg-surface">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-ink-muted" />
              <label className="block text-sm font-medium text-ink-muted">{t('cookie.settingsTitle')}</label>
            </div>
            <p className="text-xs text-ink-subtle">{t('cookie.settingsSubtitle')}</p>
            <p className="mt-3 text-sm text-ink">
              {cookieConsent === 'accepted'
                ? t('cookie.statusAccepted')
                : cookieConsent === 'rejected'
                  ? t('cookie.statusRejected')
                  : t('cookie.statusUnset')}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCookieConsent('accepted');
                  setCookieConsentState('accepted');
                }}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  cookieConsent === 'accepted'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'border-line text-ink-muted hover:bg-surface-hover'
                }`}
              >
                {t('cookie.accept')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCookieConsent('rejected');
                  setCookieConsentState('rejected');
                }}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  cookieConsent === 'rejected'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'border-line text-ink-muted hover:bg-surface-hover'
                }`}
              >
                {t('cookie.reject')}
              </button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'documents' && unit && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-700">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink">{t('profile.documents.title')}</h2>
                <p className="text-sm text-ink-subtle">{t('profile.documents.subtitle')}</p>
              </div>
            </div>
            <Button icon={Upload} onClick={() => setShowUploadModal(true)}>
              {t('profile.documents.upload')}
            </Button>
          </div>

          {unitDocuments.length === 0 ? (
            <div className="text-center py-12 text-ink-subtle">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('profile.documents.empty')}</p>
              <p className="text-xs mt-2">
                {t('profile.documents.emptyHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {unitDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border border-line rounded-lg hover:bg-surface-hover transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <FileText className="w-5 h-5 text-ink-subtle" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-ink truncate">{doc.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          unitDocumentColors[doc.type] || 'bg-control text-ink-muted'
                        }`}>
                          {unitDocumentTypes(t)[doc.type] || doc.type}
                        </span>
                      </div>
                      {doc.description && (
                        <p className="text-sm text-ink-subtle truncate">{doc.description}</p>
                      )}
                      <p className="text-xs text-ink-subtle mt-1">
                        {t('profile.documents.updatedAt', { date: formatDate(doc.uploadedAt) })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(doc.id, doc.name)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title={t('profile.documents.tooltipDownload')}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title={t('profile.documents.tooltipDelete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Upload Modal */}
      <ModalPopup
        open={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadFile(null);
          setUploadForm({ name: '', type: 'UnitInsurance', description: '' });
        }}
        title={t('profile.documents.upload')}
        maxWidthClass="max-w-lg"
      >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-ink-subtle">{t('profile.documents.uploadModalSubtitle')}</p>
              </div>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('profile.documents.typeLabel')}
                </label>
                <select
                  required
                  value={uploadForm.type}
                  onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(unitDocumentTypes(t)).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('profile.documents.nameLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                  placeholder={t('profile.documents.namePlaceholder')}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  {t('profile.documents.descriptionLabel')}
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  placeholder={t('profile.documents.descriptionPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <FileUpload
                onFileSelect={setUploadFile}
                currentFile={uploadFile}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />

              <div className="flex flex-wrap gap-3 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFile(null);
                    setUploadForm({ name: '', type: 'UnitInsurance', description: '' });
                  }}
                  fullWidth
                  className="flex-1 border border-line"
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" loading={uploading} disabled={!uploadFile} fullWidth className="flex-1">
                  {t('profile.documents.uploadSubmit')}
                </Button>
              </div>
            </form>
      </ModalPopup>

      {/* GDPR erasure confirmation modal (REQ-SEC-006) */}
      <ModalPopup
        open={showEraseModal}
        onClose={closeEraseModal}
        title={t('gdpr.erase.modalTitle')}
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-600 shrink-0">
              <ShieldAlert className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-sm text-ink-subtle">{t('gdpr.sectionSubtitle')}</p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink-muted mb-1">{t('gdpr.erase.modalTitle')}</legend>
            <label className="flex items-start gap-3 p-3 border border-line rounded-lg cursor-pointer hover:bg-surface-hover">
              <input
                type="radio"
                name="erase-type"
                className="mt-1"
                checked={eraseType === ErasureType.Full}
                onChange={() => setEraseType(ErasureType.Full)}
              />
              <span>
                <span className="block text-sm font-medium text-ink">{t('gdpr.erase.full')}</span>
                <span className="block text-xs text-ink-subtle mt-0.5">{t('gdpr.erase.fullWarning')}</span>
              </span>
            </label>
            <label className="flex items-start gap-3 p-3 border border-line rounded-lg cursor-pointer hover:bg-surface-hover">
              <input
                type="radio"
                name="erase-type"
                className="mt-1"
                checked={eraseType === ErasureType.Partial}
                onChange={() => setEraseType(ErasureType.Partial)}
              />
              <span>
                <span className="block text-sm font-medium text-ink">{t('gdpr.erase.partial')}</span>
              </span>
            </label>
          </fieldset>

          {eraseType === ErasureType.Partial && (
            <div className="pl-1">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={erasePhone}
                  onChange={(e) => setErasePhone(e.target.checked)}
                />
                {t('gdpr.erase.fieldPhone')}
              </label>
            </div>
          )}

          <div>
            <label htmlFor="erase-phrase" className="block text-sm font-medium text-ink-muted mb-1">
              {t('gdpr.erase.confirmPhraseLabel')}
            </label>
            <input
              id="erase-phrase"
              type="text"
              autoComplete="off"
              value={erasePhrase}
              onChange={(e) => setErasePhrase(e.target.value)}
              placeholder="ELIMINAR"
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label htmlFor="erase-password" className="block text-sm font-medium text-ink-muted mb-1">
              {t('gdpr.erase.passwordLabel')}
            </label>
            <input
              id="erase-password"
              type="password"
              autoComplete="current-password"
              value={erasePassword}
              onChange={(e) => setErasePassword(e.target.value)}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {eraseError && (
            <p className="text-sm text-red-600" role="alert">{eraseError}</p>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={closeEraseModal}
              fullWidth
              className="flex-1 border border-line"
            >
              {t('gdpr.erase.cancel')}
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              loading={erasing}
              disabled={erasePhrase !== 'ELIMINAR'}
              onClick={handleEraseData}
              fullWidth
              className="flex-1"
            >
              {t('gdpr.erase.confirm')}
            </Button>
          </div>
        </div>
      </ModalPopup>

      <ModalPopup
        open={detailConsent !== null}
        onClose={() => setDetailConsent(null)}
        title={
          detailConsent
            ? (consentTitleKeys[detailConsent.key] ? t(consentTitleKeys[detailConsent.key]) : detailConsent.title)
            : t('consent.detailsTitle')
        }
        maxWidthClass="max-w-2xl"
      >
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-muted">
          {detailConsent?.body}
        </div>
      </ModalPopup>
    </div>
  );
}
