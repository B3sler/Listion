import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../user/jwt-auth.guard.js'
import { CurrentUserId } from '../user/current-user.decorator.js'
import { FlowService } from './flow.service.js'
import { Flow } from './flow.entity.js'
import { CreateFlowDto } from '../../dto/create-flow.dto.js'
import { UpdateFlowDto } from '../../dto/update-flow.dto.js'

@ApiTags('Flow')
@Controller('flow')
@UseGuards(JwtAuthGuard)
// same canvas burst budget as the packet controller
@Throttle({ default: { limit: 300, ttl: 60000 } })
export class FlowController {
  constructor(private readonly flowService: FlowService) {}

  @Get()
  @ApiOperation({ summary: 'Get all flows (canvas groups) of the current user' })
  @ApiResponse({ status: 200, type: [Flow] })
  findAll(@CurrentUserId() userId: string) {
    return this.flowService.findAll(userId)
  }

  @Post()
  @ApiOperation({ summary: 'Create a flow from loose bits and packets' })
  @ApiResponse({ status: 201, type: Flow })
  @ApiResponse({ status: 409, description: 'The client-chosen id is already taken' })
  create(@Body() dto: CreateFlowDto, @CurrentUserId() userId: string) {
    return this.flowService.create(dto, userId)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Rename or recolour a flow' })
  @ApiResponse({ status: 200, type: Flow })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFlowDto,
    @CurrentUserId() userId: string,
  ) {
    return this.flowService.update(id, userId, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Dissolve a flow (its members stay)' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUserId() userId: string) {
    await this.flowService.remove(id, userId)
    return { message: 'Deleted' }
  }
}
