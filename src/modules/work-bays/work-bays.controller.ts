import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { WorkBaysService } from './work-bays.service';
import { AssignWorkBayDto, AssignWorkBayResponseDto } from './dto/assign-work-bay.dto';
import { UpdateWorkBayStatusDto } from './dto/update-work-bay-status.dto';
import { WorkBayMonitoringResponseDto } from './dto/work-bay-response.dto';

// US-18 (BE-22, BE-25, BE-29): physical bays are only visible and mutable by
// the workshop lead and admins (RN-14).
@ApiTags('work-bays')
@Controller('work-bays')
@Roles(UserRole.WORKSHOP_LEAD, UserRole.ADMIN)
export class WorkBaysController {
  constructor(private readonly service: WorkBaysService) {}

  @Get('monitoring')
  @ApiOperation({ summary: 'Monitor the 4 physical workshop bays (US-18, RN-05, RN-14)' })
  @ApiResponse({ status: 200, type: [WorkBayMonitoringResponseDto] })
  getMonitoring(): Promise<WorkBayMonitoringResponseDto[]> {
    return this.service.getMonitoring();
  }

  @Patch(':id/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a work order to a bay, freeing its previous bay (US-18, RN-14)' })
  @ApiResponse({ status: 200, type: AssignWorkBayResponseDto })
  @ApiResponse({ status: 404, description: 'Bay or work order not found' })
  @ApiResponse({ status: 409, description: 'Capacity complete: the 4 bays are occupied' })
  @ApiResponse({ status: 422, description: 'Work order cannot be assigned to a bay' })
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignWorkBayDto): Promise<AssignWorkBayResponseDto> {
    return this.service.assign(id, dto);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle the physical occupation of a bay (US-18)' })
  @ApiResponse({ status: 200, type: AssignWorkBayResponseDto })
  @ApiResponse({ status: 404, description: 'Bay not found' })
  @ApiResponse({ status: 422, description: 'Cannot occupy a bay without a work order' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkBayStatusDto,
  ): Promise<AssignWorkBayResponseDto> {
    return this.service.setStatus(id, dto);
  }
}