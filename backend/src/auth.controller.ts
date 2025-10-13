import { Controller, Post, Body, Res, UseGuards, Get, Req } from '@nestjs/common'
import { Response, Request } from 'express'
import { JwtService } from '@nestjs/jwt'

import { JwtAuthGuard } from './jwt-auth.guard'
import { UserService } from './user.service'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('register')
  async register(@Body() body: { email: string; password: string; name: string }) {
    const existing = await this.userService.findByEmail(body.email)
    if (existing) {
      return { message: 'E-Mail already registered.' }
    }
    const user = await this.userService.create(body.email, body.password, body.name)
    const token = this.jwtService.sign({ sub: user.id, email: user.email })
    return { user: { id: user.id, email: user.email, name: user.name }, token }
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const user = await this.userService.validateUser(body.email, body.password)
    if (!user) {
      return { message: 'Invalid credentials.' }
    }
    const token = this.jwtService.sign({ sub: user.id, email: user.email })
    return { user: { id: user.id, email: user.email, name: user.name }, token }
  }
}
