import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import type { Request } from 'express'
import { JwtAuthGuard } from '../user/jwt-auth.guard.js'
import { PacketService } from './packet.service.js'
import { Packet } from './packet.entity.js'
import { CreatePacketDto } from '../../dto/create-packet.dto.js'
import { UpdatePacketDto } from '../../dto/update-packet.dto.js'
import { SetPacketBitsDto } from '../../dto/set-packet-bits.dto.js'

@ApiTags('Packet')
@Controller('packet')
@UseGuards(JwtAuthGuard)
// a drag/drop burst makes several requests; the global default (60/min) is too tight for the flow canvas
@Throttle({ default: { limit: 300, ttl: 60000 } })
export class PacketController {
  constructor(private readonly packetService: PacketService) {}

  @Get()
  @ApiOperation({ summary: 'Get all packets (stacks) of the current user' })
  @ApiResponse({ status: 200, type: [Packet] })
  findAll(@Req() req: Request) {
    const userId = (req as any).user.sub as number
    return this.packetService.findAll(userId)
  }

  @Post()
  @ApiOperation({ summary: 'Create a packet from at least two bits (in step order)' })
  @ApiResponse({ status: 201, type: Packet })
  create(@Body() dto: CreatePacketDto, @Req() req: Request) {
    const userId = (req as any).user.sub as number
    return this.packetService.create(dto, userId)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Rename or move a packet' })
  @ApiResponse({ status: 200, type: Packet })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePacketDto, @Req() req: Request) {
    const userId = (req as any).user.sub as number
    return this.packetService.update(id, userId, dto)
  }

  @Put(':id/bits')
  @ApiOperation({ summary: 'Set the exact member bits of a packet in step order' })
  @ApiResponse({ status: 200, type: Packet })
  setBits(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetPacketBitsDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.sub as number
    return this.packetService.setBits(id, userId, dto.bitIds)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Dissolve a packet (its bits become loose)' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const userId = (req as any).user.sub as number
    await this.packetService.remove(id, userId)
    return { message: 'Deleted' }
  }
}
