import { ApiProperty } from '@nestjs/swagger';

// BE-12.3 (HU-12): public inventory catalog payload for a spare part.
export class SparePartResponseDto {
  @ApiProperty({ description: 'Identificador del repuesto' })
  id!: string;

  @ApiProperty({ description: 'Código del repuesto' })
  code!: string;

  @ApiProperty({ description: 'Nombre del repuesto' })
  name!: string;

  @ApiProperty({ description: 'Precio unitario oficial (BOB)' })
  unitPrice!: string;

  @ApiProperty({ description: 'Stock disponible' })
  availableStock!: number;

  @ApiProperty({ description: 'Stock reservado' })
  reservedStock!: number;

  @ApiProperty({ description: 'Indica si el repuesto está activo en el catálogo' })
  isActive!: boolean;
}
