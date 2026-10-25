import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Check, Mail, MapPin, Phone } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useSite } from '../lib/site';
import { useSeo } from '../lib/seo';
import { telHref, whatsappHref } from '../lib/format';
import { zodResolver } from '../lib/zodResolver';
import { photo } from '../lib/media';
import { FormAlert, Img, SectionMark, Spinner, TextAreaField, TextField, WhatsAppIcon } from '../components/ui/primitives';
import { ENQUIRY_MESSAGE } from '../components/site/Layout';

const schema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(120),
  phone: z.string().trim().refine((v) => v.replace(/\D/g, '').length >= 10, 'Enter a valid mobile number'),
  email: z.union([z.literal(''), z.email('Enter a valid email address')]),
  message: z.string().trim().min(5, 'Tell us a little more').max(2000),
  website: z.string(),
});
type Values = z.infer<typeof schema>;

export default function Contact() {
  useSeo('Contact', 'Call, WhatsApp or email Elite Travel Hub in Thiruvrambu, Kerala.');
  const { contact } = useSite();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', phone: '', email: '', message: '', website: '' } });

  const onSubmit = async (v: Values) => {
    setFormError(null);
    try {
      await api.post('/api/enquiries', { ...v, email: v.email || null });
      setSent(true);
      reset();
    } catch (err) {
      if (err instanceof ApiError) {
        for (const [k, m] of Object.entries(err.fields)) setError(k as keyof Values, { message: m });
        setFormError(err.message);
      } else setFormError('Something went wrong. Please call us instead.');
    }
  };

  const cards = [
    { icon: Phone, label: 'Call', value: contact.phone, href: telHref(contact.phone) },
    { icon: WhatsAppIcon, label: 'WhatsApp', value: 'Message us', href: whatsappHref(contact.whatsapp, ENQUIRY_MESSAGE), external: true },
    { icon: Mail, label: 'Email', value: contact.email, href: `mailto:${contact.email}` },
    { icon: MapPin, label: 'Based in', value: `${contact.addressLine ? `${contact.addressLine}, ` : ''}${contact.locality}, ${contact.region}`, href: contact.mapLink || undefined, external: true },
  ];

  return (
    <>
      <section className="pt-10 pb-16 lg:pt-16">
        <div className="wrap grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <SectionMark n="—" label="Contact" />
            <h1 className="display mt-6 text-h1">
              Contact <span className="text-azure">us</span>
            </h1>
          </div>
          <p className="lede lg:col-span-5">For the quickest reply, call or WhatsApp us. You can also send a message below.{contact.hours ? ` ${contact.hours}.` : ''}</p>
        </div>
      </section>

      <section className="wrap"><div className="grid gap-px border-y border-ink/15 bg-ink/10 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const inner = (
            <>
              <c.icon className="size-5 text-signal" aria-hidden="true" />
              <span className="eyebrow mt-8 block text-muted">{c.label}</span>
              <span className="headline mt-2 block text-lg break-words">{c.value}</span>
            </>
          );
          return c.href ? (
            <a key={c.label} href={c.href} {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="group bg-paper py-7 transition hover:bg-ivory sm:px-6">
              {inner}
            </a>
          ) : (
            <div key={c.label} className="bg-paper py-7 sm:px-6">
              {inner}
            </div>
          );
        })}
      </div>
      </section>

      <section className="wrap grid gap-14 py-20 lg:grid-cols-12 lg:py-28">
        <div className="lg:col-span-6">
          <h2 className="headline text-h2">Send a message</h2>
          {sent ? (
            <div className="mt-8 bg-navy p-8 text-ivory" role="status">
              <Check className="size-8 text-azure-2" aria-hidden="true" />
              <p className="headline mt-4 text-3xl">Thank you — message received.</p>
              <p className="mt-3 text-ivory/70">We will reply by phone or email. If it is urgent, please call {contact.phone}.</p>
              <button type="button" onClick={() => setSent(false)} className="btn btn-ghost-light btn-sm mt-6">
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 grid gap-5 sm:grid-cols-2">
              {formError && (
                <div className="sm:col-span-2">
                  <FormAlert>{formError}</FormAlert>
                </div>
              )}
              <TextField label="Name" autoComplete="name" {...register('name')} error={errors.name?.message} />
              <TextField label="Mobile number" type="tel" autoComplete="tel" {...register('phone')} error={errors.phone?.message} />
              <TextField label="Email" type="email" autoComplete="email" optional wrapClassName="sm:col-span-2" {...register('email')} error={errors.email?.message} />
              <TextAreaField label="Message" wrapClassName="sm:col-span-2" rows={5} {...register('message')} error={errors.message?.message} />
              <div aria-hidden="true" className="absolute -left-[9999px]">
                <input tabIndex={-1} autoComplete="off" {...register('website')} />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                  {isSubmitting && <Spinner />} Send message
                </button>
              </div>
            </form>
          )}
        </div>
        <div className="lg:col-span-5 lg:col-start-8">
          {contact.mapEmbedUrl ? (
            <iframe
              title={`Map — ${contact.businessName}`}
              src={contact.mapEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="aspect-[4/5] w-full border-0 grayscale-[0.3]"
            />
          ) : (
            <figure className="overflow-hidden">
              <Img img={photo('traveller-elite-livery-night-profile')} sizes="(min-width: 1024px) 38vw, 100vw" className="aspect-[4/3] w-full object-cover" />
            </figure>
          )}
        </div>
      </section>
    </>
  );
}
