import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import { fileURLToPath } from "url";

// Reliable __dirname equivalent for ESM (works in Vercel Lambda and local)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function setupVite(app: Express, server: Server) {
  // Dynamic imports for dev-only dependencies (vite is a devDependency)
  const { nanoid } = await import("nanoid");
  const { createServer: createViteServer } = await import("vite");
  const viteConfig = (await import("../../vite.config")).default;

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

function findPublicDir(): string {
  // Check multiple possible locations for the built frontend assets:
  const candidates = [
    // Vercel: process.cwd() is the project root, public/ is at root
    path.resolve(process.cwd(), "public"),
    // Local production (dist/index.js): public at dist/public (sibling)
    path.resolve(__dirname, "public"),
    // Fallback: one level up from dist/ then into dist/public
    path.resolve(__dirname, "..", "dist", "public"),
    // Development: two levels up from server/_core/ then into dist/public
    path.resolve(__dirname, "../..", "dist", "public"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.resolve(candidate, "index.html"))) {
      return candidate;
    }
  }

  // Return first candidate as fallback (will log error)
  return candidates[0];
}

export function serveStatic(app: Express) {
  const distPath = findPublicDir();

  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // On Vercel, express.static() is ignored by the platform,
  // but static assets are served from public/ by Vercel's CDN.
  // We still register it for non-Vercel environments.
  app.use(express.static(distPath));

  // SPA catch-all: serve index.html for any unmatched route.
  // This handles client-side routing (React Router / Wouter).
  app.use("*", (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Not found - frontend build may be missing");
    }
  });
}
