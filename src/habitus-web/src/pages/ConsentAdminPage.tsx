import { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, Pencil, Plus, AlertTriangle } from 'lucide-react';
import { consentAdminApi } from '../api/services';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n/I18nProvider';
import ModalPopup from '../components/ModalPopup';
import RichTextEditor from '../components/RichTextEditor';
import RichTextDisplay from '../components/RichTextDisplay';
import { PageHeader, Button, Spinner, EmptyState, ErrorState, Badge, Card, Field, Input } from '../components/ui';
import type { ConsentDefinitionDto, PublishConsentVersionRequest } from '../types';

// Groups definitions by `key`, keeping the latest active version first so it can
// be highlighted as the currently required consent for that key.
function groupByKey(definitions: ConsentDefinitionDto[]): { key: string; versions: ConsentDefinitionDto[]; latestId: string | null }[] {
  const map = new Map<string, ConsentDefinitionDto[]>();
  for (const def of definitions) {
    const list = map.get(def.key) ?? [];
    list.push(def);
    map.set(def.key, list);
  }
  return [...map.entries()]
    .map(([key, versions]) => {
      const sorted = [...versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const latest = sorted.find((d) => d.isActive) ?? sorted[0] ?? null;
      return { key, versions: sorted, latestId: latest ? latest.id : null };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

const emptyPublishForm: PublishConsentVersionRequest = {
  key: '',
  version: '',
  title: '',
  url: '',
  body: '',
  isMandatory: true,
};

export default function ConsentAdminPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const { t, formatDateTime } = useTranslation();

  const [definitions, setDefinitions] = useState<ConsentDefinitionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // In-place edit modal state.
  const [editingDef, setEditingDef] = useState<ConsentDefinitionDto | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editBody, setEditBody] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Publish-new-version modal state.
  const [showPublish, setShowPublish] = useState(false);
  const [publishForm, setPublishForm] = useState<PublishConsentVersionRequest>(emptyPublishForm);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [confirmingPublish, setConfirmingPublish] = useState(false);

  const loadDefinitions = useCallback(() => {
    setLoading(true);
    setLoadError('');
    consentAdminApi
      .list()
      .then((response) => {
        setDefinitions(response.data);
      })
      .catch((error) => {
        console.error('Error loading consent definitions:', error);
        setLoadError(t('consentAdmin.errorLoad'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [t]);

  // Initial load: only the deferred promise callbacks touch state, so no
  // synchronous setState runs in the effect body (avoids cascading renders).
  useEffect(() => {
    consentAdminApi
      .list()
      .then((response) => setDefinitions(response.data))
      .catch((error) => {
        console.error('Error loading consent definitions:', error);
        setLoadError(t('consentAdmin.errorLoad'));
      })
      .finally(() => setLoading(false));
  }, [t]);

  const openEdit = (def: ConsentDefinitionDto) => {
    setEditingDef(def);
    setEditTitle(def.title);
    setEditUrl(def.url ?? '');
    setEditBody(def.body ?? '');
  };

  const closeEdit = () => setEditingDef(null);

  const handleSaveEdit = () => {
    if (!editingDef) return;
    setSavingEdit(true);
    consentAdminApi
      .update(editingDef.id, {
        title: editTitle.trim(),
        url: editUrl.trim() ? editUrl.trim() : null,
        body: editBody,
      })
      .then(() => {
        toastSuccess(t('consentAdmin.saved'));
        setEditingDef(null);
        loadDefinitions();
      })
      .catch((error) => {
        console.error('Error saving consent definition:', error);
        toastError(t('consentAdmin.errorSave'));
      })
      .finally(() => {
        setSavingEdit(false);
      });
  };

  const openPublish = () => {
    setPublishForm(emptyPublishForm);
    setPublishError('');
    setConfirmingPublish(false);
    setShowPublish(true);
  };

  const closePublish = () => {
    setShowPublish(false);
    setConfirmingPublish(false);
  };

  const canSubmitPublish = publishForm.key.trim() !== '' && publishForm.version.trim() !== '' && publishForm.title.trim() !== '';

  const handlePublish = () => {
    setPublishing(true);
    setPublishError('');
    consentAdminApi
      .publish({
        key: publishForm.key.trim(),
        version: publishForm.version.trim(),
        title: publishForm.title.trim(),
        url: publishForm.url?.trim() ? publishForm.url.trim() : null,
        body: publishForm.body,
        isMandatory: publishForm.isMandatory,
      })
      .then(() => {
        toastSuccess(t('consentAdmin.published'));
        setShowPublish(false);
        setConfirmingPublish(false);
        loadDefinitions();
      })
      .catch((error) => {
        const code = (error as { response?: { data?: { code?: string } } }).response?.data?.code;
        setConfirmingPublish(false);
        if (code === 'duplicate_version') {
          setPublishError(t('consentAdmin.errorDuplicateVersion'));
        } else {
          setPublishError(t('consentAdmin.errorSave'));
        }
      })
      .finally(() => {
        setPublishing(false);
      });
  };

  const groups = groupByKey(definitions);
  const existingKeys = [...new Set(definitions.map((d) => d.key))].sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('consentAdmin.title')}
        subtitle={t('consentAdmin.subtitle')}
        actions={
          <Button icon={Plus} onClick={openPublish}>
            {t('consentAdmin.publishHeading')}
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-8 text-ink-subtle">
          <Spinner label={t('consentAdmin.title')} />
        </div>
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={loadDefinitions} />
      ) : groups.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={t('consentAdmin.empty')} />
      ) : (
        <div className="space-y-6">
          <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide">
            {t('consentAdmin.listHeading')}
          </h2>
          {groups.map((group) => (
            <Card key={group.key} className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-ink">{group.key}</h3>
              </div>
              <div className="space-y-3">
                {group.versions.map((def) => {
                  const isLatest = def.id === group.latestId;
                  return (
                    <div
                      key={def.id}
                      className={`rounded-lg border p-4 ${isLatest ? 'border-indigo-300 bg-indigo-50/40' : 'border-line'}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-ink">{def.title}</span>
                            {isLatest && <Badge variant="brand">{t('consentAdmin.latestBadge')}</Badge>}
                            {def.isMandatory && <Badge variant="warning">{t('consentAdmin.mandatoryLabel')}</Badge>}
                            <Badge variant={def.isActive ? 'success' : 'neutral'}>{t('consentAdmin.activeLabel')}</Badge>
                          </div>
                          <p className="text-xs text-ink-subtle">
                            {t('consentAdmin.versionLabel')}: <span className="font-mono">{def.version}</span>
                            {' · '}
                            {t('consentAdmin.createdAtLabel')}: {formatDateTime(def.createdAt)}
                          </p>
                          {def.updatedAt && (
                            <p className="text-xs text-ink-subtle">
                              {t('consentAdmin.updatedInfo')}: {formatDateTime(def.updatedAt)}
                              {def.updatedByUserId ? ` · ${def.updatedByUserId}` : ''}
                            </p>
                          )}
                          {def.url && (
                            <p className="text-xs text-ink-subtle break-all">
                              {t('consentAdmin.urlLabel')}: {def.url}
                            </p>
                          )}
                        </div>
                        <Button variant="secondary" size="sm" icon={Pencil} onClick={() => openEdit(def)}>
                          {t('consentAdmin.edit')}
                        </Button>
                      </div>
                      {def.body ? (
                        <div className="mt-3 border-t border-line pt-3">
                          <p className="text-xs font-medium text-ink-muted mb-1">{t('consentAdmin.bodyLabel')}</p>
                          <RichTextDisplay content={def.body} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* In-place edit modal */}
      <ModalPopup
        open={editingDef !== null}
        onClose={closeEdit}
        title={t('consentAdmin.edit')}
        maxWidthClass="max-w-2xl"
        bodyClassName="p-0"
      >
        {editingDef && (
          <>
            <div className="px-6 py-4 space-y-4">
              <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{t('consentAdmin.inPlaceNote')}</span>
              </div>
              <p className="text-xs text-ink-subtle">
                {t('consentAdmin.keyLabel')}: <span className="font-mono">{editingDef.key}</span>
                {' · '}
                {t('consentAdmin.versionLabel')}: <span className="font-mono">{editingDef.version}</span>
              </p>
              <Field label={t('consentAdmin.titleLabel')} required>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </Field>
              <Field label={t('consentAdmin.urlLabel')}>
                <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="https://" />
              </Field>
              <Field label={t('consentAdmin.bodyLabel')}>
                <RichTextEditor value={editBody} onChange={setEditBody} height="300px" />
              </Field>
            </div>
            <div className="px-6 py-4 border-t border-line flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={closeEdit} disabled={savingEdit}>
                {t('consentAdmin.cancel')}
              </Button>
              <Button onClick={handleSaveEdit} loading={savingEdit} disabled={editTitle.trim() === ''}>
                {savingEdit ? t('consentAdmin.saving') : t('consentAdmin.save')}
              </Button>
            </div>
          </>
        )}
      </ModalPopup>

      {/* Publish-new-version modal */}
      <ModalPopup
        open={showPublish}
        onClose={closePublish}
        title={t('consentAdmin.publishHeading')}
        maxWidthClass="max-w-2xl"
        bodyClassName="p-0"
      >
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-start gap-2 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{t('consentAdmin.publishWarning')}</span>
          </div>

          {publishError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {publishError}
            </div>
          )}

          <Field label={t('consentAdmin.keyLabel')} required>
            <Input
              list="consent-keys"
              value={publishForm.key}
              onChange={(e) => setPublishForm((prev) => ({ ...prev, key: e.target.value }))}
              placeholder={t('consentAdmin.keyPlaceholder')}
              disabled={publishing || confirmingPublish}
            />
            <datalist id="consent-keys">
              {existingKeys.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </Field>
          <Field label={t('consentAdmin.versionLabel')} required>
            <Input
              value={publishForm.version}
              onChange={(e) => setPublishForm((prev) => ({ ...prev, version: e.target.value }))}
              placeholder="v2"
              disabled={publishing || confirmingPublish}
            />
          </Field>
          <Field label={t('consentAdmin.titleLabel')} required>
            <Input
              value={publishForm.title}
              onChange={(e) => setPublishForm((prev) => ({ ...prev, title: e.target.value }))}
              disabled={publishing || confirmingPublish}
            />
          </Field>
          <Field label={t('consentAdmin.urlLabel')}>
            <Input
              value={publishForm.url ?? ''}
              onChange={(e) => setPublishForm((prev) => ({ ...prev, url: e.target.value }))}
              placeholder="https://"
              disabled={publishing || confirmingPublish}
            />
          </Field>
          <Field label={t('consentAdmin.bodyLabel')}>
            <RichTextEditor
              value={publishForm.body ?? ''}
              onChange={(value) => setPublishForm((prev) => ({ ...prev, body: value }))}
              height="300px"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-line text-indigo-600 focus:ring-indigo-500"
              checked={publishForm.isMandatory}
              onChange={(e) => setPublishForm((prev) => ({ ...prev, isMandatory: e.target.checked }))}
              disabled={publishing || confirmingPublish}
            />
            {t('consentAdmin.mandatoryLabel')}
          </label>
        </div>

        <div className="px-6 py-4 border-t border-line">
          {confirmingPublish ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{t('consentAdmin.publishWarning')}</span>
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="ghost" onClick={() => setConfirmingPublish(false)} disabled={publishing}>
                  {t('consentAdmin.cancel')}
                </Button>
                <Button variant="warning" onClick={handlePublish} loading={publishing}>
                  {publishing ? t('consentAdmin.publishing') : t('consentAdmin.confirmPublish')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={closePublish} disabled={publishing}>
                {t('consentAdmin.cancel')}
              </Button>
              <Button onClick={() => setConfirmingPublish(true)} disabled={!canSubmitPublish}>
                {t('consentAdmin.publish')}
              </Button>
            </div>
          )}
        </div>
      </ModalPopup>
    </div>
  );
}
