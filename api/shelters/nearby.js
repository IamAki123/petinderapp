import { getNearbySheltersPayload } from "../../server/routes.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radius = parseFloat(req.query.radius) || 50;
  const result = await getNearbySheltersPayload(lat, lng, radius);
  return res.status(result.status).json(result.body);
}
