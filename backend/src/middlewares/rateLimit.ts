import rateLimit from 'express-rate-limit';
import { env } from '../config';
import { sendFailure } from '../utils/response';

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendFailure(res, 429, 'Quá nhiều yêu cầu, vui lòng thử lại sau', 'RATE_LIMITED');
  },
});
