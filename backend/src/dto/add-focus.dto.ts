import { ApiProperty } from '@nestjs/swagger'
import { IsInt, Max, Min } from 'class-validator'

export class AddFocusDto {
  @ApiProperty({
    example: 1500,
    minimum: 1,
    maximum: 86400,
    description: 'Tracked focus time in seconds to add to the bit',
  })
  @IsInt()
  @Min(1)
  @Max(86400)
  seconds!: number
}
