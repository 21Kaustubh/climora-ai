
/**
 * CLIMORA — Nearby Friends
 * Status: UPCOMING
 *
 * All Friends API operations are temporarily disabled.
 * No location tracking, invitation creation, or cloud requests.
 * The existing AWS backend remains unchanged.
 */

export const FRIENDS_UPCOMING = true;

export const FRIENDS_UPCOMING_MESSAGE =
  'Nearby Friends — Coming Soon! This feature will be available in a future Climora update.';

export const FRIENDS_API_URL = (
  import.meta.env.VITE_CLIMORA_FRIENDS_API_URL || ''
).trim().replace(/\/+$/, '');

export const friendsApiConfigured = Boolean(FRIENDS_API_URL);

// All Friends operations are disabled until launch.
function comingSoon() {
  return Promise.reject(
    new Error(FRIENDS_UPCOMING_MESSAGE)
  );
}

export const getFriends = () => comingSoon();

export const createFriendInvite = () => comingSoon();

export const acceptFriendInvite = () => comingSoon();

export const shareApproximateLocation = () => comingSoon();

export const stopLocationSharing = () => comingSoon();

export const removeFriend = () => comingSoon();

// Preserve distance utility for future use.
export function approximateDistanceKm(a, b) {
  if (!a || !b) return null;

  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toRad) *
    Math.cos(b.lat * toRad) *
    Math.sin(dLon / 2) ** 2;

  return (
    Math.round(
      12742 *
      Math.asin(Math.min(1, Math.sqrt(x))) *
      10
    ) / 10
  );
}
