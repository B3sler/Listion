import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Request } from 'express'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>()
    const token = req.cookies?.access_token
    if (!token) {
      throw new UnauthorizedException('No token provided')
    }
    try {
      ;(req as any).user = await this.jwtService.verifyAsync(token)
      return true
    } catch {
      throw new UnauthorizedException('Invalid token')
    }
  }
}
