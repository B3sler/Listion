import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger'
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator'
import { CreateBitDto } from './create-bit.dto.js'

// the id is fixed at creation; flowId gets its own nullable field below
export class UpdateBitDto extends PartialType(OmitType(CreateBitDto, ['id', 'flowId'] as const)) {
  @ApiProperty({
    required: false,
    nullable: true,
    format: 'uuid',
    description: 'Append the bit to this packet, or null to make it a loose bit',
  })
  @IsOptional()
  @IsUUID()
  packetId?: string | null

  @ApiProperty({
    required: false,
    nullable: true,
    format: 'uuid',
    description: 'Put the loose bit into this flow, or null to take it out',
  })
  @IsOptional()
  @IsUUID()
  flowId?: string | null

  @ApiProperty({
    required: false,
    example: 4,
    description: 'Number of completed repetitions of a recurring bit',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  completedCount?: number
}
