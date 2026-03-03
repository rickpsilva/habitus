import { useState, useEffect } from 'react';
import { User, Mail, Phone, Lock, Save, Building2, Home, Shield } from 'lucide-react';
import { usersApi, condominiumsApi, unitsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import type { UpdateUserRequest, UserDto, CondominiumDto, UnitDto } from '../types';

const roleLabels: Record<number, string> = {
  0: 'Gestor',
  1: 'Administrador',
  2: 'Morador',
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
        <p className="text-gray-500 text-sm mt-0.5">Gerencie suas informações pessoais</p>
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

      {/* Password Change */}
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
          
          {condominium && (
            <div className="flex items-center justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Condomínio:
              </span>
              <span className="font-medium text-gray-900">{condominium.name}</span>
            </div>
          )}
          
          {unit && (
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
              <strong>Nota:</strong> Para alterar função, condomínio ou fração, entre em contacto com o gestor ou administrador.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
