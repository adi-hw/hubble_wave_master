import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SessionService } from './session.service';
import { RefreshToken } from '@hubblewave/instance-db';

/**
 * SessionService spec — rewritten against the canon §29.5 schema. The
 * `session_id` from a refresh-token family backs each user-visible
 * session; multiple rotations in a family deduplicate down to one row
 * in the session list.
 */

const mockRefreshTokenRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
};

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: getRepositoryToken(RefreshToken), useValue: mockRefreshTokenRepository },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseUserAgent', () => {
    it('should parse Chrome on Windows', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

      const result = service.parseUserAgent(ua);

      expect(result.deviceType).toBe('desktop');
      expect(result.browserName).toBe('Chrome');
      expect(result.osName).toBe('Windows');
    });

    it('should parse Safari on macOS', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

      const result = service.parseUserAgent(ua);

      expect(result.deviceType).toBe('desktop');
      expect(result.browserName).toBe('Safari');
      expect(result.osName).toBe('macOS');
    });

    it('should parse Edge on Windows', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';

      const result = service.parseUserAgent(ua);

      expect(result.browserName).toBe('Microsoft Edge');
      expect(result.osName).toBe('Windows');
    });

    it('should handle undefined user agent', () => {
      const result = service.parseUserAgent(undefined);

      expect(result.deviceType).toBe('desktop');
      expect(result.browserName).toBe('Unknown');
      expect(result.osName).toBe('Unknown');
    });
  });

  describe('getActiveSessionsForUser', () => {
    it('returns one session per family deduplicated by session_id', async () => {
      // Two refresh tokens for the same session (rotation) + one for a
      // different session — the result must contain two sessions, not
      // three rows.
      const sharedSessionId = '11111111-1111-1111-1111-111111111111';
      const otherSessionId = '22222222-2222-2222-2222-222222222222';
      const mockTokens: Partial<RefreshToken>[] = [
        {
          tokenHash: 'hash-2',
          sessionId: sharedSessionId,
          userId: 'user-123',
          deviceLabel: 'Chrome on Windows',
          revokedAt: null,
          createdAt: new Date(Date.now() - 1000),
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
        {
          tokenHash: 'hash-1',
          sessionId: sharedSessionId,
          userId: 'user-123',
          deviceLabel: 'Chrome on Windows',
          revokedAt: null,
          createdAt: new Date(Date.now() - 10_000),
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
        {
          tokenHash: 'hash-3',
          sessionId: otherSessionId,
          userId: 'user-123',
          deviceLabel: 'Safari on iOS',
          revokedAt: null,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      ];

      mockRefreshTokenRepository.find.mockResolvedValue(mockTokens);

      const sessions = await service.getActiveSessionsForUser('user-123', sharedSessionId);

      expect(sessions).toHaveLength(2);
      const current = sessions.find((s) => s.id === sharedSessionId);
      const other = sessions.find((s) => s.id === otherSessionId);
      expect(current?.isCurrent).toBe(true);
      expect(other?.isCurrent).toBe(false);
      expect(current?.deviceLabel).toBe('Chrome on Windows');
      expect(other?.deviceLabel).toBe('Safari on iOS');
    });

    it('returns empty array when no sessions exist', async () => {
      mockRefreshTokenRepository.find.mockResolvedValue([]);

      const sessions = await service.getActiveSessionsForUser('user-123');

      expect(sessions).toHaveLength(0);
    });
  });

  describe('revokeSession', () => {
    it('revokes the family for a session_id with reason admin_revoke', async () => {
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.revokeSession('sess-123', 'user-123');

      expect(result).toBe(true);
      expect(mockRefreshTokenRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'sess-123', userId: 'user-123' }),
        expect.objectContaining({
          revokedReason: 'admin_revoke',
        }),
      );
    });

    it('returns false when no rows were revoked', async () => {
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 0 });

      const result = await service.revokeSession('non-existent', 'user-123');

      expect(result).toBe(false);
    });
  });

  describe('revokeAllOtherSessions', () => {
    it('revokes all sessions except the current one', async () => {
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 3 });

      const count = await service.revokeAllOtherSessions('user-123', 'current-session');

      expect(count).toBe(3);
      expect(mockRefreshTokenRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          sessionId: expect.anything(), // Not(currentSessionId)
        }),
        expect.objectContaining({
          revokedReason: 'admin_revoke',
        }),
      );
    });
  });

  describe('revokeAllSessionsForUser', () => {
    it('revokes every active family for the user', async () => {
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 5 });

      const count = await service.revokeAllSessionsForUser('user-123');

      expect(count).toBe(5);
      expect(mockRefreshTokenRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' }),
        expect.objectContaining({
          revokedReason: 'admin_revoke',
        }),
      );
    });
  });

  describe('countActiveSessions', () => {
    it('counts distinct session_id values via the query builder', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '3' }),
      };
      mockRefreshTokenRepository.createQueryBuilder.mockReturnValue(qb);

      const count = await service.countActiveSessions('user-123');

      expect(count).toBe(3);
      expect(qb.select).toHaveBeenCalledWith(
        expect.stringContaining('DISTINCT rt.session_id'),
        'count',
      );
    });
  });

  describe('getSessionById', () => {
    it('returns the most recent rotation for the session', async () => {
      const mockToken: Partial<RefreshToken> = {
        tokenHash: 'h-1',
        sessionId: 'sess-1',
        userId: 'user-123',
        deviceLabel: 'Chrome on Windows',
        createdAt: new Date(),
      };

      mockRefreshTokenRepository.findOne.mockResolvedValue(mockToken);

      const session = await service.getSessionById('sess-1', 'user-123');

      expect(session).not.toBeNull();
      expect(session?.id).toBe('sess-1');
      expect(session?.deviceLabel).toBe('Chrome on Windows');
    });

    it('returns null for non-existent session', async () => {
      mockRefreshTokenRepository.findOne.mockResolvedValue(null);

      const session = await service.getSessionById('non-existent', 'user-123');

      expect(session).toBeNull();
    });
  });
});
