import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export const RECURRENCES = ['daily', 'weekdays', 'weekly', 'monthly'] as const
export type Recurrence = (typeof RECURRENCES)[number]

export class CreateBitDto {
  @ApiProperty({
    format: 'uuid',
    required: false,
    description: 'Client-generated UUIDv7, so the bit can be shown before the server answers',
  })
  @IsOptional()
  @IsUUID('7')
  id?: string

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

  @ApiProperty({
    example: '#6366f1',
    description: 'Hex color of the bit (#rrggbb)',
    required: false,
  })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string

  @ApiProperty({ format: 'uuid', description: 'Flow the new bit belongs to', required: false })
  @IsOptional()
  @IsUUID()
  flowId?: string

  @ApiProperty({
    example: 3,
    description: 'Visual size of the bit (1-4)',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  size?: number | null

  @ApiProperty({
    enum: RECURRENCES,
    example: 'weekdays',
    description: 'How often the bit repeats',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsIn(RECURRENCES)
  recurrence?: Recurrence | null

  @ApiProperty({
    example: '2026-10-21',
    description: 'Calendar day (YYYY-MM-DD) until which the bit is snoozed',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  snoozedUntil?: string | null
}
