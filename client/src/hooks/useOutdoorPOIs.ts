import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { escapeHtml } from '@/lib/escapeHtml';

interface OutdoorPOI {
  id: number;
  lat: number;
  lon: number;
  category: string;
  type: string;
  name: string;
  elevation?: number;
  capacity?: number;
  operator?: string;
  fee?: string;
  amenities?: string[];
  description?: string;
  website?: string;
  phone?: string;
}

interface CachedBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  campsite: '#2E7D32',
  shelter: '#5D4037',
  water: '#1565C0',
  trailhead: '#E65100',
  guidepost: '#6A1B9A',
};

const CATEGORY_LABELS: Record<string, string> = {
  campsite: 'Campsite',
  shelter: 'Shelter / Hut',
  water: 'Water Source',
  trailhead: 'Trailhead',
  guidepost: 'Guidepost',
};

const SOURCE_ID = 'outdoor-pois-source';
const CIRCLE_LAYER_ID = 'outdoor-pois-circles';
const LABEL_LAYER_ID = 'outdoor-pois-labels';

function boundsContain(cached: CachedBounds, query: CachedBounds): boolean {
  return (
    cached.south <= query.south &&
    cached.west <= query.west &&
    cached.north >= query.north &&
    cached.east >= query.east
  );
}

function buildPopupHTML(poi: OutdoorPOI): string {
  const categoryLabel = CATEGORY_LABELS[poi.category] || poi.category;
  const color = CATEGORY_COLORS[poi.category] || '#555';

  let html = `<div style="padding:10px;min-width:200px;max-width:280px;">`;
  html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">`;
  html += `<span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>`;
  html += `<span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(categoryLabel)}</span>`;
  html += `</div>`;

  html += `<h3 style="margin:0 0 8px 0;color:#1f2937;font-weight:600;font-size:14px;">${escapeHtml(poi.name || 'Unnamed')}</h3>`;

  if (poi.type) {
    html += `<div style="font-size:12px;color:#6b7280;margin-bottom:4px;"><strong>Type:</strong> ${escapeHtml(poi.type)}</div>`;
  }
  if (poi.elevation != null) {
    const ft = Math.round(poi.elevation * 3.28084);
    html += `<div style="font-size:12px;color:#6b7280;margin-bottom:4px;"><strong>Elevation:</strong> ${ft.toLocaleString()} ft (${Math.round(poi.elevation)} m)</div>`;
  }
  if (poi.capacity != null) {
    html += `<div style="font-size:12px;color:#6b7280;margin-bottom:4px;"><strong>Capacity:</strong> ${escapeHtml(String(poi.capacity))}</div>`;
  }
  if (poi.operator) {
    html += `<div style="font-size:12px;color:#6b7280;margin-bottom:4px;"><strong>Operator:</strong> ${escapeHtml(poi.operator)}</div>`;
  }
  if (poi.fee) {
    html += `<div style="font-size:12px;color:#6b7280;margin-bottom:4px;"><strong>Fee:</strong> ${escapeHtml(poi.fee)}</div>`;
  }
  if (poi.amenities && poi.amenities.length > 0) {
    html += `<div style="font-size:12px;color:#6b7280;margin-bottom:4px;"><strong>Amenities:</strong> ${escapeHtml(poi.amenities.join(', '))}</div>`;
  }
  if (poi.description) {
    html += `<div style="font-size:12px;color:#6b7280;margin-bottom:4px;"><strong>Info:</strong> ${escapeHtml(poi.description)}</div>`;
  }
  if (poi.website) {
    html += `<div style="font-size:12px;margin-bottom:4px;"><a href="${escapeHtml(poi.website)}" target="_blank" rel="noopener noreferrer" style="color:#3b82f6;">Website</a></div>`;
  }

  html += `<div style="font-size:11px;color:#9ca3af;margin-top:6px;">${poi.lat.toFixed(5)}°N, ${Math.abs(poi.lon).toFixed(5)}°${poi.lon < 0 ? 'W' : 'E'}</div>`;
  html += `</div>`;
  return html;
}

export function useOutdoorPOIs(
  map: mapboxgl.Map | null,
  enabled: boolean
) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cachedBoundsRef = useRef<CachedBounds[]>([]);
  const allPOIsRef = useRef<OutdoorPOI[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const clearLayers = useCallback(() => {
    if (!map) return;
    try {
      if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
      if (map.getLayer(CIRCLE_LAYER_ID)) map.removeLayer(CIRCLE_LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    } catch (e) {}
    popupRef.current?.remove();
  }, [map]);

  const updateSource = useCallback((pois: OutdoorPOI[]) => {
    if (!map) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: pois.map(poi => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [poi.lon, poi.lat],
        },
        properties: {
          id: poi.id,
          category: poi.category,
          type: poi.type,
          name: poi.name || '',
          elevation: poi.elevation ?? null,
          capacity: poi.capacity ?? null,
          operator: poi.operator || '',
          fee: poi.fee || '',
          amenities: JSON.stringify(poi.amenities || []),
          description: poi.description || '',
          website: poi.website || '',
          phone: poi.phone || '',
          lat: poi.lat,
          lon: poi.lon,
        },
      })),
    };

    if (map.getSource(SOURCE_ID)) {
      (map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource).setData(geojson);
    } else {
      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });

      map.addLayer({
        id: CIRCLE_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            10, 4,
            14, 7,
            18, 10,
          ],
          'circle-color': [
            'match', ['get', 'category'],
            'campsite', CATEGORY_COLORS.campsite,
            'shelter', CATEGORY_COLORS.shelter,
            'water', CATEGORY_COLORS.water,
            'trailhead', CATEGORY_COLORS.trailhead,
            'guidepost', CATEGORY_COLORS.guidepost,
            '#555',
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        },
      });

      map.addLayer({
        id: LABEL_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        minzoom: 12,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-max-width': 10,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#1f2937',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      });
    }
  }, [map]);

  const fetchPOIs = useCallback(async () => {
    if (!map || !enabled) return;

    const zoom = map.getZoom();
    if (zoom < 10) {
      allPOIsRef.current = [];
      updateSource([]);
      return;
    }

    const bounds = map.getBounds();
    if (!bounds) return;
    const queryBounds: CachedBounds = {
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    };

    const alreadyCached = cachedBoundsRef.current.some(cb => boundsContain(cb, queryBounds));
    if (alreadyCached) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const params = new URLSearchParams({
        south: queryBounds.south.toFixed(6),
        west: queryBounds.west.toFixed(6),
        north: queryBounds.north.toFixed(6),
        east: queryBounds.east.toFixed(6),
      });

      const response = await fetch(`/api/outdoor-pois?${params}`, {
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const pois: OutdoorPOI[] = await response.json();

      cachedBoundsRef.current.push(queryBounds);
      if (cachedBoundsRef.current.length > 20) {
        cachedBoundsRef.current = cachedBoundsRef.current.slice(-10);
      }

      const existingIds = new Set(allPOIsRef.current.map(p => p.id));
      const newPOIs = pois.filter(p => !existingIds.has(p.id));
      allPOIsRef.current = [...allPOIsRef.current, ...newPOIs];

      updateSource(allPOIsRef.current);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Failed to fetch outdoor POIs:', err);
    }
  }, [map, enabled, updateSource]);

  const debouncedFetch = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(fetchPOIs, 500);
  }, [fetchPOIs]);

  useEffect(() => {
    if (!map) return;

    if (!enabled) {
      clearLayers();
      allPOIsRef.current = [];
      cachedBoundsRef.current = [];
      abortControllerRef.current?.abort();
      return;
    }

    const onMoveEnd = () => debouncedFetch();

    fetchPOIs();

    map.on('moveend', onMoveEnd);

    const onCircleClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
      const props = feature.properties!;

      const poi: OutdoorPOI = {
        id: props.id,
        lat: props.lat,
        lon: props.lon,
        category: props.category,
        type: props.type,
        name: props.name,
        elevation: props.elevation != null && props.elevation !== '' ? Number(props.elevation) : undefined,
        capacity: props.capacity != null && props.capacity !== '' ? Number(props.capacity) : undefined,
        operator: props.operator || undefined,
        fee: props.fee || undefined,
        amenities: props.amenities ? JSON.parse(props.amenities) : undefined,
        description: props.description || undefined,
        website: props.website || undefined,
        phone: props.phone || undefined,
      };

      popupRef.current?.remove();
      popupRef.current = new mapboxgl.Popup({ offset: 12, closeButton: true, maxWidth: '300px' })
        .setLngLat(coords)
        .setHTML(buildPopupHTML(poi))
        .addTo(map);
    };

    const onMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const onMouseLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', CIRCLE_LAYER_ID, onCircleClick);
    map.on('mouseenter', CIRCLE_LAYER_ID, onMouseEnter);
    map.on('mouseleave', CIRCLE_LAYER_ID, onMouseLeave);

    return () => {
      map.off('moveend', onMoveEnd);
      map.off('click', CIRCLE_LAYER_ID, onCircleClick);
      map.off('mouseenter', CIRCLE_LAYER_ID, onMouseEnter);
      map.off('mouseleave', CIRCLE_LAYER_ID, onMouseLeave);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      abortControllerRef.current?.abort();
      popupRef.current?.remove();
    };
  }, [map, enabled, fetchPOIs, debouncedFetch, clearLayers]);

  useEffect(() => {
    return () => {
      clearLayers();
      allPOIsRef.current = [];
      cachedBoundsRef.current = [];
    };
  }, [clearLayers]);
}
