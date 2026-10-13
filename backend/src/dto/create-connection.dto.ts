import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsInt } from 'class-validator'
import { SIDES, type Side } from '../modules/connection/connection.entity.js'

const SIDE_DESCRIPTION = `Connector side (${SIDES.join('|')})`

export class CreateConnectionDto {
  @ApiProperty({ example: 1, description: 'ID of the source bit' })
  @IsInt()
  fromBitId!: number

  @ApiProperty({ example: 2, description: 'ID of the target bit' })
  @IsInt()
  toBitId!: number

  @ApiProperty({ example: 'right', description: SIDE_DESCRIPTION, enum: SIDES })
  @IsIn(SIDES)
  fromSide!: Side

  @ApiProperty({ example: 'left', description: SIDE_DESCRIPTION, enum: SIDES })
  @IsIn(SIDES)
  toSide!: Side
}
