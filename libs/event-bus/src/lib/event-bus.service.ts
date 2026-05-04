import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type Redis from 'ioredis';

import {
  EVENT_BUS_PUBLISHER,
  EVENT_BUS_SUBSCRIBER,
  EVENT_BUS_CHANNEL_PREFIX,
} from './event-bus.constants';

type Handler<T = unknown> = (payload: T) => void | Promise<void>;

/**
 * Cross-service domain event bus on Redis pub/sub.
 *
 * Why two clients? An ioredis connection in subscribe mode can only issue
 * subscribe/unsubscribe commands — publish must go through a separate
 * connection. The module wires both at registration time.
 *
 * Channel prefix isolates HubbleWave's events from any other Redis traffic
 * sharing the same instance (different DBs, BullMQ keys, etc.).
 */
@Injectable()
export class EventBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private readonly handlers = new Map<string, Handler[]>();
  private readonly subscribedChannels = new Set<string>();
  private messageListenerAttached = false;

  constructor(
    @Inject(EVENT_BUS_PUBLISHER) private readonly publisher: Redis,
    @Inject(EVENT_BUS_SUBSCRIBER) private readonly subscriber: Redis,
    @Inject(EVENT_BUS_CHANNEL_PREFIX) private readonly channelPrefix: string,
  ) {}

  onModuleInit(): void {
    if (this.messageListenerAttached) {
      return;
    }
    this.subscriber.on('message', (channel: string, message: string) => {
      void this.dispatch(channel, message);
    });
    this.messageListenerAttached = true;
  }

  async onModuleDestroy(): Promise<void> {
    this.handlers.clear();
    this.subscribedChannels.clear();
  }

  /**
   * Publish a payload to a topic. JSON-serialised; subscribers receive the
   * deserialised object. Returns once Redis has acknowledged the publish —
   * delivery to subscribers is best-effort (Redis pub/sub is fire-and-forget).
   */
  async publish<T>(topic: string, payload: T): Promise<void> {
    const channel = this.toChannel(topic);
    const message = JSON.stringify(payload);
    try {
      await this.publisher.publish(channel, message);
    } catch (error) {
      this.logger.error(
        `Failed to publish to ${channel}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Register a handler for a topic. The first subscription to a topic issues
   * a SUBSCRIBE to Redis; subsequent subscriptions to the same topic add
   * additional handlers without re-subscribing.
   *
   * Handlers run in registration order. Errors thrown by a handler are
   * logged and do not prevent other handlers from running.
   */
  subscribe<T>(topic: string, handler: Handler<T>): void {
    const channel = this.toChannel(topic);

    const existing = this.handlers.get(channel) ?? [];
    existing.push(handler as Handler);
    this.handlers.set(channel, existing);

    if (!this.subscribedChannels.has(channel)) {
      this.subscribedChannels.add(channel);
      this.subscriber.subscribe(channel).catch((error: Error) => {
        this.logger.error(
          `Failed to subscribe to ${channel}: ${error.message}`,
        );
      });
    }
  }

  private async dispatch(channel: string, message: string): Promise<void> {
    const handlers = this.handlers.get(channel);
    if (!handlers || handlers.length === 0) {
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(message);
    } catch (error) {
      this.logger.error(
        `Dropping malformed message on ${channel}: ${(error as Error).message}`,
      );
      return;
    }

    for (const handler of handlers) {
      try {
        await handler(payload);
      } catch (error) {
        this.logger.error(
          `Handler for ${channel} threw: ${(error as Error).message}`,
        );
      }
    }
  }

  private toChannel(topic: string): string {
    return `${this.channelPrefix}${topic}`;
  }
}
