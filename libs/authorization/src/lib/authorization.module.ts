import { Module, DynamicModule, Provider, Type } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CollectionAccessRule,
  PropertyAccessRule,
  PropertyDefinition,
} from '@hubblewave/instance-db';
import {
  AuthorizationService,
  COLLECTION_ACL_REPOSITORY,
  PROPERTY_ACL_REPOSITORY,
} from './authorization.service';
import { AbacService } from './abac.service';
import { PolicyCompilerService } from './policy-compiler.service';
import { CollectionAclRepository } from './collection-acl.repository';
import { PropertyAclRepository } from './property-acl.repository';

export interface AuthorizationModuleOptions {
  collectionAclRepository?: Type<unknown> | Provider;
  propertyAclRepository?: Type<unknown> | Provider;
  enableCaching?: boolean;
}

@Module({})
export class AuthorizationModule {
  /**
   * Register AuthorizationModule with repository providers.
   * Use this when you have TypeORM repositories available.
   *
   * @example
   * ```typescript
   * AuthorizationModule.forRoot({
   *   collectionAclRepository: CollectionAccessRuleRepository,
   *   propertyAclRepository: PropertyAccessRuleRepository,
   *   enableCaching: true,
   * })
   * ```
   */
  static forRoot(options: AuthorizationModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      AuthorizationService,
      AbacService,
      PolicyCompilerService,
    ];

    // Collection Access Rule Repository provider
    if (options.collectionAclRepository) {
      if (typeof options.collectionAclRepository === 'function') {
        providers.push({
          provide: COLLECTION_ACL_REPOSITORY,
          useClass: options.collectionAclRepository as Type<unknown>,
        });
      } else {
        providers.push(options.collectionAclRepository as Provider);
      }
    } else {
      providers.push({
        provide: COLLECTION_ACL_REPOSITORY,
        useValue: null,
      });
    }

    // Property Access Rule Repository provider
    if (options.propertyAclRepository) {
      if (typeof options.propertyAclRepository === 'function') {
        providers.push({
          provide: PROPERTY_ACL_REPOSITORY,
          useClass: options.propertyAclRepository as Type<unknown>,
        });
      } else {
        providers.push(options.propertyAclRepository as Provider);
      }
    } else {
      providers.push({
        provide: PROPERTY_ACL_REPOSITORY,
        useValue: null,
      });
    }

    const imports: any[] = [];

    if (options.enableCaching !== false) {
      imports.push(
        CacheModule.register({
          ttl: 300000, // 5 minutes default
          max: 1000,
        }),
      );
    }

    return {
      module: AuthorizationModule,
      imports,
      providers,
      exports: [AuthorizationService, AbacService, PolicyCompilerService],
      global: true,
    };
  }

  /**
   * Register AuthorizationModule for feature modules.
   * Provides access to AuthorizationService without re-registering repositories.
   */
  static forFeature(): DynamicModule {
    return {
      module: AuthorizationModule,
      providers: [AuthorizationService, AbacService, PolicyCompilerService],
      exports: [AuthorizationService, AbacService, PolicyCompilerService],
    };
  }

  /**
   * Register with TypeORM repositories directly.
   * Use when you want to pass TypeORM Repository instances.
   *
   * @example
   * ```typescript
   * AuthorizationModule.forRootWithTypeOrm({
   *   collectionAccessRuleEntity: CollectionAccessRule,
   *   propertyAccessRuleEntity: PropertyAccessRule,
   * })
   * ```
   */
  static forRootWithTypeOrm(options: {
    collectionAccessRuleEntity: Type<unknown>;
    propertyAccessRuleEntity: Type<unknown>;
  }): DynamicModule {
    return {
      module: AuthorizationModule,
      imports: [
        CacheModule.register({
          ttl: 300000,
          max: 1000,
        }),
      ],
      providers: [
        AuthorizationService,
        AbacService,
        PolicyCompilerService,
        {
          provide: COLLECTION_ACL_REPOSITORY,
          useFactory: (dataSource: any) => {
            try {
              return dataSource.getRepository(options.collectionAccessRuleEntity);
            } catch {
              return null;
            }
          },
          inject: ['DATA_SOURCE'],
        },
        {
          provide: PROPERTY_ACL_REPOSITORY,
          useFactory: (dataSource: any) => {
            try {
              return dataSource.getRepository(options.propertyAccessRuleEntity);
            } catch {
              return null;
            }
          },
          inject: ['DATA_SOURCE'],
        },
      ],
      exports: [AuthorizationService, AbacService, PolicyCompilerService],
      global: true,
    };
  }

  /**
   * Register with full Access Rule repository implementations.
   * This is the recommended method for instance services.
   *
   * @example
   * ```typescript
   * AuthorizationModule.forInstance()
   * ```
   */
  static forInstance(): DynamicModule {
    return {
      module: AuthorizationModule,
      imports: [
        TypeOrmModule.forFeature([
          CollectionAccessRule,
          PropertyAccessRule,
          PropertyDefinition,
        ]),
        CacheModule.register({
          ttl: 300000,
          max: 1000,
        }),
      ],
      providers: [
        AuthorizationService,
        AbacService,
        PolicyCompilerService,
        CollectionAclRepository,
        PropertyAclRepository,
        {
          provide: COLLECTION_ACL_REPOSITORY,
          useExisting: CollectionAclRepository,
        },
        {
          provide: PROPERTY_ACL_REPOSITORY,
          useExisting: PropertyAclRepository,
        },
      ],
      exports: [
        AuthorizationService,
        AbacService,
        PolicyCompilerService,
        CollectionAclRepository,
        PropertyAclRepository,
      ],
      global: true,
    };
  }
}
