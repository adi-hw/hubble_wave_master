import { SetMetadata } from '@nestjs/common';
import { ControlPlaneRole } from '@hubblewave/control-plane-db';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: ControlPlaneRole[]) => SetMetadata(ROLES_KEY, roles);
