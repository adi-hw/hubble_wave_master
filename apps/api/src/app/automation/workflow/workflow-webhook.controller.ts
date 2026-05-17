import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { timingSafeEqual } from 'crypto';
import { ProcessFlowDefinition } from '@hubblewave/instance-db';
import { Public } from '@hubblewave/auth-guard';
import { WorkflowInstanceService } from './workflow-instance.service';

const WEBHOOK_TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Plan §8.1.9 — inbound REST/webhook trigger.
 *
 * External systems POST to `/api/workflows/webhook/:flowCode/trigger`
 * with an arbitrary JSON body. The endpoint:
 *
 *  1. Resolves the flow by `code`. The flow MUST be `triggerType='webhook'`,
 *     `isActive=true`, AND `status='published'` — runtime gate so a
 *     paused or draft flow cannot be triggered.
 *  2. Authenticates the caller via the `X-Webhook-Secret` header which
 *     must match the secret stored on the flow definition's
 *     `triggerConditions.webhookSecret`. Without a secret on the flow,
 *     the endpoint refuses to trigger (fail-closed).
 *  3. Dispatches via the existing engine entry point so audit + history
 *     tracking is identical to manual / scheduled / data-event triggers.
 *
 * The endpoint is deliberately NOT guarded by `JwtAuthGuard` — the
 * caller is the external system, not a platform user. Authentication is
 * webhook-secret-based per the spec ("extends existing
 * libs/integrations/webhook.service.ts subscriber pattern").
 */
@Controller('workflows/webhook')
export class WorkflowWebhookController {
  constructor(
    @InjectRepository(ProcessFlowDefinition)
    private readonly definitionRepo: Repository<ProcessFlowDefinition>,
    private readonly instances: WorkflowInstanceService,
  ) {}

  // Canon §28 / W2 Stream 3 Task 24 — webhook-secret-authenticated
  // entry point. `@Public()` opts the route out of the global
  // JwtAuthGuard chain; webhook-secret verification (timing-safe
  // compare on the `X-Webhook-Secret` header) is the authoritative
  // authentication boundary. Allowlisted in security-bypass-check
  // category 4 (external-system callbacks).
  @Public()
  @Post(':flowCode/trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  async trigger(
    @Param('flowCode') flowCode: string,
    @Headers('x-webhook-secret') providedSecret: string | undefined,
    @Headers('x-webhook-timestamp') providedTimestamp: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    if (!flowCode || !/^[a-z0-9_]+$/.test(flowCode)) {
      throw new BadRequestException('flowCode must match [a-z0-9_]+');
    }

    const definition = await this.definitionRepo.findOne({ where: { code: flowCode } });
    if (!definition) {
      // 404 deliberately — leaks no information about whether the
      // flow exists with a different trigger type.
      throw new NotFoundException(`No webhook flow registered at "${flowCode}"`);
    }
    if (definition.triggerType !== 'webhook') {
      throw new NotFoundException(`No webhook flow registered at "${flowCode}"`);
    }
    if (!definition.isActive || definition.status !== 'published') {
      throw new NotFoundException(`Flow "${flowCode}" is not currently accepting webhook calls`);
    }

    const conditions = (definition.triggerConditions ?? {}) as {
      webhookSecret?: string;
      requireTimestamp?: boolean;
    };
    const expectedSecret = conditions.webhookSecret;
    if (!expectedSecret) {
      // Fail-closed when the flow author hasn't configured a secret —
      // treating "no secret" as "anyone can trigger" would be a
      // platform-wide unauthenticated execution surface.
      throw new UnauthorizedException(
        `Flow "${flowCode}" has no webhookSecret configured; refusing to trigger.`,
      );
    }

    if (!providedSecret || !secretsEqual(providedSecret, expectedSecret)) {
      throw new UnauthorizedException('Invalid X-Webhook-Secret header');
    }

    // Optional replay-protection: when the flow opts in by setting
    // `triggerConditions.requireTimestamp=true`, the caller must
    // supply an ISO-8601 X-Webhook-Timestamp header within a 5-minute
    // window. This narrows the replay surface for callers willing to
    // emit a timestamp; existing webhooks without the flag continue
    // to work unchanged.
    if (conditions.requireTimestamp) {
      if (!providedTimestamp) {
        throw new UnauthorizedException('X-Webhook-Timestamp header required for this flow');
      }
      const ts = Date.parse(providedTimestamp);
      if (Number.isNaN(ts)) {
        throw new UnauthorizedException('X-Webhook-Timestamp must be a valid ISO-8601 timestamp');
      }
      const skewMs = Math.abs(Date.now() - ts);
      if (skewMs > WEBHOOK_TIMESTAMP_WINDOW_MS) {
        throw new UnauthorizedException('X-Webhook-Timestamp outside acceptable window');
      }
    }

    const instance = await this.instances.start(
      definition.id,
      { input: { body, triggeredBy: 'webhook' } },
      undefined,
    );
    return { instanceId: instance.id, status: instance.state };
  }
}

/**
 * Constant-time string equality on the secret comparison. The length
 * check is required because `timingSafeEqual` throws on length
 * mismatch — a fast `length !==` short-circuit covers that branch
 * without revealing the expected secret's length to an attacker.
 */
function secretsEqual(provided: string, expected: string): boolean {
  const p = Buffer.from(provided, 'utf8');
  const e = Buffer.from(expected, 'utf8');
  if (p.length !== e.length) return false;
  return timingSafeEqual(p, e);
}
