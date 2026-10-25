import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import type { ListItem, Settings } from '../../lib/types';
import { FormAlert, Spinner, TextAreaField, TextField, cx } from '../../components/ui/primitives';
import { LoadError, PageHeader, Panel, useLoad, useToast } from '../ui';

type Key = keyof Settings;
const TABS: { key: Key; label: string }[] = [
  { key: 'contact', label: 'Contact & social' },
  { key: 'home', label: 'Homepage text' },
  { key: 'whyChoose', label: 'Why choose us' },
  { key: 'experiences', label: 'Travel experiences' },
  { key: 'seo', label: 'SEO' },
  { key: 'policies', label: 'Terms & privacy' },
];

function useSection<K extends Key>(key: K, initial: Settings[K]) {
  const toast = useToast();
  const [value, setValue] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(initial), [initial]);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await api.put<{ value: Settings[K] }>(`/api/admin/settings/${key}`, value);
      setValue(res.value);
      toast('Saved — the website now shows the new content.');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setFormError(err.message);
      } else setFormError('Could not save.');
    } finally {
      setBusy(false);
    }
  };
  return { value, setValue, errors, formError, busy, save };
}

function SaveBar({ busy }: { busy: boolean }) {
  return (
    <div className="mt-6">
      <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
        {busy && <Spinner />} Save
      </button>
    </div>
  );
}

function Fields<T extends Record<string, unknown>>({
  value,
  setValue,
  errors,
  fields,
}: {
  value: T;
  setValue: (v: T) => void;
  errors: Record<string, string>;
  fields: { k: keyof T & string; label: string; hint?: string; long?: boolean; optional?: boolean; full?: boolean }[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) =>
        f.long ? (
          <TextAreaField
            key={f.k}
            label={f.label}
            hint={f.hint}
            optional={f.optional}
            wrapClassName="sm:col-span-2"
            rows={f.k === 'bookingTerms' || f.k === 'privacyPolicy' ? 12 : 3}
            value={(value[f.k] as string | null) ?? ''}
            onChange={(e) => setValue({ ...value, [f.k]: e.target.value })}
            error={errors[f.k]}
          />
        ) : (
          <TextField
            key={f.k}
            label={f.label}
            hint={f.hint}
            optional={f.optional}
            wrapClassName={f.full ? 'sm:col-span-2' : undefined}
            value={(value[f.k] as string | null) ?? ''}
            onChange={(e) => setValue({ ...value, [f.k]: e.target.value })}
            error={errors[f.k]}
          />
        ),
      )}
    </div>
  );
}

function ListEditor({ items, onChange, errors, max }: { items: ListItem[]; onChange: (v: ListItem[]) => void; errors: Record<string, string>; max: number }) {
  const move = (i: number, d: number) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x!);
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="rounded-xl border border-line bg-paper p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-xs text-signal">{String(i + 1).padStart(2, '0')}</span>
            <div className="flex gap-1">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="grid size-8 place-items-center rounded-full border border-line disabled:opacity-30">
                <ArrowUp className="size-3.5" />
              </button>
              <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="grid size-8 place-items-center rounded-full border border-line disabled:opacity-30">
                <ArrowDown className="size-3.5" />
              </button>
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove item" className="grid size-8 place-items-center rounded-full border border-danger/30 text-danger">
                <X className="size-3.5" />
              </button>
            </div>
          </div>
          <div className="grid gap-3">
            <TextField label="Title" value={it.title} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} error={errors[`items.${i}.title`]} />
            <TextAreaField label="Text" rows={2} value={it.text} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} error={errors[`items.${i}.text`]} />
          </div>
        </div>
      ))}
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, { title: '', text: '' }])} className="btn btn-ghost btn-sm">
          <Plus className="size-4" aria-hidden="true" /> Add item
        </button>
      )}
    </div>
  );
}

function Section<K extends Key>({ k, initial, children }: { k: K; initial: Settings[K]; children: (s: ReturnType<typeof useSection<K>>) => ReactNode }) {
  const s = useSection(k, initial);
  return (
    <form onSubmit={s.save} noValidate>
      {s.formError && (
        <div className="mb-4">
          <FormAlert>{s.formError}</FormAlert>
        </div>
      )}
      {children(s)}
      <SaveBar busy={s.busy} />
    </form>
  );
}

export default function Content() {
  const { data, error, reload } = useLoad((s) => api.get<{ settings: Settings }>('/api/admin/settings', s), []);
  const [tab, setTab] = useState<Key>('contact');
  if (error) return <LoadError message={error} onRetry={reload} />;
  const st = data?.settings;

  return (
    <>
      <PageHeader title="Site content" description="Changes appear on the website as soon as you save." />
      <div className="no-scrollbar -mx-4 mb-6 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cx('shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold', tab === t.key ? 'bg-navy text-ivory' : 'bg-ivory ring-1 ring-line')}>
            {t.label}
          </button>
        ))}
      </div>
      {!st ? (
        <div className="skeleton h-96 rounded-2xl" />
      ) : (
        <Panel>
          {tab === 'contact' && (
            <Section k="contact" initial={st.contact}>
              {(s) => (
                <Fields
                  value={s.value}
                  setValue={s.setValue}
                  errors={s.errors}
                  fields={[
                    { k: 'businessName', label: 'Business name' },
                    { k: 'phone', label: 'Phone (as displayed)' },
                    { k: 'whatsapp', label: 'WhatsApp number', hint: 'Digits with country code, e.g. 919047339000' },
                    { k: 'email', label: 'Email' },
                    { k: 'locality', label: 'Town' },
                    { k: 'region', label: 'Region' },
                    { k: 'addressLine', label: 'Street address', optional: true, full: true },
                    { k: 'hours', label: 'Opening hours', optional: true, full: true, hint: 'e.g. Open every day, 6am – 10pm' },
                    { k: 'mapLink', label: 'Google Maps link', optional: true, full: true, hint: 'Only add the verified business location' },
                    { k: 'mapEmbedUrl', label: 'Google Maps embed URL', optional: true, full: true, hint: 'Google Maps → Share → Embed a map → copy the src link' },
                    { k: 'instagram', label: 'Instagram URL', optional: true },
                    { k: 'facebook', label: 'Facebook URL', optional: true },
                    { k: 'youtube', label: 'YouTube URL', optional: true },
                  ]}
                />
              )}
            </Section>
          )}
          {tab === 'home' && (
            <Section k="home" initial={st.home}>
              {(s) => (
                <Fields
                  value={s.value}
                  setValue={s.setValue}
                  errors={s.errors}
                  fields={[
                    { k: 'heroEyebrow', label: 'Hero — small label', full: true },
                    { k: 'heroTitle', label: 'Hero — headline', hint: 'The last word is set in livery blue', full: true },
                    { k: 'heroText', label: 'Hero — intro text', long: true },
                    { k: 'fleetTitle', label: 'Fleet — heading', full: true },
                    { k: 'fleetText', label: 'Fleet — text', long: true },
                    { k: 'servicesTitle', label: 'Services — heading', full: true },
                    { k: 'experiencesTitle', label: 'Experiences — heading', full: true },
                    { k: 'experiencesText', label: 'Experiences — text', long: true },
                    { k: 'whyTitle', label: 'Why choose us — heading', full: true },
                    { k: 'ctaTitle', label: 'Closing call to action — heading', full: true },
                    { k: 'ctaText', label: 'Closing call to action — text', long: true },
                  ]}
                />
              )}
            </Section>
          )}
          {tab === 'whyChoose' && (
            <Section k="whyChoose" initial={st.whyChoose}>
              {(s) => (
                <>
                  <p className="mb-4 text-sm text-muted">Only list advantages you can stand behind — they appear on the homepage.</p>
                  <ListEditor items={s.value.items} onChange={(items) => s.setValue({ items })} errors={s.errors} max={8} />
                </>
              )}
            </Section>
          )}
          {tab === 'experiences' && (
            <Section k="experiences" initial={st.experiences}>
              {(s) => (
                <>
                  <p className="mb-4 text-sm text-muted">Kinds of trips you plan for. These are descriptive, not fixed packages.</p>
                  <ListEditor items={s.value.items} onChange={(items) => s.setValue({ items })} errors={s.errors} max={10} />
                </>
              )}
            </Section>
          )}
          {tab === 'seo' && (
            <Section k="seo" initial={st.seo}>
              {(s) => (
                <Fields
                  value={s.value}
                  setValue={s.setValue}
                  errors={s.errors}
                  fields={[
                    { k: 'siteTitle', label: 'Homepage title', hint: 'Up to 70 characters', full: true },
                    { k: 'titleTemplate', label: 'Page title template', hint: '%s is replaced by the page name', full: true },
                    { k: 'description', label: 'Meta description', hint: 'Up to 170 characters — shown in search results', long: true },
                    { k: 'ogImage', label: 'Social sharing image path', hint: 'e.g. /images/og-default.jpg', full: true },
                  ]}
                />
              )}
            </Section>
          )}
          {tab === 'policies' && (
            <Section k="policies" initial={st.policies}>
              {(s) => (
                <Fields
                  value={s.value}
                  setValue={s.setValue}
                  errors={s.errors}
                  fields={[
                    { k: 'bookingTerms', label: 'Booking terms', hint: 'Separate paragraphs with a blank line', long: true },
                    { k: 'privacyPolicy', label: 'Privacy policy', hint: 'Separate paragraphs with a blank line', long: true },
                  ]}
                />
              )}
            </Section>
          )}
        </Panel>
      )}
    </>
  );
}
