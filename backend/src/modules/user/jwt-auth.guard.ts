import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { isUUID } from 'class-validator'
import type { AuthenticatedRequest, JwtPayload } from './current-user.decorator.js'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = req.cookies?.access_token
    if (!token) {
      throw new UnauthorizedException('No token provided')
    }
    let payload: JwtPayload
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token)
    } catch {
      throw new UnauthorizedException('Invalid token')
    }
    // tokens from before the switch to UUIDs carry a numeric sub
    if (!isUUID(payload.sub)) throw new UnauthorizedException('Invalid token')
    req.user = payload
    return true
  }
}
