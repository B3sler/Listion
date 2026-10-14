import { ApiProperty } from '@nestjs/swagger'
import {
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator'

export class CreateFlowDto {
  @ApiProperty({ format: 'uuid', required: false, description: 'Client-generated UUIDv7' })
  @IsOptional()
  @IsUUID('7')
  id?: string

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

  @ApiProperty({ type: [String], format: 'uuid', description: 'Loose bits to put into the flow' })
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  bitIds!: string[]

  @ApiProperty({ type: [String], format: 'uuid', description: 'Packets to put into the flow' })
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  packetIds!: string[]
}
