export function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(miles) {
  if (miles < 0.1) return "nearby";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

const KNOWN_COORDS = {
  "hillsboro paws rescue": { lat: 45.5229, lng: -122.9898 },
  "portland humane society": { lat: 45.5898, lng: -122.5951 },
  "multnomah county animal services": { lat: 45.5152, lng: -122.6784 },
  "oregon humane society": { lat: 45.5303, lng: -122.6848 },
};

export function mapsSearchUrl(locationName) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${locationName} animal shelter`)}`;
}

export function mapsDirectionsUrl(locationName, lat, lng) {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  return mapsSearchUrl(locationName);
}

export function coordsForLocation(name) {
  const key = name?.trim().toLowerCase();
  if (key && KNOWN_COORDS[key]) return KNOWN_COORDS[key];
  return null;
}

export async function geocodeShelter(name) {
  const known = coordsForLocation(name);
  if (known) return { ...known, name };

  try {
    const q = encodeURIComponent(`${name} animal shelter`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { "Accept-Language": "en", "User-Agent": "PetinderApp/1.0" } }
    );
    if (!res.ok) throw new Error("geocode failed");
    const data = await res.json();
    if (data?.[0]) {
      return {
        name,
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        address: data[0].display_name,
      };
    }
  } catch {
    /* fall through */
  }

  return null;
}

export async function resolveShelterCoords(locationName, userLat, userLng) {
  const known = coordsForLocation(locationName);
  if (known) return known;

  const geocoded = await geocodeShelter(locationName);
  if (geocoded) return geocoded;

  if (userLat != null && userLng != null) {
    try {
      const res = await fetch(`/api/shelters/nearby?lat=${userLat}&lng=${userLng}&radius=50`);
      if (res.ok) {
        const data = await res.json();
        const needle = locationName.toLowerCase();
        const match = (data.shelters || []).find((s) =>
          s.name.toLowerCase().includes(needle) || needle.includes(s.name.toLowerCase().split(" ")[0])
        );
        if (match) return match;
      }
    } catch {
      /* fall through */
    }
  }

  return null;
}
