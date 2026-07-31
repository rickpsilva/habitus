import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRound, Check, X } from 'lucide-react';
import { associationApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n/I18nProvider';
import { AssociationRequestedRole } from '../types';
import type { AssociationRequestResponseDto } from '../types';
import ModalPopup from '../components/ModalPopup';
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Badge,
  Field,
  Textarea,
  Spinner,
  EmptyState,
  ErrorState,
} from '../components/ui';

export default function AssociationRequestsAdminPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { t, formatDateTime } = useTranslation();
  const { success: toastSuccess, error: toastError } = useToast();

  const [requests, setRequests] = useState<AssociationRequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<AssociationRequestResponseDto | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Guard: only condominium Admins may review pending requests.
  useEffect(() => {
    if (!isAdmin) navigate('/dashboard');
  }, [isAdmin, navigate]);

  const reload = useCallback(() => {
    setLoading(true);
    setLoadError('');
    associationApi
      .getPending()
      .then((res) => {
        setRequests(res.data);
      })
      .catch((err) => {
        const status = (err as { response?: { status?: number } }).response?.status;
        setLoadError(status === 403 ? t('associationRequests.error.forbidden') : t('associationRequests.error.load'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [t]);

  // Initial load: only deferred promise callbacks touch state.
  useEffect(() => {
    associationApi
      .getPending()
      .then((res) => setRequests(res.data))
      .catch((err) => {
        const status = (err as { response?: { status?: number } }).response?.status;
        setLoadError(status === 403 ? t('associationRequests.error.forbidden') : t('associationRequests.error.load'));
      })
      .finally(() => setLoading(false));
  }, [t]);

  const removeRow = (id: string) => setRequests((prev) => prev.filter((r) => r.id !== id));

  const mapActionError = (err: unknown) => {
    const response = (err as { response?: { status?: number; data?: { code?: string } } }).response;
    if (response?.data?.code === 'request_not_pending') {
      toastError(t('associationRequests.error.notPending'));
    } else if (response?.status === 403) {
      toastError(t('associationRequests.error.forbidden'));
    } else {
      toastError(t('associationRequests.error.actionFailed'));
    }
  };

  const handleApprove = (id: string) => {
    setActingId(id);
    associationApi
      .approve(id, {})
      .then(() => {
        toastSuccess(t('associationRequests.approved'));
        removeRow(id);
      })
      .catch(mapActionError)
      .finally(() => {
        setActingId(null);
      });
  };

  const openReject = (request: AssociationRequestResponseDto) => {
    setRejectTarget(request);
    setRejectReason('');
  };

  const closeReject = () => {
    setRejectTarget(null);
    setRejectReason('');
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    const id = rejectTarget.id;
    setActingId(id);
    associationApi
      .reject(id, rejectReason.trim() ? { reason: rejectReason.trim() } : {})
      .then(() => {
        toastSuccess(t('associationRequests.rejected'));
        removeRow(id);
        closeReject();
      })
      .catch((err) => {
        mapActionError(err);
        closeReject();
      })
      .finally(() => {
        setActingId(null);
      });
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('associationRequests.title')} subtitle={t('associationRequests.subtitle')} />

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={reload} />
      ) : requests.length === 0 ? (
        <EmptyState icon={UserRound} title={t('associationRequests.empty')} />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardBody className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink flex items-center gap-2">
                    <UserRound className="w-4 h-4 text-ink-subtle shrink-0" />
                    {r.requesterUserId}
                  </p>
                  <p className="text-sm text-ink-subtle mt-1 flex items-center gap-2">
                    <Badge variant="brand">
                      {r.requestedRole === AssociationRequestedRole.Admin
                        ? t('role.admin')
                        : t('role.resident')}
                    </Badge>
                    <span>
                      {t('associationRequests.requestedAt')}: {formatDateTime(r.requestedAt)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="success"
                    size="sm"
                    icon={Check}
                    loading={actingId === r.id}
                    onClick={() => handleApprove(r.id)}
                  >
                    {t('associationRequests.approve')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={X}
                    disabled={actingId === r.id}
                    onClick={() => openReject(r)}
                  >
                    {t('associationRequests.reject')}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <ModalPopup
        open={rejectTarget !== null}
        onClose={closeReject}
        title={t('associationRequests.rejectTitle')}
      >
        <div className="space-y-4">
          <Field label={t('associationRequests.reasonLabel')}>
            <Textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('associationRequests.reasonPlaceholder')}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="border border-line" onClick={closeReject}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              icon={X}
              loading={actingId === rejectTarget?.id}
              onClick={confirmReject}
            >
              {t('associationRequests.confirmReject')}
            </Button>
          </div>
        </div>
      </ModalPopup>
    </div>
  );
}
