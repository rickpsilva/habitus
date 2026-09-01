import { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { Building2, Mail, Lock, User, Phone, Home, MailWarning } from 'lucide-react';
import { authApi, condominiumsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import type { UnitDto, RegisterRequest } from '../types';
import { AssociationRequestedRole, AssociationRequestSource } from '../types';
import { setPendingAssociationIntent } from '../utils/associationIntent';
import { Button } from '../components/ui';
import { useTranslation } from '../i18n/I18nProvider';

export default function RegisterPage() {
  const { t } = useTranslation();
  const { condominiumId: routeCondominiumId } = useParams<{ condominiumId?: string }>();
  const isAdminRegistration = Boolean(routeCondominiumId);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', unitId: '' });
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [error, setError] = useState('');
  const [emailExists, setEmailExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAdminRegistration) {
      setUnits([]);
      return;
    }

    condominiumsApi.getPublic()
      .then(async (condosResponse) => {
        const unitsByCondo = await Promise.all(
          condosResponse.data.map(async (condo) => {
            const unitsResponse = await condominiumsApi.getUnitsPublic(condo.id);
            return unitsResponse.data.map((unit) => ({
              id: unit.id,
              number: unit.number,
              floor: unit.floor,
              apartmentNumber: unit.apartmentNumber,
              condominiumId: condo.id,
              type: 0,
              permillage: 0,
              monthlyQuota: 0,
            }));
          })
        );

        setUnits(unitsByCondo.flat());
      })
      .catch(() => setUnits([]));
  }, [isAdminRegistration]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailExists(false);
    setLoading(true);

    let intentCondominiumId: string | undefined;
    let intentRole: number = AssociationRequestedRole.Admin;
    try {
      let request: RegisterRequest;

      if (isAdminRegistration) {
        request = {
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          condominiumId: routeCondominiumId,
          role: 'Admin',
        };
        intentCondominiumId = routeCondominiumId;
        intentRole = AssociationRequestedRole.Admin;
      } else {
        const selectedUnit = units.find((u) => u.id === form.unitId);
        if (!selectedUnit) {
          setError(t('register.error.invalidUnit'));
          setLoading(false);
          return;
        }

        request = {
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          unitId: form.unitId,
          condominiumId: selectedUnit.condominiumId,
          role: 'Resident',
        };
        intentCondominiumId = selectedUnit.condominiumId;
        intentRole = AssociationRequestedRole.Resident;
      }

      const { data } = await authApi.register(request);
      login(data);
      navigate('/dashboard');
    } catch (err) {
      const response = (err as { response?: { status?: number; data?: { code?: string } } }).response;
      // Register fallback: the email already has an account. Persist the intended
      // association so it is created right after the user signs in, and show a
      // friendly panel with a "Sign in" CTA instead of the generic error.
      if (response?.status === 409 && response.data?.code === 'email_already_exists' && intentCondominiumId) {
        setPendingAssociationIntent({
          targetCondominiumId: intentCondominiumId,
          requestedRole: intentRole,
          source: AssociationRequestSource.RegisterFallback,
        });
        setEmailExists(true);
      } else {
        setError(t('register.error.createFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-ink">{t('common.appName')}</h1>
          <p className="text-ink-subtle mt-1">{t('common.appTagline')}</p>
        </div>

        <div className="bg-surface rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-ink mb-6">
            {isAdminRegistration ? t('register.adminTitle') : t('register.title')}
          </h2>

          {isAdminRegistration && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-100 text-amber-800 text-sm">
              {t('register.adminNotice')}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
          )}

          {emailExists ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center gap-3 py-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100">
                  <MailWarning className="w-7 h-7 text-amber-600" />
                </div>
                <h3 className="text-base font-semibold text-ink">{t('association.emailExists.title')}</h3>
                <p className="text-sm text-ink-muted">{t('association.emailExists.message')}</p>
              </div>
              <Button
                type="button"
                fullWidth
                onClick={() => navigate(`/login?email=${encodeURIComponent(form.email)}`)}
              >
                {t('association.emailExists.signIn')}
              </Button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { name: 'name', label: t('register.nameLabel'), type: 'text', icon: User, placeholder: t('register.namePlaceholder') },
              { name: 'email', label: t('common.email'), type: 'email', icon: Mail, placeholder: 'joao@email.com' },
              { name: 'password', label: t('login.password'), type: 'password', icon: Lock, placeholder: '••••••••' },
              { name: 'phone', label: t('common.phone'), type: 'tel', icon: Phone, placeholder: '+351 912 345 678' },
            ].map(({ name, label, type, icon: Icon, placeholder }) => (
              <div key={name}>
                <label className="block text-sm font-medium text-ink-muted mb-1.5">{label}</label>
                <div className="relative">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
                  <input
                    type={type}
                    name={name}
                    value={form[name as keyof typeof form]}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    placeholder={placeholder}
                  />
                </div>
              </div>
            ))}

            {!isAdminRegistration && (
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1.5">{t('register.unitLabel')}</label>
                <div className="relative">
                  <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
                  <select
                    name="unitId"
                    value={form.unitId}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm appearance-none bg-surface"
                  >
                    <option value="">{t('register.unitPlaceholder')}</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {t('register.unitOption', { number: u.number, floor: u.floor ?? '' })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <Button type="submit" loading={loading} fullWidth className="mt-2">
              {loading ? t('register.creating') : t('register.title')}
            </Button>
          </form>
          )}

          <p className="text-center text-sm text-ink-subtle mt-6">
            {t('register.haveAccount')}{' '}
            <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
              {t('register.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
