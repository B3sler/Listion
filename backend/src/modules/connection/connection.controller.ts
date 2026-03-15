import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { Request } from 'express'
import { JwtAuthGuard } from '../user/jwt-auth.guard'
import { ConnectionService } from './connection.service'
import { CreateConnectionDto } from '../../dto/create-connection.dto'
import { BitConnection } from './connection.entity'

@ApiTags('Connection')
@Controller('connection')
@UseGuards(JwtAuthGuard)
export class ConnectionController {
  constructor(private readonly connectionService: ConnectionService) {}

  @Get()
  @ApiOperation({ summary: 'Get all connections for the current user' })
  @ApiResponse({ status: 200, type: [BitConnection] })
  findAll(@Req() req: Request) {
    const userId = (req as any).user.sub as number
    return this.connectionService.findAll(userId)
  }

  @Post()
  @ApiOperation({ summary: 'Connect two bits via their connector dots' })
  @ApiResponse({ status: 201, type: BitConnection })
  create(@Body() dto: CreateConnectionDto, @Req() req: Request) {
    const userId = (req as any).user.sub as number
    return this.connectionService.create(dto, userId)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a connection' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id') id: number, @Req() req: Request) {
    const userId = (req as any).user.sub as number
    await this.connectionService.remove(id, userId)
    return { message: 'Deleted' }
  }
}
