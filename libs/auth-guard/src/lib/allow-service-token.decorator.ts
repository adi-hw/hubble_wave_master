import { SetMetadata } from '@nestjs/common';

/**
 * Reflector metadata key for the `@AllowServiceToken()` decorator.
 * `JwtAuthGuard` reads this via `Reflector.getAllAndOverride` —
 * presence at either the method or the class level opts the
 * endpoint in to accepting service tokens.
 */
export const ALLOW_SERVICE_TOKEN = 'ALLOW_SERVICE_TOKEN';

/**
 * Canon §29.7 — mark an endpoint as accepting service-to-service
 * tokens. Default-DENY: every endpoint rejects service tokens unless
 * it carries this decorator at either the method or class level.
 *
 * The inverted default ("user-only unless opted in") matches the
 * canon §28 deny-wins posture applied to the JWT layer — accidentally
 * letting a service token through to a user endpoint is a security
 * bug; defaulting to deny is the correct shape.
 *
 * The decorator does NOT change `kind: 'user'` behavior. User tokens
 * remain accepted at every endpoint that requires authentication.
 * The decorator only unlocks `kind: 'service'`.
 *
 * @example
 * ```ts
 * @Post('process-event')
 * @AllowServiceToken()
 * processEvent(@Req() req: InstanceRequest) {
 *   if (req.context.kind === 'service') {
 *     // service-token branch
 *   }
 * }
 * ```
 */
export const AllowServiceToken = () => SetMetadata(ALLOW_SERVICE_TOKEN, true);
