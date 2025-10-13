import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = req.cookies?.token;
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }
    try {
      const payload = await this.jwtService.verifyAsync(token);
      req.user = payload;
      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

