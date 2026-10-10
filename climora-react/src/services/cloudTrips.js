/** Cloud Saved Trips API. Only used after Cognito sign-in.
 *  Guests continue using the original local-device trip storage.
 */
import { getCognitoAccessToken } from '../auth/cognito.js';

const endpoint = (import.meta.env.VITE_CLIMORA_TRIPS_API_URL || '').trim().replace(/\/+$/, '');
export const cloudTripsConfigured = Boolean(endpoint);

async function request(method, path = '', data) {
  if (!cloudTripsConfigured) throw new Error('Cloud trips API is not configured yet.');
  if (!endpoint.startsWith('https://')) throw new Error('Use an HTTPS Cloud Trips API endpoint.');
  const accessToken = await getCognitoAccessToken();
  const response = await fetch(endpoint + path, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(data ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
    cache: 'no-store',
  });
  let payload = {};
  try { payload = await response.json(); } catch { /* HTTP error without JSON body */ }
  if (!response.ok) {
    const fallback = response.status === 401
      ? 'Your sign-in session has expired. Please sign out and sign in again.'
      : response.status === 403
        ? 'Cloud Trips request was blocked. Check the API Gateway and Cognito configuration.'
        : `Cloud Trips request failed (${response.status}).`;
    throw new Error(typeof payload.error === 'string' ? payload.error : fallback);
  }
  return payload;
}

export async function fetchCloudTrips() {
  const result = await request('GET');
  if (!Array.isArray(result.trips)) throw new Error('Unexpected trips API response.');
  return result.trips;
}

export async function createCloudTrip(trip) {
  // Server ignores caller-supplied id and user identity. Its id is derived
  // from the mode and coordinates, so repeat saves update the same trip.
  const result = await request('POST', '', {
    start: trip.start, end: trip.end, mode: trip.mode,
    distanceKm: trip.distanceKm, durationMin: trip.durationMin,
  });
  if (!result.trip?.id) throw new Error('Cloud did not return a saved trip.');
  return result.trip;
}

export async function removeCloudTrip(id) {
  if (!/^trip_[a-f0-9]{32}$/.test(id)) throw new Error('Invalid cloud trip ID.');
  await request('DELETE', '/' + encodeURIComponent(id));
}
