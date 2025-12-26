import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AccessRuleService } from '../services/access-rule.service';
import { UserAccessContext } from '../types/access.types';

@Injectable()
export class PropertyAccessInterceptor implements NestInterceptor {
  constructor(private readonly accessService: AccessRuleService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as UserAccessContext;
    const collectionId = request.params.collectionId;

    if (!user || !collectionId) {
      // If we don't have user or collection context, just pass through
      return next.handle();
    }

    return next.handle().pipe(
      map(async (data) => {
        // Data could be a single record or an array of records (or pagination wrapper)
        // We need to resolve permissions first
        const permissions = await this.accessService.getEffectivePermissions(collectionId, user);
        
        // If no property access rules, or if we have full access logic, we might skip
        // But for now, let's assume filtering is needed
        
        const propertyRules = permissions.propertyAccess; 
        if (!propertyRules || propertyRules.length === 0) {
            return data;
        }

        // Apply filtering/masking
        if (Array.isArray(data)) {
            return data.map(item => this.maskProperties(item, propertyRules));
        } else if (data && typeof data === 'object') {
             // Handle pagination wrapper { data: [], meta: {} }
             if (Array.isArray(data.data)) {
                 data.data = data.data.map((item: any) => this.maskProperties(item, propertyRules));
                 return data;
             }
             return this.maskProperties(data, propertyRules);
        }

        return data;
      })
    );
  }

  private maskProperties(item: any, rules: any[]): any {
      const maskedItem = { ...item };
      
      for (const rule of rules) {
          if (!rule.canRead) {
              delete maskedItem[rule.propertyCode];
          } else if (rule.isMasked) {
              maskedItem[rule.propertyCode] = rule.maskValue || '****';
          }
      }
      return maskedItem;
  }
}
