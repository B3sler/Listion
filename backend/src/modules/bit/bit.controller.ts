import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { Request } from 'express'
import { JwtAuthGuard } from '../user/jwt-auth.guard'
import { BitService } from './bit.service'
import { CreateBitDto } from '../../dto/create-bit.dto'
import { UpdateBitDto } from '../../dto/update-bit.dto'
import { Bit } from './bit.entity'

@ApiTags('Bit')
@Controller('bit')
@UseGuards(JwtAuthGuard)
export class BitController {
  constructor(private readonly bitService: BitService) {}

  @Get()
  @ApiOperation({ summary: 'Get all bits (tasks) for the current user' })
  @ApiResponse({ status: 200, type: [Bit] })
  findAll(@Req() req: Request) {
    const userId = (req as any).user.sub as number
    return this.bitService.findAll(userId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single bit (task)' })
  @ApiResponse({ status: 200, type: Bit })
  findOne(@Param('id') id: number, @Req() req: Request) {
    const userId = (req as any).user.sub as number
    return this.bitService.findOne(id, userId)
  }

  @Post()
  @ApiOperation({ summary: 'Create a new bit (task)' })
  @ApiResponse({ status: 201, type: Bit })
  create(@Body() createBitDto: CreateBitDto, @Req() req: Request) {
    const userId = (req as any).user.sub as number
    return this.bitService.create(createBitDto, userId)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a bit (task)' })
  @ApiResponse({ status: 200, type: Bit })
  update(@Param('id') id: number, @Body() updateBitDto: UpdateBitDto, @Req() req: Request) {
    const userId = (req as any).user.sub as number
    return this.bitService.update(id, userId, updateBitDto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a bit (task)' })
  @ApiResponse({ status: 204 })
  async remove(@Param('id') id: number, @Req() req: Request) {
    const userId = (req as any).user.sub as number
    await this.bitService.remove(id, userId)
    return { message: 'Deleted' }
  }
}
