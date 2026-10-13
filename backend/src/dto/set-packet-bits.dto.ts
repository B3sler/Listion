import { ApiProperty } from '@nestjs/swagger'
import { ArrayMinSize, ArrayUnique, IsArray, IsInt } from 'class-validator'

export class SetPacketBitsDto {
  @ApiProperty({ type: [Number], example: [3, 1, 2], description: 'All member bits in step order' })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayUnique()
  @IsInt({ each: true })
  bitIds!: number[]
}
