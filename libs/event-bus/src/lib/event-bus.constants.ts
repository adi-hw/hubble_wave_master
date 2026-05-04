/** ioredis client used for PUBLISH (separate from the subscriber). */
export const EVENT_BUS_PUBLISHER = 'EVENT_BUS_PUBLISHER';

/**
 * ioredis client in subscribe mode. ioredis enforces that a subscribed
 * connection cannot issue regular commands — that's why publisher and
 * subscriber are distinct providers.
 */
export const EVENT_BUS_SUBSCRIBER = 'EVENT_BUS_SUBSCRIBER';

/**
 * String prefixed to every channel to isolate HubbleWave domain events from
 * unrelated Redis traffic on the same instance (BullMQ, RedisService keys, etc.).
 */
export const EVENT_BUS_CHANNEL_PREFIX = 'EVENT_BUS_CHANNEL_PREFIX';

/** Default channel prefix when none is configured. */
export const DEFAULT_EVENT_BUS_CHANNEL_PREFIX = 'hw:events:';
