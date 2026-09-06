import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { ListQuoteApprovalResponseDto } from './dto/quote-approval-query-response.dto';
import { QueryQuoteApprovalsDto } from './dto/query-quote-approvals.dto';
import { QuotesService } from './quotes.service';

@ApiTags('quotes')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteApprovalQueryController {
  constructor(private readonly service: QuotesService) {}

  @Get('budgets/approval')
  @Roles(UserRole.RECEPTIONIST, UserRole.WORKSHOP_LEAD, UserRole.ADMIN)
  @ApiOperation({ summary: 'List quotes awaiting customer approval (HU-09)' })
  @ApiResponse({ status: 200, type: ListQuoteApprovalResponseDto })
  listApprovalQuotes(@Query() query: QueryQuoteApprovalsDto): Promise<ListQuoteApprovalResponseDto> {
    return this.service.listApprovalQuotes(query);
  }
}
