import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserData {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  jti?: string;
  tokenExpiresAt?: Date;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserData;

    if (data) {
      return user?.[data];
    }

    return user;
  },
);
