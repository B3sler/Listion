import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdatePacketDto {
  @ApiProperty({ example: 'Release', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string

  @ApiProperty({ example: 120, required: false })
  @IsOptional()
  @IsInt()
  x?: number

  @ApiProperty({ example: 80, required: false })
  @IsOptional()
  @IsInt()
  y?: number
}
