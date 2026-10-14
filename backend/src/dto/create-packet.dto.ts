import { ApiProperty } from '@nestjs/swagger'
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

export class CreatePacketDto {
  @ApiProperty({ format: 'uuid', required: false, description: 'Client-generated UUIDv7' })
  @IsOptional()
  @IsUUID('7')
  id?: string

  @ApiProperty({ example: 'Release', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string

  @ApiProperty({ example: 120 })
  @IsInt()
  x!: number

  @ApiProperty({ example: 80 })
  @IsInt()
  y!: number

  @ApiProperty({
    required: false,
    format: 'uuid',
    description: 'Flow the new stack belongs to (the bits leave their own flows)',
  })
  @IsOptional()
  @IsUUID()
  flowId?: string

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Bits in step order (at least 2)',
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  bitIds!: string[]
}
