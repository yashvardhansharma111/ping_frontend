import * as SecureStore from 'expo-secure-store';

const ROOT = process.env.EXPO_PUBLIC_API_URL ?? 'https://app.pingnow.in';
const BASE_URL = `${ROOT}/api/v1`;
export const WEB_BASE = ROOT;

export interface ApiResponse<T = unknown> {
  ok: boolean;
  [key: string]: unknown;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  auth = true,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 15_000); return c.signal; })(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error?.message || (data as any).message || `HTTP ${res.status}`);
  return data as T;
}

const get = <T>(path: string, auth = true) => request<T>('GET', path, undefined, auth);
const post = <T>(path: string, body?: unknown, auth = true) => request<T>('POST', path, body, auth);
const patch = <T>(path: string, body?: unknown, auth = true) => request<T>('PATCH', path, body, auth);
const del = <T>(path: string, auth = true) => request<T>('DELETE', path, undefined, auth);

const ADMIN_BASE = `${ROOT}/api/admin/v1`;

async function adminRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await SecureStore.getItemAsync('adminToken');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${ADMIN_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 15_000); return c.signal; })(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error?.message || (data as any).message || `HTTP ${res.status}`);
  return data as T;
}

const aGet = <T>(path: string) => adminRequest<T>('GET', path);
const aPost = <T>(path: string, body?: unknown) => adminRequest<T>('POST', path, body);

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthVerifyResponse {
  ok: boolean;
  accessToken: string;
  refreshToken: string;
  user: User;
  isNewUser: boolean;
  code?: string; // only present when OTP_DEBUG=true
}

export const authApi = {
  requestOtp: (phone: string) =>
    post<{ ok: boolean; code?: string }>('/auth/otp/request', { phone }, false),
  verifyOtp: (phone: string, code: string) =>
    post<AuthVerifyResponse>('/auth/otp/verify', { phone, code }, false),
  refresh: (refreshToken: string) =>
    post<{ accessToken: string }>('/auth/refresh', { refreshToken }, false),
  me: () => get<{ ok: boolean; user: User }>('/auth/me'),
  logout: (refreshToken: string) => post('/auth/logout', { refreshToken }),
};

// ── Users ─────────────────────────────────────────────────────────────────────

export const usersApi = {
  updateMe: (data: Partial<Pick<User, 'displayName' | 'username' | 'bio' | 'avatarUrl' | 'email'> & { dob: string }>) =>
    patch<{ ok: boolean; user: User }>('/users/me', data),
  updatePrivacy: (data: Partial<{ ghostMode: boolean; locationSharing: boolean }>) =>
    patch<{ ok: boolean; privacy: User['privacy'] }>('/users/me/privacy', data),
  updateLocation: (lat: number, lng: number) =>
    patch('/users/me/location', { lat, lng }),
  deleteMe: () => del<{ ok: boolean }>('/users/me'),
  search: (q: string) =>
    get<{ ok: boolean; users: User[] }>(`/users/search?q=${encodeURIComponent(q)}`),
  getProfile: (id: string) =>
    get<{ ok: boolean; user: UserProfile }>(`/users/${id}`),
};

// ── Activities ────────────────────────────────────────────────────────────────

export interface CreateActivityPayload {
  title: string;
  type: string;
  visibility: 'public' | 'friends';
  lat: number;
  lng: number;
  durationMinutes?: number;
  maxParticipants?: number;
  startsAt?: string;
  description?: string;
}

export const activitiesApi = {
  create: (data: CreateActivityPayload) =>
    post<{ ok: boolean; activity: Activity }>('/activities', data),
  nearby: async (lat: number, lng: number) => {
    const r = await get<{ ok: boolean; activities: any[] }>(`/activities/nearby?lat=${lat}&lng=${lng}`);
    return { ...r, activities: r.activities.map(normalizeActivity) };
  },
  joined: async () => {
    const r = await get<{ ok: boolean; activities: any[] }>('/activities/joined');
    return { ...r, activities: r.activities.map(normalizeActivity) };
  },
  mine: async () => {
    const r = await get<{ ok: boolean; activities: any[] }>('/activities/mine');
    return { ...r, activities: r.activities.map(normalizeActivity) };
  },
  get: async (id: string) => {
    const r = await get<{ ok: boolean; activity: any }>(`/activities/${id}`);
    return { ...r, activity: normalizeActivity(r.activity) };
  },
  join: (id: string) => post<{ ok: boolean }>(`/activities/${id}/join`),
  leave: (id: string) => post<{ ok: boolean }>(`/activities/${id}/leave`),
  cancel: (id: string) => del<{ ok: boolean }>(`/activities/${id}`),
  onMyWay: (id: string) => post<{ ok: boolean }>(`/activities/${id}/on-my-way`),
  arrived: (id: string) => post<{ ok: boolean }>(`/activities/${id}/arrived`),
};

// ── Friends ───────────────────────────────────────────────────────────────────

export const friendsApi = {
  list: () => get<{ ok: boolean; friends: Friendship[] }>('/friends'),
  requests: () => get<{ ok: boolean; requests: Friendship[] }>('/friends/requests'),
  send: (userId: string) => post<{ ok: boolean }>('/friends/request', { userId }),
  accept: (userId: string) => post(`/friends/${userId}/accept`),
  reject: (userId: string) => post(`/friends/${userId}/reject`),
  remove: (userId: string) => del(`/friends/${userId}`),
};

// ── Shared types ──────────────────────────────────────────────────────────────

export interface User {
  _id: string;
  phone: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  bio?: string;
  email?: string;
  dob?: string;
  status: string;
  strikeCount: number;
  privacy?: {
    ghostMode: boolean;
    locationSharing: boolean;
    autoShutoffAt: string | null;
  };
}

export interface ActivityParticipant {
  userId: string;
  joinedAt: string;
  onMyWayAt?: string | null;
  arrivedAt?: string | null;
}

export interface Activity {
  _id: string;
  title: string;
  type: string;
  description?: string;
  placeName?: string;
  location: { type: 'Point'; coordinates: [number, number] }; // [lng, lat]
  startsAt: string;
  expiresAt: string;
  status?: 'live' | 'expired' | 'cancelled';
  participants: ActivityParticipant[];
  maxParticipants?: number;
  visibility: 'public' | 'friends' | 'squad';
  creator?: { _id?: string; displayName?: string; username?: string; avatarUrl?: string };
  creatorId?: string;
  distance?: number;
}

// Mongoose populate puts the user object into creatorId; normalize it to creator
function normalizeActivity(a: any): Activity {
  if (a.creatorId && typeof a.creatorId === 'object') {
    return { ...a, creator: a.creatorId, creatorId: a.creatorId._id };
  }
  return a as Activity;
}

export interface UserProfile {
  _id: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  bio?: string;
  trustRate?: number;
  status: string;
  friendshipStatus: 'self' | 'none' | 'accepted' | 'pending_sent' | 'pending_received' | 'blocked';
}

export interface Friendship {
  _id: string;
  friend: User;
  status: 'accepted' | 'pending' | 'blocked';
  requestedBy: string;
  createdAt: string;
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatParticipant {
  _id: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
}

export interface ChatRoom {
  _id: string;
  kind: 'dm' | 'activity' | 'squad';
  participantIds: ChatParticipant[];
  activityId?: string;
  squadId?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  createdAt: string;
}

export interface ChatMessage {
  _id: string;
  roomId: string;
  senderId: ChatParticipant;
  type: 'text' | 'image' | 'location' | 'system';
  body?: string;
  mediaUrl?: string;
  location?: { type: 'Point'; coordinates: [number, number] };
  readBy: { userId: string; readAt: string }[];
  createdAt: string;
  deletedAt?: string | null;
}

export const chatApi = {
  listRooms: () =>
    get<{ ok: boolean; rooms: ChatRoom[] }>('/chat/rooms'),
  getRoom: (roomId: string) =>
    get<{ ok: boolean; room: ChatRoom }>(`/chat/rooms/${roomId}`),
  openActivityRoom: (activityId: string) =>
    post<{ ok: boolean; room: ChatRoom }>(`/chat/rooms/activity/${activityId}`),
  openDm: (userId: string) =>
    post<{ ok: boolean; room: ChatRoom }>('/chat/rooms/dm', { userId }),
  listMessages: (roomId: string, before?: string) =>
    get<{ ok: boolean; messages: ChatMessage[] }>(
      `/chat/rooms/${roomId}/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`,
    ),
  sendMessage: (roomId: string, body: string) =>
    post<{ ok: boolean; message: ChatMessage }>(`/chat/rooms/${roomId}/messages`, { type: 'text', body }),
  markRead: (roomId: string) =>
    post<{ ok: boolean; marked: number }>(`/chat/rooms/${roomId}/read`),
};

// ── Ads ───────────────────────────────────────────────────────────────────────

export type AdTier = 'basic_49' | 'pro_99';
export type AdStatus = 'pending_payment' | 'live' | 'expired' | 'refunded' | 'removed';
export type AdCategory =
  | 'food_drink' | 'fashion' | 'beauty_wellness' | 'home_services'
  | 'education' | 'entertainment' | 'other';

export interface AdProduct {
  imageUrl: string;
  videoUrl?: string | null;
  name: string;
  priceMinor?: number | null;
  description?: string;
}

export interface Ad {
  _id: string;
  tier: AdTier;
  businessName: string;
  category: AdCategory;
  tagline?: string;
  contactPhone?: string | null;
  location: { type: 'Point'; coordinates: [number, number] };
  radiusMeters: number;
  products: AdProduct[];
  status: AdStatus;
  startsAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface AdAnalyticsTotals {
  views: number;
  uniqueReach: number;
  thumbsUp: number;
  wantToVisit: number;
  profileTaps: number;
  contactTaps: number;
  shares: number;
  productSwipes: number;
}

export interface CreateAdPayload {
  tier: AdTier;
  businessName: string;
  category: AdCategory;
  tagline?: string;
  lat: number;
  lng: number;
  contactPhone?: string;
  products: AdProduct[];
}

export const adsApi = {
  create: (data: CreateAdPayload) =>
    post<{ ok: boolean; ad: Ad }>('/ads', data),
  createOrder: (adId: string) =>
    post<{ ok: boolean; order: { id: string; amount: number; currency: string; keyId: string } }>(`/ads/${adId}/order`),
  verifyPayment: (adId: string, body: { gatewayOrderId: string; gatewayPaymentId: string; gatewaySignature: string; method?: string }) =>
    post<{ ok: boolean; ad: Ad }>(`/ads/${adId}/verify-payment`, body),
  mine: (status?: 'live' | 'completed' | 'all') =>
    get<{ ok: boolean; ads: Ad[] }>(`/ads/mine${status ? `?status=${status}` : ''}`),
  get: (adId: string) =>
    get<{ ok: boolean; ad: Ad }>(`/ads/${adId}`),
  analytics: (adId: string) =>
    get<{ ok: boolean; ad: Ad; totals: AdAnalyticsTotals; daily: unknown[] }>(`/ads/${adId}/analytics`),
};

// ── Admin API ─────────────────────────────────────────────────────────────────

export interface AdminOverview {
  live: { activeNow: number; activePings: number; activeAds: number; todaysRevenueMinor: number };
  last7d: { newSignups: number; pingsCreated: number; adsLaunched: number; reportsSubmitted: number; bansIssued: number };
  queues: { pendingReports: number; pendingAppeals: number };
}

export interface AdminUser {
  _id: string; displayName?: string; username?: string; phone: string;
  email?: string; status: string; strikeCount: number; createdAt: string; lastActiveAt?: string;
}

export interface AdminPayment {
  _id: string; amountMinor: number; currency: string; status: string; method?: string;
  gatewayOrderId?: string; gatewayPaymentId?: string; createdAt: string;
  userId?: { displayName?: string; username?: string; phone: string };
  adId?: { businessName: string; tier: string; status: string };
}

export interface AdminReport {
  _id: string; targetType: string; reason: string; status: string; createdAt: string;
  reporterId?: { displayName?: string; username?: string };
  targetUserId?: { displayName?: string; username?: string; status: string };
}

export const adminApi = {
  overview: () => aGet<{ ok: boolean } & AdminOverview>('/overview'),
  users: (q?: string, filter?: string, page = 1) =>
    aGet<{ ok: boolean; users: AdminUser[]; total: number }>(`/users?q=${q || ''}&filter=${filter || 'all'}&page=${page}`),
  warnUser: (id: string, reason: string) => aPost<{ ok: boolean }>(`/users/${id}/warn`, { reason }),
  banUser: (id: string, type: 'temp' | 'perm', reason: string, durationDays?: number) =>
    aPost<{ ok: boolean }>(`/users/${id}/ban`, { type, reason, durationDays, confirm: type === 'perm' ? 'CONFIRM' : undefined }),
  unbanUser: (id: string) => aPost<{ ok: boolean }>(`/users/${id}/unban`),
  payments: (page = 1, status?: string) =>
    aGet<{ ok: boolean; items: AdminPayment[]; total: number; summary: { totalMinor: number; count: number } }>(`/payments?page=${page}${status ? `&status=${status}` : ''}`),
  refundPayment: (id: string, reason: string) => aPost<{ ok: boolean }>(`/payments/${id}/refund`, { reason }),
  reports: (tab = 'all', page = 1) =>
    aGet<{ ok: boolean; items: AdminReport[]; total: number }>(`/reports?tab=${tab}&page=${page}`),
  dismissReport: (id: string) => aPost<{ ok: boolean }>(`/reports/${id}/dismiss`),
  removeReport: (id: string, reason: string) => aPost<{ ok: boolean }>(`/reports/${id}/remove`, { reason }),
  warnReport: (id: string, reason: string) => aPost<{ ok: boolean }>(`/reports/${id}/remove-and-warn`, { reason }),
};
