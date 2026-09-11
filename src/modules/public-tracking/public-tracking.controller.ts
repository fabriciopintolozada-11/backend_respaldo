import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { PublicTrackingRequestDto } from './dto/public-tracking-request.dto';
import { PublicTrackingResponseDto } from './dto/public-tracking-response.dto';
import { PublicTrackingService } from './public-tracking.service';

@ApiTags('public-tracking')
@Controller('public-tracking')
@UseGuards(ThrottlerGuard)
export class PublicTrackingController {
  constructor(private readonly service: PublicTrackingService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Public customer tracking lookup by license plate and national id (US-17, RN-17)' })
  @ApiResponse({ status: 200, description: 'Active work order tracking data', type: PublicTrackingResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 404, description: 'No active work order matched the provided data' })
  @ApiResponse({ status: 429, description: 'Too many requests from the same IP' })
  findActiveWorkOrder(@Body() dto: PublicTrackingRequestDto): Promise<PublicTrackingResponseDto> {
    return this.service.findActiveWorkOrder(dto);
  }
}
