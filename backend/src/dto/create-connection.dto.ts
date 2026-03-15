import { ApiProperty } from '@nestjs/swagger'

export class CreateConnectionDto {
  @ApiProperty({ example: 1, description: 'ID of the source bit' })
  fromBitId!: number

  @ApiProperty({ example: 2, description: 'ID of the target bit' })
  toBitId!: number

  @ApiProperty({ example: 'right', description: 'Connector side on the source bit (top|top-right|right|bottom-right|bottom|bottom-left|left|top-left)' })
  fromSide!: 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left' | 'top-left'

  @ApiProperty({ example: 'left', description: 'Connector side on the target bit (top|top-right|right|bottom-right|bottom|bottom-left|left|top-left)' })
  toSide!: 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left' | 'top-left'
}
