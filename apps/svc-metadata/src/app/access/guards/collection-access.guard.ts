import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AccessRuleService } from '../services/access-rule.service';
import { UserAccessContext, Operation } from '../types/access.types';
import { Request } from 'express';

@Injectable()
export class CollectionAccessGuard implements CanActivate {
  constructor(
    private readonly accessService: AccessRuleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user as UserAccessContext; // Assuming AuthGuard populates this

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Extract Collection ID from route params
    const collectionId = request.params['collectionId'] || request.params['id'];
    
    // If no collection ID, we can't enforce collection rules (might be a global endpoint)
    // In strict mode, we might want to block or require a specific decorator
    if (!collectionId) {
      return true; 
    }

    // Determine Operation
    const operation = this.determineOperation(request.method);

    // Prepare Access Request
    const accessRequest = {
      user,
      collectionId,
      operation,
      // We don't have the record yet for list/create, so we check general permission
      // For update/delete/get-one, we might need to check record ownership later
      // The Service will handle "No Rule Matched" -> Deny
    };

    const result = await this.accessService.checkAccess(accessRequest);

    if (!result.allowed) {
      throw new ForbiddenException(
        result.reason || `Access denied for ${operation} on collection ${collectionId}`,
      );
    }

    // Store the matching rule or permissions in request for downstream use
    (request as any).accessResult = result;

    return true;
  }

  private determineOperation(method: string): Operation {
    switch (method.toUpperCase()) {
      case 'GET': return 'read';
      case 'POST': return 'create';
      case 'PUT':
      case 'PATCH': return 'update';
      case 'DELETE': return 'delete';
      default: return 'read'; // Safe default
    }
  }
}
