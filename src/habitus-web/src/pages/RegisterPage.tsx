import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Mail, Lock, User, Phone, Home } from 'lucide-react';
import { authApi, unitsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import type { UnitDto } from '../types';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', unitId: '' });
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    unitsApi.getAll().then((r) => setUnits(r.data)).catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.register(form);
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
          <h1 className="text-3xl font-bold text-gray-900">Habitus</h1>
          <p className="text-gray-500 mt-1">Gestão de Condomínio</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Criar Conta</h2>

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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                <div className="relative">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={type}
                    name={name}
                    value={form[name as keyof typeof form]}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    placeholder={placeholder}
                  />
                </div>
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Fração</label>
              <div className="relative">
                <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  name="unitId"
                  value={form.unitId}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm appearance-none bg-white"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg transition-colors text-sm mt-2"
            >
              {loading ? 'A criar conta...' : 'Criar Conta'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
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
