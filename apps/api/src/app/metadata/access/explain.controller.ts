import {
  Body,
  Controller,
  Inject,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  AuthorizationService,
  type DecisionProvenance,
  type FieldDecisionProvenance,
} from '@hubblewave/authorization';
import {
  IDENTITY_RESOLVER_PORT,
  IdentityResolverPort,
  JwtAuthGuard,
  PermissionsGuard,
  RequirePermission,
  type UserRequestContext,
} from '@hubblewave/auth-guard';
import { ExplainCollectionDto, ExplainFieldDto } from './dto/explain.dto';

/**
 * §28.7 — admin-facing explainability endpoint.
 *
 * Every authorization decision MUST be able to produce its provenance:
 * which level fired, which rule matched, which principal triggered the
 * match, and the fallback chain of levels checked before the match. This
 * controller exposes that provenance for arbitrary (target user, resource,
 * operation) triples — the auditor's "why did user X get access to record
 * Y" workflow.
 *
 * Access posture:
 *   - Gated by `@RequirePermission('authorization:explain:read')` per
 *     canon §28.6 + W2 Stream 3 Task 20. The capability is registered
 *     `dangerous: true` because it surfaces ACL reasoning over arbitrary
 *     users — a sensitive capability that the admin role holds via
 *     seeded `role_permissions` rows. The pre-Stream-3 `@Roles('admin')`
 *     check was redundant once the capability model expressed the same
 *     authority; the bare `@Roles` was retired alongside.
 *   - The target user's identity is freshly resolved through the
 *     `IdentityResolverPort` — the same path the JWT auth guard uses for
 *     the live request principal. Deactivated users and unknown UUIDs
 *     return 404 (defensive — does not leak whether the user exists at
 *     all).
 *   - The endpoint runs the evaluator AS IF the target user was the
 *     request principal but does NOT actually surface the target user's
 *     data — only the provenance shape.
 *
 * Spec reference: CLAUDE.md §28.7 + the §28.4 fallback semantics this
 * implementation reflects.
 */
@Controller('authorization/explain')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('authorization:explain:read')
export class ExplainController {
  constructor(
    private readonly authz: AuthorizationService,
    @Inject(IDENTITY_RESOLVER_PORT)
    private readonly identityResolver: IdentityResolverPort,
  ) {}

  @Post('collection')
  async explainCollection(
    @Body() dto: ExplainCollectionDto,
  ): Promise<DecisionProvenance> {
    const targetCtx = await this.buildTargetContext(dto.userId);
    return this.authz.explainCollectionAccess(
      targetCtx,
      dto.collectionId,
      dto.operation,
    );
  }

  @Post('field')
  async explainField(
    @Body() dto: ExplainFieldDto,
  ): Promise<FieldDecisionProvenance> {
    const targetCtx = await this.buildTargetContext(dto.userId);
    return this.authz.explainFieldAccess(
      targetCtx,
      dto.collectionId,
      {
        code: dto.field.code,
        isSystem: dto.field.isSystem,
      },
    );
  }

  /**
   * Resolve the target user's live identity via the IdentityResolverPort
   * and shape it as a `UserRequestContext` suitable for the authorization
   * evaluator. Returns NotFoundException for both missing users and
   * non-active users so an admin probing for a UUID cannot distinguish
   * the two cases (defensive — avoid leaking "this user exists but is
   * suspended").
   */
  private async buildTargetContext(userId: string): Promise<UserRequestContext> {
    const identity = await this.identityResolver.resolveIdentity(userId);
    if (!identity || identity.status !== 'active') {
      throw new NotFoundException(
        `Cannot explain authorization for user ${userId}: user not found or not active`,
      );
    }
    return {
      kind: 'user',
      userId: identity.userId,
      roleIds: identity.roleIds,
      roleCodes: identity.roleCodes,
      permissionCodes: identity.permissionCodes,
      groupIds: identity.groupIds,
      isAdmin: identity.isAdmin,
      securityStamp: identity.securityStamp,
      // `attributes.roleIds` is the canonical source the evaluator reads
      // for principal matching. Mirror the resolved role UUIDs into the
      // attributes bag so a target user with role memberships matches
      // role-keyed rules the same way they would on a live request.
      attributes: { roleIds: identity.roleIds },
    };
  }
}
