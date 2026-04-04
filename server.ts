import express from "express";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    env: process.env.NODE_ENV || 'development'
  });
});

async function setup() {
  const distPath = path.join(process.cwd(), 'dist');
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    console.log("Starting in DEVELOPMENT mode with Vite middleware...");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Failed to load Vite middleware, falling back to static:", e);
      app.use(express.static(distPath));
    }
  } else {
    console.log("Starting in PRODUCTION mode, serving static files...");
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI R.G Server is running on port ${PORT}`);
  });
}

setup();

export default app;
