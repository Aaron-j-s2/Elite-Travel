import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { formatDate, todayIST } from '../../lib/format';
import { FormAlert, Img, SelectField, Spinner, TextAreaField, TextField } from '../../components/ui/primitives';
import { ConfirmDialog, LoadError, PageHeader, Panel, Toggle, useAdmin, useToast } from '../ui';
import type { AdminVehicle } from '../types';

type Form = {
  name: string;
  slug: string;
  category: 'bus' | 'car';
  makeModel: string;
  registration: string;
  seats: string;
  tagline: string;
  description: string;
  amenities: string[];
  specs: { label: string; value: string }[];
  dayRate: string;
  ratePerKm: string;
  minKmPerDay: string;
  priceNote: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: string;
};

const EMPTY: Form = {
  name: '',
  slug: '',
  category: 'bus',
  makeModel: '',
  registration: '',
  seats: '',
  tagline: '',
  description: '',
  amenities: [],
  specs: [],
  dayRate: '',
  ratePerKm: '',
  minKmPerDay: '',
  priceNote: '',
  isActive: true,
  isFeatured: false,
  sortOrder: '0',
};

const str = (n: number | null) => (n == null ? '' : String(n));
const toForm = (v: AdminVehicle): Form => ({
  name: v.name,
  slug: v.slug,
  category: v.category,
  makeModel: v.makeModel ?? '',
  registration: v.registration ?? '',
  seats: str(v.seats),
  tagline: v.tagline ?? '',
  description: v.description ?? '',
  amenities: v.amenities,
  specs: v.specs,
  dayRate: str(v.dayRate),
  ratePerKm: str(v.ratePerKm),
  minKmPerDay: str(v.minKmPerDay),
  priceNote: v.priceNote ?? '',
  isActive: v.isActive,
  isFeatured: v.isFeatured,
  sortOrder: String(v.sortOrder),
});

function AmenitiesInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  };
  return (
    <div>
      <label htmlFor="amenity" className="field-label">
        Features & amenities <span className="font-normal text-muted">(only what the vehicle really has)</span>
      </label>
      <div className="flex gap-2">
        <input
          id="amenity"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="e.g. Push-back seats"
          className="input"
        />
        <button type="button" onClick={add} className="btn btn-ghost btn-sm !min-h-12">
          Add
        </button>
      </div>
      {value.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {value.map((a) => (
            <li key={a} className="inline-flex items-center gap-1 rounded-full bg-fog px-3 py-1.5 text-sm">
              {a}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== a))} aria-label={`Remove ${a}`} className="rounded-full p-0.5 hover:bg-stone">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Photos({ vehicle, onChange }: { vehicle: AdminVehicle; onChange: (v: AdminVehicle) => void }) {
  const toast = useToast();
  const { features } = useAdmin();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [alts, setAlts] = useState<Record<string, string>>({});

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const bad = [...files].find((f) => !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(f.type) || f.size > 8 * 1024 * 1024);
    if (bad) {
      toast(`${bad.name}: use JPEG, PNG, WebP or AVIF under 8 MB.`, 'error');
      return;
    }
    const fd = new FormData();
    [...files].forEach((f) => fd.append('images', f));
    setUploading(true);
    try {
      const res = await api.post<{ vehicle: AdminVehicle }>(`/api/admin/vehicles/${vehicle.id}/images`, fd);
      onChange(res.vehicle);
      toast(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded. Add a description to each for accessibility.`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Upload failed.', 'error');
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const order = vehicle.images.map((i) => i.id);
    const [item] = order.splice(idx, 1);
    order.splice(idx + dir, 0, item!);
    try {
      const res = await api.put<{ vehicle: AdminVehicle }>(`/api/admin/vehicles/${vehicle.id}/images/order`, { order });
      onChange(res.vehicle);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not reorder.', 'error');
    }
  };

  const saveAlt = async (id: string) => {
    const alt = alts[id];
    if (alt === undefined) return;
    try {
      const res = await api.patch<{ vehicle: AdminVehicle }>(`/api/admin/vehicles/${vehicle.id}/images/${id}`, { alt });
      onChange(res.vehicle);
      setAlts(({ [id]: _, ...rest }) => rest);
      toast('Description saved');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save.', 'error');
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      const res = await api.del<{ vehicle: AdminVehicle }>(`/api/admin/vehicles/${vehicle.id}/images/${deleting}`);
      onChange(res.vehicle);
      toast('Photo removed');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not remove.', 'error');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Panel
      title={`Photos (${vehicle.images.length})`}
      actions={
        <>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only" id="photo-upload" onChange={(e) => upload(e.target.files)} />
          <label htmlFor="photo-upload" className="btn btn-primary btn-sm cursor-pointer">
            {uploading ? <Spinner /> : <ImagePlus className="size-4" aria-hidden="true" />} Upload
          </label>
        </>
      }
    >
      <p className="mb-4 text-xs text-muted">
        JPEG, PNG, WebP or AVIF, up to 8 MB, at least 600×400. Photos are resized automatically and location data is removed. The first photo is the cover.
        {features.supabaseStorage ? ' Stored in Supabase Storage.' : ' Stored on the server disk.'}
      </p>
      {vehicle.images.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone p-8 text-center text-sm text-muted">No photos yet.</p>
      ) : (
        <ul className="space-y-3">
          {vehicle.images.map((img, i) => (
            <li key={img.id} className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-3 sm:flex-row sm:items-center">
              <Img img={img} sizes="160px" className="aspect-[4/3] w-full rounded-lg object-cover sm:w-36" />
              <div className="min-w-0 flex-1">
                <label className="field-label" htmlFor={`alt-${img.id}`}>
                  {i === 0 ? 'Cover photo — ' : ''}Description (alt text)
                </label>
                <div className="flex gap-2">
                  <input id={`alt-${img.id}`} value={alts[img.id] ?? img.alt} onChange={(e) => setAlts((a) => ({ ...a, [img.id]: e.target.value }))} className="input !min-h-10 text-sm" />
                  {alts[img.id] !== undefined && (
                    <button type="button" onClick={() => saveAlt(img.id)} className="btn btn-primary btn-sm">
                      Save
                    </button>
                  )}
                </div>
              </div>
              <div className="flex gap-1 sm:flex-col">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="grid size-9 place-items-center rounded-full border border-line disabled:opacity-30">
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" disabled={i === vehicle.images.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="grid size-9 place-items-center rounded-full border border-line disabled:opacity-30">
                  <ArrowDown className="size-4" />
                </button>
                <button type="button" onClick={() => setDeleting(img.id)} aria-label="Delete photo" className="grid size-9 place-items-center rounded-full border border-danger/30 text-danger hover:bg-danger hover:text-ivory">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={deleting !== null} title="Delete this photo?" confirmLabel="Delete photo" tone="danger" onConfirm={remove} onClose={() => setDeleting(null)}>
        It will be removed from the website immediately.
      </ConfirmDialog>
    </Panel>
  );
}

function Blocks({ vehicle, onChange }: { vehicle: AdminVehicle; onChange: (v: AdminVehicle) => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post<{ vehicle: AdminVehicle }>(`/api/admin/vehicles/${vehicle.id}/blocks`, { ...form, reason: form.reason || null });
      onChange(res.vehicle);
      setForm({ startDate: '', endDate: '', reason: '' });
      toast('Dates blocked');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not block dates.', 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    try {
      const res = await api.del<{ vehicle: AdminVehicle }>(`/api/admin/vehicles/${vehicle.id}/blocks/${id}`);
      onChange(res.vehicle);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not remove.', 'error');
    }
  };
  return (
    <Panel title="Unavailable dates">
      <p className="mb-4 text-xs text-muted">Block dates for servicing or private use. Customers can’t request the vehicle on these days.</p>
      {vehicle.blocks && vehicle.blocks.length > 0 && (
        <ul className="mb-5 divide-y divide-line rounded-xl border border-line">
          {vehicle.blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span>
                <strong>
                  {formatDate(b.startDate)} – {formatDate(b.endDate)}
                </strong>
                {b.reason && <span className="text-muted"> · {b.reason}</span>}
              </span>
              <button type="button" onClick={() => remove(b.id)} aria-label="Remove block" className="grid size-8 place-items-center rounded-full hover:bg-fog">
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
        <TextField label="From" type="date" min={todayIST()} required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        <TextField label="To" type="date" min={form.startDate || todayIST()} required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        <TextField label="Reason" optional value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        <button type="submit" disabled={busy || !form.startDate || !form.endDate} className="btn btn-ghost btn-sm !min-h-12">
          Block
        </button>
      </form>
    </Panel>
  );
}

export default function VehicleEdit() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const [vehicle, setVehicle] = useState<AdminVehicle | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = () => {
    if (!id) return;
    setLoadError(null);
    api
      .get<{ vehicle: AdminVehicle }>(`/api/admin/vehicles/${id}`)
      .then((r) => {
        setVehicle(r.vehicle);
        setForm(toForm(r.vehicle));
      })
      .catch((err) => setLoadError(err.message));
  };
  useEffect(load, [id]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const field = (k: keyof Form) => ({ value: form[k] as string, onChange: (e: { target: { value: string } }) => set(k, e.target.value as never), error: errors[k] });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);
    const body = { ...form, specs: form.specs.filter((s) => s.label.trim() && s.value.trim()) };
    try {
      const res = isNew ? await api.post<{ vehicle: AdminVehicle }>('/api/admin/vehicles', body) : await api.patch<{ vehicle: AdminVehicle }>(`/api/admin/vehicles/${id}`, body);
      toast(isNew ? 'Vehicle created — now add photos.' : 'Vehicle saved');
      if (isNew) navigate(`/admin/vehicles/${res.vehicle.id}`, { replace: true });
      else {
        setVehicle(res.vehicle);
        setForm(toForm(res.vehicle));
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setFormError(err.message);
      } else setFormError('Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.del(`/api/admin/vehicles/${id}`);
      toast('Vehicle deleted');
      navigate('/admin/vehicles');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not delete.', 'error');
      setConfirmDelete(false);
    }
  };

  if (loadError) return <LoadError message={loadError} onRetry={load} />;
  if (!isNew && !vehicle) return <div className="skeleton h-96 rounded-2xl" aria-busy="true" />;

  return (
    <>
      <Link to="/admin/vehicles" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" /> All vehicles
      </Link>
      <PageHeader
        title={isNew ? 'Add a vehicle' : vehicle!.name}
        actions={
          !isNew && vehicle!.isActive ? (
            <a href={`/vehicles/${vehicle!.slug}`} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
              <ExternalLink className="size-4" aria-hidden="true" /> View on website
            </a>
          ) : undefined
        }
      />

      <div className="grid gap-6 xl:grid-cols-5">
        <form onSubmit={save} noValidate className="space-y-6 xl:col-span-3">
          {formError && <FormAlert>{formError}</FormAlert>}
          <Panel title="Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Display name" {...field('name')} wrapClassName="sm:col-span-2" />
              <SelectField label="Category" {...field('category')}>
                <option value="bus">Tourist bus / traveller</option>
                <option value="car">Travel car</option>
              </SelectField>
              <TextField label="Seating capacity" type="number" min={1} max={80} optional hint="Leave blank to show “Seating on request”" {...field('seats')} />
              <TextField label="Make & model" optional {...field('makeModel')} />
              <TextField label="Registration" optional hint="For your own records only — it is never shown on the website." {...field('registration')} />
              <TextField label="Short tagline" optional {...field('tagline')} wrapClassName="sm:col-span-2" />
              <TextAreaField label="Description" optional rows={4} {...field('description')} wrapClassName="sm:col-span-2" />
              <TextField label="Web address (slug)" optional hint={isNew ? 'Generated from the name if left blank' : `/vehicles/${form.slug}`} {...field('slug')} />
              <TextField label="Display order" type="number" hint="Lower numbers show first" {...field('sortOrder')} />
            </div>
          </Panel>

          <Panel title="Features & specifications">
            <AmenitiesInput value={form.amenities} onChange={(v) => set('amenities', v)} />
            <div className="mt-6">
              <p className="field-label">Verified specifications</p>
              <ul className="space-y-2">
                {form.specs.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <input aria-label="Specification" placeholder="e.g. Air conditioning" value={s.label} onChange={(e) => set('specs', form.specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="input !min-h-10 text-sm" />
                    <input aria-label="Value" placeholder="e.g. Yes" value={s.value} onChange={(e) => set('specs', form.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} className="input !min-h-10 text-sm" />
                    <button type="button" onClick={() => set('specs', form.specs.filter((_, j) => j !== i))} aria-label="Remove specification" className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-fog">
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => set('specs', [...form.specs, { label: '', value: '' }])} className="btn btn-ghost btn-sm mt-3">
                <Plus className="size-4" aria-hidden="true" /> Add specification
              </button>
            </div>
          </Panel>

          <Panel title="Pricing">
            <p className="mb-4 text-xs text-muted">Leave everything blank to hide prices on the website. When a day rate is set, the booking form shows an indicative fare (day rate × number of days).</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Day rate (₹)" type="number" min={0} optional {...field('dayRate')} />
              <TextField label="Rate per km (₹)" type="number" min={0} step="0.5" optional {...field('ratePerKm')} />
              <TextField label="Minimum km per day" type="number" min={0} optional {...field('minKmPerDay')} />
              <TextField label="Pricing note" optional placeholder="e.g. Tolls and parking extra" {...field('priceNote')} wrapClassName="sm:col-span-3" />
            </div>
          </Panel>

          <Panel title="Visibility">
            <div className="space-y-2">
              <Toggle checked={form.isActive} onChange={(v) => set('isActive', v)} label="Live on website" description="Disabled vehicles are hidden and can’t be booked." />
              <Toggle checked={form.isFeatured} onChange={(v) => set('isFeatured', v)} label="Featured" description="Highlight this vehicle where featured vehicles are shown." />
            </div>
          </Panel>

          <div className="sticky bottom-20 z-10 flex flex-wrap gap-2 rounded-2xl border border-line bg-paper/95 p-3 backdrop-blur lg:bottom-4">
            <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
              {saving && <Spinner />} {isNew ? 'Create vehicle' : 'Save changes'}
            </button>
            {!isNew && (
              <button type="button" onClick={() => setConfirmDelete(true)} className="btn btn-sm ml-auto text-danger hover:bg-danger/10">
                <Trash2 className="size-4" aria-hidden="true" /> Delete
              </button>
            )}
          </div>
        </form>

        <div className="space-y-6 xl:col-span-2">
          {isNew ? (
            <Panel title="Photos">
              <p className="text-sm text-muted">Create the vehicle first, then upload its photos here.</p>
            </Panel>
          ) : (
            <>
              <Photos vehicle={vehicle!} onChange={setVehicle} />
              <Blocks vehicle={vehicle!} onChange={setVehicle} />
            </>
          )}
        </div>
      </div>

      <ConfirmDialog open={confirmDelete} title={`Delete ${vehicle?.name}?`} confirmLabel="Delete vehicle" tone="danger" onConfirm={remove} onClose={() => setConfirmDelete(false)}>
        {vehicle && vehicle.bookingCount > 0
          ? 'This vehicle has booking history, so it can’t be deleted. Turn off “Live on website” to hide it instead.'
          : 'The vehicle and its photos will be permanently removed. This can’t be undone.'}
      </ConfirmDialog>
    </>
  );
}
