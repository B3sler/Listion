import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../user/jwt-auth.guard.js'
import { CurrentUserId } from '../user/current-user.decorator.js'
import { DependencyService } from './dependency.service.js'
import { Dependency } from './dependency.entity.js'
import { CreateDependencyDto } from '../../dto/create-dependency.dto.js'

@ApiTags('Dependency')
@Controller('dependency')
@UseGuards(JwtAuthGuard)
// a drag/drop burst makes several requests; the global default (60/min) is too tight for the flow canvas
@Throttle({ default: { limit: 300, ttl: 60000 } })
export class DependencyController {
  constructor(private readonly dependencyService: DependencyService) {}

  @Get()
  @ApiOperation({ summary: 'Get all dependencies (arrows) of the current user' })
  @ApiResponse({ status: 200, type: [Dependency] })
  findAll(@CurrentUserId() userId: string) {
    return this.dependencyService.findAll(userId)
  }

  @Post()
  @ApiOperation({ summary: 'Create a dependency: "to" waits for "from" (bit or packet each)' })
  @ApiResponse({ status: 201, type: Dependency })
  @ApiResponse({ status: 409, description: 'The client-chosen id is already taken' })
  create(@Body() dto: CreateDependencyDto, @CurrentUserId() userId: string) {
    return this.dependencyService.create(dto, userId)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a dependency' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUserId() userId: string) {
    await this.dependencyService.remove(id, userId)
    return { message: 'Deleted' }
  }
}
