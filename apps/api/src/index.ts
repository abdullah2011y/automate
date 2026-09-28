import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import v1Router from './routes';
import { errorHandler } from './middleware/errorHandler';
import { BaileysService } from './services/baileys.service';

// Extend Express Request type to include rawBody
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

const app = express();

// Security HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration: explicit whitelist
const allowedOrigins = [
  config.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'capacitor://localhost',
  'ionic://localhost',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., mobile apps, curl, server-to-server webhooks)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Shopify-Hmac-Sha256', 'X-Hub-Signature-256'],
}));

// Request logging
if (config.NODE_ENV !== 'test') {
  app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// JSON body parser with rawBody preservation for Shopify & Meta HMAC signature validation
app.use(
  express.json({
    limit: '2mb',
    verify: (req: Request, _res: Response, buf: Buffer) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Root sanity endpoint
app.get('/', (_req, res) => {
  res.json({
    service: 'ByteForge Omni-Commerce API',
    status: 'online',
    version: '1.0.0',
    documentation: `${config.API_PREFIX}/health`,
  });
});

// Versioned API endpoints
app.use(config.API_PREFIX, v1Router);

// Centralized error handling
app.use(errorHandler);

// Server startup - explicitly bind to 0.0.0.0 for container networking (Northflank/Docker)
const server = app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`🚀 [ByteForge API] Running on port ${config.PORT} (${config.NODE_ENV}) - bound to 0.0.0.0`);
  console.log(`🔗 Health check available at: http://localhost:${config.PORT}${config.API_PREFIX}/health`);

  // Phase 4: Automatically initialize Baileys WhatsApp Web socket in non-test mode
  if (config.NODE_ENV !== 'test') {
    BaileysService.init().catch((err) => {
      console.error('❌ [Baileys] Error during startup initialization:', err);
    });
  }
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}, closing WhatsApp socket, database connections & HTTP server gracefully...`);
  try {
    await BaileysService.disconnect();
  } catch (err) {}

  try {
    const { prisma } = await import('./db/prisma');
    await prisma.$disconnect();
    console.log('✅ PostgreSQL connection pool cleanly drained.');
  } catch (err) {}

  server.close(() => {
    console.log('✅ HTTP server closed. Process exiting.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
