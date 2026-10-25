import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { FormAlert, SelectField, Spinner, TextAreaField, TextField } from '../../components/ui/primitives';
import { ServiceIcon } from '../../components/site/ServiceIcon';
import { ConfirmDialog, Empty, LoadError, PageHeader, Panel, Toggle, useLoad, useToast } from '../ui';

interface Service {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  icon: string;
  image: string | null;
  isActive: boolean;
  sortOrder: number;
}
const ICONS = ['bus', 'car', 'users', 'heart', 'route', 'mountain', 'map', 'sparkles', 'briefcase', 'landmark'];
const BLANK = { title: '', slug: '', summary: '', body: '', icon: 'route', image: '', isActive: true, sortOrder: '0' };

function Editor({ service, onDone, onCancel }: { service: Service | null; onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [v, setV] = useState(service ? { ...service, image: service.image ?? '', sortOrder: String(service.sortOrder) } : BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const f = (k: 'title' | 'slug' | 'summary' | 'body' | 'image' | 'sortOrder' | 'icon') => ({ value: v[k], onChange: (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value }), error: errors[k] });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    setErrors({});
    try {
      const body = { ...v, image: v.image || null };
      if (service) await api.put(`/api/admin/services/${service.id}`, body);
      else await api.post('/api/admin/services', body);
      toast('Service saved');
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
    <Panel title={service ? `Edit “${service.title}”` : 'New service'} className="mb-6">
      <form onSubmit={save} noValidate className="space-y-4">
        {formError && <FormAlert>{formError}</FormAlert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Title" {...f('title')} />
          <SelectField label="Icon" {...f('icon')}>
            {ICONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </SelectField>
          <TextAreaField label="Summary" hint="One or two sentences — shown on the homepage" rows={2} wrapClassName="sm:col-span-2" {...f('summary')} />
          <TextAreaField label="Details" optional hint="Shown on the Services page" rows={4} wrapClassName="sm:col-span-2" {...f('body')} />
          <TextField label="Image path" optional hint="Leave blank to use a fleet photo" {...f('image')} />
          <TextField label="Display order" type="number" {...f('sortOrder')} />
          <TextField label="Slug" optional hint="Used for links like /services#slug" {...f('slug')} />
        </div>
        <Toggle checked={v.isActive} onChange={(isActive) => setV({ ...v, isActive })} label="Show on website" />
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

export default function ServicesAdmin() {
  const toast = useToast();
  const { data, error, reload } = useLoad((s) => api.get<{ items: Service[] }>('/api/admin/services', s), []);
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Service | null>(null);

  const remove = async () => {
    if (!deleting) return;
    try {
      await api.del(`/api/admin/services/${deleting.id}`);
      toast('Service deleted');
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
        title="Services"
        description="Shown on the homepage, the Services page and in the footer."
        actions={
          <button type="button" onClick={() => setEditing('new')} className="btn btn-primary btn-sm">
            <Plus className="size-4" aria-hidden="true" /> Add service
          </button>
        }
      />
      {editing && <Editor key={editing === 'new' ? 'new' : editing.id} service={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <div className="skeleton h-60 rounded-2xl" />
      ) : data.items.length === 0 ? (
        <Empty title="No services yet." />
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-ivory">
          {data.items.map((s) => (
            <li key={s.id} className="flex items-center gap-4 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-navy text-ivory">
                <ServiceIcon name={s.icon} className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {s.title} {!s.isActive && <span className="ml-1 rounded-full bg-ink/10 px-2 py-0.5 text-xs">Hidden</span>}
                </p>
                <p className="truncate text-sm text-muted">{s.summary}</p>
              </div>
              <button type="button" onClick={() => setEditing(s)} aria-label={`Edit ${s.title}`} className="grid size-9 place-items-center rounded-full hover:bg-fog">
                <Pencil className="size-4" />
              </button>
              <button type="button" onClick={() => setDeleting(s)} aria-label={`Delete ${s.title}`} className="grid size-9 place-items-center rounded-full text-danger hover:bg-danger/10">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={deleting !== null} title={`Delete “${deleting?.title}”?`} confirmLabel="Delete service" tone="danger" onConfirm={remove} onClose={() => setDeleting(null)}>
        It will be removed from the website. To keep it but hide it, edit it and turn off “Show on website”.
      </ConfirmDialog>
    </>
  );
}
