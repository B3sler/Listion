import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

export interface JwtPayload {
  sub: string
  email: string
}

export type AuthenticatedRequest = Request & { user?: JwtPayload }

/** The id of the logged-in user, taken from the verified JWT (set by JwtAuthGuard). */
export const CurrentUserId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>()
  return req.user!.sub
})
