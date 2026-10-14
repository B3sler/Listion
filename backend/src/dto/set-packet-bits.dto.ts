import { ApiProperty } from '@nestjs/swagger'
import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator'

export class SetPacketBitsDto {
  @ApiProperty({ type: [String], format: 'uuid', description: 'All member bits in step order' })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  bitIds!: string[]
}
