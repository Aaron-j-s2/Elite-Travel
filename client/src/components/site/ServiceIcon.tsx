import { Briefcase, Bus, Car, Heart, Landmark, Map, Mountain, Route, Sparkles, Users, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = { bus: Bus, car: Car, users: Users, heart: Heart, route: Route, mountain: Mountain, map: Map, sparkles: Sparkles, briefcase: Briefcase, landmark: Landmark };

export function ServiceIcon({ name, className = 'size-5' }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Route;
  return <Icon className={className} strokeWidth={1.5} aria-hidden="true" />;
}
