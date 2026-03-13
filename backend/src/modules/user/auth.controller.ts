import { Controller, Post, Body, Res, UseGuards, Get, Req } from '@nestjs/common'
import { Response, Request } from 'express'
import { JwtService } from '@nestjs/jwt'
import { Throttle } from '@nestjs/throttler'

import { JwtAuthGuard } from './jwt-auth.guard'
import { UserService } from './user.service'

@Controller('auth')
@Throttle({ default: { ttl: 60000, limit: 10 } })
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('register')
  async register(
    @Body() body: { email: string; password: string; name: string },
    @Res() res: Response,
  ) {
    const existing = await this.userService.findByEmail(body.email)
    if (existing) {
      return res.status(400).json({ message: 'E-Mail already registered.' })
    }
    const user = await this.userService.create(body.email, body.password, body.name)
    const token = this.jwtService.sign({ sub: user.id, email: user.email })
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24, // 1 Tag
    })
    return res.json({ user: { id: user.id, email: user.email, name: user.name } })
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }, @Res() res: Response) {
    const user = await this.userService.validateUser(body.email, body.password)
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' })
    }
    const token = this.jwtService.sign({ sub: user.id, email: user.email })
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24, // 1 Tag
    })
    return res.json({ user: { id: user.id, email: user.email, name: user.name } })
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    const user = (req as any).user
    if (!user) {
      return { user: null }
    }
    const dbUser = await this.userService.findByEmail(user.email)
    if (!dbUser) {
      return { user: null }
    }
    return { user: { id: dbUser.id, email: dbUser.email, name: dbUser.name } }
  }

  @Post('logout')
  async logout(@Res() res: Response) {
    res.cookie('access_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
    })
    return res.json({ message: 'Logged out successfully' })
  }
}
