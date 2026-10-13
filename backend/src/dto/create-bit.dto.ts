import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsDate,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class CreateBitDto {
  @ApiProperty({ example: 'Go shopping', description: 'Short text describing the task' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string

  @ApiProperty({
    example: 0,
    description: 'Status: 0=open, 1=in progress, 2=done',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  status?: number

  @ApiProperty({
    example: '2025-10-20T12:00:00',
    description: 'Deadline for completion',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date

  @ApiProperty({ example: 2, description: 'Priority: 1=low, 2=medium, 3=high', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  priority?: number

  @ApiProperty({ example: 'Milk, bread, eggs', description: 'Notes for the task', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string

  @ApiProperty({ example: 5, description: 'X Coordinate of Bit', required: false })
  @IsOptional()
  @IsInt()
  x?: number

  @ApiProperty({ example: 2, description: 'Y Coordinate of Bit', required: false })
  @IsOptional()
  @IsInt()
  y?: number

  @ApiProperty({ example: 1, description: 'Bit workspace', required: false })
  @IsOptional()
  @IsInt()
  workspace?: number

  @ApiProperty({ example: '#6366f1', description: 'Hex color of the bit (#rrggbb)', required: false })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string
}
