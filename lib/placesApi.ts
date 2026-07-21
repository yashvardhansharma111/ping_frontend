export interface PlaceSuggestion {
  name: string;
  emoji: string;
}

export interface LocationCategory {
  key: string;
  label: string;
  icon: string;
}

export const LOCATION_CATEGORIES: LocationCategory[] = [
  { key: 'cafes',     label: 'Cafés',    icon: 'cafe-outline'     },
  { key: 'parks',     label: 'Parks',    icon: 'leaf-outline'     },
  { key: 'coworking', label: 'Cowork',   icon: 'laptop-outline'   },
  { key: 'meetup',    label: 'Meetup',   icon: 'people-outline'   },
];

// Maps activity type → best-fit location category
export const ACTIVITY_TO_CATEGORY: Record<string, string> = {
  food:    'cafes',
  study:   'coworking',
  sport:   'parks',
  outdoor: 'parks',
  gaming:  'coworking',
  music:   'meetup',
  meetup:  'meetup',
  custom:  'cafes',
};

export type CategorizedPlaces = Record<string, PlaceSuggestion[]>;

// Tag → category key mapping for client-side bucketing
const TAG_TO_CATEGORY: Record<string, { cat: string; emoji: string }> = {
  cafe:              { cat: 'cafes',     emoji: '☕' },
  coffee_shop:       { cat: 'cafes',     emoji: '☕' },
  park:              { cat: 'parks',     emoji: '🌳' },
  garden:            { cat: 'parks',     emoji: '🌸' },
  nature_reserve:    { cat: 'parks',     emoji: '🌿' },
  coworking:         { cat: 'coworking', emoji: '💼' },
  coworking_space:   { cat: 'coworking', emoji: '💼' },
  library:           { cat: 'coworking', emoji: '📚' },
  bar:               { cat: 'meetup',    emoji: '🍺' },
  pub:               { cat: 'meetup',    emoji: '🍺' },
  restaurant:        { cat: 'meetup',    emoji: '🍽️' },
  food_court:        { cat: 'meetup',    emoji: '🍽️' },
};

const MAX_PER_CATEGORY = 8;

export async function fetchCategorizedPlaces(
  lat: number,
  lng: number,
): Promise<CategorizedPlaces> {
  const overpassQuery = `[out:json][timeout:12];
(
  node["amenity"="cafe"](around:1000,${lat},${lng});
  node["amenity"="coffee_shop"](around:1000,${lat},${lng});
  node["leisure"="park"](around:2500,${lat},${lng});
  node["leisure"="garden"](around:2500,${lat},${lng});
  node["leisure"="nature_reserve"](around:3500,${lat},${lng});
  node["office"="coworking"](around:3000,${lat},${lng});
  node["amenity"="coworking_space"](around:3000,${lat},${lng});
  node["amenity"="library"](around:2000,${lat},${lng});
  node["amenity"="bar"](around:1000,${lat},${lng});
  node["amenity"="pub"](around:1000,${lat},${lng});
  node["amenity"="restaurant"](around:1000,${lat},${lng});
  node["amenity"="food_court"](around:1500,${lat},${lng});
);
out 80;`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 13000);

  try {
    const resp = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(overpassQuery)}`,
      signal: controller.signal,
    });
    if (!resp.ok) return {};
    const json = await resp.json();

    const counts: Record<string, number> = {};
    const seen: Record<string, Set<string>> = {};
    const results: CategorizedPlaces = {};

    for (const el of json.elements ?? []) {
      const name: string | undefined = el.tags?.name;
      if (!name) continue;

      // Find the tag value that matches our mapping
      const tagVal: string =
        el.tags?.amenity ?? el.tags?.leisure ?? el.tags?.office ?? '';

      const mapping = TAG_TO_CATEGORY[tagVal];
      if (!mapping) continue;

      const { cat, emoji } = mapping;

      if (!seen[cat]) seen[cat] = new Set();
      if (!results[cat]) results[cat] = [];

      const nameLower = name.toLowerCase();
      if (seen[cat].has(nameLower)) continue;
      if ((counts[cat] ?? 0) >= MAX_PER_CATEGORY) continue;

      seen[cat].add(nameLower);
      results[cat].push({ name, emoji });
      counts[cat] = (counts[cat] ?? 0) + 1;
    }

    return results;
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
  }
}

// ── Legacy type-based fetcher (used internally if needed) ─────────────────────

const TYPE_QUERIES: Record<string, { tag: string; value: string; emoji: string }[]> = {
  food: [
    { tag: 'amenity', value: 'cafe',        emoji: '☕' },
    { tag: 'amenity', value: 'restaurant',  emoji: '🍽️' },
    { tag: 'amenity', value: 'fast_food',   emoji: '🍔' },
    { tag: 'amenity', value: 'bar',         emoji: '🍺' },
  ],
  study: [
    { tag: 'amenity', value: 'library',     emoji: '📚' },
    { tag: 'amenity', value: 'cafe',        emoji: '☕' },
  ],
  sport: [
    { tag: 'leisure', value: 'sports_centre', emoji: '🏋️' },
    { tag: 'leisure', value: 'pitch',         emoji: '⚽' },
    { tag: 'leisure', value: 'park',          emoji: '🌳' },
    { tag: 'leisure', value: 'fitness_centre', emoji: '💪' },
  ],
  outdoor: [
    { tag: 'leisure', value: 'park',        emoji: '🌳' },
    { tag: 'leisure', value: 'garden',      emoji: '🌸' },
    { tag: 'tourism', value: 'viewpoint',   emoji: '🏔️' },
    { tag: 'leisure', value: 'nature_reserve', emoji: '🌿' },
  ],
  music: [
    { tag: 'amenity', value: 'bar',         emoji: '🍺' },
    { tag: 'amenity', value: 'cafe',        emoji: '☕' },
    { tag: 'amenity', value: 'nightclub',   emoji: '🎵' },
    { tag: 'amenity', value: 'pub',         emoji: '🎸' },
  ],
  gaming: [
    { tag: 'amenity', value: 'cafe',        emoji: '☕' },
    { tag: 'amenity', value: 'library',     emoji: '📚' },
  ],
  meetup: [
    { tag: 'amenity', value: 'cafe',        emoji: '☕' },
    { tag: 'leisure', value: 'park',        emoji: '🌳' },
    { tag: 'amenity', value: 'restaurant',  emoji: '🍽️' },
    { tag: 'amenity', value: 'bar',         emoji: '🍺' },
  ],
  custom: [
    { tag: 'amenity', value: 'cafe',        emoji: '☕' },
    { tag: 'leisure', value: 'park',        emoji: '🌳' },
    { tag: 'amenity', value: 'restaurant',  emoji: '🍽️' },
  ],
};

export async function fetchNearbyPlaces(
  lat: number,
  lng: number,
  activityType: string,
  radiusMeters = 1000,
): Promise<PlaceSuggestion[]> {
  const queries = TYPE_QUERIES[activityType] ?? TYPE_QUERIES.meetup;

  const nodeLines = queries
    .map(({ tag, value }) => `node["${tag}"="${value}"](around:${radiusMeters},${lat},${lng});`)
    .join('');

  const overpassQuery = `[out:json][timeout:8];(${nodeLines});out 15;`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const resp = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(overpassQuery)}`,
      signal: controller.signal,
    });
    if (!resp.ok) return [];
    const json = await resp.json();

    const seen = new Set<string>();
    const results: PlaceSuggestion[] = [];

    for (const el of json.elements ?? []) {
      const name: string | undefined = el.tags?.name;
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());

      const tagVal = el.tags?.amenity ?? el.tags?.leisure ?? el.tags?.tourism ?? '';
      const match = queries.find((q) => q.value === tagVal);
      results.push({ name, emoji: match?.emoji ?? '📍' });

      if (results.length >= 8) break;
    }

    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
