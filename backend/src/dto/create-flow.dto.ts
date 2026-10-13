import { ApiProperty } from '@nestjs/swagger'
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator'

export class CreateFlowDto {
  @ApiProperty({ example: 'Release Q4', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string

  @ApiProperty({ example: '#818cf8', required: false })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string

  @ApiProperty({ type: [Number], example: [1, 4], description: 'Loose bits to put into the flow' })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  bitIds!: number[]

  @ApiProperty({ type: [Number], example: [2], description: 'Packets to put into the flow' })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  packetIds!: number[]
}
