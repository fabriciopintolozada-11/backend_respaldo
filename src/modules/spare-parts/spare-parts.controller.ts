import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { SparePartsService } from './spare-parts.service';
import { SparePartResponseDto } from './dto/spare-part.response.dto';

// BE-12.3 (HU-12): inventory catalog used to build budgets with official prices.
@ApiTags('spare-parts')
@ApiBearerAuth()
@Controller('spare-parts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RECEPTIONIST, UserRole.WORKSHOP_LEAD, UserRole.MECHANIC, UserRole.ADMIN)
export class SparePartsController {
  constructor(private readonly service: SparePartsService) {}

  @Get()
  @ApiOperation({ summary: 'List the active spare parts catalog (HU-12, BE-12.3)' })
  @ApiResponse({ status: 200, type: [SparePartResponseDto] })
  findAll(): Promise<SparePartResponseDto[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a spare part by id (HU-12, BE-12.3)' })
  @ApiResponse({ status: 200, type: SparePartResponseDto })
  @ApiResponse({ status: 404, description: 'Spare part not found' })
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<SparePartResponseDto> {
    return this.service.findById(id);
  }
}
