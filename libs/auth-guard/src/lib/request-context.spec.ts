import { ForbiddenException } from '@nestjs/common';
import {
  ServiceRequestContext,
  UserRequestContext,
  assertServiceContext,
  assertUserContext,
  isServiceContext,
  isUserContext,
} from './request-context.interface';

/**
 * Spec for canon §29.7 `RequestContext` discriminated-union narrowing
 * helpers. The helpers are the contract every consumer relies on; a
 * regression that lets a service token through to user code is the
 * exact bug the discriminator exists to prevent.
 */
describe('RequestContext narrowing helpers (canon §29.7)', () => {
  const userCtx: UserRequestContext = {
    kind: 'user',
    userId: 'u-1',
    roleIds: ['role-1'],
    roleCodes: ['member'],
    permissionCodes: [],
    groupIds: [],
    securityStamp: 'stamp-1',
    isAdmin: false,
  };

  const serviceCtx: ServiceRequestContext = {
    kind: 'service',
    serviceId: 'svc-worker',
    instanceId: 'inst-1',
    scopes: ['work_order:read'],
    audience: 'svc-api',
  };

  describe('assertUserContext', () => {
    it('returns the user context unchanged when called with kind=user', () => {
      expect(assertUserContext(userCtx)).toBe(userCtx);
    });

    it('throws ForbiddenException when called with kind=service', () => {
      expect(() => assertUserContext(serviceCtx)).toThrow(ForbiddenException);
      expect(() => assertUserContext(serviceCtx)).toThrow(
        /service tokens are not accepted/i,
      );
    });
  });

  describe('assertServiceContext', () => {
    it('returns the service context unchanged when called with kind=service', () => {
      expect(assertServiceContext(serviceCtx)).toBe(serviceCtx);
    });

    it('throws ForbiddenException when called with kind=user', () => {
      expect(() => assertServiceContext(userCtx)).toThrow(ForbiddenException);
      expect(() => assertServiceContext(userCtx)).toThrow(
        /user tokens are not accepted/i,
      );
    });
  });

  describe('isUserContext / isServiceContext', () => {
    it('isUserContext narrows correctly', () => {
      expect(isUserContext(userCtx)).toBe(true);
      expect(isUserContext(serviceCtx)).toBe(false);
    });

    it('isServiceContext narrows correctly', () => {
      expect(isServiceContext(serviceCtx)).toBe(true);
      expect(isServiceContext(userCtx)).toBe(false);
    });
  });
});
