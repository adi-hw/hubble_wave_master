export type { FilterAst, PrimitiveValue } from './lib/ast';
export { compileSearchAuthz } from './lib/compiler';
export type { SearchAuthzCompilerInput } from './lib/compiler';
export { emitTypesenseFilterBy } from './lib/typesense-emitter';
export type { AttributeContext } from './lib/typesense-emitter';
export { extractRequiredAttributes } from './lib/acl-projection';
export type { AclProjection } from './lib/acl-projection';
export { emitPgvectorWhere } from './lib/pgvector-emitter';
export type { PgvectorWhereResult } from './lib/pgvector-emitter';
