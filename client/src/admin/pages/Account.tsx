import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/api';
import { FormAlert, Spinner, TextField } from '../../components/ui/primitives';
import { PageHeader, Panel, useAdmin, useToast } from '../ui';

export default function Account() {
  const { admin, features } = useAdmin();
  const toast = useToast();
  const [v, setV] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    if (v.newPassword !== v.confirm) {
      setErrors({ confirm: 'Passwords don’t match' });
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/admin/auth/password', { currentPassword: v.currentPassword, newPassword: v.newPassword });
      setV({ currentPassword: '', newPassword: '', confirm: '' });
      toast('Password changed. Other devices have been signed out.');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setFormError(err.message);
      } else setFormError('Could not change the password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Account" description={`Signed in as ${admin.email}`} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Change password">
          <form onSubmit={submit} noValidate className="space-y-4">
            {formError && <FormAlert>{formError}</FormAlert>}
            <TextField label="Current password" type="password" autoComplete="current-password" value={v.currentPassword} onChange={(e) => setV({ ...v, currentPassword: e.target.value })} error={errors.currentPassword} />
            <TextField label="New password" type="password" autoComplete="new-password" hint="At least 12 characters" value={v.newPassword} onChange={(e) => setV({ ...v, newPassword: e.target.value })} error={errors.newPassword} />
            <TextField label="Confirm new password" type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} error={errors.confirm} />
            <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
              {busy && <Spinner />} Change password
            </button>
          </form>
        </Panel>
        <Panel title="Integrations">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="font-semibold">Email notifications</dt>
              <dd className="text-muted">{features.email ? 'Configured — new requests and status changes are emailed.' : 'Not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM on the server to enable.'}</dd>
            </div>
            <div>
              <dt className="font-semibold">Photo storage</dt>
              <dd className="text-muted">{features.supabaseStorage ? 'Supabase Storage.' : 'Server disk (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to use Supabase Storage).'}</dd>
            </div>
            <div>
              <dt className="font-semibold">Adding administrators</dt>
              <dd className="text-muted">
                For security there is no sign-up page. New administrators are created on the server with <code className="rounded bg-fog px-1">npm run admin:create</code>.
              </dd>
            </div>
          </dl>
        </Panel>
      </div>
    </>
  );
}
