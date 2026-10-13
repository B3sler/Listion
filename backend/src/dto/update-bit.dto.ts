import { ApiProperty, PartialType } from '@nestjs/swagger'
import { IsInt, IsOptional } from 'class-validator'
import { CreateBitDto } from './create-bit.dto.js'

export class UpdateBitDto extends PartialType(CreateBitDto) {
  @ApiProperty({
    required: false,
    nullable: true,
    example: 3,
    description: 'Append the bit to this packet, or null to make it a loose bit',
  })
  @IsOptional()
  @IsInt()
  packetId?: number | null
}
