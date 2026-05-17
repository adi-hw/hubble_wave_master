/**
 * F052 — AVA chat transactionality (AVACoreService surface).
 *
 * Canon §10 ("every action must be explainable") requires that the writes a
 * chat turn produces succeed or fail together. The chat orchestrator at
 * apps/api/src/app/data/ava/ava-core.service.ts performs N database writes
 * around a single external LLM call. The plan estimated 7 writes; the actual
 * sequence is (see the docstring on `AVACoreService.chat`):
 *
 *   Pre-LLM transaction (3 writes — atomic):
 *     1. Conversation (find or insert)
 *     2. User message (insert)
 *     3. Intent classification (insert)
 *
 *   LLM provider call (external HTTP; intentionally NOT wrapped in any
 *   transaction — holding row locks across the LLM call would block other
 *   tenants).
 *
 *   Post-LLM transaction (5 writes — atomic, last one conditional):
 *     4. Assistant message (insert)
 *     5. Conversation row update
 *     6. Usage metrics — response_time (insert)
 *     7. Usage metrics — token_usage (insert)
 *     8. (conditional, ticket-create intent only) Suggestion (insert)
 *
 * This suite uses a real Postgres DataSource (via `createTestDataSource`)
 * with the live `AVACoreService` class. Each failure-injection case forces a
 * throw at a specific repository write inside one of the transactions and
 * asserts the entire transaction rolled back — no orphan rows, no partial
 * state.
 *
 * The pre-LLM block stands alone: a failure between the LLM call and the
 * post-LLM block leaves the user message persisted (that is correct UX;
 * users expect their sent messages to survive transient LLM failures). The
 * post-LLM block is atomic for everything the LLM's success produced.
 */

import { DataSource, EntityManager } from 'typeorm';
import {
  AVAConversation,
  AVAMessage,
  AVAIntent,
  AVASuggestion,
  AVAUsageMetrics,
  AVAContext,
  AVAFeedback,
} from '@hubblewave/instance-db';
import { AVACoreService } from '../../src/app/data/ava/ava-core.service';
import { LLMProviderService } from '../../src/app/data/ava/llm-provider.service';
import { createTestDataSource } from '../helpers/test-database';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = 'test-org';

const USER_CTX = {
  id: USER_ID,
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  permissions: ['ticket.create', 'ticket.read', 'asset.read'],
  organizationId: ORG_ID,
  organizationName: 'Test Org',
};

function buildLlmStub(): LLMProviderService {
  // The real LLMProviderService talks to Claude/OpenAI. The transactional
  // contract under test is independent of the LLM content, so a stub
  // returning a fixed shape is sufficient.
  return {
    complete: jest.fn().mockResolvedValue({
      id: 'fake-response-id',
      content: 'Sure, I can help you create a ticket.',
      toolCalls: [{ id: 't1', name: 'create_ticket', arguments: { title: 'x' } }],
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      latency: 42,
      model: 'fake-model',
    }),
  } as unknown as LLMProviderService;
}

async function buildService(
  dataSource: DataSource,
): Promise<{ service: AVACoreService; llmStub: LLMProviderService }> {
  const llmStub = buildLlmStub();
  // Instantiate AVACoreService directly with concrete repositories — the
  // class only needs typed Repository<T> instances and a DataSource, which
  // is exactly what we can build off a live datasource without spinning up
  // a full Nest TestingModule.
  const service = new AVACoreService(
    dataSource.getRepository(AVAConversation),
    dataSource.getRepository(AVAMessage),
    dataSource.getRepository(AVAIntent),
    dataSource.getRepository(AVAContext),
    dataSource.getRepository(AVASuggestion),
    dataSource.getRepository(AVAFeedback),
    llmStub,
    dataSource,
  );
  return { service, llmStub };
}

interface DbSnapshot {
  conversations: number;
  messages: number;
  intents: number;
  metrics: number;
  suggestions: number;
}

async function snapshot(ds: DataSource): Promise<DbSnapshot> {
  const conv = await ds.getRepository(AVAConversation).count();
  const msg = await ds.getRepository(AVAMessage).count();
  const intent = await ds.getRepository(AVAIntent).count();
  const metric = await ds.getRepository(AVAUsageMetrics).count();
  const suggestion = await ds.getRepository(AVASuggestion).count();
  return {
    conversations: conv,
    messages: msg,
    intents: intent,
    metrics: metric,
    suggestions: suggestion,
  };
}

describe('AVACoreService.chat — F052 transactionality', () => {
  let dataSource: DataSource;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const created = await createTestDataSource({
      entities: [
        AVAConversation,
        AVAMessage,
        AVAIntent,
        AVASuggestion,
        AVAUsageMetrics,
        AVAContext,
        AVAFeedback,
      ],
      schemas: ['ava'],
    });
    dataSource = created.dataSource;
    cleanup = created.cleanup;
  }, 60_000);

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  beforeEach(async () => {
    // TRUNCATE every AVA table between tests so each case starts from a
    // known-empty baseline. CASCADE drops dependent FK rows in one shot.
    await dataSource.query(
      'TRUNCATE TABLE ' +
        '"ava"."ava_suggestions", ' +
        '"ava"."ava_usage_metrics", ' +
        '"ava"."ava_intents", ' +
        '"ava"."ava_messages", ' +
        '"ava"."ava_conversations" ' +
        'RESTART IDENTITY CASCADE',
    );
  });

  afterEach(() => {
    // Restore all spies — a leaked `jest.spyOn(dataSource, 'transaction')`
    // would otherwise apply its mockImplementation to subsequent tests and
    // cause cross-test interference (the typical symptom: a later test that
    // never spied on transaction recurses through a prior test's spy).
    jest.restoreAllMocks();
  });

  describe('happy path baseline', () => {
    it('persists conversation + user message + intent + assistant message + 2 metrics + suggestion (ticket.create intent)', async () => {
      const { service } = await buildService(dataSource);

      const response = await service.chat(
        { message: 'create a ticket for the server' },
        USER_CTX,
      );

      expect(response.conversationId).toBeDefined();
      expect(response.messageId).toBeDefined();

      const after = await snapshot(dataSource);
      expect(after.conversations).toBe(1);
      // 2 messages: user + assistant
      expect(after.messages).toBe(2);
      // 1 intent row keyed to the user message
      expect(after.intents).toBe(1);
      // 2 metrics rows: response_time + token_usage
      expect(after.metrics).toBe(2);
      // 1 suggestion (ticket.create triggers the conditional branch)
      expect(after.suggestions).toBe(1);

      // Conversation header reflects both turns.
      const conv = await dataSource
        .getRepository(AVAConversation)
        .findOneByOrFail({ id: response.conversationId });
      expect(conv.messageCount).toBe(2);
      expect(conv.title).toBeDefined();
      expect(conv.lastActivityAt).toBeDefined();
    });

    it('does not write a suggestion for non-ticket-create intents', async () => {
      const { service } = await buildService(dataSource);
      await service.chat({ message: 'hello there' }, USER_CTX);

      const after = await snapshot(dataSource);
      expect(after.conversations).toBe(1);
      expect(after.messages).toBe(2);
      expect(after.intents).toBe(1);
      expect(after.metrics).toBe(2);
      expect(after.suggestions).toBe(0);
    });
  });

  describe('Pre-LLM transaction rollback', () => {
    it('rolls back the user message + intent when the intent insert fails', async () => {
      const { service, llmStub } = await buildService(dataSource);

      // Monkey-patch the EntityManager-bound AVAIntent repo at save time to
      // throw on the very first save call. The test runs inside the real
      // transaction so the throw must roll the whole block back.
      const originalTxn = dataSource.transaction.bind(dataSource) as <U>(
        cb: (mgr: EntityManager) => Promise<U>,
      ) => Promise<U>;
      jest.spyOn(dataSource, 'transaction').mockImplementationOnce(
        (async (cb: (mgr: EntityManager) => Promise<unknown>) => {
          // First call is the pre-LLM block. Wrap the EntityManager so the
          // AVAIntent save throws.
          return originalTxn(async (mgr: EntityManager) => {
            const realGetRepo = mgr.getRepository.bind(mgr);
            mgr.getRepository = ((entity: any) => {
              const repo = realGetRepo(entity);
              if (entity === AVAIntent) {
                const repoWithBreak = Object.create(repo);
                repoWithBreak.save = jest
                  .fn()
                  .mockRejectedValueOnce(new Error('injected: intent save failed'));
                return repoWithBreak;
              }
              return repo;
            }) as typeof mgr.getRepository;
            return cb(mgr);
          });
        }) as any,
      );

      await expect(
        service.chat({ message: 'create a ticket for me' }, USER_CTX),
      ).rejects.toThrow('injected: intent save failed');

      // LLM must not have been called — the failure is pre-LLM.
      expect(llmStub.complete).not.toHaveBeenCalled();

      // Every AVA table is empty: the rollback discarded the conversation,
      // user message, and intent attempts.
      const after = await snapshot(dataSource);
      expect(after).toEqual({
        conversations: 0,
        messages: 0,
        intents: 0,
        metrics: 0,
        suggestions: 0,
      });
    });

    it('rolls back the conversation + user message when the user-message insert fails', async () => {
      const { service, llmStub } = await buildService(dataSource);

      const originalTxn = dataSource.transaction.bind(dataSource) as <U>(
        cb: (mgr: EntityManager) => Promise<U>,
      ) => Promise<U>;
      jest.spyOn(dataSource, 'transaction').mockImplementationOnce(
        (async (cb: (mgr: EntityManager) => Promise<unknown>) => {
          return originalTxn(async (mgr: EntityManager) => {
            const realGetRepo = mgr.getRepository.bind(mgr);
            mgr.getRepository = ((entity: any) => {
              const repo = realGetRepo(entity);
              if (entity === AVAMessage) {
                const repoWithBreak = Object.create(repo);
                repoWithBreak.save = jest
                  .fn()
                  .mockRejectedValueOnce(new Error('injected: user message save failed'));
                return repoWithBreak;
              }
              return repo;
            }) as typeof mgr.getRepository;
            return cb(mgr);
          });
        }) as any,
      );

      await expect(
        service.chat({ message: 'create a ticket' }, USER_CTX),
      ).rejects.toThrow('injected: user message save failed');

      expect(llmStub.complete).not.toHaveBeenCalled();

      const after = await snapshot(dataSource);
      expect(after).toEqual({
        conversations: 0,
        messages: 0,
        intents: 0,
        metrics: 0,
        suggestions: 0,
      });
    });

    it('rolls back the conversation insert when it fails (new-conversation path)', async () => {
      const { service, llmStub } = await buildService(dataSource);

      const originalTxn = dataSource.transaction.bind(dataSource) as <U>(
        cb: (mgr: EntityManager) => Promise<U>,
      ) => Promise<U>;
      jest.spyOn(dataSource, 'transaction').mockImplementationOnce(
        (async (cb: (mgr: EntityManager) => Promise<unknown>) => {
          return originalTxn(async (mgr: EntityManager) => {
            const realGetRepo = mgr.getRepository.bind(mgr);
            mgr.getRepository = ((entity: any) => {
              const repo = realGetRepo(entity);
              if (entity === AVAConversation) {
                const repoWithBreak = Object.create(repo);
                repoWithBreak.save = jest
                  .fn()
                  .mockRejectedValueOnce(new Error('injected: conversation save failed'));
                return repoWithBreak;
              }
              return repo;
            }) as typeof mgr.getRepository;
            return cb(mgr);
          });
        }) as any,
      );

      await expect(
        service.chat({ message: 'create a ticket' }, USER_CTX),
      ).rejects.toThrow('injected: conversation save failed');

      expect(llmStub.complete).not.toHaveBeenCalled();

      const after = await snapshot(dataSource);
      expect(after.conversations).toBe(0);
      expect(after.messages).toBe(0);
      expect(after.intents).toBe(0);
    });
  });

  describe('Post-LLM transaction rollback', () => {
    // After Transaction 1 commits and the LLM call succeeds, Transaction 2
    // begins. Any failure inside it must roll back ALL of: assistant message,
    // conversation header update, the 2 metrics rows, and (conditionally) the
    // suggestion row. The pre-LLM commits (conversation, user message, intent)
    // remain — that is the design intent. Users expect their sent messages
    // to persist across transient assistant-side failures.

    async function seedPreTxnState(): Promise<DbSnapshot> {
      // Use a helper test that runs the happy path to produce a baseline
      // database state; then truncate and re-run with failure injection.
      // Simpler approach: count the pre-LLM rows directly by checking the
      // snapshot AFTER the pre-LLM commit but BEFORE the failure.
      return { conversations: 1, messages: 1, intents: 1, metrics: 0, suggestions: 0 };
    }

    function spyTxnNthCall(
      n: number,
      breakEntity: any,
      breakMethod: 'save' | 'update' = 'save',
    ): void {
      // Capture the underlying transaction method BEFORE spying. After
      // jest.spyOn replaces the property, calling `dataSource.transaction`
      // would land back on the spy → infinite recursion. We grab the
      // prototype's method (the spy lives on the instance, not the
      // prototype) and invoke it with `dataSource` as `this`.
      const realTxn = (Object.getPrototypeOf(dataSource).transaction).bind(
        dataSource,
      ) as <U>(cb: (mgr: EntityManager) => Promise<U>) => Promise<U>;
      let callCount = 0;
      jest.spyOn(dataSource, 'transaction').mockImplementation(
        (async (cb: (mgr: EntityManager) => Promise<unknown>) => {
          callCount += 1;
          if (callCount !== n) {
            return realTxn(cb);
          }
          return realTxn(async (mgr: EntityManager) => {
            const realGetRepo = mgr.getRepository.bind(mgr);
            mgr.getRepository = ((entity: any) => {
              const repo = realGetRepo(entity);
              if (entity === breakEntity) {
                const repoWithBreak = Object.create(repo);
                (repoWithBreak as any)[breakMethod] = jest
                  .fn()
                  .mockRejectedValueOnce(
                    new Error(`injected: ${breakEntity.name}.${breakMethod} failed`),
                  );
                return repoWithBreak;
              }
              return repo;
            }) as typeof mgr.getRepository;
            return cb(mgr);
          });
        }) as any,
      );
    }

    it('rolls back assistant message + conversation update + metrics when assistant message save fails', async () => {
      const { service, llmStub } = await buildService(dataSource);
      spyTxnNthCall(2, AVAMessage, 'save');

      await expect(
        service.chat({ message: 'create a ticket for the server' }, USER_CTX),
      ).rejects.toThrow(/injected/);

      // LLM was called (we're past Transaction 1).
      expect(llmStub.complete).toHaveBeenCalledTimes(1);

      // Pre-LLM block survives, post-LLM block rolled back.
      const after = await snapshot(dataSource);
      const pre = await seedPreTxnState();
      expect(after.conversations).toBe(pre.conversations);
      expect(after.messages).toBe(pre.messages); // ONLY the user message
      expect(after.intents).toBe(pre.intents);
      expect(after.metrics).toBe(0);
      expect(after.suggestions).toBe(0);

      // Conversation header still has messageCount=0 (the pre-LLM block
      // creates it with 0; the post-LLM update that would set it to 2 was
      // rolled back).
      const conv = await dataSource.getRepository(AVAConversation).findOneOrFail({
        where: { userId: USER_ID, organizationId: ORG_ID },
      });
      expect(conv.messageCount).toBe(0);
    });

    it('rolls back conversation update + metrics + suggestion when the conversation update fails', async () => {
      const { service, llmStub } = await buildService(dataSource);
      spyTxnNthCall(2, AVAConversation, 'update');

      await expect(
        service.chat({ message: 'create a ticket for the server' }, USER_CTX),
      ).rejects.toThrow(/injected/);

      expect(llmStub.complete).toHaveBeenCalledTimes(1);

      const after = await snapshot(dataSource);
      const pre = await seedPreTxnState();
      // Crucial assertion: even though the assistant message INSERT succeeded
      // before the UPDATE threw, the wrapping transaction rolled BOTH back.
      expect(after.conversations).toBe(pre.conversations);
      expect(after.messages).toBe(pre.messages); // assistant message rolled back
      expect(after.intents).toBe(pre.intents);
      expect(after.metrics).toBe(0);
      expect(after.suggestions).toBe(0);
    });

    it('rolls back metrics + suggestion when the second metrics save fails', async () => {
      const { service, llmStub } = await buildService(dataSource);

      // Break the SECOND metrics save (token_usage). Both metric saves use
      // the same repo, so a one-shot rejection on the second call requires
      // tracking the call sequence. Capture the real transaction via the
      // prototype to avoid the spy recursing on itself.
      const realTxn = (Object.getPrototypeOf(dataSource).transaction).bind(
        dataSource,
      ) as <U>(cb: (mgr: EntityManager) => Promise<U>) => Promise<U>;
      let callCount = 0;
      jest
        .spyOn(dataSource, 'transaction')
        .mockImplementation((async (cb: (mgr: EntityManager) => Promise<unknown>) => {
          callCount += 1;
          if (callCount !== 2) {
            return realTxn(cb);
          }
          return realTxn(async (mgr: EntityManager) => {
            const realGetRepo = mgr.getRepository.bind(mgr);
            let metricsSaveCount = 0;
            mgr.getRepository = ((entity: any) => {
              const repo = realGetRepo(entity);
              if (entity === AVAUsageMetrics) {
                const repoWithBreak = Object.create(repo);
                const realSave = repo.save.bind(repo);
                repoWithBreak.save = jest.fn((arg: any) => {
                  metricsSaveCount += 1;
                  if (metricsSaveCount === 2) {
                    return Promise.reject(
                      new Error('injected: AVAUsageMetrics.save (token_usage) failed'),
                    );
                  }
                  return realSave(arg);
                });
                return repoWithBreak;
              }
              return repo;
            }) as typeof mgr.getRepository;
            return cb(mgr);
          });
        }) as any);

      await expect(
        service.chat({ message: 'create a ticket for the server' }, USER_CTX),
      ).rejects.toThrow(/token_usage/);

      expect(llmStub.complete).toHaveBeenCalledTimes(1);

      const after = await snapshot(dataSource);
      // The first metrics save succeeded inside the transaction but the
      // second threw — the transaction wrapper rolls both back. No metrics
      // rows survive.
      expect(after.metrics).toBe(0);
      // Assistant message also rolled back because it was inside the same
      // transaction.
      expect(after.messages).toBe(1); // only the user message remains
      // Conversation header has not been updated (rolled back).
      const conv = await dataSource.getRepository(AVAConversation).findOneOrFail({
        where: { userId: USER_ID, organizationId: ORG_ID },
      });
      expect(conv.messageCount).toBe(0);
      // Suggestion also did not persist.
      expect(after.suggestions).toBe(0);
    });

    it('rolls back the suggestion + everything before it when the suggestion save fails (ticket.create intent)', async () => {
      const { service, llmStub } = await buildService(dataSource);
      spyTxnNthCall(2, AVASuggestion, 'save');

      await expect(
        service.chat({ message: 'create a ticket for the laptop' }, USER_CTX),
      ).rejects.toThrow(/AVASuggestion.*failed/);

      expect(llmStub.complete).toHaveBeenCalledTimes(1);

      const after = await snapshot(dataSource);
      const pre = await seedPreTxnState();
      // The suggestion is the LAST write in the post-LLM block; its failure
      // must roll back every earlier write in that block (assistant message,
      // conversation update, both metrics, and the suggestion attempt).
      expect(after.conversations).toBe(pre.conversations);
      expect(after.messages).toBe(pre.messages); // assistant message rolled back
      expect(after.intents).toBe(pre.intents);
      expect(after.metrics).toBe(0);
      expect(after.suggestions).toBe(0);

      // Conversation header still has messageCount=0 (update rolled back).
      const conv = await dataSource.getRepository(AVAConversation).findOneOrFail({
        where: { userId: USER_ID, organizationId: ORG_ID },
      });
      expect(conv.messageCount).toBe(0);
    });
  });

  describe('LLM failure between transactions', () => {
    it('keeps the pre-LLM commit but writes no post-LLM rows when the LLM call throws', async () => {
      const { service, llmStub } = await buildService(dataSource);
      (llmStub.complete as jest.Mock).mockRejectedValueOnce(
        new Error('LLM provider unavailable'),
      );

      await expect(
        service.chat({ message: 'create a ticket' }, USER_CTX),
      ).rejects.toThrow('LLM provider unavailable');

      // Pre-LLM block committed: the user's input is preserved (correct UX).
      const after = await snapshot(dataSource);
      expect(after.conversations).toBe(1);
      expect(after.messages).toBe(1); // user message only
      expect(after.intents).toBe(1);
      // Post-LLM block never opened.
      expect(after.metrics).toBe(0);
      expect(after.suggestions).toBe(0);

      // Conversation header still has messageCount=0 (the post-LLM update
      // that would bump it to 2 never ran).
      const conv = await dataSource.getRepository(AVAConversation).findOneOrFail({
        where: { userId: USER_ID, organizationId: ORG_ID },
      });
      expect(conv.messageCount).toBe(0);
    });
  });
});
