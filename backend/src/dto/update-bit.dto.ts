import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger'
import { IsInt, IsOptional } from 'class-validator'
import { CreateBitDto } from './create-bit.dto.js'

export class UpdateBitDto extends PartialType(OmitType(CreateBitDto, ['flowId'] as const)) {
  @ApiProperty({
    required: false,
    nullable: true,
    example: 3,
    description: 'Append the bit to this packet, or null to make it a loose bit',
  })
  @IsOptional()
  @IsInt()
  packetId?: number | null

  @ApiProperty({
    required: false,
    nullable: true,
    example: 2,
    description: 'Put the loose bit into this flow, or null to take it out',
  })
  @IsOptional()
  @IsInt()
  flowId?: number | null
}
