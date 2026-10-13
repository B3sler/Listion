import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, Matches, MaxLength, ValidateIf } from 'class-validator'

export class UpdateFlowDto {
  // absent is fine; null is not (it would reach the NOT NULL column)
  @ApiProperty({ example: 'Release Q4', required: false })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string

  @ApiProperty({ example: '#34d399', required: false })
  @ValidateIf((_, value) => value !== undefined)
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string
}
