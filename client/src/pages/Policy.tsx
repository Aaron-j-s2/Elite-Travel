import { useSite } from '../lib/site';
import { useSeo } from '../lib/seo';
import { SectionMark } from '../components/ui/primitives';

export default function Policy({ kind }: { kind: 'terms' | 'privacy' }) {
  const title = kind === 'terms' ? 'Booking terms' : 'Privacy policy';
  useSeo(title);
  const { site } = useSite();
  const body = site ? (kind === 'terms' ? site.settings.policies.bookingTerms : site.settings.policies.privacyPolicy) : null;
  return (
    <article className="wrap max-w-3xl py-12 lg:py-20">
      <SectionMark n="—" label="The small print" />
      <h1 className="display mt-6 text-h1">{title}</h1>
      <div className="mt-10 space-y-5 text-[1.05rem] leading-relaxed text-ink/85">
        {body ? body.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>) : <div className="skeleton h-60 rounded-[3px]" aria-busy="true" />}
      </div>
    </article>
  );
}
