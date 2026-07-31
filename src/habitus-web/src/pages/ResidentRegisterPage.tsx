import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Building2, Mail, Lock, User, Phone, Home, CheckCircle } from 'lucide-react';
import { condominiumsApi, userRegistrationApi } from '../api/services';
import type { UnitPublicDto } from '../types';
import { Button } from '../components/ui';
import { useTranslation } from '../i18n/I18nProvider';

export default function ResidentRegisterPage() {
  const { t } = useTranslation();
  const { condominiumId } = useParams<{ condominiumId: string }>();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', unitId: '' });
  const [units, setUnits] = useState<UnitPublicDto[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [condominiumName, setCondominiumName] = useState('');

  useEffect(() => {
    if (!condominiumId) return;

    // Load condominium name for display
    condominiumsApi.getPublic().then((r) => {
      const condo = r.data.find((c) => c.id === condominiumId);
      if (condo) setCondominiumName(condo.name);
    }).catch(() => {});

    // Load units for this condominium
    condominiumsApi.getUnitsPublic(condominiumId)
      .then((r) => setUnits(r.data))
      .catch(() => setError(t('residentRegister.error.loadUnits')));
  }, [condominiumId, t]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.unitId) {
      setError(t('residentRegister.error.selectUnit'));
      return;
    }

    setLoading(true);
    try {
      await userRegistrationApi.registerResident(condominiumId!, {
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        unitId: form.unitId,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(apiError ?? t('register.error.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-surface rounded-2xl shadow-xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <CheckCircle className="w-9 h-9 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-ink mb-2">{t('residentRegister.success.title')}</h2>
            <p className="text-sm text-ink-muted mb-6">
              {t('residentRegister.success.line1')}<br />
              {t('residentRegister.success.line2')}<br />
              {t('residentRegister.success.line3')}
            </p>
            <Link
              to="/login"
              className="inline-block px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              {t('residentRegister.success.goToLogin')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-ink">Habitus</h1>
          <p className="text-ink-subtle mt-1">{t('common.appTagline')}</p>
        </div>

        <div className="bg-surface rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-ink mb-1">{t('register.title')}</h2>
          {condominiumName && (
            <p className="text-sm text-indigo-600 font-medium mb-4">{condominiumName}</p>
          )}

          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-100 text-amber-800 text-sm">
            {t('residentRegister.pendingNoticePrefix')}{' '}
            <strong>{t('residentRegister.pendingNoticeStrong')}</strong>{' '}
            {t('residentRegister.pendingNoticeSuffix')}
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
          )}

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

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1.5">
                {t('register.unitLabel')} <span className="text-red-500">*</span>
              </label>
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
                      {t('residentRegister.unitOption', {
                        number: u.number,
                        apartment: u.apartmentNumber ? ` (${u.apartmentNumber})` : '',
                        floor: u.floor,
                      })}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button type="submit" loading={loading} fullWidth className="mt-2">
              {loading ? t('residentRegister.submitting') : t('residentRegister.submit')}
            </Button>
          </form>

          <p className="text-center text-sm text-ink-subtle mt-6">
            {t('register.haveAccount')}{' '}
            <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
              {t('register.signIn')}
            </Link>
          </p>
          <p className="text-center text-sm text-ink-subtle mt-2">
            <Link to="/register" className="text-ink-subtle hover:text-ink-muted text-xs">
              ← {t('residentRegister.chooseAnother')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
