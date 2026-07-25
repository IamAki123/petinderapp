import { getHealthPayload, getNearbySheltersPayload, postChatPayload } from "./routes.js";

export function registerApiRoutes(app) {
  app.get("/health", (_req, res) => {
    res.json(getHealthPayload());
  });

  app.get("/shelters/nearby", async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = parseFloat(req.query.radius) || 50;
    const result = await getNearbySheltersPayload(lat, lng, radius);
    res.status(result.status).json(result.body);
  });

  app.post("/chat", async (req, res) => {
    const result = await postChatPayload(req.body);
    res.status(result.status).json(result.body);
  });
}
