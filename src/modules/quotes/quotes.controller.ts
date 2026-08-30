import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { QuoteResponseDto } from './dto/quote-response.dto';
import { QuotesService } from './quotes.service';

@ApiTags('quotes')
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
}
