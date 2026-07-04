export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface RouteStep {
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number];
  };
  distance: number;
  duration: number;
  name: string;
  instruction?: string; // We will construct this
}

export interface RouteInfo {
  coordinates: Coordinate[];
  distance: number; // meters
  duration: number; // seconds
  steps: RouteStep[];
}

function getInstruction(step: any): string {
  const type = step.maneuver.type;
  const modifier = step.maneuver.modifier;
  const name = step.name || 'road';

  if (type === 'depart') return `Head ${modifier || ''} on ${name}`;
  if (type === 'arrive') return `Arrive at destination`;
  if (type === 'turn') return `Turn ${modifier} onto ${name}`;
  if (type === 'continue') return `Continue onto ${name}`;
  if (type === 'new name') return `Continue onto ${name}`;
  if (type === 'merge') return `Merge ${modifier} onto ${name}`;
  if (type === 'on ramp') return `Take the ramp onto ${name}`;
  if (type === 'off ramp') return `Take the exit onto ${name}`;
  if (type === 'fork') return `Keep ${modifier} at the fork onto ${name}`;
  if (type === 'end of road') return `Turn ${modifier} at end of road onto ${name}`;
  if (type === 'roundabout') return `Enter roundabout and take exit ${step.maneuver.exit || ''}`;
  
  return `${type} ${modifier || ''} onto ${name}`;
}

// Public OSRM demo server — fine for development, but it throttles heavily and
// leaks courier/customer coordinates to a third party. Never used in production:
// set EXPO_PUBLIC_ROUTING_URL to a self-hosted OSRM instance for release builds.
const DEMO_ROUTING_URL = 'https://router.project-osrm.org';

let warnedMissingRoutingUrl = false;

function getRoutingBaseUrl(): string | null {
  const configured = process.env.EXPO_PUBLIC_ROUTING_URL;
  if (configured) {
    // Strip trailing slashes so path concatenation stays predictable
    return configured.replace(/\/+$/, '');
  }

  if (__DEV__) {
    return DEMO_ROUTING_URL;
  }

  if (!warnedMissingRoutingUrl) {
    warnedMissingRoutingUrl = true;
    console.warn(
      '[routing] EXPO_PUBLIC_ROUTING_URL is not set in this production build. ' +
      'Route lines are disabled — maps will render without polylines. ' +
      'Set EXPO_PUBLIC_ROUTING_URL to a self-hosted OSRM server to enable routing.'
    );
  }
  return null;
}

/**
 * Fetch a driving route between two coordinates.
 * Returns null when routing is unavailable (no routing server configured in
 * production, or the request failed) — callers should render without a polyline.
 */
export async function fetchRoute(start: Coordinate, end: Coordinate): Promise<RouteInfo | null> {
  const baseUrl = getRoutingBaseUrl();
  if (!baseUrl) {
    return null;
  }

  try {
    const response = await fetch(
      `${baseUrl}/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&steps=true`
    );

    if (!response.ok) {
      console.error('Failed to fetch route', response.status);
      return null;
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.error('Invalid route data', data);
      return null;
    }

    const route = data.routes[0];
    const coordinates = route.geometry.coordinates.map((coord: number[]) => ({
      latitude: coord[1],
      longitude: coord[0],
    }));

    const steps = route.legs[0].steps.map((step: any) => ({
      ...step,
      instruction: getInstruction(step),
    }));

    return {
      coordinates,
      distance: route.distance,
      duration: route.duration,
      steps,
    };
  } catch (error) {
    console.error('Error fetching route:', error);
    return null;
  }
}
