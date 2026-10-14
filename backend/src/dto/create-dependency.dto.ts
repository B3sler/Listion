import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsOptional, IsUUID } from 'class-validator'
import { NODE_TYPES, type NodeType } from '../modules/dependency/dependency.entity.js'

export class CreateDependencyDto {
  @ApiProperty({ format: 'uuid', required: false, description: 'Client-generated UUIDv7' })
  @IsOptional()
  @IsUUID('7')
  id?: string

  @ApiProperty({ enum: NODE_TYPES, example: 'bit' })
  @IsIn(NODE_TYPES)
  fromType!: NodeType

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fromId!: string

  @ApiProperty({ enum: NODE_TYPES, example: 'packet' })
  @IsIn(NODE_TYPES)
  toType!: NodeType

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  toId!: string
}
