import { useEffect } from 'react';

const DEFAULT_TITLE = 'Elite Travel Hub — Tourist Buses & Travel Cars in Thiruvrambu, Kerala';

function setMeta(selector: string, attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

/**
 * Keeps <title> and description in sync during client-side navigation.
 * (The server already renders page-specific tags for the first load and for crawlers.)
 */
export function useSeo(title: string | null, description?: string, opts: { noindex?: boolean } = {}) {
  useEffect(() => {
    const full = title ? `${title} · Elite Travel Hub` : DEFAULT_TITLE;
    document.title = full;
    setMeta('meta[property="og:title"]', 'property', 'og:title', full);
    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description);
      setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    }
    const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (opts.noindex) setMeta('meta[name="robots"]', 'name', 'robots', 'noindex, nofollow');
    else robots?.remove();
  }, [title, description, opts.noindex]);
}
