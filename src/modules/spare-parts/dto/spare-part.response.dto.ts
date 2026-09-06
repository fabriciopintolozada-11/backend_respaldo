import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SparePartCategory } from './spare-part-category.enum';

// BE-12.3 (HU-12): public inventory catalog payload for a spare part.
export class SparePartResponseDto {
  @ApiProperty({ description: 'Identificador del repuesto' })
  id!: string;

  @ApiProperty({ description: 'Código del repuesto' })
  code!: string;

  @ApiProperty({ description: 'Nombre del repuesto' })
  name!: string;

  @ApiProperty({ enum: SparePartCategory })
  category!: SparePartCategory;

  @ApiProperty({ description: 'Precio unitario oficial (BOB)', required: false })
  unitPrice?: string;

  @ApiProperty({ description: 'Stock físico' })
  physicalStock!: number;

  @ApiProperty({ description: 'Stock disponible' })
  availableStock!: number;

  @ApiProperty({ description: 'Stock reservado' })
  reservedStock!: number;

  @ApiPropertyOptional({ description: 'Last stock movement timestamp' })
  lastMovementAt?: Date;

  @ApiProperty({ description: 'Indica si el repuesto está activo en el catálogo' })
  isActive!: boolean;
}
