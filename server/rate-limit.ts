import rateLimit from 'express-rate-limit';
import type { Express } from 'express';

export function setupRateLimiting(app: Express) {
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { message: 'Too many requests, please try again in a minute' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.headers.upgrade === 'websocket',
  });
  
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: 'Too many login attempts, please try again in 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { message: 'Too many accounts created, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { message: 'AI route generation limit reached. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    message: { message: 'Upload limit reached, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { message: 'Too many password reset attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  app.use('/api/login', authLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/register', registerLimiter);
  app.use('/api/auth/register', registerLimiter);
  app.use('/api/auth/forgot-password', passwordResetLimiter);
  app.use('/api/auth/reset-password', passwordResetLimiter);
  
  app.use('/api/ai/', aiLimiter);
  
  app.use('/api/drone-images', uploadLimiter);
  app.use('/api/admin/drone-images/upload', uploadLimiter);
  app.use('/api/admin/drone-models/upload', uploadLimiter);
  app.use('/api/cesium-tilesets/upload', uploadLimiter);
  
  app.use('/api/', generalLimiter);
  
  console.log('Rate limiting enabled');
}
