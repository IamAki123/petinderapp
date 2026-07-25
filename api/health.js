import { getHealthPayload } from "../server/routes.js";

export default function handler(_req, res) {
  res.status(200).json(getHealthPayload());
}
