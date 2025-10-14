import { ApiProperty } from '@nestjs/swagger';

export class CreateBitDto {
  @ApiProperty({ example: 1, description: 'UserId, dem die Aufgabe gehört' })
  user!: number;

  @ApiProperty({ example: 'Einkaufen gehen', description: 'Kurzer Text, der die Aufgabe beschreibt' })
  titel!: string;

  @ApiProperty({ example: 0, description: 'Status: 0=offen, 1=in Bearbeitung, 2=erledigt', required: false })
  status?: number;

  @ApiProperty({ example: '2025-10-20T12:00:00', description: 'Bis wann erledigt', required: false })
  dueDate?: Date;

  @ApiProperty({ example: 2, description: 'Priorität: 1=niedrig, 2=mittel, 3=hoch', required: false })
  priority?: number;

  @ApiProperty({ example: 'Milch, Brot, Eier', description: 'Notizen zur Aufgabe', required: false })
  notes?: string;
}

