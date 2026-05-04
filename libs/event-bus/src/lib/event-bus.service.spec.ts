import { Test, TestingModule } from '@nestjs/testing';

import {
  EVENT_BUS_CHANNEL_PREFIX,
  EVENT_BUS_PUBLISHER,
  EVENT_BUS_SUBSCRIBER,
} from './event-bus.constants';
import { EventBusService } from './event-bus.service';

/**
 * In-memory Redis stand-in. Mimics ioredis well enough for pub/sub round-trips:
 * publisher writes a (channel, message) tuple, subscriber receives it via the
 * same fake hub.
 */
class FakeRedisHub {
  private listeners = new Map<string, Array<(channel: string, message: string) => void>>();

  emit(channel: string, message: string): void {
    const handlers = this.listeners.get(channel) ?? [];
    for (const handler of handlers) {
      handler(channel, message);
    }
  }

  attach(channel: string, handler: (channel: string, message: string) => void): void {
    const existing = this.listeners.get(channel) ?? [];
    existing.push(handler);
    this.listeners.set(channel, existing);
  }
}

class FakePublisher {
  constructor(private readonly hub: FakeRedisHub) {}

  publish(channel: string, message: string): Promise<number> {
    this.hub.emit(channel, message);
    return Promise.resolve(1);
  }
}

class FakeSubscriber {
  private messageHandlers: Array<(channel: string, message: string) => void> = [];
  private subscribedChannels = new Set<string>();

  constructor(private readonly hub: FakeRedisHub) {}

  on(event: string, handler: (channel: string, message: string) => void): this {
    if (event === 'message') {
      this.messageHandlers.push(handler);
      // Re-attach for any already-subscribed channel.
      for (const channel of this.subscribedChannels) {
        this.hub.attach(channel, handler);
      }
    }
    return this;
  }

  subscribe(channel: string): Promise<number> {
    this.subscribedChannels.add(channel);
    for (const handler of this.messageHandlers) {
      this.hub.attach(channel, handler);
    }
    return Promise.resolve(1);
  }
}

describe('EventBusService', () => {
  let service: EventBusService;
  let hub: FakeRedisHub;

  beforeEach(async () => {
    hub = new FakeRedisHub();
    const publisher = new FakePublisher(hub);
    const subscriber = new FakeSubscriber(hub);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventBusService,
        { provide: EVENT_BUS_PUBLISHER, useValue: publisher },
        { provide: EVENT_BUS_SUBSCRIBER, useValue: subscriber },
        { provide: EVENT_BUS_CHANNEL_PREFIX, useValue: 'test:' },
      ],
    }).compile();

    service = module.get<EventBusService>(EventBusService);
    service.onModuleInit();
  });

  it('delivers a published payload to a subscriber on the same topic', async () => {
    const received: Array<{ userIds: string[] }> = [];
    service.subscribe<{ userIds: string[] }>('identity.user-role.changed', (payload) => {
      received.push(payload);
    });

    await service.publish('identity.user-role.changed', { userIds: ['user-1'] });

    // Allow microtasks for the async dispatch path.
    await new Promise((resolve) => setImmediate(resolve));

    expect(received).toEqual([{ userIds: ['user-1'] }]);
  });

  it('fans out to every subscriber registered on a topic', async () => {
    const a: unknown[] = [];
    const b: unknown[] = [];
    service.subscribe('identity.role-permission.changed', (payload) => {
      a.push(payload);
    });
    service.subscribe('identity.role-permission.changed', (payload) => {
      b.push(payload);
    });

    await service.publish('identity.role-permission.changed', { roleIds: ['r1', 'r2'] });
    await new Promise((resolve) => setImmediate(resolve));

    expect(a).toEqual([{ roleIds: ['r1', 'r2'] }]);
    expect(b).toEqual([{ roleIds: ['r1', 'r2'] }]);
  });

  it('isolates topics — a subscriber on topic A does not see topic B', async () => {
    const aReceived: unknown[] = [];
    service.subscribe('identity.user-role.changed', (payload) => {
      aReceived.push(payload);
    });

    await service.publish('identity.role-permission.changed', { roleIds: ['r1'] });
    await new Promise((resolve) => setImmediate(resolve));

    expect(aReceived).toHaveLength(0);
  });

  it('continues delivering to other handlers when one throws', async () => {
    const surviving: unknown[] = [];
    service.subscribe('identity.user-role.changed', () => {
      throw new Error('boom');
    });
    service.subscribe('identity.user-role.changed', (payload) => {
      surviving.push(payload);
    });

    await service.publish('identity.user-role.changed', { userIds: ['u1'] });
    await new Promise((resolve) => setImmediate(resolve));

    expect(surviving).toEqual([{ userIds: ['u1'] }]);
  });

  it('drops malformed messages without invoking handlers', async () => {
    const received: unknown[] = [];
    service.subscribe('identity.user-role.changed', (payload) => {
      received.push(payload);
    });

    // Publish raw garbage directly via the hub, simulating a bad sender.
    hub.emit('test:identity.user-role.changed', '{not json');
    await new Promise((resolve) => setImmediate(resolve));

    expect(received).toHaveLength(0);
  });

  it('prefixes channels with the configured prefix', async () => {
    const calls: string[] = [];
    const publisher = {
      publish: (channel: string, _message: string) => {
        calls.push(channel);
        return Promise.resolve(1);
      },
    };
    const subscriber = new FakeSubscriber(hub);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventBusService,
        { provide: EVENT_BUS_PUBLISHER, useValue: publisher },
        { provide: EVENT_BUS_SUBSCRIBER, useValue: subscriber },
        { provide: EVENT_BUS_CHANNEL_PREFIX, useValue: 'hw:events:' },
      ],
    }).compile();

    const prefixed = module.get<EventBusService>(EventBusService);
    prefixed.onModuleInit();
    await prefixed.publish('identity.user-role.changed', { userIds: ['u1'] });

    expect(calls).toEqual(['hw:events:identity.user-role.changed']);
  });
});
