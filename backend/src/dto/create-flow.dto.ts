import { ApiProperty } from '@nestjs/swagger'
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator'

export class CreateFlowDto {
  // absent is fine; null is not (it would reach the NOT NULL column)
  @ApiProperty({ example: 'Release Q4', required: false })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string

  @ApiProperty({ example: '#818cf8', required: false })
  @ValidateIf((_, value) => value !== undefined)
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
