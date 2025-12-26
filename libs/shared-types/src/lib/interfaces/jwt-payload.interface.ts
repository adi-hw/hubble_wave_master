export interface JwtPayload {
  sub: string;
  username: string;
  roles: string[];
  permissions: string[];
  session_id?: string;
  iat?: number;
  exp?: number;
}
