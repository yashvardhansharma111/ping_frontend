import * as SecureStore from 'expo-secure-store';

const ROOT = process.env.EXPO_PUBLIC_API_URL ?? 'https://app.pingnow.in';
const BASE_URL = `${ROOT}/api/v1`;
export const WEB_BASE = ROOT;

export interface ApiResponse {
  ok: boolean;
  [key: string]: unknown;
}

// Singleton refresh promise — prevents concurrent 401s from each triggering a separate refresh
let _refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    const refreshToken = await SecureStore.getItemAsync('refreshToken');
    if (!refreshToken) throw new Error('No refresh token stored');
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as any).message || 'Token refresh failed');
    const newToken: string = (data as any).accessToken;
    await SecureStore.setItemAsync('accessToken', newToken);
    // Update in-memory store so all subsequent requests use the new token immediately
    const { default: useAuthStore } = await import('./stores/authStore');
    useAuthStore.setState({ accessToken: newToken });
    return newToken;
  })().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

function makeSignal() {
  const c = new AbortController();
  setTimeout(() => c.abort(), 15_000);
  return c.signal;
}

async function getAccessToken(): Promise<string | null> {
  // In-memory store is always the most up-to-date source (updated synchronously
  // on login and after refresh). SecureStore writes are async so reading from
  // there can miss a token that was just set.
  const { default: useAuthStore } = await import('./stores/authStore');
  const inMemory = useAuthStore.getState().accessToken;
  if (inMemory) return inMemory;
  return SecureStore.getItemAsync('accessToken');
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  auth = true,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated');
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: makeSignal(),
  });

  let data = await res.json().catch(() => ({}));

  // Auto-refresh on 401 then retry once
  if (auth && res.status === 401) {
    try {
      const newToken = await refreshAccessToken(); // also updates authStore in-memory
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: makeSignal(),
      });
      data = await res.json().catch(() => ({}));
    } catch {
      // Refresh failed — clear session and let the router redirect to login
      const { default: useAuthStore } = await import('./stores/authStore');
      await useAuthStore.getState().logout();
      throw new Error('Session expired. Please log in again.');
    }
  }

  if (!res.ok) throw new Error((data as any).error?.message || (data as any).message || `HTTP ${res.status}`);
  return data as T;
}

const get = <T>(path: string, auth = true) => request<T>('GET', path, undefined, auth);
const post = <T>(path: string, body?: unknown, auth = true) => request<T>('POST', path, body, auth);
const patch = <T>(path: string, body?: unknown, auth = true) => request<T>('PATCH', path, body, auth);
const del = <T>(path: string, auth = true) => request<T>('DELETE', path, undefined, auth);

// ── Image upload (multipart — bypasses request() which is JSON-only) ──────────

export const uploadApi = {
  uploadImage: async (localUri: string, folder: 'ads' | 'avatars' | 'misc' = 'misc'): Promise<string> => {
    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const filename = localUri.split('/').pop() ?? 'image.jpg';
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    const form = new FormData();
    form.append('image', { uri: localUri, name: filename, type: mime } as any);
    form.append('folder', folder);

    const res = await fetch(`${BASE_URL}/upload/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as any).error?.message || (data as any).message || `Upload failed (${res.status})`);
    return (data as any).url as string;
  },
};

const ADMIN_BASE = `${ROOT}/api/admin/v1`;

async function adminRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await SecureStore.getItemAsync('adminToken');
  if (!token) throw new Error('Not authenticated');
  headers['Authorization'] = `Bearer ${token}`;
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
  updateMe: (data: Partial<Pick<User, 'displayName' | 'username' | 'bio' | 'avatarUrl' | 'email'> & { dob: string; gender: string; institute: string; hobbies: string[] }>) =>
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
  genderFilter?: 'all' | 'women_only' | 'men_only';
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
  leaveQuietly: (id: string) => post<{ ok: boolean }>(`/activities/${id}/leave-quietly`),
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
  block: (userId: string) => post<{ ok: boolean }>(`/friends/${userId}/block`),
  unblock: (userId: string) => post<{ ok: boolean }>(`/friends/${userId}/unblock`),
  mutual: (userId: string) => get<{ ok: boolean; count: number; mutualIds: string[] }>(`/friends/${userId}/mutual`),
};

export const reportsApi = {
  create: (targetType: 'user' | 'ping' | 'message', targetId: string, reason: string, notes?: string) =>
    post<{ ok: boolean }>('/reports', { targetType, targetId, reason, notes }),
};

// ── Shared types ──────────────────────────────────────────────────────────────

export interface User {
  _id: string;
  id?: string; // backend also sends id (alias of _id)
  phone: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  bio?: string;
  email?: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  status: string;
  strikeCount: number;
  phoneVerifiedAt?: string | null;
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
  genderFilter?: 'all' | 'women_only' | 'men_only';
  creator?: { _id?: string; displayName?: string; username?: string; avatarUrl?: string; trustRate?: number; createdAt?: string };
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
  createdAt?: string;
  phoneVerifiedAt?: string | null;
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
  feed: (lat: number, lng: number) =>
    get<{ ok: boolean; ads: Ad[] }>(`/ads/feed?lat=${lat}&lng=${lng}`),
  recordEvent: (adId: string, type: 'view' | 'contact_tap' | 'thumbs_up' | 'want_to_visit' | 'product_swipe') => {
    const path = type === 'view' ? 'view' : type === 'contact_tap' ? 'contact' : type === 'thumbs_up' ? 'thumbs-up' : type === 'want_to_visit' ? 'want-to-visit' : 'view';
    return post<{ ok: boolean }>(`/ads/${adId}/${path}`, {}, false);
  },
};

// ── Admin API ─────────────────────────────────────────────────────────────────

export interface AdminDailyPoint {
  date: string; // YYYY-MM-DD
  day: string;  // MM-DD
  signups: number;
  pings: number;
  ads: number;
  revenueMinor: number;
}

export interface AdminOverview {
  live: { activeNow: number; activePings: number; activeAds: number; todaysRevenueMinor: number };
  last7d: { newSignups: number; pingsCreated: number; adsLaunched: number; reportsSubmitted: number; bansIssued: number };
  queues: { pendingReports: number; pendingAppeals: number };
  daily?: AdminDailyPoint[];
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
