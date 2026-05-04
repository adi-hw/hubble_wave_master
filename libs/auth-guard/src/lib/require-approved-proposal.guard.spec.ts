import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_APPROVED_PROPOSAL_KEY } from './require-approved-proposal.decorator';
import {
  AvaProposalLookup,
  RequireApprovedProposalGuard,
} from './require-approved-proposal.guard';

interface MockProposal {
  id: string;
  state: 'suggested' | 'previewed' | 'approved' | 'rejected' | 'executed' | 'failed';
}

function buildContext(opts: {
  decoratorPresent: boolean;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}): { ctx: ExecutionContext; reflector: Reflector; req: Record<string, unknown> } {
  const req: Record<string, unknown> = {
    body: opts.body ?? {},
    headers: opts.headers ?? {},
  };
  const handler = () => undefined;
  const reflector = new Reflector();
  jest
    .spyOn(reflector, 'get')
    .mockImplementation((key: unknown) =>
      key === REQUIRE_APPROVED_PROPOSAL_KEY ? opts.decoratorPresent : undefined,
    );
  const ctx = {
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, reflector, req };
}

function buildLookup(proposal: MockProposal | null): AvaProposalLookup {
  return {
    findById: jest.fn().mockResolvedValue(proposal),
  };
}

describe('RequireApprovedProposalGuard', () => {
  it('returns true (no-op) when the decorator is absent', async () => {
    const { ctx, reflector } = buildContext({ decoratorPresent: false });
    const lookup = buildLookup(null);
    const guard = new RequireApprovedProposalGuard(reflector, lookup);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(lookup.findById).not.toHaveBeenCalled();
  });

  it('passes when the proposal is in the approved state and stashes it on the request', async () => {
    const { ctx, reflector, req } = buildContext({
      decoratorPresent: true,
      body: { proposalId: 'p1' },
    });
    const lookup = buildLookup({ id: 'p1', state: 'approved' });
    const guard = new RequireApprovedProposalGuard(reflector, lookup);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(lookup.findById).toHaveBeenCalledWith('p1');
    expect(req['avaProposal']).toEqual({ id: 'p1', state: 'approved' });
  });

  it('reads proposalId from X-Ava-Proposal-Id header when body is empty', async () => {
    const { ctx, reflector } = buildContext({
      decoratorPresent: true,
      headers: { 'x-ava-proposal-id': 'header-id' },
    });
    const lookup = buildLookup({ id: 'header-id', state: 'approved' });
    const guard = new RequireApprovedProposalGuard(reflector, lookup);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(lookup.findById).toHaveBeenCalledWith('header-id');
  });

  it('throws BadRequestException when neither body nor header carries proposalId', async () => {
    const { ctx, reflector } = buildContext({ decoratorPresent: true });
    const lookup = buildLookup({ id: 'p1', state: 'approved' });
    const guard = new RequireApprovedProposalGuard(reflector, lookup);

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFoundException when the proposal does not exist', async () => {
    const { ctx, reflector } = buildContext({
      decoratorPresent: true,
      body: { proposalId: 'missing' },
    });
    const lookup = buildLookup(null);
    const guard = new RequireApprovedProposalGuard(reflector, lookup);

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ForbiddenException for every non-approved state', async () => {
    for (const state of ['suggested', 'previewed', 'rejected', 'executed', 'failed'] as const) {
      const { ctx, reflector } = buildContext({
        decoratorPresent: true,
        body: { proposalId: 'p1' },
      });
      const lookup = buildLookup({ id: 'p1', state });
      const guard = new RequireApprovedProposalGuard(reflector, lookup);

      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('error message names the offending state for forbidden cases', async () => {
    const { ctx, reflector } = buildContext({
      decoratorPresent: true,
      body: { proposalId: 'p1' },
    });
    const lookup = buildLookup({ id: 'p1', state: 'suggested' });
    const guard = new RequireApprovedProposalGuard(reflector, lookup);

    await expect(guard.canActivate(ctx)).rejects.toThrow(/state 'suggested'/);
  });
});
