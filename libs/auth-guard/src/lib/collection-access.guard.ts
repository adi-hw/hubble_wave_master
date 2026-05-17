import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUIRE_COLLECTION_ACCESS_KEY,
  type AccessLocation,
  type CollectionTarget,
  type RequireCollectionAccessOptions,
} from './require-collection-access.decorator';
import {
  COLLECTION_ACCESS_EVALUATOR_PORT,
  type CollectionAccessEvaluator,
} from './collection-access.port';
import {
  COLLECTION_ID_RESOLVER_PORT,
  type CollectionIdResolverPort,
} from './collection-id-resolver.port';
import {
  isUserContext,
  type UserRequestContext,
  type RequestContext,
} from './request-context.interface';

const PERMISSION_DENIED_RESPONSE = {
  statusCode: 403,
  message: 'Permission denied',
  code: 'PERMISSION_DENIED',
} as const;

/**
 * Canon §28 — route into the §28 evaluator for any endpoint annotated
 * with `@RequireCollectionAccess(...)`.
 *
 * Activation:
 *   - No metadata on the handler/class → guard is a no-op (returns
 *     `true`). The `PermissionsGuard` or `RolesGuard` (or none) is
 *     authoritative for the endpoint.
 *   - Metadata present → guard reads `(verb, collection, record?)`,
 *     resolves the collection identifier from the request, calls the
 *     §28 evaluator, attaches row-level predicates for list/search
 *     paths, and either returns `true` or throws `Forbidden` /
 *     `NotFound` / 500.
 *
 * Error posture (canon §28 deny-wins / §29.7 default-deny):
 *   - **500 InternalServerError** — programmer error: decorator
 *     specifies `from: 'param', name: 'X'` but no such param exists
 *     on the request; or `kind: 'code'` with no `COLLECTION_ID_RESOLVER_PORT`
 *     bound. The runtime fail-fast catches misapplication before
 *     production.
 *   - **404 NotFound** — `kind: 'code'` resolver returns `null` (the
 *     code references no extant collection). Surfaced as 404 rather
 *     than 403 because the resource genuinely does not exist —
 *     surfacing 403 would leak existence.
 *   - **403 PermissionDenied** — §28 evaluator returned `false`. Body
 *     is the canon §28 minimal shape `{ statusCode: 403, message:
 *     'Permission denied', code: 'PERMISSION_DENIED' }` — never leak
 *     which rule denied. Audit-row writing on 403 lands in Stream 2
 *     PR6 once `AccessAuditPort.logAccessDenied` is added.
 *
 * Service tokens (canon §29.7) do NOT reach this guard's substance:
 *   - The `JwtAuthGuard` populates `request.context` as a discriminated
 *     `UserRequestContext | ServiceRequestContext`. This guard returns
 *     `true` when `context.kind === 'service'` — service tokens are
 *     scope-gated at the JwtAuthGuard layer via
 *     `@RequireServiceScope`, NOT at the §28 evaluator (services have
 *     no per-record authority concept).
 *
 * Row-level predicates: on `allow` for list/search-style endpoints (no
 * `record` target), the guard fetches the §28 row-level predicates
 * via `getSafeRowLevelPredicatesForCollection` and attaches them to
 * `request.rowConditions`. The data service reads them to scope the
 * underlying query. Endpoints with a `record` target skip this step
 * because the record-level check already binds the visible row.
 */
@Injectable()
export class CollectionAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(COLLECTION_ACCESS_EVALUATOR_PORT)
    private readonly evaluator?: CollectionAccessEvaluator,
    @Optional()
    @Inject(COLLECTION_ID_RESOLVER_PORT)
    private readonly resolver?: CollectionIdResolverPort,
  ) {}

  async canActivate(execCtx: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.getAllAndOverride<RequireCollectionAccessOptions>(
      REQUIRE_COLLECTION_ACCESS_KEY,
      [execCtx.getHandler(), execCtx.getClass()],
    );
    if (!opts) {
      // No collection-access metadata on this route — defer.
      return true;
    }

    if (!this.evaluator) {
      // Decorator declared the endpoint needs §28 evaluation but the
      // app didn't bind a `COLLECTION_ACCESS_EVALUATOR_PORT`. Loud
      // failure beats silent allow.
      throw new InternalServerErrorException(
        'CollectionAccessGuard requires COLLECTION_ACCESS_EVALUATOR_PORT to be bound (canon §28)',
      );
    }

    const request = execCtx.switchToHttp().getRequest();
    const context = (request.context ?? request.user) as
      | RequestContext
      | undefined;

    if (!context) {
      // JwtAuthGuard should have populated this. If it didn't, the
      // endpoint is misconfigured (likely missing @Public() or a
      // guard-chain gap).
      throw new InternalServerErrorException(
        'CollectionAccessGuard saw no request.context — JwtAuthGuard did not run',
      );
    }

    // Service tokens are gated at JwtAuthGuard via @RequireServiceScope.
    // The §28 evaluator is user-only.
    if (!isUserContext(context)) {
      return true;
    }

    const collectionId = await this.resolveCollectionId(
      request,
      opts.collection,
    );

    const allowed = await this.evaluator.canAccessCollection(
      context,
      collectionId,
      opts.verb,
    );
    if (!allowed) {
      throw new ForbiddenException(PERMISSION_DENIED_RESPONSE);
    }

    if (opts.record) {
      const recordId = this.extractFromRequest(
        request,
        opts.record.from,
        opts.record.name,
      );
      if (typeof recordId !== 'string' || recordId.length === 0) {
        throw new InternalServerErrorException(
          `@RequireCollectionAccess record target '${opts.record.from}.${opts.record.name}' missing on request`,
        );
      }
      const recordAllowed = await this.evaluator.canAccessCollectionRecord(
        context,
        collectionId,
        recordId,
        opts.verb,
      );
      if (!recordAllowed) {
        throw new ForbiddenException(PERMISSION_DENIED_RESPONSE);
      }
    } else {
      // List/search path — attach row-conditions for the data layer.
      const predicates =
        await this.evaluator.getSafeRowLevelPredicatesForCollection(
          context,
          collectionId,
          opts.verb,
        );
      const augmented = request as { rowConditions?: unknown[] };
      augmented.rowConditions = predicates;
    }

    return true;
  }

  /**
   * Resolve the decorator's `collection` target to a canonical UUID
   * collectionId. Three branches:
   *   - `kind: 'id'` — the request carries the UUID; use as-is.
   *   - `kind: 'code'` — the request carries a customer-facing code;
   *     route through `COLLECTION_ID_RESOLVER_PORT`. Missing port is a
   *     500 (programmer error); resolver returning null is a 404
   *     (resource genuinely doesn't exist).
   *   - `from: 'fixed'` — controller hardcodes the identifier; the
   *     `name` field IS the value. Skip request extraction entirely.
   */
  private async resolveCollectionId(
    request: unknown,
    target: CollectionTarget,
  ): Promise<string> {
    let raw: string | undefined;
    if (target.from === 'fixed') {
      raw = target.name;
    } else {
      const value = this.extractFromRequest(request, target.from, target.name);
      raw = typeof value === 'string' ? value : undefined;
    }

    if (typeof raw !== 'string' || raw.length === 0) {
      throw new InternalServerErrorException(
        `@RequireCollectionAccess collection target '${target.from}.${target.name}' missing on request`,
      );
    }

    if (target.kind === 'id') {
      return raw;
    }

    if (!this.resolver) {
      throw new InternalServerErrorException(
        '@RequireCollectionAccess kind: "code" requires COLLECTION_ID_RESOLVER_PORT to be bound (canon §28)',
      );
    }

    const resolved = await this.resolver.resolveByCode(raw);
    if (resolved == null) {
      throw new NotFoundException(`Collection '${raw}' not found`);
    }
    return resolved;
  }

  private extractFromRequest(
    request: unknown,
    from: AccessLocation,
    name: string,
  ): unknown {
    if (from === 'fixed') return name;
    const req = request as {
      params?: Record<string, unknown>;
      query?: Record<string, unknown>;
      body?: Record<string, unknown>;
    };
    const bucket =
      from === 'param' ? req.params : from === 'query' ? req.query : req.body;
    if (!bucket || typeof bucket !== 'object') return undefined;
    return (bucket as Record<string, unknown>)[name];
  }
}

/**
 * Type augmentation point — controllers that read `req.rowConditions`
 * after `CollectionAccessGuard` runs should narrow `request` to this
 * shape (or extend their `InstanceRequest` type to carry the field).
 *
 * Kept as an unexported helper here; consumers typically extend their
 * own `AuthenticatedRequest` shape rather than importing this
 * directly.
 */
export interface WithRowConditions {
  rowConditions?: unknown[];
}

/**
 * Re-export for consumers that prefer importing the user context
 * narrowing helper alongside the guard.
 */
export type { UserRequestContext };
