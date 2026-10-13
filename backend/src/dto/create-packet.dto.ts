import { ApiProperty } from '@nestjs/swagger'
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

export class CreatePacketDto {
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
    example: 2,
    description: 'Flow the new stack belongs to (the bits leave their own flows)',
  })
  @IsOptional()
  @IsInt()
  flowId?: number

  @ApiProperty({ type: [Number], example: [1, 2], description: 'Bits in step order (at least 2)' })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayUnique()
  @IsInt({ each: true })
  bitIds!: number[]
}
