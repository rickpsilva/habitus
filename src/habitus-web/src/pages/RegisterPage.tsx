import { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { Building2, Mail, Lock, User, Phone, Home } from 'lucide-react';
import { authApi, condominiumsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import type { UnitDto, RegisterRequest } from '../types';
import { Button } from '../components/ui';

export default function RegisterPage() {
  const { condominiumId: routeCondominiumId } = useParams<{ condominiumId?: string }>();
  const isAdminRegistration = Boolean(routeCondominiumId);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', unitId: '' });
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [error, setError] = useState('');
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
    setLoading(true);
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
      } else {
        const selectedUnit = units.find((u) => u.id === form.unitId);
        if (!selectedUnit) {
          setError('Selecione uma fração válida para concluir o registo.');
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
      }

      const { data } = await authApi.register(request);
      login(data);
      navigate('/dashboard');
    } catch {
      setError('Não foi possível criar a conta. Verifique os dados e tente novamente.');
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
          <h1 className="text-3xl font-bold text-ink">Habitus</h1>
          <p className="text-ink-subtle mt-1">Gestão de Condomínio</p>
        </div>

        <div className="bg-surface rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-ink mb-6">
            {isAdminRegistration ? 'Registo de Administrador' : 'Criar Conta'}
          </h2>

          {isAdminRegistration && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-100 text-amber-800 text-sm">
              Está a efetuar o registo de um utilizador com perfil Administrador para o condomínio indicado pelo gestor.
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { name: 'name', label: 'Nome completo', type: 'text', icon: User, placeholder: 'João Silva' },
              { name: 'email', label: 'Email', type: 'email', icon: Mail, placeholder: 'joao@email.com' },
              { name: 'password', label: 'Password', type: 'password', icon: Lock, placeholder: '••••••••' },
              { name: 'phone', label: 'Telefone', type: 'tel', icon: Phone, placeholder: '+351 912 345 678' },
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
                <label className="block text-sm font-medium text-ink-muted mb-1.5">Fração</label>
                <div className="relative">
                  <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
                  <select
                    name="unitId"
                    value={form.unitId}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm appearance-none bg-surface"
                  >
                    <option value="">Selecionar fração</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.number} – Piso {u.floor}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <Button type="submit" loading={loading} fullWidth className="mt-2">
              {loading ? 'A criar conta...' : 'Criar Conta'}
            </Button>
          </form>

          <p className="text-center text-sm text-ink-subtle mt-6">
            Já tem conta?{' '}
            <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Iniciar sessão
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
