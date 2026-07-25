import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import express from "express";
import dotenv from "dotenv";
import { registerApiRoutes } from "./server/api.js";

dotenv.config();

function petinderApiPlugin() {
  return {
    name: "petinder-api",
    configureServer(server) {
      const api = express();
      api.use(express.json({ limit: "1mb" }));
      registerApiRoutes(api);

      server.middlewares.use("/api", (req, res, next) => {
        api(req, res, next);
      });

      console.log("Petinder API ready at http://localhost:5173/api");
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), petinderApiPlugin()],
  base: "./",
  server: {
    port: 5173,
  },
});
