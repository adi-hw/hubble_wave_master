export enum ErrorCode {
  // Authentication errors (1xxx)
  INVALID_CREDENTIALS = 'AUTH_1001',
  TOKEN_EXPIRED = 'AUTH_1002',
  TOKEN_INVALID = 'AUTH_1003',
  ACCOUNT_LOCKED = 'AUTH_1004',
  MFA_REQUIRED = 'AUTH_1005',
  MFA_INVALID = 'AUTH_1006',
  PASSWORD_EXPIRED = 'AUTH_1007',
  SESSION_EXPIRED = 'AUTH_1008',
  REFRESH_TOKEN_INVALID = 'AUTH_1009',
  REFRESH_TOKEN_REUSED = 'AUTH_1010',

  // Authorization errors (2xxx)
  FORBIDDEN = 'AUTHZ_2001',
  INSUFFICIENT_PERMISSIONS = 'AUTHZ_2002',
  ROLE_NOT_FOUND = 'AUTHZ_2003',
  POLICY_DENIED = 'AUTHZ_2004',

  // Validation errors (3xxx)
  VALIDATION_FAILED = 'VAL_3001',
  INVALID_INPUT = 'VAL_3002',
  MISSING_REQUIRED_FIELD = 'VAL_3003',
  INVALID_FORMAT = 'VAL_3004',
  VALUE_OUT_OF_RANGE = 'VAL_3005',

  // Resource errors (4xxx)
  RESOURCE_NOT_FOUND = 'RES_4001',
  RESOURCE_ALREADY_EXISTS = 'RES_4002',
  RESOURCE_CONFLICT = 'RES_4003',
  RESOURCE_DELETED = 'RES_4004',
  USER_NOT_FOUND = 'RES_4005',
  TABLE_NOT_FOUND = 'RES_4006',
  ROLE_NOT_ASSIGNED = 'RES_4007',

  // User status errors (5xxx)
  USER_ALREADY_INACTIVE = 'USR_5001',
  USER_NOT_INACTIVE = 'USR_5002',
  USER_ALREADY_SUSPENDED = 'USR_5003',
  USER_NOT_SUSPENDED = 'USR_5004',
  USER_NOT_LOCKED = 'USR_5005',
  USER_NOT_DELETED = 'USR_5006',
  USER_NOT_INVITED = 'USR_5007',
  CANNOT_DELETE_SYSTEM_USER = 'USR_5008',



  // Database errors (6xxx)
  DATABASE_ERROR = 'DB_6001',
  TRANSACTION_FAILED = 'DB_6002',
  CONSTRAINT_VIOLATION = 'DB_6003',

  // Internal errors (9xxx)
  INTERNAL_ERROR = 'INT_9001',
  SERVICE_UNAVAILABLE = 'INT_9002',
  CONFIGURATION_ERROR = 'INT_9003',
}

export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCode.INVALID_CREDENTIALS]: 'Invalid username or password',
  [ErrorCode.TOKEN_EXPIRED]: 'Token has expired',
  [ErrorCode.TOKEN_INVALID]: 'Token is invalid',
  [ErrorCode.ACCOUNT_LOCKED]: 'Account is locked due to too many failed login attempts',
  [ErrorCode.MFA_REQUIRED]: 'Multi-factor authentication is required',
  [ErrorCode.MFA_INVALID]: 'Invalid MFA token',
  [ErrorCode.PASSWORD_EXPIRED]: 'Password has expired and must be changed',
  [ErrorCode.SESSION_EXPIRED]: 'Session has expired',
  [ErrorCode.REFRESH_TOKEN_INVALID]: 'Refresh token is invalid',
  [ErrorCode.REFRESH_TOKEN_REUSED]: 'Refresh token has been reused (potential security breach)',

  [ErrorCode.FORBIDDEN]: 'Access denied',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions to perform this action',
  [ErrorCode.ROLE_NOT_FOUND]: 'Role not found',
  [ErrorCode.POLICY_DENIED]: 'Access denied by policy',

  [ErrorCode.VALIDATION_FAILED]: 'Validation failed',
  [ErrorCode.INVALID_INPUT]: 'Invalid input provided',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'Required field is missing',
  [ErrorCode.INVALID_FORMAT]: 'Invalid format',
  [ErrorCode.VALUE_OUT_OF_RANGE]: 'Value is out of allowed range',

  [ErrorCode.RESOURCE_NOT_FOUND]: 'Resource not found',
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 'Resource already exists',
  [ErrorCode.RESOURCE_CONFLICT]: 'Resource conflict',
  [ErrorCode.RESOURCE_DELETED]: 'Resource has been deleted',
  [ErrorCode.USER_NOT_FOUND]: 'User not found',
  [ErrorCode.TABLE_NOT_FOUND]: 'Table not found',
  [ErrorCode.ROLE_NOT_ASSIGNED]: 'Role assignment not found',

  [ErrorCode.USER_ALREADY_INACTIVE]: 'User is already inactive',
  [ErrorCode.USER_NOT_INACTIVE]: 'User is not inactive',
  [ErrorCode.USER_ALREADY_SUSPENDED]: 'User is already suspended',
  [ErrorCode.USER_NOT_SUSPENDED]: 'User is not suspended',
  [ErrorCode.USER_NOT_LOCKED]: 'User is not locked',
  [ErrorCode.USER_NOT_DELETED]: 'User is not deleted',
  [ErrorCode.USER_NOT_INVITED]: 'User is not in invited status',
  [ErrorCode.CANNOT_DELETE_SYSTEM_USER]: 'Cannot delete system user',



  [ErrorCode.DATABASE_ERROR]: 'Database error occurred',
  [ErrorCode.TRANSACTION_FAILED]: 'Transaction failed',
  [ErrorCode.CONSTRAINT_VIOLATION]: 'Database constraint violation',

  [ErrorCode.INTERNAL_ERROR]: 'Internal server error',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
  [ErrorCode.CONFIGURATION_ERROR]: 'Configuration error',
};
