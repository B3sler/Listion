import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BitService } from '../services/bit.service';
import { CreateBitDto } from '../types/create-bit.dto';
import { UpdateBitDto } from '../types/update-bit.dto';
import { Bit } from '../entities/bit.entity';

@ApiTags('Bit')
@Controller('bit')
export class BitController {
  constructor(private readonly bitService: BitService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Aufgaben abrufen' })
  @ApiResponse({ status: 200, type: [Bit] })
  findAll() {
    return this.bitService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Eine Aufgabe abrufen' })
  @ApiResponse({ status: 200, type: Bit })
  findOne(@Param('id') id: number) {
    return this.bitService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Neue Aufgabe erstellen' })
  @ApiResponse({ status: 201, type: Bit })
  create(@Body() createBitDto: CreateBitDto) {
    return this.bitService.create(createBitDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Aufgabe aktualisieren' })
  @ApiResponse({ status: 200, type: Bit })
  update(@Param('id') id: number, @Body() updateBitDto: UpdateBitDto) {
    return this.bitService.update(id, updateBitDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Aufgabe löschen' })
  @ApiResponse({ status: 204 })
  async remove(@Param('id') id: number) {
    await this.bitService.remove(id);
    return { message: 'Gelöscht' };
  }
}
