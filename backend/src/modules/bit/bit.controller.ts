import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { JwtAuthGuard } from '../user/jwt-auth.guard.js'
import { CurrentUserId } from '../user/current-user.decorator.js'
import { BitService } from './bit.service.js'
import { CreateBitDto } from '../../dto/create-bit.dto.js'
import { UpdateBitDto } from '../../dto/update-bit.dto.js'
import { Bit } from './bit.entity.js'

@ApiTags('Bit')
@Controller('bit')
@UseGuards(JwtAuthGuard)
// a drag/drop burst makes several requests; the global default (60/min) is too tight for the flow canvas
@Throttle({ default: { limit: 300, ttl: 60000 } })
export class BitController {
  constructor(private readonly bitService: BitService) {}

  @Get()
  @ApiOperation({ summary: 'Get all bits (tasks) for the current user' })
  @ApiResponse({ status: 200, type: [Bit] })
  findAll(@CurrentUserId() userId: string) {
    return this.bitService.findAll(userId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single bit (task)' })
  @ApiResponse({ status: 200, type: Bit })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUserId() userId: string) {
    return this.bitService.findOne(id, userId)
  }

  @Post()
  @ApiOperation({ summary: 'Create a new bit (task)' })
  @ApiResponse({ status: 201, type: Bit })
  @ApiResponse({ status: 409, description: 'The client-chosen id is already taken' })
  create(@Body() createBitDto: CreateBitDto, @CurrentUserId() userId: string) {
    return this.bitService.create(createBitDto, userId)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a bit (task)' })
  @ApiResponse({ status: 200, type: Bit })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBitDto: UpdateBitDto,
    @CurrentUserId() userId: string,
  ) {
    return this.bitService.update(id, userId, updateBitDto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a bit (task)' })
  @ApiResponse({ status: 204 })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUserId() userId: string) {
    await this.bitService.remove(id, userId)
    return { message: 'Deleted' }
  }
}
