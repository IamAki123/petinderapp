import { createServerApp } from "./app.js";

const PORT = process.env.PORT || 3001;
const app = createServerApp();

app.listen(PORT, () => {
  console.log(`Petinder server running on http://localhost:${PORT}`);
});
