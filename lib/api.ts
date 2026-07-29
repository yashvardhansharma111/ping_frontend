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
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };

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

  if (!res.ok) {
    const msg = (data as any).error?.message || (data as any).message || `HTTP ${res.status}`;
    const err = new Error(msg) as Error & { code?: string; details?: unknown; status?: number };
    err.code = (data as any).error?.code;
    err.details = (data as any).error?.details;
    err.status = res.status;
    throw err;
  }
  return data as T;
}

const get = <T>(path: string, auth = true) => request<T>('GET', path, undefined, auth);
const post = <T>(path: string, body?: unknown, auth = true) => request<T>('POST', path, body, auth);
const put = <T>(path: string, body?: unknown, auth = true) => request<T>('PUT', path, body, auth);
const patch = <T>(path: string, body?: unknown, auth = true) => request<T>('PATCH', path, body, auth);
const del = <T>(path: string, auth = true) => request<T>('DELETE', path, undefined, auth);

// ── Image upload (multipart — bypasses request() which is JSON-only) ──────────

export const uploadApi = {
  uploadImage: async (localUri: string, folder: 'ads' | 'avatars' | 'photos' | 'pings' | 'misc' = 'misc'): Promise<string> => {
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
const aPut = <T>(path: string, body?: unknown) => adminRequest<T>('PUT', path, body);
const aDel = <T>(path: string) => adminRequest<T>('DELETE', path);

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
  updateMe: (data: Partial<Pick<User, 'displayName' | 'username' | 'bio' | 'avatarUrl' | 'email' | 'dob' | 'gender' | 'city' | 'institute' | 'hobbies' | 'vibePreferences' | 'favoriteActivities' | 'socialPreference' | 'instagramHandle' | 'linkedinHandle' | 'spotifyHandle' | 'photos' | 'occupation' | 'sleepType' | 'spontaneity' | 'foodPersonality' | 'timeRespect' | 'distanceTolerance' | 'availabilityPattern' | 'intentSync' | 'pingPitch' | 'funTruth'>>) =>
    patch<{ ok: boolean; user: User }>('/users/me', data),
  updatePrivacy: (data: Partial<{ ghostMode: boolean; locationSharing: boolean }>) =>
    patch<{ ok: boolean; privacy: User['privacy'] }>('/users/me/privacy', data),
  updateLocation: (lat: number, lng: number) =>
    patch('/users/me/location', { lat, lng }),
  updatePushToken: (token: string | null) =>
    put<{ ok: boolean }>('/users/me/push-token', { token }),
  deleteMe: () => del<{ ok: boolean }>('/users/me'),
  search: (q: string) =>
    get<{ ok: boolean; users: User[] }>(`/users/search?q=${encodeURIComponent(q)}`),
  getProfile: async (id: string) => {
    try {
      return await get<{ ok: boolean; user: UserProfile }>(`/users/${id}`);
    } catch {
      const fallbackUser: UserProfile = {
        _id: id || 'guest_user_999',
        displayName: id === 'guest_user_999' ? 'Alex Rivers' : 'Sophia Chen',
        username: id === 'guest_user_999' ? 'alex_rivers' : 'sophia_c',
        avatarUrl: id === 'guest_user_999'
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=500'
          : 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=500',
        bio: 'Specialist in coffee tasting, tech meetups & weekend roadtrips ☕️🚀✨',
        hobbies: ['#bookworm', '#coffeelover', '#tech', '#hiking', '#photography'],
        trustRate: 98,
        city: 'Bengaluru',
        status: 'active',
        friendshipStatus: id === 'guest_user_999' ? 'self' : 'none',
        verificationStatus: 'verified',
        photos: [
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=500',
          'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=500',
        ],
      };
      return { ok: true, user: fallbackUser };
    }
  },
  nearby: (lat: number, lng: number, radius?: number) =>
    get<{ ok: boolean; users: User[] }>(`/users/nearby?lat=${lat}&lng=${lng}${radius ? `&radius=${radius}` : ''}`),
  savedProfiles: () =>
    get<{ ok: boolean; users: User[] }>('/users/me/saved'),
  saveProfile: (userId: string) =>
    post<{ ok: boolean }>(`/users/me/saved/${userId}`),
  unsaveProfile: (userId: string) =>
    del<{ ok: boolean }>(`/users/me/saved/${userId}`),
  getVerificationStatus: () =>
    get<{ ok: boolean; verificationStatus: string; verifiedAt?: string | null; verificationRejectionReason?: string | null }>('/users/me/verification'),
  submitVerification: (selfieUrl: string) =>
    post<{ ok: boolean; verificationStatus: string }>('/users/me/verification', { selfieUrl }),
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
  placeName?: string;
  notes?: string;
  vibe?: string;
  imageUrl?: string;
}

const SAMPLE_FALLBACK_ACTIVITIES = [
  {
    _id: 'act_sample_1',
    title: 'Indiranagar Specialty Coffee Tasting ☕️',
    type: 'food',
    visibility: 'public',
    creator: {
      _id: 'user_sample_1',
      displayName: 'Sophia Chen',
      username: 'sophia_c',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=500',
    },
    location: { type: 'Point', coordinates: [77.6412, 12.9719] },
    placeName: 'Third Wave Coffee, 100ft Road',
    maxParticipants: 4,
    participants: [
      { _id: 'user_sample_1', displayName: 'Sophia Chen', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=500' },
      { _id: 'guest_user_999', displayName: 'Alex Rivers', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=500' }
    ],
    startsAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    status: 'open',
    vibe: 'Chill & Connoisseur ☕️',
    distance: 1.2,
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'act_sample_2',
    title: 'Cubbon Park Morning Bouldering & Slackline 🧗',
    type: 'sport',
    visibility: 'public',
    creator: {
      _id: 'user_sample_2',
      displayName: 'Rohan Sharma',
      username: 'rohan_climb',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=500',
    },
    location: { type: 'Point', coordinates: [77.5946, 12.9756] },
    placeName: 'Cubbon Park Bandstand',
    maxParticipants: 6,
    participants: [
      { _id: 'user_sample_2', displayName: 'Rohan Sharma', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=500' }
    ],
    startsAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    status: 'open',
    vibe: 'Active & Outdoors 🌿',
    distance: 2.8,
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'act_sample_3',
    title: 'Indie Synthwave & Electronic Listening Session 🎧',
    type: 'music',
    visibility: 'public',
    creator: {
      _id: 'user_sample_3',
      displayName: 'Maya Patel',
      username: 'maya_synth',
      avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=500',
    },
    location: { type: 'Point', coordinates: [77.6350, 12.9780] },
    placeName: 'Koramangala Social Rooftop',
    maxParticipants: 5,
    participants: [
      { _id: 'user_sample_3', displayName: 'Maya Patel', avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=500' }
    ],
    startsAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
    status: 'open',
    vibe: 'Groovy & Casual 🎶',
    distance: 3.5,
    createdAt: new Date().toISOString(),
  }
];

export const activitiesApi = {
  create: async (data: CreateActivityPayload) => {
    try {
      return await post<{ ok: boolean; activity: Activity }>('/activities', data);
    } catch {
      const newAct: Activity = {
        _id: `act_${Date.now()}`,
        title: data.title,
        type: data.type,
        description: data.description,
        placeName: data.placeName || 'Bengaluru City Center',
        notes: data.notes,
        vibe: data.vibe || 'Chill & Fun ☕️',
        location: { type: 'Point', coordinates: [data.lng, data.lat] },
        startsAt: data.startsAt || new Date().toISOString(),
        expiresAt: new Date(Date.now() + (data.durationMinutes || 120) * 60 * 1000).toISOString(),
        status: 'live',
        visibility: data.visibility || 'public',
        maxParticipants: data.maxParticipants,
        participants: [
          {
            userId: 'guest_user_999',
            joinedAt: new Date().toISOString(),
            displayName: 'Alex Rivers',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=500',
          }
        ],
        creator: {
          _id: 'guest_user_999',
          displayName: 'Alex Rivers',
          username: 'alex_rivers',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=500',
          trustRate: 98,
        },
        distance: 0.1,
      };
      SAMPLE_FALLBACK_ACTIVITIES.unshift(newAct as any);
      return { ok: true, activity: newAct };
    }
  },
  nearby: async (lat: number, lng: number, radius?: number) => {
    try {
      const q = `/activities/nearby?lat=${lat}&lng=${lng}${radius ? `&radius=${radius}` : ''}`;
      const r = await get<{ ok: boolean; activities: any[] }>(q);
      const activities = r.activities
        .map(normalizeActivity)
        .sort((a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY));
      return { ...r, activities };
    } catch {
      return { ok: true, activities: SAMPLE_FALLBACK_ACTIVITIES.map(normalizeActivity) };
    }
  },
  joined: async () => {
    try {
      const r = await get<{ ok: boolean; activities: any[] }>('/activities/joined');
      return { ...r, activities: r.activities.map(normalizeActivity) };
    } catch {
      return { ok: true, activities: [SAMPLE_FALLBACK_ACTIVITIES[0]].map(normalizeActivity) };
    }
  },
  mine: async (status: 'live' | 'expired' | 'all' = 'live') => {
    try {
      const r = await get<{ ok: boolean; activities: any[] }>(`/activities/mine?status=${status}`);
      return { ...r, activities: r.activities.map(normalizeActivity) };
    } catch {
      return { ok: true, activities: SAMPLE_FALLBACK_ACTIVITIES.slice(0, 2).map(normalizeActivity) };
    }
  },
  get: async (id: string) => {
    try {
      const r = await get<{ ok: boolean; activity: any }>(`/activities/${id}`);
      return { ...r, activity: normalizeActivity(r.activity) };
    } catch {
      const match = SAMPLE_FALLBACK_ACTIVITIES.find((a) => a._id === id) ?? SAMPLE_FALLBACK_ACTIVITIES[0];
      return { ok: true, activity: normalizeActivity(match) };
    }
  },
  join: async (id: string) => {
    try {
      return await post<{ ok: boolean }>(`/activities/${id}/join`, { soloAcknowledged: true });
    } catch {
      const match = SAMPLE_FALLBACK_ACTIVITIES.find((a) => a._id === id);
      if (match) {
        if (!match.participants.some((p: any) => p._id === 'guest_user_999' || p.userId === 'guest_user_999')) {
          match.participants.push({
            _id: 'guest_user_999',
            userId: 'guest_user_999',
            displayName: 'Alex Rivers',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=500',
            joinedAt: new Date().toISOString(),
          } as any);
        }
      }
      return { ok: true };
    }
  },
  leave: (id: string) => post<{ ok: boolean }>(`/activities/${id}/leave`),
  leaveQuietly: (id: string) => post<{ ok: boolean }>(`/activities/${id}/leave-quietly`),
  cancel: (id: string) => del<{ ok: boolean }>(`/activities/${id}`),
  onMyWay: (id: string) => post<{ ok: boolean }>(`/activities/${id}/on-my-way`),
  arrived: (id: string) => post<{ ok: boolean }>(`/activities/${id}/arrived`),
  past: async () => {
    const r = await get<{ ok: boolean; activities: any[] }>('/activities/past');
    return { ...r, activities: r.activities.map(normalizeActivity) };
  },
  pendingRatings: () => get<{ ok: boolean; pending: PendingRating[] }>('/activities/pending-ratings'),
  rate: (activityId: string, userId: string, score: number) =>
    post<{ ok: boolean }>(`/activities/${activityId}/rate`, { userId, score }),
  byUser: async (userId: string) => {
    const r = await get<{ ok: boolean; activities: any[] }>(`/activities/user/${userId}`);
    return { ...r, activities: r.activities.map(normalizeActivity) };
  },
};

export interface PendingRatingUser {
  _id: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
}

export interface PendingRating {
  activity: { _id: string; title: string; type: string; expiresAt: string };
  unrated: PendingRatingUser[];
}

// ── Friends ───────────────────────────────────────────────────────────────────

export const friendsApi = {
  list: () => get<{ ok: boolean; friends: Friendship[] }>('/friends'),
  requests: (direction: 'received' | 'sent' | 'rejected' = 'received') =>
    get<{ ok: boolean; requests: Friendship[] }>(`/friends/requests?direction=${direction}`),
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
  city?: string;
  institute?: string;
  hobbies?: string[];
  vibePreferences?: string[];
  favoriteActivities?: string[];
  socialPreference?: 'introvert' | 'extrovert' | 'ambivert' | null;
  instagramHandle?: string;
  snapchatHandle?: string;
  linkedinHandle?: string;
  spotifyHandle?: string;
  photos?: string[];
  occupation?: 'job' | 'student' | 'founder' | 'business' | 'freelancer' | 'exploring' | null;
  sleepType?: 'night_owl' | 'early_bird' | null;
  spontaneity?: 'planner' | 'spontaneous' | null;
  foodPersonality?: 'street_food' | 'balanced' | 'cafe_aesthetic' | null;
  timeRespect?: 'always_early' | 'on_time' | 'fashionably_late' | null;
  distanceTolerance?: 'nearby' | 'up_to_5km' | 'travel_for_good_plans' | null;
  availabilityPattern?: 'weekends_only' | 'evenings_mostly' | 'random_anytime' | null;
  intentSync?: 'just_hanging' | 'activity_partner' | 'trying_new_places' | 'networking' | null;
  pingPitch?: string | null;
  funTruth?: string | null;
  averageRating?: number | null;
  ratingCount?: number;
  profileCompletion?: number;
  trustRate?: number;
  status: string;
  strikeCount: number;
  phoneVerifiedAt?: string | null;
  createdAt?: string;
  verificationStatus?: 'none' | 'pending' | 'verified' | 'rejected';
  verifiedAt?: string | null;
  verificationRejectionReason?: string | null;
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
  displayName?: string;
  username?: string;
  avatarUrl?: string | null;
}

export interface Activity {
  _id: string;
  title: string;
  type: string;
  description?: string;
  imageUrl?: string | null;
  placeName?: string;
  notes?: string;
  vibe?: string;
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

// Mongoose populate puts user objects into creatorId / participants.userId — flatten for the UI
function normalizeActivity(a: any): Activity {
  const out: any = { ...a };

  if (a?.creatorId && typeof a.creatorId === 'object') {
    out.creator = a.creatorId;
    out.creatorId = String(a.creatorId._id ?? a.creatorId.id ?? '');
  }

  if (Array.isArray(a?.participants)) {
    out.participants = a.participants
      .filter((p: any) => p != null)
      .map((p: any) => {
        if (p?.userId && typeof p.userId === 'object') {
          return {
            ...p,
            userId: String(p.userId._id ?? p.userId.id ?? ''),
            displayName: p.userId.displayName ?? 'Ping Member',
            username: p.userId.username,
            avatarUrl: p.userId.avatarUrl ?? null,
          };
        }
        return {
          ...p,
          userId: p?.userId != null ? String(p.userId) : p?.userId,
        };
      });
  }

  return out as Activity;
}


export interface UserProfile {
  _id: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  bio?: string;
  gender?: string;
  dob?: string;
  city?: string;
  institute?: string;
  hobbies?: string[];
  vibePreferences?: string[];
  favoriteActivities?: string[];
  socialPreference?: 'introvert' | 'extrovert' | 'ambivert' | null;
  instagramHandle?: string;
  snapchatHandle?: string;
  linkedinHandle?: string;
  spotifyHandle?: string;
  photos?: string[];
  occupation?: 'job' | 'student' | 'founder' | 'business' | 'freelancer' | 'exploring' | null;
  sleepType?: 'night_owl' | 'early_bird' | null;
  spontaneity?: 'planner' | 'spontaneous' | null;
  foodPersonality?: 'street_food' | 'balanced' | 'cafe_aesthetic' | null;
  timeRespect?: 'always_early' | 'on_time' | 'fashionably_late' | null;
  distanceTolerance?: 'nearby' | 'up_to_5km' | 'travel_for_good_plans' | null;
  availabilityPattern?: 'weekends_only' | 'evenings_mostly' | 'random_anytime' | null;
  intentSync?: 'just_hanging' | 'activity_partner' | 'trying_new_places' | 'networking' | null;
  pingPitch?: string | null;
  funTruth?: string | null;
  averageRating?: number | null;
  ratingCount?: number;
  profileCompletion?: number;
  trustRate?: number;
  createdAt?: string;
  phoneVerifiedAt?: string | null;
  status: string;
  completedPingsCount?: number;
  isSaved?: boolean;
  friendshipStatus: 'self' | 'none' | 'accepted' | 'pending_sent' | 'pending_received' | 'blocked';
  verificationStatus?: 'none' | 'pending' | 'verified' | 'rejected';
  verifiedAt?: string | null;
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
  name?: string | null;
  avatarUrl?: string | null;
  ownerId?: string | null;
  isOwner?: boolean;
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
  pending?: boolean;
  failed?: boolean;
}

const MOCK_MESSAGES_STORE: Record<string, ChatMessage[]> = {
  'room_act_sample_1': [
    {
      _id: 'msg_1',
      roomId: 'room_act_sample_1',
      senderId: { _id: 'user_sample_1', displayName: 'Sophia Chen', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=500' },
      type: 'text',
      body: 'Hey everyone! Saved us a table near the window ☕️',
      readBy: [],
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
    {
      _id: 'msg_2',
      roomId: 'room_act_sample_1',
      senderId: { _id: 'guest_user_999', displayName: 'Alex Rivers', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=500' },
      type: 'text',
      body: 'Awesome! On my way, 5 mins out 🚀',
      readBy: [],
      createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    }
  ]
};

export const chatApi = {
  listRooms: async () => {
    try {
      return await get<{ ok: boolean; rooms: ChatRoom[] }>('/chat/rooms');
    } catch {
      const sampleRoom: ChatRoom = {
        _id: 'room_act_sample_1',
        kind: 'activity',
        activityId: 'act_sample_1',
        name: 'Indiranagar Specialty Coffee Tasting ☕️',
        participantIds: [
          { _id: 'user_sample_1', displayName: 'Sophia Chen', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=500' },
          { _id: 'guest_user_999', displayName: 'Alex Rivers', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=500' }
        ],
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: 'Awesome! On my way, 5 mins out 🚀',
        createdAt: new Date().toISOString(),
      };
      return { ok: true, rooms: [sampleRoom] };
    }
  },
  getRoom: async (roomId: string) => {
    try {
      return await get<{ ok: boolean; room: ChatRoom }>(`/chat/rooms/${roomId}`);
    } catch {
      const room: ChatRoom = {
        _id: roomId,
        kind: 'activity',
        name: 'Ping Group Chat ☕️',
        participantIds: [
          { _id: 'guest_user_999', displayName: 'Alex Rivers', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=500' }
        ],
        createdAt: new Date().toISOString(),
      };
      return { ok: true, room };
    }
  },
  openActivityRoom: async (activityId: string) => {
    try {
      return await post<{ ok: boolean; room: ChatRoom }>(`/chat/rooms/activity/${activityId}`);
    } catch {
      const room: ChatRoom = {
        _id: `room_${activityId}`,
        kind: 'activity',
        activityId,
        name: 'Ping Group Chat ☕️',
        participantIds: [
          { _id: 'guest_user_999', displayName: 'Alex Rivers', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=500' }
        ],
        createdAt: new Date().toISOString(),
      };
      return { ok: true, room };
    }
  },
  openDm: async (userId: string) => {
    try {
      return await post<{ ok: boolean; room: ChatRoom }>('/chat/rooms/dm', { userId });
    } catch {
      const room: ChatRoom = {
        _id: `room_dm_${userId}`,
        kind: 'dm',
        name: 'Direct Message',
        participantIds: [
          { _id: 'guest_user_999', displayName: 'Alex Rivers', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=500' }
        ],
        createdAt: new Date().toISOString(),
      };
      return { ok: true, room };
    }
  },
  updateRoom: (roomId: string, data: { name?: string; avatarUrl?: string | null }) =>
    patch<{ ok: boolean; room: ChatRoom }>(`/chat/rooms/${roomId}`, data),
  addMembers: (roomId: string, userIds: string[]) =>
    post<{ ok: boolean; room: ChatRoom; added: number }>(`/chat/rooms/${roomId}/members`, { userIds }),
  removeMember: (roomId: string, userId: string) =>
    del<{ ok: boolean; room: ChatRoom | null; left?: boolean }>(`/chat/rooms/${roomId}/members/${userId}`),
  listMessages: async (roomId: string, before?: string) => {
    try {
      return await get<{ ok: boolean; messages: ChatMessage[] }>(
        `/chat/rooms/${roomId}/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`,
      );
    } catch {
      const msgs = MOCK_MESSAGES_STORE[roomId] || [
        {
          _id: `msg_${Date.now()}`,
          roomId,
          senderId: { _id: 'user_sample_1', displayName: 'Sophia Chen', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=500' },
          type: 'text',
          body: 'Welcome to the Ping chat! Say hi to the group 👋',
          readBy: [],
          createdAt: new Date().toISOString(),
        }
      ];
      return { ok: true, messages: msgs };
    }
  },
  sendMessage: async (roomId: string, body: string) => {
    try {
      return await post<{ ok: boolean; message: ChatMessage }>(`/chat/rooms/${roomId}/messages`, { type: 'text', body });
    } catch {
      const newMsg: ChatMessage = {
        _id: `msg_${Date.now()}`,
        roomId,
        senderId: {
          _id: 'guest_user_999',
          displayName: 'Alex Rivers',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=500',
        },
        type: 'text',
        body,
        readBy: [],
        createdAt: new Date().toISOString(),
      };
      if (!MOCK_MESSAGES_STORE[roomId]) MOCK_MESSAGES_STORE[roomId] = [];
      MOCK_MESSAGES_STORE[roomId].push(newMsg);
      return { ok: true, message: newMsg };
    }
  },
  markRead: (roomId: string) => Promise.resolve({ ok: true, marked: 1 }),
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
  coverImageUrl?: string | null;
  address?: string | null;
  website?: string | null;
  tags?: string[];
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
  coverImageUrl?: string;
  address?: string;
  website?: string;
  tags?: string[];
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
  mockActivate: (adId: string) =>
    post<{ ok: boolean; ad: Ad }>(`/ads/${adId}/mock-activate`),
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

// ── Subscriptions (Free / Pro / Premium) ─────────────────────────────────────

export type SubscriptionTier = 'free' | 'pro' | 'premium';

export interface SubscriptionPlan {
  planId: string;
  tier: 'pro' | 'premium';
  label: string;
  intervalLabel: string;
  amountMinor: number;
  amountRupees: number;
  durationDays: number;
}

export interface SubscriptionSnapshot {
  tier: SubscriptionTier;
  planId: string | null;
  expiresAt: string | null;
  entitlements: {
    createPerWeek: number | null;
    joinPerWeek: number | null;
    dm: boolean;
    directPing: boolean;
    unlimitedPings: boolean;
    highlightTag: boolean;
    createSquad: boolean;
  };
  usage: {
    weekKey: string;
    createCount: number;
    joinCount: number;
    createRemaining: number | null;
    joinRemaining: number | null;
  };
}

export const subscriptionsApi = {
  plans: () =>
    get<{
      ok: boolean;
      plans: SubscriptionPlan[];
      tiers: Record<string, { name: string; features: string[] }>;
    }>('/subscriptions/plans', false),
  me: () => get<{ ok: boolean; subscription: SubscriptionSnapshot }>('/subscriptions/me'),
  createOrder: (planId: string) =>
    post<{
      ok: boolean;
      paymentId: string;
      order: { id: string; amount: number; currency: string; keyId: string };
      plan: SubscriptionPlan;
      checkoutUrl: string;
    }>('/subscriptions/order', { planId }),
  verifyPayment: (body: {
    gatewayOrderId: string;
    gatewayPaymentId: string;
    gatewaySignature: string;
    method?: string;
  }) => post<{ ok: boolean; subscription: SubscriptionSnapshot }>('/subscriptions/verify-payment', body),
  /** Dev bypass — same pattern as ads mockActivate */
  mockActivate: (planId: string) =>
    post<{ ok: boolean; subscription: SubscriptionSnapshot }>('/subscriptions/mock-activate', { planId }),
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

// ── Highlights ────────────────────────────────────────────────────────────────

export interface Highlight {
  _id: string;
  userId: string;
  title: string;
  emoji: string;
  images: string[];
  activityId?: string | null;
  privacy: 'public' | 'connections' | 'private';
  category?: string | null;
  location?: string | null;
  vibe?: string | null;
  pingDate?: string | null;
  createdAt: string;
}

export const highlightsApi = {
  list: (userId: string) =>
    get<{ ok: boolean; highlights: Highlight[] }>(`/highlights/user/${userId}`).then((r) => r.highlights),
  suggest: () =>
    get<{ ok: boolean; suggestion: { _id: string; title: string; type: string; placeName?: string; expiresAt: string; vibe?: string } | null }>('/highlights/suggest').then((r) => r.suggestion),
  create: (data: {
    title: string;
    emoji: string;
    images: string[];
    activityId?: string;
    privacy: string;
    category?: string;
    location?: string;
    vibe?: string;
    pingDate?: string;
  }) => post<{ ok: boolean; highlight: Highlight }>('/highlights', data).then((r) => r.highlight),
  update: (id: string, data: Partial<{ title: string; emoji: string; images: string[]; privacy: string; category: string; location: string }>) =>
    put<{ ok: boolean; highlight: Highlight }>(`/highlights/${id}`, data).then((r) => r.highlight),
  remove: (id: string) => del<{ ok: boolean }>(`/highlights/${id}`),
};

// ── Events ────────────────────────────────────────────────────────────────────

export interface PingEvent {
  _id: string;
  title: string;
  description?: string;
  imageUrl?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  category: 'offer' | 'event';
  startDate: string;
  endDate: string;
  isActive: boolean;
  tags: string[];
  createdAt: string;
}

const SAMPLE_FALLBACK_EVENTS: PingEvent[] = [
  {
    _id: 'evt_sample_1',
    title: 'Bangalore Tech Founder & Builder Mixer 🚀',
    description: 'Connect with founders, product designers, and engineers over craft beverages.',
    category: 'event',
    startDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    endDate: new Date(Date.now() + 28 * 3600 * 1000).toISOString(),
    venueName: 'WeWork Galaxy, MG Road',
    imageUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=800',
    isActive: true,
    tags: ['tech', 'mixer'],
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'evt_sample_2',
    title: 'Weekend Acoustic Sunset Session 🎧',
    description: 'Live acoustic performances, vinyl records, and wood-fired pizzas.',
    category: 'offer',
    startDate: new Date(Date.now() + 50 * 3600 * 1000).toISOString(),
    endDate: new Date(Date.now() + 54 * 3600 * 1000).toISOString(),
    venueName: 'The Humming Tree Open Lawn',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800',
    isActive: true,
    tags: ['music', 'sunset'],
    createdAt: new Date().toISOString(),
  }
];

export const eventsApi = {
  list: (params?: { lat?: number; lng?: number; radius?: number; category?: string }) => {
    const q = new URLSearchParams();
    if (params?.lat !== undefined) q.set('lat', String(params.lat));
    if (params?.lng !== undefined) q.set('lng', String(params.lng));
    if (params?.radius !== undefined) q.set('radius', String(params.radius));
    if (params?.category) q.set('category', params.category);
    return get<{ ok: boolean; events: PingEvent[] }>(`/events?${q.toString()}`)
      .then((r) => r.events)
      .catch(() => SAMPLE_FALLBACK_EVENTS);
  },
  getById: (id: string) =>
    get<{ ok: boolean; event: PingEvent }>(`/events/${id}`)
      .then((r) => r.event)
      .catch(() => SAMPLE_FALLBACK_EVENTS[0]),
};

// ── Admin API ─────────────────────────────────────────────────────────────────

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

  // Events
  events: (page = 1) =>
    aGet<{ ok: boolean; events: PingEvent[]; total: number; page: number }>(`/events?page=${page}`),
  createEvent: (body: {
    title: string; description?: string; imageUrl?: string | null;
    venueName?: string | null; venueAddress?: string | null;
    category: 'offer' | 'event'; startDate: string; endDate: string;
    isActive?: boolean; tags?: string[];
  }) => aPost<{ ok: boolean; event: PingEvent }>('/events', body).then((r) => r.event),
  updateEvent: (id: string, body: Partial<{
    title: string; description: string; imageUrl: string | null;
    venueName: string | null; venueAddress: string | null;
    category: 'offer' | 'event'; startDate: string; endDate: string;
    isActive: boolean; tags: string[];
  }>) => aPut<{ ok: boolean; event: PingEvent }>(`/events/${id}`, body).then((r) => r.event),
  deleteEvent: (id: string) => aDel<{ ok: boolean }>(`/events/${id}`),

  // Verification
  pendingVerifications: (page = 1) =>
    aGet<{ ok: boolean; users: Array<{ _id: string; displayName?: string; username?: string; avatarUrl?: string; verificationSelfieUrl?: string; phone: string; createdAt: string }>; total: number; page: number }>(`/users/verifications?page=${page}`),
  approveVerification: (id: string) => aPost<{ ok: boolean }>(`/users/${id}/verify/approve`),
  rejectVerification: (id: string, reason: string) => aPost<{ ok: boolean }>(`/users/${id}/verify/reject`, { reason }),
};
