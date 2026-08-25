import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QueryVehicleStatusDto } from './dto/query-vehicle-status.dto';
import { VehicleStatusResponseDto } from './dto/vehicle-status.response.dto';
import { VehicleStatusService } from './vehicle-status.service';

// BE-22 / RN-17: public endpoint, no authentication, plate + identification.
@ApiTags('public')
@Controller('public/vehicle-status')
export class VehicleStatusController {
  constructor(private readonly service: VehicleStatusService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Consultar el estado actual de un vehículo sin autenticación (US-02, RN-17)' })
  @ApiQuery({ name: 'plate', required: true, description: 'Placa del vehículo', example: '1234ABC' })
  @ApiQuery({ name: 'customerIdentification', required: true, description: 'Documento de identidad del cliente', example: '1234567' })
  @ApiResponse({ status: 200, description: 'Estado actual del vehículo', type: VehicleStatusResponseDto })
  @ApiResponse({ status: 400, description: 'Los parámetros de consulta son inválidos o incompletos' })
  @ApiResponse({ status: 404, description: 'No se encontró una Orden de Trabajo activa válida' })
  query(@Query() dto: QueryVehicleStatusDto): Promise<VehicleStatusResponseDto> {
    return this.service.getStatus(dto.plate, dto.customerIdentification);
  }
}
