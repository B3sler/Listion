import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsInt } from 'class-validator'
import { NODE_TYPES, type NodeType } from '../modules/dependency/dependency.entity.js'

export class CreateDependencyDto {
  @ApiProperty({ enum: NODE_TYPES, example: 'bit' })
  @IsIn(NODE_TYPES)
  fromType!: NodeType

  @ApiProperty({ example: 1 })
  @IsInt()
  fromId!: number

  @ApiProperty({ enum: NODE_TYPES, example: 'packet' })
  @IsIn(NODE_TYPES)
  toType!: NodeType

  @ApiProperty({ example: 2 })
  @IsInt()
  toId!: number
}
