import { describe, it, expect } from 'vitest'
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { JwtAuthGuard } from './jwt-auth.guard.js'
import type { AuthenticatedRequest } from './current-user.decorator.js'

const jwt = new JwtService({ secret: 'test-secret' })
const guard = new JwtAuthGuard(jwt)
const USER = '0192f1a0-0000-7000-8000-000000000001'

function ctx(req: Partial<AuthenticatedRequest>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext
}

describe('JwtAuthGuard', () => {
  it('setzt req.user für ein gültiges Token mit UUID-sub', async () => {
    const req: Partial<AuthenticatedRequest> = {
      cookies: { access_token: jwt.sign({ sub: USER, email: 'a@b.de' }) },
    }
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true)
    expect(req.user).toMatchObject({ sub: USER, email: 'a@b.de' })
  })

  it('lehnt alte Tokens mit numerischem sub ab', async () => {
    const req = { cookies: { access_token: jwt.sign({ sub: 5, email: 'a@b.de' }) } }
    await expect(guard.canActivate(ctx(req))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('lehnt fehlende und ungültige Tokens ab', async () => {
    await expect(guard.canActivate(ctx({ cookies: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
    await expect(
      guard.canActivate(ctx({ cookies: { access_token: 'kaputt' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
