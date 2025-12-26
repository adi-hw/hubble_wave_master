// ============================================================
// Redis Module - Session Caching & Rate Limiting
// ============================================================
//
// This module provides Redis connectivity for:
// - Session caching (faster auth validation)
// - Token blacklist (revoked tokens)
// - Rate limiting state
// - Real-time features (pub/sub)
// ============================================================

export { RedisModule } from './lib/redis.module';
export { RedisService } from './lib/redis.service';
export { REDIS_CLIENT, REDIS_KEYS, REDIS_TTL } from './lib/redis.constants';
