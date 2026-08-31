import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ApproveQuoteDto } from './dto/approve-quote.dto';
import { RejectQuoteDto } from './dto/reject-quote.dto';
import { QuoteDecisionResponseDto } from './dto/quote-decision-response.dto';
import { QuoteResponseDto } from './dto/quote-response.dto';
import { QuotesService } from './quotes.service';

@ApiTags('quotes')
@ApiBearerAuth()
@Controller('work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RECEPTIONIST, UserRole.WORKSHOP_LEAD, UserRole.ADMIN)
export class QuotesController {
  constructor(private readonly service: QuotesService) {}

  @Post(':id/quote')
  @ApiOperation({ summary: 'Create a workshop quote in BOB (US-12, RN-21)' })
  @ApiResponse({ status: 201, type: QuoteResponseDto })
  create(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateQuoteDto): Promise<QuoteResponseDto> {
    return this.service.create(id, dto);
  }

  @Post(':id/approve-quote')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.RECEPTIONIST, UserRole.ADMIN)
  @ApiOperation({ summary: 'Record customer approval and reserve quoted parts (US-09, RN-02, RN-07, RN-08)' })
  @ApiResponse({ status: 201, type: QuoteDecisionResponseDto })
  @ApiResponse({ status: 409, description: 'Quote is not awaiting a decision or already decided' })
  @ApiResponse({ status: 422, description: 'A quoted spare part has insufficient available stock' })
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveQuoteDto, @Req() request: Request): Promise<QuoteDecisionResponseDto> {
    return this.service.approve(id, dto, request.user.id);
  }

  @Post(':id/reject-quote')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.RECEPTIONIST, UserRole.ADMIN)
  @ApiOperation({ summary: 'Record customer rejection of a quote (US-09, RN-02)' })
  @ApiResponse({ status: 201, type: QuoteDecisionResponseDto })
  @ApiResponse({ status: 409, description: 'Quote is not awaiting a decision or already decided' })
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectQuoteDto, @Req() request: Request): Promise<QuoteDecisionResponseDto> {
    return this.service.reject(id, dto, request.user.id);
  }
}
