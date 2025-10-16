import { ApiProperty } from '@nestjs/swagger'

export class CreateBitDto {
  @ApiProperty({ example: 1, description: 'UserId to whom the task belongs' })
  user!: number

  @ApiProperty({ example: 'Go shopping', description: 'Short text describing the task' })
  title!: string

  @ApiProperty({
    example: 0,
    description: 'Status: 0=open, 1=in progress, 2=done',
    required: false,
  })
  status?: number

  @ApiProperty({
    example: '2025-10-20T12:00:00',
    description: 'Deadline for completion',
    required: false,
  })
  dueDate?: Date

  @ApiProperty({ example: 2, description: 'Priority: 1=low, 2=medium, 3=high', required: false })
  priority?: number

  @ApiProperty({ example: 'Milk, bread, eggs', description: 'Notes for the task', required: false })
  notes?: string
}
