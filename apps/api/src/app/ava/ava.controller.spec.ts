import { DataSource, EntityManager } from 'typeorm';
import { Logger } from '@nestjs/common';
import { Response } from 'express';
import { AVAController } from './ava.controller';

/**
 * F052 — AVA chat handler transactional contract.
 *
 * The chat and chatStream handlers chain multiple writes (start conversation,
 * write user message, write assistant message) around a network call to the
 * LLM. Before this fix the chain ran without any transaction, so a DB blip
 * between writes left conversations in an inconsistent state — most painfully
 * a committed user turn with no committed assistant reply.
 *
 * The fix splits each handler into two short transactions with the LLM call
 * sitting between them:
 *
 *   Transaction 1  — get-or-create conversation (+ persist user message for
 *                    non-streaming chat)
 *   LLM call       — runs outside any transaction (network IO, can't roll back)
 *   Transaction 2  — persist the assistant reply (and the user turn too, for
 *                    chatStream, since the streaming variant defers it)
 *
 * These tests build a fake DataSource that simulates TypeORM transactional
 * semantics: pending writes only commit if the wrapped function resolves;
 * throwing inside discards the pending writes. They then exercise the
 * happy path, Transaction-1-fails, and Transaction-2-fails cases for both
 * chat and chatStream and assert exactly the right writes land or roll back.
 */

type CommittedWrite =
  | { kind: 'start'; conversationId: string }
  | { kind: 'message'; conversationId: string; role: 'user' | 'assistant'; content: string };

type FakeRequest = {
  headers: Record<string, string>;
  user?: Record<string, unknown>;
};

interface FailureConfig {
  failTxnOnCall?: number;
  failOnOperation?: 'start' | 'addUser' | 'addAssistant' | 'getHistory';
}

function buildFakeDataSource(opts: FailureConfig = {}) {
  const committed: CommittedWrite[] = [];
  let transactionCallCount = 0;
  let conversationCounter = 0;

  const buildManager = (pending: CommittedWrite[]): EntityManager => {
    return { _pending: pending, _isFakeTxn: true } as unknown as EntityManager;
  };

  const dataSource = {
    transaction: jest.fn(async <T>(fn: (m: EntityManager) => Promise<T>): Promise<T> => {
      transactionCallCount += 1;
      const callIndex = transactionCallCount;
      const pending: CommittedWrite[] = [];
      const manager = buildManager(pending);

      if (opts.failTxnOnCall === callIndex) {
        throw new Error(`simulated DB failure on transaction #${callIndex}`);
      }

      const result = await fn(manager);
      committed.push(...pending);
      return result;
    }),
    manager: { _isFakeManager: true } as unknown as EntityManager,
  } as unknown as DataSource;

  /**
   * Stub ConversationMemoryService that pushes pending writes onto the
   * manager's pending list and respects targeted failures via opts.
   */
  const conversationMemory = {
    startConversation: jest.fn(
      async (manager: EntityManager, _userId: string, _orgId: string) => {
        if (opts.failOnOperation === 'start') {
          throw new Error('simulated startConversation failure');
        }
        conversationCounter += 1;
        const id = `conv-${conversationCounter}`;
        const pending = (manager as unknown as { _pending: CommittedWrite[] })._pending;
        pending.push({ kind: 'start', conversationId: id });
        return {
          id,
          userId: 'u-1',
          organizationId: 'org-1',
          status: 'active' as const,
          messages: [],
          context: {},
          messageCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    ),
    getConversationHistory: jest.fn(async () => {
      if (opts.failOnOperation === 'getHistory') {
        throw new Error('simulated getConversationHistory failure');
      }
      return [];
    }),
    addMessage: jest.fn(
      async (
        manager: EntityManager,
        conversationId: string,
        _orgId: string,
        _userId: string,
        message: { role: 'user' | 'assistant'; content: string },
      ) => {
        if (opts.failOnOperation === 'addUser' && message.role === 'user') {
          throw new Error('simulated user addMessage failure');
        }
        if (opts.failOnOperation === 'addAssistant' && message.role === 'assistant') {
          throw new Error('simulated assistant addMessage failure');
        }
        const pending = (manager as unknown as { _pending: CommittedWrite[] })._pending;
        pending.push({
          kind: 'message',
          conversationId,
          role: message.role,
          content: message.content,
        });
      },
    ),
  };

  return { dataSource, committed, conversationMemory, transactionCalls: () => transactionCallCount };
}

function buildController(
  dataSource: DataSource,
  conversationMemory: ReturnType<typeof buildFakeDataSource>['conversationMemory'],
  llmResponse: { message: string; sources?: unknown[] } = { message: 'AVA response' },
  llmShouldFail = false,
): AVAController {
  const avaService = {
    chat: jest.fn(async () => {
      if (llmShouldFail) {
        throw new Error('simulated LLM failure');
      }
      return {
        message: llmResponse.message,
        sources: llmResponse.sources || [],
        suggestedActions: [],
        followUpQuestions: [],
        cards: [],
        confidence: 0.9,
        model: 'test-model',
        duration: 42,
      };
    }),
    chatStream: jest.fn(async function* () {
      if (llmShouldFail) {
        throw new Error('simulated LLM stream failure');
      }
      yield { type: 'chunk', data: 'AVA' };
      yield { type: 'chunk', data: ' response' };
      yield { type: 'done' };
    }),
  };

  const controller = new AVAController(
    avaService as any,
    {} as any, // llmService — not used in chat/chatStream
    conversationMemory as any,
    {} as any, // insightsService
    {} as any, // actionExecutor
    {} as any, // previewService
    dataSource,
  );

  // Silence the controller's logger so error-path tests don't pollute
  // jest output. Reassigns the private field via a typed cast.
  (controller as unknown as { logger: Logger }).logger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  } as unknown as Logger;

  return controller;
}

function buildUser() {
  return {
    id: 'u-1',
    username: 'tester',
    roles: ['admin'],
    sessionId: 'sess-1',
  } as any;
}

function buildReq(): FakeRequest {
  return {
    headers: { 'x-instance-slug': 'org-1' },
    user: { organizationId: 'org-1' },
  };
}

function buildResMock() {
  const written: string[] = [];
  const res = {
    setHeader: jest.fn(),
    write: jest.fn((chunk: string) => {
      written.push(chunk);
      return true;
    }),
    end: jest.fn(),
  };
  return { res: res as unknown as Response, written };
}

describe('AVAController chat — F052 transactional persistence', () => {
  describe('happy path', () => {
    it('commits user message in Transaction 1, then assistant message in Transaction 2', async () => {
      const { dataSource, committed, conversationMemory, transactionCalls } = buildFakeDataSource();
      const controller = buildController(dataSource, conversationMemory);

      const result = await controller.chat(
        buildUser(),
        { message: 'hello AVA' },
        buildReq() as any,
      );

      expect(transactionCalls()).toBe(2);
      // Transaction 1 wrote the conversation start + user message.
      expect(committed).toEqual([
        { kind: 'start', conversationId: 'conv-1' },
        { kind: 'message', conversationId: 'conv-1', role: 'user', content: 'hello AVA' },
        { kind: 'message', conversationId: 'conv-1', role: 'assistant', content: 'AVA response' },
      ]);
      expect(result.conversationId).toBe('conv-1');
      expect(result.message).toBe('AVA response');
    });

    it('reuses an existing conversationId without starting a new one', async () => {
      const { dataSource, committed, conversationMemory } = buildFakeDataSource();
      const controller = buildController(dataSource, conversationMemory);

      const result = await controller.chat(
        buildUser(),
        { message: 'follow-up', conversationId: 'conv-existing' },
        buildReq() as any,
      );

      expect(conversationMemory.startConversation).not.toHaveBeenCalled();
      expect(conversationMemory.getConversationHistory).toHaveBeenCalled();
      expect(committed.filter((w) => w.kind === 'start')).toHaveLength(0);
      // Both user and assistant messages still persisted.
      const messages = committed.filter((w) => w.kind === 'message');
      expect(messages).toHaveLength(2);
      expect(result.conversationId).toBe('conv-existing');
    });
  });

  describe('Transaction 1 rollback', () => {
    it('rolls back the user message when Transaction 1 fails — neither conversation nor user message persisted', async () => {
      const { dataSource, committed, conversationMemory, transactionCalls } = buildFakeDataSource({
        failOnOperation: 'addUser',
      });
      const controller = buildController(dataSource, conversationMemory);

      await expect(
        controller.chat(buildUser(), { message: 'hello' }, buildReq() as any),
      ).rejects.toThrow('simulated user addMessage failure');

      // Transaction 2 is never attempted; the LLM call is also skipped.
      expect(transactionCalls()).toBe(1);
      expect(committed).toEqual([]);
    });

    it('does not call the LLM if Transaction 1 fails', async () => {
      const { dataSource, conversationMemory } = buildFakeDataSource({ failOnOperation: 'addUser' });
      const controller = buildController(dataSource, conversationMemory);
      const avaService = (controller as unknown as { avaService: { chat: jest.Mock } }).avaService;

      await expect(
        controller.chat(buildUser(), { message: 'hello' }, buildReq() as any),
      ).rejects.toThrow();

      expect(avaService.chat).not.toHaveBeenCalled();
    });
  });

  describe('Transaction 2 rollback', () => {
    it('keeps the user message committed when Transaction 2 fails; assistant message NOT persisted; error logged with conversationId', async () => {
      const { dataSource, committed, conversationMemory } = buildFakeDataSource({
        failTxnOnCall: 2,
      });
      const controller = buildController(dataSource, conversationMemory);
      const loggerErrorSpy = jest.spyOn(
        (controller as unknown as { logger: Logger }).logger,
        'error',
      );

      await expect(
        controller.chat(buildUser(), { message: 'hello' }, buildReq() as any),
      ).rejects.toThrow(/transaction #2/);

      // User message + conversation row from Transaction 1 stay committed.
      expect(committed).toEqual([
        { kind: 'start', conversationId: 'conv-1' },
        { kind: 'message', conversationId: 'conv-1', role: 'user', content: 'hello' },
      ]);
      // No assistant message persisted.
      expect(committed.filter((w) => w.kind === 'message' && w.role === 'assistant')).toHaveLength(0);
      // Log mentions conversationId so operators can correlate the lost reply.
      expect(loggerErrorSpy).toHaveBeenCalled();
      const logMsg = loggerErrorSpy.mock.calls[0][0] as string;
      expect(logMsg).toContain('F052');
      expect(logMsg).toContain('conv-1');
    });

    it('keeps the user message committed even if the inner addMessage call throws during Transaction 2', async () => {
      const { dataSource, committed, conversationMemory } = buildFakeDataSource({
        failOnOperation: 'addAssistant',
      });
      const controller = buildController(dataSource, conversationMemory);

      await expect(
        controller.chat(buildUser(), { message: 'hello' }, buildReq() as any),
      ).rejects.toThrow('simulated assistant addMessage failure');

      // Transaction 1 stayed committed, Transaction 2 rolled back.
      expect(committed.filter((w) => w.kind === 'message' && w.role === 'user')).toHaveLength(1);
      expect(committed.filter((w) => w.kind === 'message' && w.role === 'assistant')).toHaveLength(0);
    });
  });
});

describe('AVAController chatStream — F052 transactional persistence', () => {
  it('commits conversation + history fetch in Transaction 1, streams, then commits BOTH messages in Transaction 2', async () => {
    const { dataSource, committed, conversationMemory, transactionCalls } = buildFakeDataSource();
    const controller = buildController(dataSource, conversationMemory);
    const { res, written } = buildResMock();

    await controller.chatStream(
      buildUser(),
      { message: 'streaming hi' },
      buildReq() as any,
      res,
    );

    expect(transactionCalls()).toBe(2);
    expect(committed).toEqual([
      { kind: 'start', conversationId: 'conv-1' },
      { kind: 'message', conversationId: 'conv-1', role: 'user', content: 'streaming hi' },
      { kind: 'message', conversationId: 'conv-1', role: 'assistant', content: 'AVA response' },
    ]);

    // SSE protocol: conversationId pushed first, chunks during stream, [DONE] at the end.
    const joined = written.join('');
    expect(joined).toContain('"type":"conversationId"');
    expect(joined).toContain('"conv-1"');
    expect(joined).toContain('[DONE]');
  });

  it('rolls back the streaming-handler init when Transaction 1 fails and never opens the SSE stream', async () => {
    const { dataSource, committed, conversationMemory } = buildFakeDataSource({
      failOnOperation: 'start',
    });
    const controller = buildController(dataSource, conversationMemory);
    const { res, written } = buildResMock();

    await expect(
      controller.chatStream(
        buildUser(),
        { message: 'streaming hi' },
        buildReq() as any,
        res,
      ),
    ).rejects.toThrow('simulated startConversation failure');

    // Nothing committed and the SSE writer was never used (no headers, no chunks).
    expect(committed).toEqual([]);
    expect(written).toEqual([]);
    // Stream never finalised, so res.end was never called either.
    expect((res as unknown as { end: jest.Mock }).end).not.toHaveBeenCalled();
  });

  it('rolls back BOTH user + assistant messages when Transaction 2 fails; logs error with conversationId', async () => {
    const { dataSource, committed, conversationMemory } = buildFakeDataSource({
      failTxnOnCall: 2,
    });
    const controller = buildController(dataSource, conversationMemory);
    const loggerErrorSpy = jest.spyOn(
      (controller as unknown as { logger: Logger }).logger,
      'error',
    );
    const { res, written } = buildResMock();

    await controller.chatStream(
      buildUser(),
      { message: 'streaming hi' },
      buildReq() as any,
      res,
    );

    // Conversation from Transaction 1 stayed committed.
    expect(committed).toEqual([{ kind: 'start', conversationId: 'conv-1' }]);
    // Neither the user nor the assistant message landed.
    expect(committed.filter((w) => w.kind === 'message')).toHaveLength(0);

    // The streaming handler catches the error and writes an SSE error frame
    // rather than propagating — so the client sees a closed stream, not an
    // HTTP 5xx.
    const joined = written.join('');
    expect(joined).toContain('"type":"error"');
    // Logger error logged with conversationId.
    const logMsg = loggerErrorSpy.mock.calls.find((c) =>
      String(c[0]).includes('F052'),
    )?.[0] as string | undefined;
    expect(logMsg).toBeDefined();
    expect(logMsg).toContain('conv-1');
  });

  it('rolls back BOTH messages when the inner assistant addMessage throws inside Transaction 2', async () => {
    const { dataSource, committed, conversationMemory } = buildFakeDataSource({
      failOnOperation: 'addAssistant',
    });
    const controller = buildController(dataSource, conversationMemory);
    const { res } = buildResMock();

    await controller.chatStream(
      buildUser(),
      { message: 'streaming hi' },
      buildReq() as any,
      res,
    );

    // Conversation row stays, but the entire message-pair transaction
    // rolled back: neither role landed.
    expect(committed.filter((w) => w.kind === 'message')).toHaveLength(0);
  });
});
