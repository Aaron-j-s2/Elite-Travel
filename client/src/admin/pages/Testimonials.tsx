import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { FormAlert, Spinner, TextAreaField, TextField } from '../../components/ui/primitives';
import { ConfirmDialog, Empty, LoadError, PageHeader, Panel, Toggle, useLoad, useToast } from '../ui';

interface Testimonial {
  id: string;
  authorName: string;
  authorPlace: string | null;
  quote: string;
  tripLabel: string | null;
  sourceNote: string | null;
  isPublished: boolean;
  sortOrder: number;
}
const BLANK = { authorName: '', authorPlace: '', quote: '', tripLabel: '', sourceNote: '', isPublished: false, sortOrder: '0' };

function Editor({ item, onDone, onCancel }: { item: Testimonial | null; onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [v, setV] = useState(
    item ? { ...item, authorPlace: item.authorPlace ?? '', tripLabel: item.tripLabel ?? '', sourceNote: item.sourceNote ?? '', sortOrder: String(item.sortOrder) } : BLANK,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const f = (k: 'authorName' | 'authorPlace' | 'quote' | 'tripLabel' | 'sourceNote' | 'sortOrder') => ({ value: v[k], onChange: (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value }), error: errors[k] });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      if (item) await api.put(`/api/admin/testimonials/${item.id}`, v);
      else await api.post('/api/admin/testimonials', v);
      toast('Testimonial saved');
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setFormError(err.message);
      } else setFormError('Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={item ? 'Edit testimonial' : 'New testimonial'} className="mb-6">
      <form onSubmit={save} noValidate className="space-y-4">
        {formError && <FormAlert>{formError}</FormAlert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextAreaField label="Quote" hint="The customer’s own words" rows={3} wrapClassName="sm:col-span-2" {...f('quote')} />
          <TextField label="Customer name" hint="As the customer agreed to be named" {...f('authorName')} />
          <TextField label="Place" optional {...f('authorPlace')} />
          <TextField label="Trip" optional placeholder="e.g. Family trip to Munnar" {...f('tripLabel')} />
          <TextField label="Display order" type="number" {...f('sortOrder')} />
          <TextField label="Source (internal)" optional hint="Where this review came from — e.g. Google review, WhatsApp message. Not shown publicly." wrapClassName="sm:col-span-2" {...f('sourceNote')} />
        </div>
        <Toggle checked={v.isPublished} onChange={(isPublished) => setV({ ...v, isPublished })} label="Published" description="Only publish genuine reviews you have permission to show." />
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
            {busy && <Spinner />} Save
          </button>
          <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
            Cancel
          </button>
        </div>
      </form>
    </Panel>
  );
}

export default function Testimonials() {
  const toast = useToast();
  const { data, error, reload } = useLoad((s) => api.get<{ items: Testimonial[] }>('/api/admin/testimonials', s), []);
  const [editing, setEditing] = useState<Testimonial | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Testimonial | null>(null);

  const remove = async () => {
    if (!deleting) return;
    try {
      await api.del(`/api/admin/testimonials/${deleting.id}`);
      toast('Testimonial deleted');
      reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not delete.', 'error');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Testimonials"
        description="Genuine customer reviews only. While none are published, the homepage shows a fleet photograph instead."
        actions={
          <button type="button" onClick={() => setEditing('new')} className="btn btn-primary btn-sm">
            <Plus className="size-4" aria-hidden="true" /> Add testimonial
          </button>
        }
      />
      {editing && <Editor key={editing === 'new' ? 'new' : editing.id} item={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : data.items.length === 0 ? (
        <Empty title="No testimonials yet.">Add reviews your customers have actually given you.</Empty>
      ) : (
        <ul className="space-y-3">
          {data.items.map((t) => (
            <li key={t.id} className="flex gap-4 rounded-2xl border border-line bg-ivory p-5">
              <div className="min-w-0 flex-1">
                <p className="headline text-xl !font-normal">“{t.quote}”</p>
                <p className="mt-2 text-sm">
                  <strong>{t.authorName}</strong>
                  {t.authorPlace && <span className="text-muted"> · {t.authorPlace}</span>}
                  <span className={t.isPublished ? 'ml-2 rounded-full bg-success/10 px-2 py-0.5 text-xs font-bold text-success' : 'ml-2 rounded-full bg-ink/10 px-2 py-0.5 text-xs font-bold'}>{t.isPublished ? 'Published' : 'Draft'}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button type="button" onClick={() => setEditing(t)} aria-label="Edit" className="grid size-9 place-items-center rounded-full hover:bg-fog">
                  <Pencil className="size-4" />
                </button>
                <button type="button" onClick={() => setDeleting(t)} aria-label="Delete" className="grid size-9 place-items-center rounded-full text-danger hover:bg-danger/10">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={deleting !== null} title="Delete this testimonial?" confirmLabel="Delete" tone="danger" onConfirm={remove} onClose={() => setDeleting(null)}>
        The review from {deleting?.authorName} will be permanently deleted.
      </ConfirmDialog>
    </>
  );
}
