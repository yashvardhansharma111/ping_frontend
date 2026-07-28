import type { ComponentProps } from 'react';
import { Ping } from '@/constants/theme';

type MCIName = ComponentProps<typeof import('@expo/vector-icons').MaterialCommunityIcons>['name'];

/**
 * Single activity-type palette for map, lists, cards, past pings.
 * Purple-spectrum so the app reads as one product — not rainbow-per-screen.
 */
export const ACTIVITY_TYPES: Record<
  string,
  { icon: MCIName; color: string; label: string }
> = {
  sport:   { icon: 'dumbbell',           color: '#6545D9', label: 'Sport' },
  food:    { icon: 'food-fork-drink',    color: '#8F63F4', label: 'Food' },
  music:   { icon: 'music',              color: '#BB92FF', label: 'Music' },
  study:   { icon: 'book-open-variant',  color: '#7B5CFF', label: 'Study' },
  outdoor: { icon: 'walk',               color: '#9B7AFF', label: 'Outdoor' },
  gaming:  { icon: 'gamepad-variant',    color: '#C8A8FF', label: 'Gaming' },
  meetup:  { icon: 'account-group',      color: '#6545D9', label: 'Meetup' },
  default: { icon: 'flash',              color: Ping.purple, label: 'Ping' },
};

export function activityTypeMeta(type?: string | null) {
  if (!type) return ACTIVITY_TYPES.default;
  return ACTIVITY_TYPES[type] ?? ACTIVITY_TYPES.default;
}
