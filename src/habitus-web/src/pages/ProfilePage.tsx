import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User, Mail, Phone, Lock, Save, Building2, Home, Shield, FileText, Download, Trash2, Upload, TrendingUp, Moon, Sun, Link2, RefreshCcw, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { authApi, usersApi, condominiumsApi, unitsApi, documentsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import FileUpload from '../components/FileUpload';
import { getIsDarkMode, onThemeChanged, toggleTheme } from '../utils/theme';
import type { UpdateUserRequest, UserDto, CondominiumDto, UnitDto, DocumentDto, TwoFactorSecurityResponse, TwoFactorSetupResponse, DisableTwoFactorRequest, RegenerateRecoveryCodesRequest } from '../types';

const roleLabels: Record<number, string> = {
  0: 'Gestor',
  1: 'Administrador',
  2: 'Morador',
};

const unitDocumentTypes: Record<string, string> = {
  UnitInsurance: 'Seguro da Fração',
  UnitOwnershipProof: 'Escritura',
  UnitOther: 'Outro',
};

const unitDocumentColors: Record<string, string> = {
  UnitInsurance: 'bg-blue-100 text-blue-700',
  UnitOwnershipProof: 'bg-purple-100 text-purple-700',
  UnitOther: 'bg-gray-100 text-gray-600',
};

export default function ProfilePage() {
  const { user, isManager } = useAuth();
  const { error: toastError } = useToast();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'documents'>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserDto | null>(null);
  const [condominium, setCondominium] = useState<CondominiumDto | null>(null);
  const [unit, setUnit] = useState<UnitDto | null>(null);
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
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    type: 'UnitInsurance',
    description: '',
  });
  const [uploading, setUploading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(getIsDarkMode());
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

  useEffect(() => {
    const securityStatus = searchParams.get('securityStatus');
    if (!securityStatus) return;

    const messages: Record<string, string> = {
      linked_google: 'Google account linked successfully.',
      linked_microsoft: 'Microsoft account linked successfully.',
      link_failed: 'Unable to link the selected provider.',
    };

    const message = messages[securityStatus];
    if (message) {
      if (securityStatus.startsWith('linked_')) {
        setSuccess(message);
      } else {
        setError(message);
      }
    }
  }, [searchParams]);

  const handleToggleTheme = () => {
    const nextIsDark = toggleTheme();
    setIsDarkMode(nextIsDark);
  };

  useEffect(() => {
    const loadUserData = async () => {
      setLoading(true);
      try {
        // Get current authenticated user
        const userResponse = await usersApi.getMe();
        const currentUser = userResponse.data;
        setUserData(currentUser);
        
        setProfileData({
          name: currentUser.name,
          email: currentUser.email,
          phone: currentUser.phone,
        });

        // Load condominium if exists
        if (currentUser.condominiumId) {
          try {
            const condoResponse = await condominiumsApi.getById(currentUser.condominiumId);
            setCondominium(condoResponse.data);
          } catch (err) {
            console.error('Failed to load condominium:', err);
          }
        }

        // Load unit if exists
        if (currentUser.unitId) {
          try {
            const unitResponse = await unitsApi.getById(currentUser.unitId);
            setUnit(unitResponse.data);
            
            // Load unit documents
            loadUnitDocuments(currentUser.unitId);
          } catch (err) {
            console.error('Failed to load unit:', err);
          }
        }
      } catch (error) {
        console.error('Failed to load user data:', error);
        setError('Erro ao carregar dados do utilizador');
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      loadUserData();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadSecurityOverview();
    }
  }, [user]);

  useEffect(() => {
    if (!twoFactorSetup?.otpauthUri) {
      setTwoFactorQrCode('');
      return;
    }

    QRCode.toDataURL(twoFactorSetup.otpauthUri)
      .then(setTwoFactorQrCode)
      .catch(() => setTwoFactorQrCode(''));
  }, [twoFactorSetup]);

  const loadSecurityOverview = async () => {
    setLoadingSecurity(true);
    try {
      const response = await authApi.getSecurityOverview();
      setSecurityData(response.data);
    } catch (err) {
      console.error('Failed to load security data:', err);
    } finally {
      setLoadingSecurity(false);
    }
  };

  const handleStartTwoFactorSetup = async () => {
    setProcessingSecurity(true);
    setError('');
    try {
      const response = await authApi.setupTwoFactor();
      setTwoFactorSetup(response.data);
      setTwoFactorSetupCode('');
    } catch {
      setError('Erro ao iniciar configuração da autenticação de dois fatores.');
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
      setSuccess('Autenticação de dois fatores ativada com sucesso.');
      loadSecurityOverview();
    } catch {
      setError('Código inválido. Verifique a app autenticadora e tente novamente.');
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
      setSuccess('Autenticação de dois fatores desativada.');
      setShowDisableTwoFactor(false);
      setDisableTwoFactorData({ currentPassword: '', code: '', useRecoveryCode: false });
      loadSecurityOverview();
    } catch {
      setError('Não foi possível desativar a autenticação de dois fatores.');
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
      setSuccess('Códigos de recuperação gerados com sucesso.');
      setShowRegenerateRecoveryCodes(false);
      setRegenerateRecoveryCodesData({ currentPassword: '', code: '', useRecoveryCode: false });
      loadSecurityOverview();
    } catch {
      setError('Não foi possível regenerar os códigos de recuperação.');
    } finally {
      setProcessingSecurity(false);
    }
  };

  const handleStartProviderLink = (provider: 'google' | 'microsoft') => {
    window.location.href = `/api/auth/external/${provider}/link`;
  };

  const handleUnlinkProvider = async (provider: 'google' | 'microsoft') => {
    try {
      await authApi.unlinkProvider(provider);
      setSuccess('Conta externa removida com sucesso.');
      loadSecurityOverview();
    } catch {
      setError('Não foi possível remover a conta externa.');
    }
  };

  const loadUnitDocuments = async (unitId: string) => {
    try {
      const response = await documentsApi.getPaged(1, 100, '', 'Unit');
      // Filter documents by unitId
      const unitDocs = response.data.items.filter(doc => doc.unitId === unitId);
      setUnitDocuments(unitDocs);
    } catch (err) {
      console.error('Failed to load unit documents:', err);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !userData?.unitId) return;

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('name', uploadForm.name);
      formData.append('type', uploadForm.type);
      formData.append('context', 'Unit');
      formData.append('description', uploadForm.description);
      formData.append('unitId', userData.unitId);

      await documentsApi.upload(formData);
      setSuccess('Documento carregado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadForm({ name: '', type: 'UnitInsurance', description: '' });
      loadUnitDocuments(userData.unitId);
    } catch (err) {
      setError('Erro ao carregar documento');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteDocId(id);
  };

  const confirmDeleteDoc = async () => {
    if (!deleteDocId || !userData?.unitId) return;
    try {
      await documentsApi.delete(deleteDocId);
      setSuccess('Documento eliminado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
      loadUnitDocuments(userData.unitId);
    } catch (err) {
      toastError('Erro ao eliminar documento.');
      console.error(err);
    } finally {
      setDeleteDocId(null);
    }
  };

  const handleDownload = async (id: string, fileName: string) => {
    try {
      await documentsApi.download(id, fileName);
    } catch (err) {
      setError('Erro ao baixar documento');
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
      setSuccess('Perfil atualizado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao atualizar perfil');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
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
      setSuccess('Senha atualizada com sucesso!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao atualizar senha. Verifique a senha atual.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="text-center py-20 text-gray-400">
          <User className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>A carregar dados do perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <ConfirmModal
        open={deleteDocId !== null}
        title="Eliminar documento"
        message="Tem a certeza que deseja eliminar este documento? Esta ação não pode ser revertida."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={confirmDeleteDoc}
        onCancel={() => setDeleteDocId(null)}
      />
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
        <p className="text-gray-500 text-sm mt-0.5">Gerencie suas informações pessoais e segurança</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'profile'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <User className="w-4 h-4" />
            Perfil
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'security'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Shield className="w-4 h-4" />
            Segurança
          </button>
          {!isManager && unit && (
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
                activeTab === 'documents'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              Documentos
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
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 text-indigo-700">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Informações Pessoais</h2>
                <p className="text-sm text-gray-500">Atualize seus dados pessoais</p>
              </div>
            </div>

            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Nome
                  </div>
                </label>
                <input
                  type="text"
                  required
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </div>
                </label>
                <input
                  type="email"
                  value={profileData.email || ''}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Telefone
                  </div>
                </label>
                <input
                  type="tel"
                  required
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'A guardar...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>

          {/* User Info Display (Read-only) */}
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-gray-600" />
              Informações de Conta
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Função:
                </span>
                <span className="font-medium text-gray-900">
                  {userData && roleLabels[userData.role]}
                </span>
              </div>
              
              {!isManager && condominium && (
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Condomínio:
                  </span>
                  <span className="font-medium text-gray-900">{condominium.name}</span>
                </div>
              )}

              {!isManager && condominium && (
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email do condomínio:
                  </span>
                  <span className="font-medium text-gray-900">{condominium.email || 'Sem email configurado'}</span>
                </div>
              )}
              
              {!isManager && unit && (
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600 flex items-center gap-2">
                    <Home className="w-4 h-4" />
                    Fração:
                  </span>
                  <span className="font-medium text-gray-900">
                    Fração {unit.number} – Piso {unit.floor}
                  </span>
                </div>
              )}
              
              {!isManager && unit && unit.monthlyQuota > 0 && (
                <div className="py-2 border-b border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    <span className="text-gray-600 font-medium">
                      Quotas {new Date().getFullYear()}:
                    </span>
                  </div>
                  <div className="ml-6 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Mensal:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        €{unit.monthlyQuota.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Trimestral:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        €{(unit.monthlyQuota * 3).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Anual:</span>
                      <span className="text-sm font-semibold text-indigo-600">
                        €{(unit.monthlyQuota * 12).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {userData && (
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600 flex items-center gap-2">
                    {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    Tema:
                  </span>
                  <button
                    onClick={handleToggleTheme}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                  >
                    {isDarkMode ? 'Mudar para claro' : 'Mudar para escuro'}
                  </button>
                </div>
              )}

              {userData && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-600">Estado:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    userData.isActive 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {userData.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              )}
              
              <div className="pt-3 mt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  <strong>Nota:</strong> {isManager
                    ? 'A área de Gestor é focada em segurança e informações gerais da plataforma.'
                    : 'Para alterar função, condomínio ou fração, entre em contacto com o gestor ou administrador.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h2>
                  <p className="text-sm text-gray-500">Add an extra layer of protection to your account.</p>
                </div>
              </div>
              {securityData && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${securityData.twoFactorEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                  {securityData.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </span>
              )}
            </div>

            {loadingSecurity ? (
              <p className="text-sm text-gray-500">Loading security settings...</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  Recovery codes remaining: <span className="font-semibold text-gray-900">{securityData?.recoveryCodesRemaining ?? 0}</span>
                </div>

                {!securityData?.twoFactorEnabled && !twoFactorSetup && (
                  <button
                    onClick={handleStartTwoFactorSetup}
                    disabled={processingSecurity}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {processingSecurity ? 'Preparing...' : 'Set up 2FA'}
                  </button>
                )}

                {twoFactorSetup && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5 space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">Configure your authenticator app</h3>
                      <p className="text-sm text-gray-600 mt-1">Scan the QR code or enter the setup key manually in Google Authenticator, Microsoft Authenticator, or a compatible app.</p>
                    </div>

                    {twoFactorQrCode && (
                      <div className="flex justify-center">
                        <img src={twoFactorQrCode} alt="2FA QR Code" className="w-44 h-44 rounded-lg border border-white shadow-sm bg-white p-3" />
                      </div>
                    )}

                    <div className="rounded-lg border border-indigo-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Manual setup key</p>
                      <p className="font-mono text-sm text-gray-900 break-all">{twoFactorSetup.manualEntryKey}</p>
                    </div>

                    <form onSubmit={handleVerifyTwoFactorSetup} className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Verification code</label>
                        <input
                          type="text"
                          value={twoFactorSetupCode}
                          onChange={(e) => setTwoFactorSetupCode(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="123456"
                          required
                        />
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setTwoFactorSetup(null);
                            setTwoFactorSetupCode('');
                          }}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={processingSecurity}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                          {processingSecurity ? 'Verifying...' : 'Verify and enable'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {securityData?.twoFactorEnabled && (
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setShowRegenerateRecoveryCodes((value) => !value)}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      Regenerate recovery codes
                    </button>
                    <button
                      onClick={() => setShowDisableTwoFactor((value) => !value)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Disable 2FA
                    </button>
                  </div>
                )}

                {showDisableTwoFactor && (
                  <form onSubmit={handleDisableTwoFactor} className="rounded-lg border border-red-100 bg-red-50 p-4 space-y-3">
                    <h3 className="font-semibold text-gray-900">Disable two-factor authentication</h3>
                    <input
                      type="password"
                      value={disableTwoFactorData.currentPassword}
                      onChange={(e) => setDisableTwoFactorData({ ...disableTwoFactorData, currentPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="Current password"
                      required
                    />
                    <input
                      type="text"
                      value={disableTwoFactorData.code}
                      onChange={(e) => setDisableTwoFactorData({ ...disableTwoFactorData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder={disableTwoFactorData.useRecoveryCode ? 'Recovery code' : 'Authentication code'}
                      required
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={disableTwoFactorData.useRecoveryCode}
                        onChange={(e) => setDisableTwoFactorData({ ...disableTwoFactorData, useRecoveryCode: e.target.checked })}
                      />
                      Use recovery code
                    </label>
                    <button
                      type="submit"
                      disabled={processingSecurity}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      Confirm disable
                    </button>
                  </form>
                )}

                {showRegenerateRecoveryCodes && (
                  <form onSubmit={handleRegenerateRecoveryCodes} className="rounded-lg border border-amber-100 bg-amber-50 p-4 space-y-3">
                    <h3 className="font-semibold text-gray-900">Regenerate recovery codes</h3>
                    <input
                      type="password"
                      value={regenerateRecoveryCodesData.currentPassword}
                      onChange={(e) => setRegenerateRecoveryCodesData({ ...regenerateRecoveryCodesData, currentPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="Current password"
                      required
                    />
                    <input
                      type="text"
                      value={regenerateRecoveryCodesData.code}
                      onChange={(e) => setRegenerateRecoveryCodesData({ ...regenerateRecoveryCodesData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder={regenerateRecoveryCodesData.useRecoveryCode ? 'Recovery code' : 'Authentication code'}
                      required
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={regenerateRecoveryCodesData.useRecoveryCode}
                        onChange={(e) => setRegenerateRecoveryCodesData({ ...regenerateRecoveryCodesData, useRecoveryCode: e.target.checked })}
                      />
                      Use recovery code
                    </label>
                    <button
                      type="submit"
                      disabled={processingSecurity}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                    >
                      Generate new codes
                    </button>
                  </form>
                )}

                {recoveryCodes.length > 0 && (
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 space-y-2">
                    <h3 className="font-semibold text-gray-900">Recovery codes</h3>
                    <p className="text-sm text-gray-600">Save these codes in a secure place. Each code can only be used once.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {recoveryCodes.map((code) => (
                        <div key={code} className="font-mono text-sm bg-white rounded border border-emerald-100 px-3 py-2 text-gray-900">
                          {code}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-700">
                <Link2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Linked Accounts</h2>
                <p className="text-sm text-gray-500">Connect Google or Microsoft to sign in without entering your password.</p>
              </div>
            </div>

            <div className="space-y-3">
              {(['Google', 'Microsoft'] as const).map((provider) => {
                const linkedProvider = securityData?.linkedProviders.find((item) => item.provider === provider);
                const providerKey = provider.toLowerCase() as 'google' | 'microsoft';

                return (
                  <div key={provider} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{provider}</p>
                      <p className="text-sm text-gray-500">
                        {linkedProvider ? `Linked to ${linkedProvider.providerEmail}` : 'Not linked'}
                      </p>
                    </div>
                    {linkedProvider ? (
                      <button
                        onClick={() => handleUnlinkProvider(providerKey)}
                        className="px-4 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Unlink
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartProviderLink(providerKey)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Link {provider}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-700">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Alterar Senha</h2>
                <p className="text-sm text-gray-500">Atualize sua senha de acesso</p>
              </div>
            </div>

            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha Atual</label>
                <input
                  type="password"
                  required
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Mínimo de 6 caracteres</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nova Senha</label>
                <input
                  type="password"
                  required
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Lock className="w-4 h-4" />
                  {saving ? 'A alterar...' : 'Alterar Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && unit && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-700">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Documentos da Minha Fração</h2>
                <p className="text-sm text-gray-500">Gerencie os documentos da sua habitação</p>
              </div>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Carregar Documento
            </button>
          </div>

          {unitDocuments.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum documento carregado ainda.</p>
              <p className="text-xs mt-2">
                Carregue documentos como apólice de seguro, escritura, etc.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {unitDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-gray-900 truncate">{doc.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          unitDocumentColors[doc.type] || 'bg-gray-100 text-gray-600'
                        }`}>
                          {unitDocumentTypes[doc.type] || doc.type}
                        </span>
                      </div>
                      {doc.description && (
                        <p className="text-sm text-gray-500 truncate">{doc.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Atualizado: {new Date(doc.uploadedAt).toLocaleDateString('pt-PT')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(doc.id, doc.name)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Baixar"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      <ModalPopup
        open={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadFile(null);
          setUploadForm({ name: '', type: 'UnitInsurance', description: '' });
        }}
        title="Carregar Documento"
        maxWidthClass="max-w-lg"
      >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Adicione um documento à sua fração</p>
              </div>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Documento *
                </label>
                <select
                  required
                  value={uploadForm.type}
                  onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(unitDocumentTypes).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Documento *
                </label>
                <input
                  type="text"
                  required
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                  placeholder="Ex: Apólice de Seguro 2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição (opcional)
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  placeholder="Adicione detalhes sobre este documento..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <FileUpload
                onFileSelect={setUploadFile}
                currentFile={uploadFile}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFile(null);
                    setUploadForm({ name: '', type: 'UnitInsurance', description: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || uploading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'A carregar...' : 'Carregar'}
                </button>
              </div>
            </form>
      </ModalPopup>
    </div>
  );
}
