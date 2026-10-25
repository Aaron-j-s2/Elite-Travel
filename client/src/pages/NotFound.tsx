import { Link } from 'react-router';
import { useSeo } from '../lib/seo';

export default function NotFound() {
  useSeo('Page not found', undefined, { noindex: true });
  return (
    <section className="wrap grid min-h-[60vh] place-items-center py-20 text-center">
      <div>
        <div className="milestone mx-auto w-28 px-3 pt-4 pb-4" aria-hidden="true">
          <span className="relative z-10 font-mono text-[0.6rem] font-bold tracking-wider">WRONG TURN</span>
          <span className="display relative z-10 mt-5 text-5xl leading-none">404</span>
        </div>
        <h1 className="headline mt-10 text-h2">Page not found</h1>
        <p className="lede mx-auto mt-4 max-w-md">This page has moved or does not exist.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/" className="btn btn-primary">
            Back home
          </Link>
          <Link to="/vehicles" className="btn btn-ghost">
            See our vehicles
          </Link>
        </div>
      </div>
    </section>
  );
}
