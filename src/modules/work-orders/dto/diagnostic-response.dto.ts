import { ApiProperty } from '@nestjs/swagger';

export class DiagnosticResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workOrderId!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: [String] }) suggestedTasks!: string[];
  @ApiProperty({ type: [String] }) suggestedPartIds!: string[];
  @ApiProperty() estimatedHours!: number;
  @ApiProperty() createdAt!: Date;
}
