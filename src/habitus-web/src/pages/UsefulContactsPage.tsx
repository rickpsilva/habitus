import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, PhoneCall, ShieldAlert, Wrench, Building2 } from 'lucide-react';
import { usefulContactsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ModalPopup from '../components/ModalPopup';
import SearchBar from '../components/SearchBar';
import { PageHeader, Button, AsyncState, EmptyState, Card } from '../components/ui';
import type { UsefulContactCategory, UsefulContactDto } from '../types';

type CategoryOption = {
  value: number;
  label: string;
  icon: React.ElementType;
  badgeClass: string;
};

const categoryOptions: CategoryOption[] = [
  { value: 0, label: 'Emergencia', icon: ShieldAlert, badgeClass: 'bg-red-100 text-red-700' },
  { value: 1, label: 'Servico', icon: Wrench, badgeClass: 'bg-indigo-100 text-indigo-700' },
  { value: 2, label: 'Administrativo', icon: Building2, badgeClass: 'bg-control text-ink-muted' },
];

const categoryByString: Record<string, number> = {
  Emergency: 0,
  Service: 1,
  Administrative: 2,
};

const initialForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  postalCode: '',
  locality: '',
  category: 0,
};

function normalizeCategory(category: UsefulContactCategory): number {
  if (typeof category === 'number') {
    return category;
  }

  return categoryByString[category] ?? 0;
}

function categoryMeta(category: UsefulContactCategory) {
  const value = normalizeCategory(category);
  return categoryOptions.find((option) => option.value === value) ?? categoryOptions[0];
}

export default function UsefulContactsPage() {
  const navigate = useNavigate();
  const { condominiumId, isAdmin, isManager } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [contacts, setContacts] = useState<UsefulContactDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<UsefulContactDto | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (isManager) {
      navigate('/dashboard');
    }
  }, [isManager, navigate]);

  const loadContacts = useCallback(async () => {
    if (!condominiumId) {
      setContacts([]);
      setLoadError('Condomínio não identificado.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');

    try {
      const response = await usefulContactsApi.getAll(condominiumId);
      setContacts(response.data);
    } catch {
      setLoadError('Não foi possível carregar os contactos úteis.');
    } finally {
      setLoading(false);
    }
  }, [condominiumId]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const filteredContacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return contacts;
    }

    return contacts.filter((contact) => {
      const category = categoryMeta(contact.category).label.toLowerCase();
      return (
        contact.name.toLowerCase().includes(query) ||
        contact.phone.toLowerCase().includes(query) ||
        category.includes(query)
      );
    });
  }, [contacts, searchQuery]);

  const openCreateModal = () => {
    setEditingContact(null);
    setForm(initialForm);
    setShowForm(true);
  };

  const openEditModal = (contact: UsefulContactDto) => {
    setEditingContact(contact);
    setForm({
      name: contact.name,
      phone: contact.phone,
      email: contact.email || '',
      address: contact.address || '',
      postalCode: contact.postalCode || '',
      locality: contact.locality || '',
      category: normalizeCategory(contact.category),
    });
    setShowForm(true);
  };

  const closeModal = () => {
    setShowForm(false);
    setEditingContact(null);
    setForm(initialForm);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!condominiumId) {
      toastError('Condomínio não identificado.');
      return;
    }

    if (!form.name.trim() || !form.phone.trim()) {
      toastError('Nome e telefone sao obrigatorios.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        locality: form.locality.trim() || undefined,
        category: form.category,
      };

      if (editingContact) {
        await usefulContactsApi.update(condominiumId, editingContact.id, payload);
        toastSuccess('Contacto util atualizado com sucesso.');
      } else {
        await usefulContactsApi.create(condominiumId, payload);
        toastSuccess('Contacto util criado com sucesso.');
      }

      closeModal();
      await loadContacts();
    } catch {
      toastError('Não foi possível guardar o contacto útil.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId || !condominiumId) {
      setDeleteId(null);
      return;
    }

    try {
      await usefulContactsApi.delete(condominiumId, deleteId);
      toastSuccess('Contacto util eliminado com sucesso.');
      await loadContacts();
    } catch {
      toastError('Não foi possível eliminar o contacto útil.');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmModal
        open={deleteId !== null}
        title="Eliminar contacto util"
        message="Tem a certeza que deseja eliminar este contacto? Esta ação não pode ser revertida."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      <ModalPopup
        open={showForm}
        onClose={closeModal}
        title={editingContact ? 'Editar Contacto Util' : 'Novo Contacto Util'}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">Nome</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Ex: Bombeiros de Lisboa"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">Telefone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Ex: +351 213 000 000"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Ex: contacto@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">Morada</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Ex: Rua Principal, 123"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Código Postal</label>
              <input
                type="text"
                value={form.postalCode}
                onChange={(e) => setForm((prev) => ({ ...prev, postalCode: e.target.value }))}
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Ex: 1000-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Localidade</label>
              <input
                type="text"
                value={form.locality}
                onChange={(e) => setForm((prev) => ({ ...prev, locality: e.target.value }))}
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Ex: Lisboa"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">Categoria</label>
            <select
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={closeModal} className="border border-line">
              Cancelar
            </Button>
            <Button type="submit" loading={submitting}>
              {editingContact ? 'Guardar' : 'Criar'}
            </Button>
          </div>
        </form>
      </ModalPopup>

      <PageHeader
        title="Contactos Úteis"
        subtitle="Lista de contactos importantes do condomínio."
        search={
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Pesquisar por nome, telefone ou categoria..."
          />
        }
        actions={
          isAdmin && (
            <Button icon={Plus} onClick={openCreateModal} fullWidth className="sm:w-auto">
              Novo Contacto
            </Button>
          )
        }
      />

      <AsyncState
        loading={loading}
        error={loadError || null}
        onRetry={loadContacts}
        isEmpty={filteredContacts.length === 0}
        skeleton="card"
        empty={
          <EmptyState
            icon={PhoneCall}
            title="Sem contactos úteis registados"
            description={
              isAdmin
                ? 'Adicione o primeiro contacto para o condomínio.'
                : 'Ainda não existem contactos disponíveis.'
            }
          />
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => {
            const meta = categoryMeta(contact.category);
            const Icon = meta.icon;

            return (
              <Card key={contact.id} interactive className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-ink truncate">{contact.name}</h3>
                    <a href={`tel:${contact.phone}`} className="text-sm text-indigo-600 hover:text-indigo-700">
                      {contact.phone}
                    </a>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(contact)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(contact.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  {contact.email && (
                    <div className="text-ink-muted">
                      <a href={`mailto:${contact.email}`} className="text-indigo-600 hover:text-indigo-700">
                        {contact.email}
                      </a>
                    </div>
                  )}
                  {contact.address && (
                    <div className="text-ink-muted">{contact.address}</div>
                  )}
                  {(contact.postalCode || contact.locality) && (
                    <div className="text-ink-muted">
                      {contact.postalCode && <span>{contact.postalCode}</span>}
                      {contact.postalCode && contact.locality && <span>, </span>}
                      {contact.locality && <span>{contact.locality}</span>}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${meta.badgeClass}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {meta.label}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </AsyncState>
    </div>
  );
}
