import { PartialType } from '@nestjs/swagger'
import { CreateBitDto } from './create-bit.dto.js'

export class UpdateBitDto extends PartialType(CreateBitDto) {}
