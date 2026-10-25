import { useState } from 'react';
import { Check, Mail, Phone, RotateCcw, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { formatDateTime, telHref, whatsappHref } from '../../lib/format';
import { WhatsAppIcon, cx } from '../../components/ui/primitives';
import { ConfirmDialog, Empty, LoadError, PageHeader, useLoad, useToast } from '../ui';

interface Enquiry {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  message: string;
  status: 'new' | 'handled';
  createdAt: string;
}

export default function Enquiries() {
  const toast = useToast();
  const [filter, setFilter] = useState<'' | 'new' | 'handled'>('new');
  const { data, setData, error, reload } = useLoad((s) => api.get<{ items: Enquiry[] }>(`/api/admin/enquiries${filter ? `?status=${filter}` : ''}`, s), [filter]);
  const [deleting, setDeleting] = useState<Enquiry | null>(null);

  const setStatus = async (e: Enquiry, status: Enquiry['status']) => {
    try {
      await api.patch(`/api/admin/enquiries/${e.id}`, { status });
      setData((d) => d && { items: filter && filter !== status ? d.items.filter((x) => x.id !== e.id) : d.items.map((x) => (x.id === e.id ? { ...x, status } : x)) });
      toast(status === 'handled' ? 'Marked as handled' : 'Moved back to new');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not update.', 'error');
    }
  };
  const remove = async () => {
    if (!deleting) return;
    try {
      await api.del(`/api/admin/enquiries/${deleting.id}`);
      setData((d) => d && { items: d.items.filter((x) => x.id !== deleting.id) });
      toast('Enquiry deleted');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not delete.', 'error');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader title="Enquiries" description="Messages sent through the contact form." />
      <div className="mb-5 flex gap-1.5" role="group" aria-label="Filter">
        {([['new', 'New'], ['handled', 'Handled'], ['', 'All']] as const).map(([v, l]) => (
          <button key={l} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)} className={cx('rounded-full px-3.5 py-2 text-sm font-semibold', filter === v ? 'bg-navy text-ivory' : 'bg-ivory ring-1 ring-line')}>
            {l}
          </button>
        ))}
      </div>
      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : data.items.length === 0 ? (
        <Empty title={filter === 'new' ? 'No new enquiries.' : 'No enquiries.'} />
      ) : (
        <ul className="space-y-3">
          {data.items.map((e) => (
            <li key={e.id} className={cx('rounded-2xl border bg-ivory p-5', e.status === 'new' ? 'border-plate' : 'border-line')}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold">{e.name}</p>
                <p className="text-xs text-muted">{formatDateTime(e.createdAt)}</p>
              </div>
              <p className="mt-1 text-sm text-muted">
                {e.phone}
                {e.email && ` · ${e.email}`}
              </p>
              <p className="mt-3 whitespace-pre-line">{e.message}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={telHref(e.phone)} className="btn btn-ghost btn-sm">
                  <Phone className="size-4" aria-hidden="true" /> Call
                </a>
                <a href={whatsappHref(e.phone, `Hello ${e.name.split(' ')[0]}, this is Elite Travel Hub replying to your enquiry.`)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                  <WhatsAppIcon className="size-4" /> WhatsApp
                </a>
                {e.email && (
                  <a href={`mailto:${e.email}?subject=${encodeURIComponent('Your enquiry to Elite Travel Hub')}`} className="btn btn-ghost btn-sm">
                    <Mail className="size-4" aria-hidden="true" /> Email
                  </a>
                )}
                {e.status === 'new' ? (
                  <button type="button" onClick={() => setStatus(e, 'handled')} className="btn btn-primary btn-sm">
                    <Check className="size-4" aria-hidden="true" /> Mark handled
                  </button>
                ) : (
                  <button type="button" onClick={() => setStatus(e, 'new')} className="btn btn-ghost btn-sm">
                    <RotateCcw className="size-4" aria-hidden="true" /> Mark as new
                  </button>
                )}
                <button type="button" onClick={() => setDeleting(e)} aria-label="Delete enquiry" className="btn btn-sm ml-auto text-danger hover:bg-danger/10">
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={deleting !== null} title="Delete this enquiry?" confirmLabel="Delete" tone="danger" onConfirm={remove} onClose={() => setDeleting(null)}>
        The message from {deleting?.name} will be permanently deleted.
      </ConfirmDialog>
    </>
  );
}
