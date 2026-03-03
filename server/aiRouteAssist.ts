import Anthropic from '@anthropic-ai/sdk';

function getAnthropicClient(): Anthropic {
  const rawApiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  let apiKey = rawApiKey;
  const match = rawApiKey.match(/sk-ant-[A-Za-z0-9_-]{20,}/);
  if (match) {
    apiKey = match[0];
  }
  if (apiKey.length > 300 || !apiKey.startsWith('sk-ant-')) {
    console.error(`[AI Route Assist] ANTHROPIC_API_KEY is invalid (length=${rawApiKey.length}, starts="${rawApiKey.substring(0, 15)}"). Please set it to your actual Anthropic API key (starts with sk-ant-).`);
  }
  return new Anthropic({ apiKey });
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function sanitizeForApi(text: string): string {
  return text
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/\u00B0/g, ' deg')
    .replace(/\u00B7/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u2032/g, "'")
    .replace(/\u2033/g, '"')
    .replace(/\u00E9/g, 'e')
    .replace(/\u00F1/g, 'n')
    .replace(/[^\x00-\x7F]/g, ' ');
}

async function geocodeLocation(query: string): Promise<Array<{
  name: string;
  lat: number;
  lng: number;
  fullName: string;
  relevance: number;
}>> {
  const token = process.env.MAPBOX_ACCESS_TOKEN || process.env.VITE_MAPBOX_ACCESS_TOKEN;
  if (!token) return [];

  try {
    const encoded = encodeURIComponent(query);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&limit=5&types=poi,place,locality,neighborhood,region`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return [];

    const data = await response.json();
    if (!data.features || data.features.length === 0) return [];

    return data.features.map((f: any) => ({
      name: f.text,
      lat: f.center[1],
      lng: f.center[0],
      fullName: f.place_name,
      relevance: f.relevance,
    }));
  } catch (e) {
    console.error('[AI Route Assist] Geocoding error:', e);
    return [];
  }
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RouteAssistRequest {
  message: string;
  activityType: 'hiking' | 'downhill_skiing' | 'xc_skiing' | 'mountain_biking' | 'trail_running' | 'general';
  mapCenter: { lat: number; lng: number };
  mapZoom: number;
  conversationHistory: ChatMessage[];
  existingRoute?: {
    name: string;
    waypoints: Array<{ name: string; lat: number; lng: number; elevation?: number }>;
    totalDistance: number;
    elevationGain: number;
    elevationLoss: number;
    routingMode: string;
  };
}

interface SuggestedWaypoint {
  name: string;
  lat: number;
  lng: number;
  description?: string;
}

interface RouteOption {
  label: string;
  source: 'trail_data' | 'community';
  description: string;
  color: string;
  waypoints: SuggestedWaypoint[];
  communityRouteId?: number;
  communityAuthor?: string;
}

interface RouteAssistResponse {
  message: string;
  routeOptions?: RouteOption[];
  flyToCenter?: { lat: number; lng: number; name: string };
}

async function fetchTrailDataForArea(
  center: { lat: number; lng: number },
  zoom: number,
  activityType: string,
  overrideRadiusDeg?: number
): Promise<string> {
  const radiusDeg = overrideRadiusDeg || Math.max(0.02, 0.5 / Math.pow(2, Math.max(0, zoom - 10)));
  const south = center.lat - radiusDeg;
  const north = center.lat + radiusDeg;
  const west = center.lng - radiusDeg;
  const east = center.lng + radiusDeg;

  let wayFilters = '';
  switch (activityType) {
    case 'downhill_skiing':
      wayFilters = `
        way["piste:type"="downhill"](${south},${west},${north},${east});
        way["aerialway"](${south},${west},${north},${east});
        node["aerialway"="station"](${south},${west},${north},${east});
      `;
      break;
    case 'xc_skiing':
      wayFilters = `
        way["piste:type"="nordic"](${south},${west},${north},${east});
        way["piste:type"="skitour"](${south},${west},${north},${east});
        way["highway"="path"]["piste:type"](${south},${west},${north},${east});
        way["landuse"="winter_sports"](${south},${west},${north},${east});
      `;
      break;
    case 'mountain_biking':
      wayFilters = `
        way["highway"="path"]["mtb:scale"](${south},${west},${north},${east});
        way["highway"="track"](${south},${west},${north},${east});
        way["highway"="path"]["bicycle"!="no"](${south},${west},${north},${east});
        way["route"="mtb"](${south},${west},${north},${east});
      `;
      break;
    case 'trail_running':
    case 'hiking':
    default:
      wayFilters = `
        way["highway"="path"](${south},${west},${north},${east});
        way["highway"="footway"](${south},${west},${north},${east});
        way["highway"="track"](${south},${west},${north},${east});
        way["highway"="bridleway"](${south},${west},${north},${east});
        way["route"="hiking"](${south},${west},${north},${east});
        way["sac_scale"](${south},${west},${north},${east});
      `;
      break;
  }

  const query = `
    [out:json][timeout:60];
    (
      ${wayFilters}
      node["natural"="peak"](${south},${west},${north},${east});
      node["natural"="saddle"](${south},${west},${north},${east});
      node["tourism"~"viewpoint|alpine_hut"](${south},${west},${north},${east});
      node["amenity"="parking"]["access"!="private"](${south},${west},${north},${east});
    );
    out body;
    >;
    out skel qt;
  `;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) continue;
      const data = await response.json();
      if (!data.elements || data.elements.length === 0) {
        return 'No trail data found in this area from OpenStreetMap.';
      }
      return summarizeTrailData(data, activityType);
    } catch (e) {
      console.error(`Overpass fetch failed (${endpoint}):`, e);
      continue;
    }
  }
  return 'Unable to fetch trail data. Overpass API may be temporarily unavailable.';
}

function summarizeTrailData(osmData: any, activityType: string): string {
  const nodes = new Map<number, { lat: number; lon: number; tags?: any }>();
  const ways: Array<{ name: string; type: string; tags: any; nodeIds: number[] }> = [];
  const pois: Array<{ name: string; type: string; lat: number; lon: number; ele?: string }> = [];

  for (const el of osmData.elements) {
    if (el.type === 'node') {
      nodes.set(el.id, { lat: el.lat, lon: el.lon, tags: el.tags });
      if (el.tags?.name) {
        const poiType = el.tags.natural || el.tags.tourism || el.tags.amenity || el.tags.aerialway || 'point';
        pois.push({ name: el.tags.name, type: poiType, lat: el.lat, lon: el.lon, ele: el.tags.ele });
      }
    }
  }

  for (const el of osmData.elements) {
    if (el.type === 'way' && el.tags) {
      const name = el.tags.name || el.tags.ref || 'Unnamed trail';
      const type = el.tags['piste:type'] || el.tags.highway || el.tags.aerialway || el.tags.route || 'way';
      ways.push({ name, type, tags: el.tags, nodeIds: el.nodes || [] });
    }
  }

  const lines: string[] = [];
  lines.push(`=== OPENSTREETMAP TRAIL DATA (${activityType}) ===`);
  lines.push(`Trails/ways: ${ways.length} | Points of interest: ${pois.length}`);
  lines.push('');

  const trailsByName = new Map<string, typeof ways[0][]>();
  for (const way of ways) {
    if (!trailsByName.has(way.name)) trailsByName.set(way.name, []);
    trailsByName.get(way.name)!.push(way);
  }

  lines.push('--- NAMED TRAILS ---');
  for (const [name, segments] of Array.from(trailsByName.entries())) {
    if (name === 'Unnamed trail') continue;
    const types = Array.from(new Set(segments.map(s => s.type))).join(', ');
    const tags = segments[0].tags;
    let detail = `- ${name} (${types})`;
    if (tags.sac_scale) detail += ` [difficulty: ${tags.sac_scale}]`;
    if (tags['piste:difficulty']) detail += ` [difficulty: ${tags['piste:difficulty']}]`;
    if (tags['piste:grooming']) detail += ` [grooming: ${tags['piste:grooming']}]`;
    if (tags.surface) detail += ` [surface: ${tags.surface}]`;
    if (tags.trail_visibility) detail += ` [visibility: ${tags.trail_visibility}]`;
    if (tags.mtb_scale) detail += ` [MTB scale: ${tags.mtb_scale}]`;

    let totalLength = 0;
    for (const seg of segments) {
      for (let i = 0; i < seg.nodeIds.length - 1; i++) {
        const a = nodes.get(seg.nodeIds[i]);
        const b = nodes.get(seg.nodeIds[i + 1]);
        if (a && b) {
          const R = 6371000;
          const dLat = (b.lat - a.lat) * Math.PI / 180;
          const dLon = (b.lon - a.lon) * Math.PI / 180;
          const sin2 = Math.sin(dLat / 2) ** 2 +
            Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
          totalLength += R * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
        }
      }
    }
    if (totalLength > 0) detail += ` [~${(totalLength / 1609.34).toFixed(1)} mi]`;

    if (segments[0].nodeIds.length > 0) {
      const startNode = nodes.get(segments[0].nodeIds[0]);
      const lastSeg = segments[segments.length - 1];
      const endNode = nodes.get(lastSeg.nodeIds[lastSeg.nodeIds.length - 1]);
      if (startNode) detail += ` [starts: ${startNode.lat.toFixed(5)}, ${startNode.lon.toFixed(5)}]`;
      if (endNode) detail += ` [ends: ${endNode.lat.toFixed(5)}, ${endNode.lon.toFixed(5)}]`;
    }
    lines.push(detail);
  }

  const unnamed = trailsByName.get('Unnamed trail');
  if (unnamed) lines.push(`- Plus ${unnamed.length} unnamed trail segments`);

  lines.push('');
  lines.push('--- POINTS OF INTEREST ---');
  for (const poi of pois) {
    let detail = `- ${poi.name} (${poi.type})`;
    if (poi.ele) detail += ` [elevation: ${Math.round(parseFloat(poi.ele) * 3.28084).toLocaleString()} ft / ${poi.ele}m]`;
    detail += ` [location: ${poi.lat.toFixed(5)}, ${poi.lon.toFixed(5)}]`;
    lines.push(detail);
  }

  return lines.join('\n');
}

interface CommunityRoute {
  id: number;
  name: string;
  description: string | null;
  notes: string | null;
  totalDistance: string | null;
  elevationGain: string | null;
  elevationLoss: string | null;
  estimatedTime: number | null;
  routingMode: string;
  waypoints: Array<{ name: string; lngLat: [number, number]; elevation?: number }>;
  ownerUsername: string;
  ownerFullName: string | null;
  routeNotes: Array<{ category: string; content: string }>;
  pointsOfInterest: Array<{ name: string; lat: number; lng: number; note?: string; elevation?: number }>;
}

export async function fetchCommunityRoutes(
  center: { lat: number; lng: number },
  radiusDeg: number,
  dbStorage: any
): Promise<CommunityRoute[]> {
  try {
    const publicRoutes = await dbStorage.getPublicRoutesWithOwners();
    if (!publicRoutes || publicRoutes.length === 0) return [];

    const south = center.lat - radiusDeg;
    const north = center.lat + radiusDeg;
    const west = center.lng - radiusDeg;
    const east = center.lng + radiusDeg;

    const nearbyRoutes: CommunityRoute[] = [];

    for (const route of publicRoutes) {
      let waypoints: Array<{ name: string; lngLat: [number, number]; elevation?: number }> = [];
      try {
        if (route.waypointCoordinates) {
          waypoints = JSON.parse(route.waypointCoordinates);
        }
      } catch { continue; }

      if (waypoints.length === 0) {
        try {
          const path = JSON.parse(route.pathCoordinates);
          if (path.length > 0) {
            const mid = path[Math.floor(path.length / 2)];
            const [lng, lat] = Array.isArray(mid) ? mid : [mid.lng || mid[0], mid.lat || mid[1]];
            if (lat < south || lat > north || lng < west || lng > east) continue;
          }
        } catch { continue; }
      } else {
        const isNearby = waypoints.some(wp => {
          const [lng, lat] = wp.lngLat;
          return lat >= south && lat <= north && lng >= west && lng <= east;
        });
        if (!isNearby) continue;
      }

      let routeNotes: Array<{ category: string; content: string }> = [];
      let pointsOfInterest: Array<{ name: string; lat: number; lng: number; note?: string; elevation?: number }> = [];

      try {
        const notes = await dbStorage.getRouteNotes(route.id);
        routeNotes = notes.map((n: any) => ({ category: n.category, content: n.content || '' }));
      } catch {}

      try {
        const pois = await dbStorage.getRoutePointsOfInterest(route.id);
        pointsOfInterest = pois.map((p: any) => ({
          name: p.name,
          lat: parseFloat(p.latitude),
          lng: parseFloat(p.longitude),
          note: p.note || undefined,
          elevation: p.elevation ? parseFloat(p.elevation) : undefined,
        }));
      } catch {}

      nearbyRoutes.push({
        id: route.id,
        name: route.name,
        description: route.description,
        notes: route.notes,
        totalDistance: route.totalDistance,
        elevationGain: route.elevationGain,
        elevationLoss: route.elevationLoss,
        estimatedTime: route.estimatedTime,
        routingMode: route.routingMode,
        waypoints,
        ownerUsername: route.owner.username,
        ownerFullName: route.owner.fullName,
        routeNotes,
        pointsOfInterest,
      });
    }

    console.log(`[AI Route Assist] Found ${nearbyRoutes.length} community routes nearby (out of ${publicRoutes.length} total public)`);
    return nearbyRoutes;
  } catch (error) {
    console.error('[AI Route Assist] Error fetching community routes:', error);
    return [];
  }
}

function summarizeCommunityRoutes(routes: CommunityRoute[]): string {
  if (routes.length === 0) {
    return '=== SESSION MAPS COMMUNITY ROUTES ===\nNo public routes from other Session Maps users found in this area.\n';
  }

  const lines: string[] = [];
  lines.push(`=== SESSION MAPS COMMUNITY ROUTES (${routes.length} found) ===`);
  lines.push('These are routes created and shared by real Session Maps users who have actually done these routes.');
  lines.push('Community routes have GPS-verified waypoints and often include personal notes about conditions, difficulty, and tips.');
  lines.push('');

  for (const route of routes) {
    const distMiles = route.totalDistance ? (parseFloat(route.totalDistance) / 1609.34).toFixed(1) : '?';
    const gainFeet = route.elevationGain ? Math.round(parseFloat(route.elevationGain) * 3.28084) : null;
    const lossFeet = route.elevationLoss ? Math.round(parseFloat(route.elevationLoss) * 3.28084) : null;

    lines.push(`--- Route: "${route.name}" (by @${route.ownerUsername}) [ID: ${route.id}] ---`);
    if (route.description) lines.push(`  Description: ${route.description}`);
    lines.push(`  Distance: ${distMiles} mi | Mode: ${route.routingMode}`);
    if (gainFeet !== null) lines.push(`  Elevation: +${gainFeet.toLocaleString()} ft / -${(lossFeet || 0).toLocaleString()} ft`);
    if (route.estimatedTime) lines.push(`  Estimated time: ${route.estimatedTime} min`);

    if (route.waypoints.length > 0) {
      lines.push(`  Waypoints (${route.waypoints.length}):`);
      for (const wp of route.waypoints) {
        const [lng, lat] = wp.lngLat;
        const eleFeet = wp.elevation ? Math.round(wp.elevation * 3.28084) : null;
        lines.push(`    - ${wp.name} (${lat.toFixed(5)}, ${lng.toFixed(5)})${eleFeet ? ` [${eleFeet.toLocaleString()} ft]` : ''}`);
      }
    }

    if (route.notes) {
      lines.push(`  Creator's notes: ${route.notes.substring(0, 300)}${route.notes.length > 300 ? '...' : ''}`);
    }

    if (route.routeNotes.length > 0) {
      lines.push(`  Detailed notes:`);
      for (const note of route.routeNotes) {
        if (note.content) {
          lines.push(`    [${note.category}]: ${note.content.substring(0, 200)}${note.content.length > 200 ? '...' : ''}`);
        }
      }
    }

    if (route.pointsOfInterest.length > 0) {
      lines.push(`  Points of Interest marked by creator:`);
      for (const poi of route.pointsOfInterest) {
        lines.push(`    * ${poi.name} (${poi.lat.toFixed(5)}, ${poi.lng.toFixed(5)})${poi.note ? ` -- ${poi.note}` : ''}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

function buildSystemPrompt(
  activityType: string,
  trailData: string,
  communityData: string,
  geocodeResults: string,
  existingRoute?: RouteAssistRequest['existingRoute']
): string {
  let activityContext = '';
  switch (activityType) {
    case 'downhill_skiing':
      activityContext = 'The user is planning a downhill skiing session. Focus on ski runs, lifts, difficulty ratings (green/blue/black/double-black), and efficient lift-to-run sequencing.';
      break;
    case 'xc_skiing':
      activityContext = 'The user is planning a cross-country skiing outing. Focus on groomed Nordic trails, classic vs skate lanes, trail difficulty, and loop options.';
      break;
    case 'mountain_biking':
      activityContext = 'The user is planning a mountain bike ride. Focus on singletrack, MTB difficulty ratings, trail surface, climbing vs descending.';
      break;
    case 'trail_running':
      activityContext = 'The user is planning a trail run. Focus on runnable surfaces, elevation gain, distance targets, and loop vs out-and-back.';
      break;
    case 'hiking':
    default:
      activityContext = 'The user is planning a hike. Focus on trail conditions, elevation, scenic points, difficulty, distance, and estimated time.';
      break;
  }

  let existingRouteContext = '';
  if (existingRoute) {
    const distMiles = (existingRoute.totalDistance / 1609.34).toFixed(1);
    const gainFeet = Math.round(existingRoute.elevationGain * 3.28084);
    const lossFeet = Math.round(existingRoute.elevationLoss * 3.28084);
    existingRouteContext = `
THE USER HAS AN EXISTING ROUTE LOADED:
- Name: ${existingRoute.name}
- Distance: ${distMiles} miles
- Elevation: +${gainFeet} ft / -${lossFeet} ft
- Routing mode: ${existingRoute.routingMode}
- Waypoints: ${existingRoute.waypoints.map(wp => `${wp.name} (${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)})`).join(' -> ')}
You can suggest modifications or alternatives.
`;
  }

  return `You are an expert outdoor route planning assistant for Session Maps. You help users build routes for hiking, skiing, biking, and trail running.

${activityContext}

YOU HAVE ACCESS TO THESE DATA SOURCES:
1. **OpenStreetMap trail data** -- real trail network data with names, types, difficulty, and coordinates
2. **Session Maps community routes** -- routes shared by other users with GPS-verified waypoints and personal notes
3. **Geocoding results** -- location matches for places the user mentioned

YOUR BEHAVIOR RULES:

**RULE 1: BE CONVERSATIONAL**
- If the user's request is vague, ASK CLARIFYING QUESTIONS before building a route.
- Good questions: "How long of a hike are you looking for?", "Do you want a loop or out-and-back?", "What difficulty level?"
- If a location is ambiguous (e.g. multiple places with same name), present the options and ask which one.
- When asking questions, do NOT include any route_option blocks. Just ask your questions.

**RULE 2: SEARCH GLOBALLY**
- You are NOT limited to what's on the user's screen. The trail data provided covers the area around whatever location the user is asking about.
- Use the geocoding results to understand where the user wants to go.

**RULE 3: DENSE WAYPOINTS EVERY MILE**
- When you suggest a route, place waypoints approximately every 1 mile (1.6 km) along the trail.
- This means a 5-mile hike should have roughly 6 waypoints (start + one per mile).
- A 10-mile hike should have roughly 11 waypoints.
- A 2-mile hike should have at least 3-4 waypoints.
- Waypoints should follow the actual trail path closely, curving with the trail.
- Name waypoints using real trail names and landmarks: "Jenny Lake Trail - Mile 1", "Cascade Canyon Junction", "Hidden Falls Viewpoint", etc.
- For the start and end points, use actual trailhead or parking area names.
- For loops, the last waypoint should be at or very near the first waypoint.

**RULE 4: SUGGEST 1-3 ROUTE OPTIONS**
When you have enough information to suggest routes, present 1 to 3 options. For each option:
- Explain the route: distance, elevation, estimated time, difficulty, highlights
- Compare the options: why someone would choose one over another
- Use a different label for each so the user can distinguish them

**RULE 5: USE REAL DATA**
- Only suggest routes on real trails from the data. Never invent trail names or coordinates.
- Community routes from other Session Maps users are GPS-verified and trustworthy.
- When a community route matches, credit the creator with @username.
- Use imperial units (miles, feet) as primary.

GEOCODING RESULTS FOR THE USER'S QUERY:
${geocodeResults}

OPENSTREETMAP TRAIL DATA:
${trailData}

SESSION MAPS COMMUNITY ROUTES:
${communityData}

${existingRouteContext}

WHEN SUGGESTING ROUTES, include waypoint data in route_option JSON blocks at the END of your message. Format exactly like this:

\`\`\`route_option
{
  "label": "Jenny Lake Loop (Clockwise)",
  "source": "trail_data",
  "description": "7.1 mile loop, +800ft elevation, 3-4 hours, moderate difficulty",
  "color": "blue",
  "waypoints": [
    {"name": "Jenny Lake Trailhead", "lat": 43.7530, "lng": -110.7210, "description": "Start at the parking area"},
    {"name": "Jenny Lake Trail - Mile 1", "lat": 43.7580, "lng": -110.7260, "description": "Trail follows the lakeshore"},
    {"name": "Hidden Falls Junction", "lat": 43.7620, "lng": -110.7350, "description": "Side trail to Hidden Falls"},
    {"name": "Inspiration Point", "lat": 43.7640, "lng": -110.7380, "description": "Scenic overlook, 200ft above lake"},
    {"name": "Cascade Canyon Mouth", "lat": 43.7660, "lng": -110.7420, "description": "Trail continues along west shore"},
    {"name": "West Shore - Mile 5", "lat": 43.7590, "lng": -110.7350, "description": "Quieter west side of lake"},
    {"name": "South End", "lat": 43.7500, "lng": -110.7280, "description": "South end of lake"},
    {"name": "Jenny Lake Trailhead", "lat": 43.7530, "lng": -110.7210, "description": "Back at start - loop complete"}
  ]
}
\`\`\`

For community-sourced routes:
\`\`\`route_option
{
  "label": "@trailrunner42's Jenny Lake Loop",
  "source": "community",
  "description": "6.8 mile loop shared by @trailrunner42 - well-marked, family friendly",
  "color": "orange",
  "communityRouteId": 42,
  "communityAuthor": "trailrunner42",
  "waypoints": [...]
}
\`\`\`

IMPORTANT: Each route option MUST have a different "color" value. Use these colors in order: "blue", "orange", "green". This tells the app which color to draw each route on the map.

Only include route_option blocks when you are actually suggesting specific routes. Do NOT include them when asking clarifying questions.`;
}

export async function processRouteAssistRequest(
  request: RouteAssistRequest,
  dbStorage: any
): Promise<RouteAssistResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      message: 'AI Route Assistant is not configured. Please add your ANTHROPIC_API_KEY to the environment variables.',
    };
  }

  const { mapCenter, mapZoom, activityType, message } = request;

  console.log(`[AI Route Assist] Processing: "${message.substring(0, 80)}..." for ${activityType}`);

  const geocodeResults = await geocodeLocation(message);
  let geocodeContext = '';

  let searchCenter = mapCenter;
  let searchRadius = Math.max(0.02, 0.5 / Math.pow(2, Math.max(0, mapZoom - 10)));

  if (geocodeResults.length > 0) {
    searchCenter = { lat: geocodeResults[0].lat, lng: geocodeResults[0].lng };
    searchRadius = 0.1;

    geocodeContext = 'GEOCODING RESULTS (locations matching the user query):\n';
    for (const result of geocodeResults) {
      geocodeContext += `- "${result.fullName}" (${result.lat.toFixed(5)}, ${result.lng.toFixed(5)}) [relevance: ${result.relevance}]\n`;
    }
    geocodeContext += `\nUsing "${geocodeResults[0].fullName}" as the primary search area.\n`;

    console.log(`[AI Route Assist] Geocoded to: ${geocodeResults[0].fullName} (${searchCenter.lat.toFixed(4)}, ${searchCenter.lng.toFixed(4)})`);
  } else {
    geocodeContext = 'No specific location was identified from the user query. Using the current map view area.\n';
    console.log(`[AI Route Assist] No geocode match, using map center: ${mapCenter.lat.toFixed(4)}, ${mapCenter.lng.toFixed(4)}`);
  }

  const [trailDataRaw, communityRoutes] = await Promise.all([
    fetchTrailDataForArea(searchCenter, mapZoom, activityType, searchRadius),
    fetchCommunityRoutes(searchCenter, searchRadius, dbStorage),
  ]);

  const trailData = sanitizeForApi(trailDataRaw);
  const communityData = sanitizeForApi(summarizeCommunityRoutes(communityRoutes));

  console.log(`[AI Route Assist] Trail data: ${trailData.length} chars`);
  console.log(`[AI Route Assist] Community routes: ${communityRoutes.length} found`);

  const systemPrompt = buildSystemPrompt(activityType, trailData, communityData, sanitizeForApi(geocodeContext), request.existingRoute);

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  const recentHistory = request.conversationHistory.slice(-10);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: sanitizeForApi(msg.content) });
  }
  messages.push({ role: 'user', content: sanitizeForApi(message) });

  try {
    console.log(`[AI Route Assist] Sending to Claude (${messages.length} messages, system: ${systemPrompt.length} chars)`);

    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: sanitizeForApi(systemPrompt),
      messages: messages.map(m => ({ role: m.role, content: sanitizeForApi(m.content) })),
    });

    const assistantMessage = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');

    let routeOptions: RouteOption[] | undefined;
    let cleanMessage = assistantMessage;

    const optionRegex = /```route_option\n([\s\S]*?)```/g;
    let match;
    const parsedOptions: RouteOption[] = [];

    while ((match = optionRegex.exec(assistantMessage)) !== null) {
      try {
        const option = JSON.parse(match[1]);
        parsedOptions.push(option);
      } catch (e) {
        console.error('[AI Route Assist] Failed to parse route option:', e);
      }
    }

    if (parsedOptions.length > 0) {
      routeOptions = parsedOptions;
      cleanMessage = assistantMessage.replace(/```route_option\n[\s\S]*?```/g, '').trim();
    }

    const flyToCenter = geocodeResults.length > 0
      ? { lat: geocodeResults[0].lat, lng: geocodeResults[0].lng, name: geocodeResults[0].fullName }
      : undefined;

    console.log(`[AI Route Assist] Response: ${cleanMessage.length} chars, ${routeOptions?.length || 0} options`);

    return {
      message: cleanMessage,
      routeOptions,
      flyToCenter,
    };

  } catch (error: any) {
    console.error('[AI Route Assist] Claude API error:', error);
    if (error.status === 401) return { message: 'Invalid API key. Please check your ANTHROPIC_API_KEY.' };
    if (error.status === 429) return { message: 'Rate limit reached. Please wait a moment and try again.' };
    return { message: `AI assistant error: ${error.message || 'Unknown error'}. Please try again.` };
  }
}
