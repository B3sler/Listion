import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { BitService } from './bit.service'
import { CreateBitDto } from '../../dto/create-bit.dto'
import { UpdateBitDto } from '../../dto/update-bit.dto'
import { Bit } from './bit.entity'

@ApiTags('Bit')
@Controller('bit')
export class BitController {
  constructor(private readonly bitService: BitService) {}

  @Get()
  @ApiOperation({ summary: 'Get all bits (tasks)' })
  @ApiResponse({ status: 200, type: [Bit] })
  findAll() {
    return this.bitService.findAll()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single bit (task)' })
  @ApiResponse({ status: 200, type: Bit })
  findOne(@Param('id') id: number) {
    return this.bitService.findOne(id)
  }

  @Post()
  @ApiOperation({ summary: 'Create a new bit (task)' })
  @ApiResponse({ status: 201, type: Bit })
  create(@Body() createBitDto: CreateBitDto) {
    return this.bitService.create(createBitDto)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a bit (task)' })
  @ApiResponse({ status: 200, type: Bit })
  update(@Param('id') id: number, @Body() updateBitDto: UpdateBitDto) {
    return this.bitService.update(id, updateBitDto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a bit (task)' })
  @ApiResponse({ status: 204 })
  async remove(@Param('id') id: number) {
    await this.bitService.remove(id)
    return { message: 'Deleted' }
  }
}
