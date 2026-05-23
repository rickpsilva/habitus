import { Building2, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function InactiveCondominiumPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-rose-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-amber-100 p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500 shadow-lg mb-4">
          <AlertTriangle className="w-8 h-8 text-white" />
        </div>

        <div className="flex items-center justify-center gap-2 text-gray-900 mb-2">
          <Building2 className="w-5 h-5" />
          <h1 className="text-2xl font-bold">Condomínio Inativo</h1>
        </div>

        <p className="text-gray-600 leading-relaxed">
          O seu condomínio encontra-se atualmente inativo. O acesso ao portal foi temporariamente bloqueado.
        </p>

        <p className="text-gray-600 leading-relaxed mt-3">
          Contacte o administrador do condomínio para esclarecer a situação e solicitar a reativação.
        </p>

        <div className="mt-7">
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors"
          >
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
