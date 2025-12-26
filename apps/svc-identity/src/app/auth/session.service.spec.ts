import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SessionService, SessionInfo } from './session.service';
import { RefreshToken } from '@hubblewave/instance-db';

const mockRefreshTokenRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
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

    it('should parse Chrome on Android mobile', () => {
      const ua =
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

      const result = service.parseUserAgent(ua);

      expect(result.deviceType).toBe('mobile');
      expect(result.browserName).toBe('Chrome');
      expect(result.osName).toBe('Android');
    });

    it('should parse Safari on iPad', () => {
      const ua =
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

      const result = service.parseUserAgent(ua);

      expect(result.deviceType).toBe('tablet');
      expect(result.osName).toBe('iOS');
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
    it('should return active sessions', async () => {
      const mockTokens: Partial<RefreshToken>[] = [
        {
          id: 'token-1',
          userId: 'user-123',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120',
          ipAddress: '192.168.1.1',
          isRevoked: false,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'token-2',
          userId: 'user-123',
          userAgent: 'Mozilla/5.0 (iPhone) Safari/17',
          ipAddress: '10.0.0.1',
          isRevoked: false,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      ];

      mockRefreshTokenRepository.find.mockResolvedValue(mockTokens);

      const sessions = await service.getActiveSessionsForUser('user-123', 'token-1');

      expect(sessions).toHaveLength(2);
      expect(sessions[0].isCurrent).toBe(true);
      expect(sessions[1].isCurrent).toBe(false);
    });

    it('should return empty array when no sessions', async () => {
      mockRefreshTokenRepository.find.mockResolvedValue([]);

      const sessions = await service.getActiveSessionsForUser('user-123');

      expect(sessions).toHaveLength(0);
    });
  });

  describe('revokeSession', () => {
    it('should revoke a specific session', async () => {
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.revokeSession('token-123', 'user-123');

      expect(result).toBe(true);
      expect(mockRefreshTokenRepository.update).toHaveBeenCalledWith(
        { id: 'token-123', userId: 'user-123' },
        expect.objectContaining({
          isRevoked: true,
          revokedReason: 'USER_REVOKED',
        })
      );
    });

    it('should return false when session not found', async () => {
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 0 });

      const result = await service.revokeSession('non-existent', 'user-123');

      expect(result).toBe(false);
    });
  });

  describe('revokeAllOtherSessions', () => {
    it('should revoke all sessions except current', async () => {
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 3 });

      const count = await service.revokeAllOtherSessions('user-123', 'current-token');

      expect(count).toBe(3);
      expect(mockRefreshTokenRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          isRevoked: false,
          id: expect.anything(), // Not(currentTokenId)
        }),
        expect.objectContaining({
          isRevoked: true,
          revokedReason: 'USER_REVOKED_ALL_OTHERS',
        })
      );
    });
  });

  describe('revokeAllSessionsForUser', () => {
    it('should revoke all sessions for user', async () => {
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 5 });

      const count = await service.revokeAllSessionsForUser('user-123');

      expect(count).toBe(5);
      expect(mockRefreshTokenRepository.update).toHaveBeenCalledWith(
        { userId: 'user-123', isRevoked: false },
        expect.objectContaining({
          isRevoked: true,
          revokedReason: 'USER_LOGOUT_ALL',
        })
      );
    });
  });

  describe('countActiveSessions', () => {
    it('should count active sessions', async () => {
      mockRefreshTokenRepository.count.mockResolvedValue(3);

      const count = await service.countActiveSessions('user-123');

      expect(count).toBe(3);
    });
  });

  describe('getSessionById', () => {
    it('should return session info', async () => {
      const mockToken: Partial<RefreshToken> = {
        id: 'token-123',
        userId: 'user-123',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120',
        ipAddress: '192.168.1.1',
        createdAt: new Date(),
      };

      mockRefreshTokenRepository.findOne.mockResolvedValue(mockToken);

      const session = await service.getSessionById('token-123', 'user-123');

      expect(session).not.toBeNull();
      expect(session?.id).toBe('token-123');
      expect(session?.ipAddress).toBe('192.168.1.1');
    });

    it('should return null for non-existent session', async () => {
      mockRefreshTokenRepository.findOne.mockResolvedValue(null);

      const session = await service.getSessionById('non-existent', 'user-123');

      expect(session).toBeNull();
    });
  });
});
