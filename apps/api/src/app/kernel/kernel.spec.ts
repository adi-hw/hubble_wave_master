import { extractContext, AppException, ErrorCode } from './index';

describe('kernel barrel exports', () => {
  it('exports extractContext function', () => {
    expect(extractContext).toBeDefined();
    expect(typeof extractContext).toBe('function');
  });

  it('exports AppException class extending HttpException', () => {
    const ex = AppException.notFound(ErrorCode.RESOURCE_NOT_FOUND);
    expect(ex).toBeInstanceOf(AppException);
    expect(ex.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
    expect(ex.getStatus()).toBe(404);
  });

  it('ErrorCode enum has expected values', () => {
    expect(ErrorCode.INVALID_CREDENTIALS).toBe('AUTH_1001');
    expect(ErrorCode.FORBIDDEN).toBe('AUTHZ_2001');
    expect(ErrorCode.VALIDATION_FAILED).toBe('VAL_3001');
    expect(ErrorCode.RESOURCE_NOT_FOUND).toBe('RES_4001');
  });
});
