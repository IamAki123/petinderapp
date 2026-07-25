const EARTH_RADIUS_MI = 3958.8;

const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const FETCH_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  "User-Agent": "PetinderApp/1.0 (pet adoption demo)",
  Accept: "application/json",
};

export function haversineMiles(lat1, lng1, lat2, lng2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MI * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatOsmAddress(tags = {}) {
  if (tags["addr:full"]) return tags["addr:full"];
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const cityLine = [tags["addr:city"], tags["addr:state"], tags["addr:postcode"]].filter(Boolean).join(", ");
  const combined = [street, cityLine].filter(Boolean).join(", ");
  return combined || null;
}

function isShelterLike(tags = {}, name = "") {
  if (tags.amenity === "animal_shelter") return true;
  if (tags.social_facility === "animal_shelter") return true;
  if (tags.office === "animal_welfare") return true;

  const label = `${name} ${tags.name || ""} ${tags.operator || ""}`.toLowerCase();
  return /shelter|humane|spca|rescue|adoption|animal welfare|paws|aspca/.test(label);
}

function elementCoords(el) {
  if (el.lat != null && el.lon != null) return { lat: el.lat, lng: el.lon };
  if (el.center?.lat != null && el.center?.lon != null) {
    return { lat: el.center.lat, lng: el.center.lon };
  }
  return null;
}

function dedupeKey(name, lat, lng) {
  return `${name.toLowerCase()}-${lat.toFixed(4)}-${lng.toFixed(4)}`;
}

function addShelter(seen, list, shelter, userLat, userLng) {
  const key = dedupeKey(shelter.name, shelter.lat, shelter.lng);
  if (seen.has(key)) return;
  seen.add(key);
  list.push({
    ...shelter,
    distance: haversineMiles(userLat, userLng, shelter.lat, shelter.lng),
  });
}

async function queryOverpass(query) {
  let lastError = null;

  for (const server of OVERPASS_SERVERS) {
    try {
      const res = await fetch(server, {
        method: "POST",
        headers: FETCH_HEADERS,
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!res.ok) {
        lastError = new Error(`${server} returned ${res.status}`);
        continue;
      }

      const data = await res.json();
      if (data.remark && !data.elements) {
        lastError = new Error(data.remark);
        continue;
      }

      return data.elements || [];
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("All Overpass servers failed");
}

function parseOverpassElements(elements, userLat, userLng, seen, shelters) {
  for (const el of elements) {
    const coords = elementCoords(el);
    if (!coords) continue;

    const tags = el.tags || {};
    const name = tags.name || tags.operator;
    if (!name || !isShelterLike(tags, name)) continue;

    addShelter(seen, shelters, {
      id: `${el.type}-${el.id}`,
      name,
      lat: coords.lat,
      lng: coords.lng,
      address: formatOsmAddress(tags),
      phone: tags.phone || tags["contact:phone"] || null,
      website: tags.website || tags["contact:website"] || null,
      source: "openstreetmap",
    }, userLat, userLng);
  }
}

async function queryNominatim(lat, lng, radiusMiles, seen, shelters) {
  const delta = radiusMiles / 69;
  const viewbox = [
    lng - delta,
    lat + delta,
    lng + delta,
    lat - delta,
  ].join(",");

  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent("animal shelter")}&format=json&limit=20` +
    `&viewbox=${viewbox}&bounded=1&addressdetails=1`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "PetinderApp/1.0 (pet adoption demo)",
      "Accept-Language": "en",
    },
  });

  if (!res.ok) return;

  const results = await res.json();
  for (const place of results || []) {
    const name = place.display_name?.split(",")[0] || place.name;
    if (!name || !isShelterLike({}, name)) continue;

    const plat = parseFloat(place.lat);
    const plng = parseFloat(place.lon);
    if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;

    const dist = haversineMiles(lat, lng, plat, plng);
    if (dist > radiusMiles) continue;

    addShelter(seen, shelters, {
      id: `nom-${place.osm_type}-${place.osm_id}`,
      name: place.name || name,
      lat: plat,
      lng: plng,
      address: place.display_name || null,
      phone: null,
      website: null,
      source: "nominatim",
    }, lat, lng);
  }
}

export async function fetchNearbyShelters(lat, lng, radiusMiles = 50) {
  const radiusM = Math.round(radiusMiles * 1609.34);
  const seen = new Set();
  const shelters = [];

  const query = `
[out:json][timeout:25];
(
  nwr["amenity"="animal_shelter"](around:${radiusM},${lat},${lng});
  nwr["social_facility"="animal_shelter"](around:${radiusM},${lat},${lng});
  nwr["office"="animal_welfare"](around:${radiusM},${lat},${lng});
);
out center tags;
`;

  try {
    const elements = await queryOverpass(query);
    parseOverpassElements(elements, lat, lng, seen, shelters);
  } catch (err) {
    console.warn("Overpass lookup failed, trying Nominatim:", err.message);
  }

  if (shelters.length === 0) {
    await queryNominatim(lat, lng, radiusMiles, seen, shelters);
  }

  if (shelters.length === 0) {
    throw new Error("No shelters found near you. OpenStreetMap may have limited data in your area.");
  }

  return shelters.sort((a, b) => a.distance - b.distance);
}
