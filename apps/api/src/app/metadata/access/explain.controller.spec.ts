import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type {
  AuthorizationService,
  DecisionProvenance,
  FieldDecisionProvenance,
} from '@hubblewave/authorization';
import {
  RolesGuard,
  type IdentityResolverPort,
  type ResolvedIdentity,
} from '@hubblewave/auth-guard';
import { ExplainController } from './explain.controller';
import type { ExplainCollectionDto, ExplainFieldDto } from './dto/explain.dto';

/**
 * §28.7 — admin-only explainability endpoint tests.
 *
 * The endpoint is gated by `@Roles('admin')` + JwtAuthGuard + RolesGuard
 * + PermissionsGuard (the standard global-guards stack used everywhere in
 * apps/api). Unit-testing the controller in isolation means:
 *   - The endpoint handlers (explainCollection / explainField) are invoked
 *     directly and tested against AuthorizationService + IdentityResolverPort
 *     stubs.
 *   - The guard chain is exercised separately by exercising RolesGuard
 *     against the controller's class-level metadata. This is the integration
 *     between `@Roles('admin')` and the runtime, which is what test 14 in
 *     the brief requires.
 */

const TARGET_USER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const COLLECTION = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const RULE_UUID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const ROLE_UUID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

function buildAuthzStub(): jest.Mocked<
  Pick<AuthorizationService, 'explainCollectionAccess' | 'explainFieldAccess'>
> {
  return {
    explainCollectionAccess: jest.fn(),
    explainFieldAccess: jest.fn(),
  };
}

function buildResolverStub(
  resolved: ResolvedIdentity | null,
): jest.Mocked<IdentityResolverPort> {
  return {
    resolveIdentity: jest.fn().mockResolvedValue(resolved),
  };
}

function buildActiveIdentity(overrides: Partial<ResolvedIdentity> = {}): ResolvedIdentity {
  return {
    userId: TARGET_USER,
    roles: [ROLE_UUID],
    permissions: [],
    isAdmin: false,
    status: 'active',
    // canon §29.6 — fixture default for the cross-cutting kill-switch.
    // Specific tests override when they need to assert token_version
    // mismatch behavior.
    securityStamp: 'stamp-test-default',
    ...overrides,
  };
}

describe('ExplainController (§28.7)', () => {
  it('12. /collection endpoint returns DecisionProvenance from AuthorizationService', async () => {
    const expectedProvenance: DecisionProvenance = {
      effect: 'allow',
      matchedLevel: 2,
      matchedRuleId: RULE_UUID,
      matchedPrincipal: ROLE_UUID,
      fallbackChain: ['level-1: no match', `level-2: allow matched (rule: ${RULE_UUID})`],
    };
    const authz = buildAuthzStub();
    authz.explainCollectionAccess.mockResolvedValue(expectedProvenance);
    const resolver = buildResolverStub(buildActiveIdentity());

    const controller = new ExplainController(
      authz as unknown as AuthorizationService,
      resolver,
    );

    const dto: ExplainCollectionDto = {
      userId: TARGET_USER,
      collectionId: COLLECTION,
      operation: 'read',
    };
    const result = await controller.explainCollection(dto);

    expect(result).toEqual(expectedProvenance);
    expect(resolver.resolveIdentity).toHaveBeenCalledWith(TARGET_USER);
    expect(authz.explainCollectionAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: TARGET_USER,
        roles: [ROLE_UUID],
        isAdmin: false,
        attributes: { roleIds: [ROLE_UUID] },
      }),
      COLLECTION,
      'read',
    );
  });

  it('13. /field endpoint returns FieldDecisionProvenance from AuthorizationService', async () => {
    const expectedProvenance: FieldDecisionProvenance = {
      effect: 'mask',
      matchedLevel: 2,
      matchedRuleId: RULE_UUID,
      matchedPrincipal: ROLE_UUID,
      fallbackChain: ['level-1: no match', `level-2: allow matched (rule: ${RULE_UUID})`],
      maskingStrategy: 'PARTIAL',
    };
    const authz = buildAuthzStub();
    authz.explainFieldAccess.mockResolvedValue(expectedProvenance);
    const resolver = buildResolverStub(buildActiveIdentity());

    const controller = new ExplainController(
      authz as unknown as AuthorizationService,
      resolver,
    );

    const dto: ExplainFieldDto = {
      userId: TARGET_USER,
      collectionId: COLLECTION,
      field: { code: 'phi_field', isSystem: false },
    };
    const result = await controller.explainField(dto);

    expect(result).toEqual(expectedProvenance);
    expect(authz.explainFieldAccess).toHaveBeenCalledWith(
      expect.objectContaining({ userId: TARGET_USER }),
      COLLECTION,
      { code: 'phi_field', isSystem: false },
    );
  });

  it('14. RolesGuard rejects non-admins before the handler runs (403)', () => {
    // Class-level `@Roles('admin')` is the gate. RolesGuard reads the
    // metadata via Reflector and throws ForbiddenException if the
    // request user does not hold the role. The handler is never invoked.
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);

    const nonAdminRequest = {
      user: { userId: 'u1', roles: ['viewer'] },
    };
    const exec = {
      getHandler: () => ExplainController.prototype.explainCollection,
      getClass: () => ExplainController,
      switchToHttp: () => ({ getRequest: () => nonAdminRequest }),
    } as never;

    expect(() => guard.canActivate(exec)).toThrow(ForbiddenException);
  });

  it('14b. RolesGuard permits admins (the handler is reachable)', () => {
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);

    const adminRequest = {
      user: { userId: 'admin', roles: ['admin'] },
    };
    const exec = {
      getHandler: () => ExplainController.prototype.explainCollection,
      getClass: () => ExplainController,
      switchToHttp: () => ({ getRequest: () => adminRequest }),
    } as never;

    expect(guard.canActivate(exec)).toBe(true);
  });

  it('15. resolves the target user via IdentityResolverPort before invoking the evaluator', async () => {
    const authz = buildAuthzStub();
    authz.explainCollectionAccess.mockResolvedValue({
      effect: 'deny',
      matchedLevel: 3,
      matchedRuleId: null,
      matchedPrincipal: null,
      fallbackChain: ['level-1: no match', 'level-2: no match', 'level-3: default deny'],
    });
    const resolver = buildResolverStub(
      buildActiveIdentity({ roles: ['custom-role-a', 'custom-role-b'] }),
    );

    const controller = new ExplainController(
      authz as unknown as AuthorizationService,
      resolver,
    );

    await controller.explainCollection({
      userId: TARGET_USER,
      collectionId: COLLECTION,
      operation: 'read',
    });

    // Both .roles and attributes.roleIds carry the resolved roles so
    // principal matching honours role-keyed rules.
    expect(authz.explainCollectionAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: ['custom-role-a', 'custom-role-b'],
        attributes: { roleIds: ['custom-role-a', 'custom-role-b'] },
      }),
      COLLECTION,
      'read',
    );
  });

  it('16. target user not found → 404 NotFoundException', async () => {
    const authz = buildAuthzStub();
    const resolver = buildResolverStub(null);

    const controller = new ExplainController(
      authz as unknown as AuthorizationService,
      resolver,
    );

    await expect(
      controller.explainCollection({
        userId: TARGET_USER,
        collectionId: COLLECTION,
        operation: 'read',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    // The evaluator was never invoked — we failed at identity resolution.
    expect(authz.explainCollectionAccess).not.toHaveBeenCalled();
  });

  it('17. inactive target user → 404 NotFoundException (no information disclosure)', async () => {
    // Defensive posture: returning a distinct error for "user exists but
    // is inactive" would leak whether the UUID is a real user. Same 404.
    const authz = buildAuthzStub();
    const resolver = buildResolverStub(
      buildActiveIdentity({ status: 'inactive' }),
    );

    const controller = new ExplainController(
      authz as unknown as AuthorizationService,
      resolver,
    );

    await expect(
      controller.explainCollection({
        userId: TARGET_USER,
        collectionId: COLLECTION,
        operation: 'read',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(authz.explainCollectionAccess).not.toHaveBeenCalled();
  });
});
