import { Link, useSearchParams } from 'react-router';
import { Phone } from 'lucide-react';
import { useSite } from '../lib/site';
import { useSeo } from '../lib/seo';
import { telHref, whatsappHref } from '../lib/format';
import { photo } from '../lib/media';
import type { Category } from '../lib/types';
import { Img, SectionMark, WhatsAppIcon } from '../components/ui/primitives';
import { BookingForm } from '../components/site/BookingForm';
import { ENQUIRY_MESSAGE } from '../components/site/Layout';

export default function Book() {
  useSeo('Book a vehicle', 'Send your trip details to Elite Travel Hub and receive a booking reference instantly.');
  const { vehicles, contact } = useSite();
  const [params] = useSearchParams();
  const slug = params.get('vehicle');
  const vehicle = vehicles?.find((v) => v.slug === slug);
  const category = params.get('category');
  const interior = photo('interior-white-leather-cabin-forward');

  // Wait for the fleet before mounting the form when a vehicle is preselected, so it prefills correctly.
  const ready = !slug || vehicles !== null;

  return (
    <section className="py-10 lg:py-16">
      <div className="wrap grid gap-14 lg:grid-cols-12">
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <SectionMark n="—" label="Booking request" />
            <h1 className="display mt-6 text-h1">
              Book a <span className="text-azure">vehicle</span>
            </h1>
            <p className="lede mt-6">Tell us where and when you want to travel. You get a booking reference straight away, and we will call you to confirm.</p>
            <div className="mt-8 hidden overflow-hidden rounded-[4px] lg:block">
              <Img img={interior} sizes="30vw" className="aspect-[4/3] w-full object-cover" />
            </div>
            <div className="mt-8 rounded-[4px] border border-line p-5 text-sm">
              <p className="font-semibold">Prefer to talk?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={telHref(contact.phone)} className="btn btn-ghost btn-sm">
                  <Phone className="size-4" aria-hidden="true" /> {contact.phone}
                </a>
                <a href={whatsappHref(contact.whatsapp, ENQUIRY_MESSAGE)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                  <WhatsAppIcon className="size-4" /> WhatsApp
                </a>
              </div>
              <p className="mt-4 text-muted">
                Already sent a request?{' '}
                <Link to="/booking/status" className="font-semibold text-navy underline underline-offset-4">
                  Track it here
                </Link>
                .
              </p>
            </div>
          </div>
        </aside>
        <div className="lg:col-span-7 lg:col-start-6">
          {ready ? (
            <BookingForm
              prefill={{
                vehicleId: vehicle?.id,
                vehicleCategory: category === 'car' || category === 'bus' ? (category as Category) : undefined,
                pickupLocation: params.get('from') ?? undefined,
                destination: params.get('to') ?? undefined,
                tripDate: params.get('date') ?? undefined,
                passengers: params.get('pax') ?? undefined,
              }}
            />
          ) : (
            <div className="skeleton h-[36rem] rounded-[4px]" aria-busy="true" />
          )}
        </div>
      </div>
    </section>
  );
}
