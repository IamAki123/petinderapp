import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import L from "leaflet";
import { MapPin, Navigation, Loader2, LocateFixed, AlertCircle } from "lucide-react";
import { formatDistance, mapsDirectionsUrl } from "../utils/geo.js";
import { fetchJson } from "../utils/api.js";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const shelterIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

async function fetchRealShelters(lat, lng) {
  const data = await fetchJson(`/api/shelters/nearby?lat=${lat}&lng=${lng}&radius=50`);
  return data.shelters || [];
}

export default function ShelterMapScreen() {
  const [userPos, setUserPos] = useState(null);
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsLocation, setNeedsLocation] = useState(false);

  const loadShelters = async (lat, lng) => {
    setLoading(true);
    setError("");
    setNeedsLocation(false);
    setUserPos({ lat, lng });
    try {
      const list = await fetchRealShelters(lat, lng);
      setShelters(list);
      if (list.length === 0) {
        setError("No registered shelters found within 50 miles. OpenStreetMap may have limited data in your area.");
      }
    } catch (e) {
      setError(e.message || "Failed to find nearby shelters.");
      setShelters([]);
    } finally {
      setLoading(false);
    }
  };

  const requestLocation = () => {
    setLoading(true);
    setError("");
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      setNeedsLocation(true);
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => loadShelters(pos.coords.latitude, pos.coords.longitude),
      () => {
        setNeedsLocation(true);
        setLoading(false);
        setError("Location access is required to find real shelters near you.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const mapCenter = userPos || { lat: 39.8283, lng: -98.5795 };
  const mapZoom = userPos ? (shelters.length > 1 ? 10 : 12) : 4;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <Loader2 size={32} color="var(--pine)" className="animate-spin" />
        <p className="pt-stamp text-xs" style={{ color: "var(--ink)", opacity: 0.65 }}>
          Finding real animal shelters near you…
        </p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="pt-display text-xl" style={{ color: "var(--pine)" }}>Nearby Shelters</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink)", opacity: 0.65 }}>
              Real shelters from OpenStreetMap, sorted by distance.
            </p>
          </div>
          <button
            onClick={requestLocation}
            className="p-2 rounded-lg shrink-0"
            style={{ background: "var(--paper-dark)", border: "none", cursor: "pointer" }}
            title="Refresh location"
          >
            <LocateFixed size={18} color="var(--pine)" />
          </button>
        </div>
        {error && (
          <div className="mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--paper-dark)", color: "var(--brick)" }}>
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {needsLocation && (
          <button
            onClick={requestLocation}
            className="pt-display w-full mt-2 py-2.5 rounded-xl text-sm text-white"
            style={{ background: "var(--pine)", border: "none", cursor: "pointer" }}
          >
            Enable location
          </button>
        )}
      </div>

      {userPos && (
        <div className="mx-4 mb-2 rounded-xl overflow-hidden pt-card-shadow shrink-0" style={{ height: 220, border: "2px solid var(--paper-dark)" }}>
          <MapContainer
            key={`${userPos.lat}-${userPos.lng}-${shelters.length}`}
            center={[mapCenter.lat, mapCenter.lng]}
            zoom={mapZoom}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <CircleMarker
              center={[userPos.lat, userPos.lng]}
              radius={8}
              pathOptions={{ color: "#1F3D2E", fillColor: "#E3A93B", fillOpacity: 1, weight: 2 }}
            >
              <Popup>You are here</Popup>
            </CircleMarker>
            {shelters.map((s) => (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={shelterIcon}>
                <Popup>
                  <strong>{s.name}</strong>
                  <br />
                  {s.address || "Address not listed"}
                  <br />
                  {formatDistance(s.distance)}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      <div className="pt-scroll flex-1 min-h-0 px-4 pb-3 flex flex-col gap-2">
        {shelters.map((s, i) => {
          const directions = mapsDirectionsUrl(s.name, s.lat, s.lng);
          return (
            <div key={s.id} className="pt-card-shadow rounded-xl p-3 flex gap-3 shrink-0" style={{ background: "white" }}>
              <div className="rounded-full p-2 shrink-0 self-start" style={{ background: "var(--paper-dark)" }}>
                {i === 0 ? <Navigation size={18} color="var(--mustard)" /> : <MapPin size={18} color="var(--pine)" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="pt-display text-base" style={{ color: "var(--pine)" }}>{s.name}</h3>
                  <span className="pt-stamp text-xs shrink-0" style={{ color: "var(--brick)" }}>
                    {formatDistance(s.distance)}
                  </span>
                </div>
                {s.address ? (
                  <a
                    href={directions}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs mt-1 block underline"
                    style={{ color: "var(--pine)" }}
                  >
                    {s.address}
                  </a>
                ) : (
                  <p className="text-xs mt-1" style={{ color: "var(--ink)", opacity: 0.6 }}>
                    Address not in map data — directions use map pin
                  </p>
                )}
                {s.phone && (
                  <a href={`tel:${s.phone}`} className="text-xs block mt-1" style={{ color: "var(--ink)", opacity: 0.75 }}>
                    {s.phone}
                  </a>
                )}
                <a
                  href={directions}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pt-stamp text-xs inline-flex items-center gap-1 mt-2 px-3 py-1.5 rounded-lg text-white"
                  style={{ background: "var(--mustard)", textDecoration: "none" }}
                >
                  <Navigation size={13} /> Get directions
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
