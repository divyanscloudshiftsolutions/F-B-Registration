import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import router from './routes';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { tokenService } from './services/TokenService';
import { logger, logException, requestLoggingMiddleware } from './lib/logger';

// Trigger Railway rebuild: verified active tokens index fix
dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Configure Trust Proxy for Deployed Proxy Environments
app.set('trust proxy', 1);

// Configure Redis Store with In-Memory fallback for Rate Limiting
let rateLimitStore;
if (process.env.REDIS_URL) {
  try {
    const redisClient = new Redis(process.env.REDIS_URL);
    rateLimitStore = new RedisStore({
      // @ts-expect-error - compatibility mapping for ioredis/rate-limit-redis
      sendCommand: (...args: string[]) => redisClient.call(args[0], ...args.slice(1)),
    });
    logger.info('Rate limiter: Redis store initialized successfully', {
      component: 'rate_limit',
      event: 'rate_limit.redis_ready',
    });
  } catch (err) {
    logException(err, 'rate_limit', 'init_redis_store');
  }
}

// API Gateway Rate Limiter (B2 component in nfc.md)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per 15-minute window
  store: rateLimitStore,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP. Please try again after 15 minutes.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

const allowedOrigins = [
  ...(process.env.FRONTEND_URL?.split(',').map(origin => origin.trim()).filter(Boolean) ?? []),
  'https://nfc-qr-code-production.up.railway.app',
  'https://nfc-qr-code-two.vercel.app',
  'https://nfc-qr-code-007.vercel.app',
  'https://nfc-qr.app.cloudshiftsolutions.in',
  'https://api.nfc-qr.app.cloudshiftsolutions.in',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:19006',
  'http://192.168.1.150:8091',
].filter(Boolean) as string[];

const getOriginHostname = (origin: string) => {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return '';
  }
};

const isPrivateNetworkOrigin = (origin: string) => {
  const match = origin.match(/^https?:\/\/((\d{1,3}(?:\.\d{1,3}){3}))(?:[:/]|$)/i);
  if (!match) return false;

  const octets = match[1].split('.').map(Number);
  if (octets.length !== 4 || octets.some(octet => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  const [first, second] = octets;
  return (first === 10) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168);
};

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.toLowerCase().trim();
    const originHost = getOriginHostname(normalizedOrigin);

    // Check if origin is explicitly allowed
    const isAllowed = allowedOrigins.some(allowed => {
      const normalizedAllowed = allowed.toLowerCase().trim();
      return normalizedOrigin === normalizedAllowed ||
             normalizedOrigin === `${normalizedAllowed}/` ||
             normalizedOrigin.startsWith(normalizedAllowed);
    });

    const isCloudShiftOrigin = originHost.endsWith('.cloudshiftsolutions.in') ||
      originHost === 'cloudshiftsolutions.in';

    // Check if origin is a local dev address, a private-network address, or a Vercel deployment
    const isLocalOrVercel = normalizedOrigin.includes('localhost') ||
                            normalizedOrigin.includes('127.0.0.1') ||
                            normalizedOrigin.startsWith('chrome-extension://') ||
                            normalizedOrigin.endsWith('.vercel.app') ||
                            normalizedOrigin.includes('.vercel.app') ||
                            isPrivateNetworkOrigin(normalizedOrigin);

    if (isAllowed || isCloudShiftOrigin || isLocalOrVercel) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(requestLoggingMiddleware);
app.use(limiter);

// Mount API router
app.use('/api', router);

// Root route handler for status verification
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'NFC Bar Management System Backend API is running. Mount all requests on /api',
    timestamp: new Date().toISOString()
  });
});

// Production health check for monitoring (Railway Requirement)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logException(err, 'http', 'unhandled_error', {
    method: req.method,
    path: req.originalUrl || req.url,
  });

  const isProduction = process.env.NODE_ENV === 'production';
  const errorMessage = isProduction ? 'Internal server error occurred' : (err.message || 'Internal server error occurred');

  res.status(500).json({
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: errorMessage,
    },
  });
});

app.listen(Number(port), '0.0.0.0', () => {
  logger.info(`Backend server listening on port ${port}`, {
    component: 'startup',
    event: 'server.started',
    port: Number(port),
  });
});

// Periodic background system state reconciler (B3 background check)
setInterval(async () => {
  try {
    await tokenService.reconcileSystemState();
  } catch (err) {
    logException(err, 'reconciler', 'reconcile_system_state');
  }
}, 15000);
