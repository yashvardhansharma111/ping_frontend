import { Linking } from 'react-native';
import type { PingEvent } from '@/lib/api';

/** Google Maps target for an event: admin-provided URL, else coordinates, else a place search. */
export function eventMapsUrl(ev: PingEvent): string | null {
  if (ev.mapsUrl) return ev.mapsUrl;
  const coords = ev.location?.coordinates;
  if (coords && coords.length === 2) return `https://www.google.com/maps/search/?api=1&query=${coords[1]},${coords[0]}`;
  const q = [ev.venueName, ev.venueAddress, ev.city].filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

export function openEventLocation(ev: PingEvent) {
  const url = eventMapsUrl(ev);
  if (url) Linking.openURL(url).catch(() => {});
}

export function eventPlaceLabel(ev: PingEvent) {
  return ev.venueName || ev.city || ev.venueAddress || 'Location';
}

export function isLiveNow(ev: PingEvent, now = Date.now()) {
  return new Date(ev.startDate).getTime() <= now && new Date(ev.endDate).getTime() >= now;
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return new Date(iso).toLocaleDateString('en-IN', opts);
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function fmtRange(start: string, end: string) {
  const s = new Date(start), e = new Date(end);
  if (s.toDateString() === e.toDateString()) return fmtDate(start);
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}
