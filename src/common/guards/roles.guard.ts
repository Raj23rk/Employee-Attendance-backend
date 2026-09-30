import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: User has no role assigned');
    }

    const userRole = user.role;
    const hasRole =
      requiredRoles.includes(userRole) ||
      (userRole === Role.CEO || userRole === Role.EXECUTIVE) || // Executive has universal supervisory access
      ((userRole === Role.ADMIN || userRole === Role.SYSTEM_ADMIN) && requiredRoles.includes(Role.ADMIN)) ||
      ((userRole === Role.HR || userRole === Role.HR_MANAGER) && (requiredRoles.includes(Role.HR) || requiredRoles.includes(Role.MANAGER))) ||
      ((userRole === Role.MANAGER || userRole === Role.TEAM_MANAGER) && requiredRoles.includes(Role.MANAGER)) ||
      (userRole === Role.ACCOUNTANT && (requiredRoles.includes(Role.HR) || requiredRoles.includes(Role.ADMIN)));

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied: requires one of [${requiredRoles.join(', ')}], current role is ${user.role}`,
      );
    }

    return true;
  }
}
