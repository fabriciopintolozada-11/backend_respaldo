import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { SparePartsService } from './spare-parts.service';
import { SparePartResponseDto } from './dto/spare-part.response.dto';
import { QuerySparePartsDto } from './dto/query-spare-parts.dto';
import { ListSparePartsResponseDto } from './dto/list-spare-parts.response.dto';
import { CreateSparePartDto } from './dto/create-spare-part.dto';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { InventoryAdjustmentResponseDto } from './dto/inventory-adjustment-response.dto';
import { Request } from 'express';

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
  @ApiResponse({ status: 200, type: ListSparePartsResponseDto })
  findAll(@Query() query: QuerySparePartsDto, @Req() request: Request): Promise<ListSparePartsResponseDto> {
    return this.service.findAll(query, request.user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a spare part by id (HU-12, BE-12.3)' })
  @ApiResponse({ status: 200, type: SparePartResponseDto })
  @ApiResponse({ status: 404, description: 'Spare part not found' })
  findById(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request): Promise<SparePartResponseDto> {
    return this.service.findById(id, request.user.role);
  }

  @Post()
  @Roles(UserRole.WORKSHOP_LEAD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create an active spare part and record initial stock (HU-23, RN-19, RN-21)' })
  @ApiResponse({ status: 201, type: SparePartResponseDto })
  @ApiResponse({ status: 409, description: 'Spare part code already exists' })
  create(@Body() dto: CreateSparePartDto, @Req() request: Request): Promise<SparePartResponseDto> {
    return this.service.create(dto, request.user.id);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.WORKSHOP_LEAD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate a spare part without deleting its history (HU-23, RN-19)' })
  @ApiResponse({ status: 200, type: SparePartResponseDto })
  @ApiResponse({ status: 409, description: 'Spare part has pending reservations' })
  deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<SparePartResponseDto> {
    return this.service.deactivate(id);
  }

  // US-14: register a physical inventory adjustment (positive or negative).
  // Only WORKSHOP_LEAD and ADMIN may perform this operation (RN-14, RN-15).
  @Post('adjustments')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.WORKSHOP_LEAD, UserRole.ADMIN)
  @ApiOperation({ summary: 'Register a physical inventory adjustment (US-14, RN-07, RN-08, BE-17)' })
  @ApiResponse({ status: 201, type: InventoryAdjustmentResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid DTO payload' })
  @ApiResponse({ status: 403, description: 'Insufficient role for this operation' })
  @ApiResponse({ status: 404, description: 'Spare part not found' })
  @ApiResponse({ status: 422, description: 'Adjustment would result in negative stock or below reserved (RN-07)' })
  createAdjustment(
    @Body() dto: CreateInventoryAdjustmentDto,
    @Req() request: Request,
  ): Promise<InventoryAdjustmentResponseDto> {
    return this.service.createAdjustment(dto, request.user.id, request.user.role);
  }
}
