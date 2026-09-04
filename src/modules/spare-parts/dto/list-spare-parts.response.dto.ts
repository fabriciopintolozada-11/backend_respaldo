import { ApiProperty } from '@nestjs/swagger';
import { SparePartResponseDto } from './spare-part.response.dto';

export class ListSparePartsResponseDto {
  @ApiProperty({ type: [SparePartResponseDto] })
  data!: SparePartResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
