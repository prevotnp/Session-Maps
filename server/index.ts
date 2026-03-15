import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import compression from 'compression';
import helmet from 'helmet';
import { setupRateLimiting } from "./rate-limit";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  frameguard: false,
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      const sensitiveEndpoints = ['/api/login', '/api/register', '/api/auth', '/api/user-location', '/api/shared-locations'];
      const isSensitive = sensitiveEndpoints.some(ep => path.startsWith(ep));
      
      if (capturedJsonResponse && !isSensitive) {
        const bodyStr = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${bodyStr.length > 200 ? bodyStr.slice(0, 200) + '…' : bodyStr}`;
      }

      if (logLine.length > 300) {
        logLine = logLine.slice(0, 299) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  setupRateLimiting(app);
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    console.error(err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  (async () => {
    try {
      const { db } = await import('./db');
      const { cesium3dTilesets } = await import('@shared/schema');
      const { like } = await import('drizzle-orm');
      const localTilesets = await db.select().from(cesium3dTilesets).where(like(cesium3dTilesets.storagePath, 'local:%'));
      if (localTilesets.length > 0) {
        const { syncTilesetToObjectStorage } = await import('./cesiumStorageSync');
        for (const ts of localTilesets) {
          const localDir = ts.storagePath!.replace('local:', '');
          const fs = await import('fs');
          if (fs.existsSync(localDir)) {
            console.log(`[Startup] Syncing tileset ${ts.id} to Object Storage...`);
            syncTilesetToObjectStorage(ts.id, localDir).catch(err => {
              console.error(`[Startup] Sync failed for tileset ${ts.id}:`, err);
            });
          }
        }
      }
    } catch (e) {
      console.error('[Startup] Error checking for unsynced tilesets:', e);
    }
  })();

  // Cleanup expired voice messages every 15 minutes (audio is stored in DB, so just delete rows)
  const cleanupExpiredVoiceMessages = async () => {
    try {
      const { storage } = await import('./storage');
      const count = await storage.deleteExpiredVoiceMessages();
      if (count > 0) {
        console.log(`[Cleanup] Deleted ${count} expired voice messages`);
      }
    } catch (err) {
      console.error('[Cleanup] Voice message cleanup error:', err);
    }
  };
  cleanupExpiredVoiceMessages();
  setInterval(cleanupExpiredVoiceMessages, 15 * 60 * 1000);

  // Serve both the API and the client on a single port.
  // On Replit, port 5000 is the only non-firewalled port.
  const port = parseInt(process.env.PORT || "5000", 10);
  
  // Increase server timeout for large file uploads (2 hours)
  server.timeout = 2 * 60 * 60 * 1000; // 2 hours
  server.headersTimeout = 2 * 60 * 60 * 1000 + 60000; // 2 hours + 1 min (must be > timeout)
  server.keepAliveTimeout = 2 * 60 * 60 * 1000; // 2 hours
  server.requestTimeout = 2 * 60 * 60 * 1000; // 2 hours
  
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
