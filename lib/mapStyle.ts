import type { StyleSpecification } from '@maplibre/maplibre-react-native';

// Ping Dark Purple — OpenStreetMap vector tiles via OpenFreeMap (no API key)
// Data: © OpenStreetMap contributors  |  Tiles: openfreemap.org (CC-BY)
export const pingMapStyle: StyleSpecification = {
  version: 8,
  name: 'Ping',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    ofm: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    // ── Canvas ──────────────────────────────────────────────────────────────
    {
      id: 'bg',
      type: 'background',
      paint: { 'background-color': '#060612' },
    },

    // ── Water ───────────────────────────────────────────────────────────────
    {
      id: 'water-fill',
      type: 'fill',
      source: 'ofm',
      'source-layer': 'water',
      paint: { 'fill-color': '#08102A' },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'ofm',
      'source-layer': 'waterway',
      paint: {
        'line-color': '#08102A',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 2.5],
      },
    },

    // ── Land cover ──────────────────────────────────────────────────────────
    {
      id: 'landcover-green',
      type: 'fill',
      source: 'ofm',
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['grass', 'wood', 'scrub', 'park', 'pitch']]],
      paint: { 'fill-color': '#07100A', 'fill-opacity': 0.85 },
    },
    {
      id: 'landcover-sand',
      type: 'fill',
      source: 'ofm',
      'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'sand'],
      paint: { 'fill-color': '#0D0B07', 'fill-opacity': 0.6 },
    },

    // ── Land use ────────────────────────────────────────────────────────────
    {
      id: 'landuse-residential',
      type: 'fill',
      source: 'ofm',
      'source-layer': 'landuse',
      filter: ['==', ['get', 'class'], 'residential'],
      paint: { 'fill-color': '#080815', 'fill-opacity': 0.5 },
    },
    {
      id: 'landuse-industrial',
      type: 'fill',
      source: 'ofm',
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['industrial', 'commercial', 'retail']]],
      paint: { 'fill-color': '#0C0C1F', 'fill-opacity': 0.6 },
    },

    // ── Buildings ───────────────────────────────────────────────────────────
    {
      id: 'building',
      type: 'fill',
      source: 'ofm',
      'source-layer': 'building',
      minzoom: 13,
      paint: {
        'fill-color': '#0E0E28',
        'fill-outline-color': '#1A1A3C',
      },
    },

    // ── Roads — casings (outer glow/border) ─────────────────────────────────
    {
      id: 'road-casing-major',
      type: 'line',
      source: 'ofm',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#160840',
        'line-width': ['interpolate', ['linear'], ['zoom'],
          5, 1, 8, 3, 12, 7, 16, 15, 20, 32],
        'line-blur': 1,
      },
    },
    {
      id: 'road-casing-secondary',
      type: 'line',
      source: 'ofm',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#100620',
        'line-width': ['interpolate', ['linear'], ['zoom'],
          8, 1, 12, 3.5, 16, 8],
      },
    },

    // ── Roads — fill ────────────────────────────────────────────────────────
    {
      id: 'road-minor',
      type: 'line',
      source: 'ofm',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'residential', 'unclassified', 'track']]],
      minzoom: 12,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#13082E',
        'line-width': ['interpolate', ['linear'], ['zoom'],
          12, 0.5, 16, 3, 20, 8],
      },
    },
    {
      id: 'road-tertiary',
      type: 'line',
      source: 'ofm',
      'source-layer': 'transportation',
      filter: ['==', ['get', 'class'], 'tertiary'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#1E0D48',
        'line-width': ['interpolate', ['linear'], ['zoom'],
          9, 0.4, 12, 1.5, 16, 4, 20, 10],
      },
    },
    {
      id: 'road-secondary',
      type: 'line',
      source: 'ofm',
      'source-layer': 'transportation',
      filter: ['==', ['get', 'class'], 'secondary'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#261060',
        'line-width': ['interpolate', ['linear'], ['zoom'],
          8, 0.5, 12, 2, 16, 6, 20, 13],
      },
    },
    {
      id: 'road-primary',
      type: 'line',
      source: 'ofm',
      'source-layer': 'transportation',
      filter: ['==', ['get', 'class'], 'primary'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#3D1580',
        'line-width': ['interpolate', ['linear'], ['zoom'],
          6, 0.4, 10, 1.8, 14, 5, 18, 11],
      },
    },
    {
      id: 'road-trunk',
      type: 'line',
      source: 'ofm',
      'source-layer': 'transportation',
      filter: ['==', ['get', 'class'], 'trunk'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#4C1D95',
        'line-width': ['interpolate', ['linear'], ['zoom'],
          6, 0.5, 10, 2.2, 14, 6, 18, 13],
      },
    },
    {
      id: 'road-motorway',
      type: 'line',
      source: 'ofm',
      'source-layer': 'transportation',
      filter: ['==', ['get', 'class'], 'motorway'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#6D28D9',
        'line-width': ['interpolate', ['linear'], ['zoom'],
          5, 0.5, 8, 1.8, 12, 5, 16, 11, 20, 25],
      },
    },

    // ── Paths / pedestrian ──────────────────────────────────────────────────
    {
      id: 'road-path',
      type: 'line',
      source: 'ofm',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['path', 'footway', 'pedestrian', 'cycleway']]],
      minzoom: 14,
      paint: {
        'line-color': '#1A0F3A',
        'line-width': 0.8,
        'line-dasharray': [3, 2],
      },
    },

    // ── Administrative boundaries ──────────────────────────────────────────
    {
      id: 'boundary-country',
      type: 'line',
      source: 'ofm',
      'source-layer': 'boundary',
      filter: ['==', ['get', 'admin_level'], 2],
      paint: {
        'line-color': 'rgba(139, 92, 246, 0.65)',
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.8, 6, 1.2, 10, 1.8],
        'line-dasharray': [4, 3],
      },
    },
    {
      id: 'boundary-state',
      type: 'line',
      source: 'ofm',
      'source-layer': 'boundary',
      filter: ['==', ['get', 'admin_level'], 4],
      minzoom: 4,
      paint: {
        'line-color': 'rgba(109, 62, 216, 0.45)',
        'line-width': 0.9,
        'line-dasharray': [6, 4],
      },
    },

    // ── Labels ──────────────────────────────────────────────────────────────
    {
      id: 'road-label',
      type: 'symbol',
      source: 'ofm',
      'source-layer': 'transportation_name',
      minzoom: 11,
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']]],
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-font': ['Open Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 11, 9.5, 16, 12.5],
        'symbol-placement': 'line',
        'text-max-angle': 35,
        'text-letter-spacing': 0.03,
      },
      paint: {
        'text-color': '#7C5CBD',
        'text-halo-color': '#060612',
        'text-halo-width': 1.5,
      },
    },
    {
      id: 'place-suburb',
      type: 'symbol',
      source: 'ofm',
      'source-layer': 'place',
      minzoom: 13,
      filter: ['in', ['get', 'class'], ['literal', ['suburb', 'neighbourhood', 'quarter']]],
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-font': ['Open Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 17, 13],
      },
      paint: {
        'text-color': '#6B5BA8',
        'text-halo-color': '#060612',
        'text-halo-width': 1.5,
      },
    },
    {
      id: 'place-village',
      type: 'symbol',
      source: 'ofm',
      'source-layer': 'place',
      minzoom: 9,
      filter: ['in', ['get', 'class'], ['literal', ['village', 'hamlet']]],
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-font': ['Open Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 9, 11, 15, 14],
      },
      paint: {
        'text-color': '#7C6CBD',
        'text-halo-color': '#060612',
        'text-halo-width': 2,
      },
    },
    {
      id: 'place-town-city',
      type: 'symbol',
      source: 'ofm',
      'source-layer': 'place',
      filter: ['in', ['get', 'class'], ['literal', ['town', 'city']]],
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-font': ['Open Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 11, 10, 14, 14, 18],
        'text-anchor': 'center',
        'text-max-width': 8,
      },
      paint: {
        'text-color': '#A78BFA',
        'text-halo-color': '#060612',
        'text-halo-width': 2.5,
      },
    },
    {
      id: 'place-state',
      type: 'symbol',
      source: 'ofm',
      'source-layer': 'place',
      filter: ['==', ['get', 'class'], 'state'],
      minzoom: 4,
      maxzoom: 9,
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-font': ['Open Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 8, 12],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.1,
      },
      paint: {
        'text-color': '#7C5CBD',
        'text-halo-color': '#060612',
        'text-halo-width': 1.5,
        'text-opacity': 0.85,
      },
    },
    {
      id: 'place-country',
      type: 'symbol',
      source: 'ofm',
      'source-layer': 'place',
      filter: ['==', ['get', 'class'], 'country'],
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-font': ['Open Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 2, 9, 6, 13, 8, 17],
        'text-anchor': 'center',
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.15,
        'text-max-width': 6,
      },
      paint: {
        'text-color': '#8B7CC8',
        'text-halo-color': '#060612',
        'text-halo-width': 2,
      },
    },
  ],
};
