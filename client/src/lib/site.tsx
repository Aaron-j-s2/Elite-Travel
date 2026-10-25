import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { SiteData, Vehicle } from './types';

/** Verified business details — used until the editable copy has loaded, and if the API is unreachable. */
export const FALLBACK_CONTACT = {
  businessName: 'Elite Travel Hub',
  phone: '+91 90473 39000',
  whatsapp: '919047339000',
  email: 'elitetourandtravel2026@gmail.com',
  locality: 'Thiruvrambu',
  region: 'Kerala, India',
  addressLine: null,
  mapEmbedUrl: '',
  mapLink: '',
  hours: null,
  instagram: '',
  facebook: '',
  youtube: '',
};

interface SiteState {
  site: SiteData | null;
  vehicles: Vehicle[] | null;
  error: boolean;
  contact: SiteData['settings']['contact'];
  reload: () => void;
}

const SiteContext = createContext<SiteState | null>(null);

export function SiteProvider({ children }: { children: ReactNode }) {
  const [site, setSite] = useState<SiteData | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setError(false);
    Promise.all([api.get<SiteData>('/api/site', ctrl.signal), api.get<{ vehicles: Vehicle[] }>('/api/vehicles', ctrl.signal)])
      .then(([s, v]) => {
        setSite(s);
        setVehicles(v.vehicles);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(true);
      });
    return () => ctrl.abort();
  }, [nonce]);

  return (
    <SiteContext.Provider value={{ site, vehicles, error, contact: site?.settings.contact ?? FALLBACK_CONTACT, reload: () => setNonce((n) => n + 1) }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite must be used inside SiteProvider');
  return ctx;
}
