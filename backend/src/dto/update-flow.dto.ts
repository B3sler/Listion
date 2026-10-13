import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator'

export class UpdateFlowDto {
  @ApiProperty({ example: 'Release Q4', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string

  @ApiProperty({ example: '#34d399', required: false })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string
}
