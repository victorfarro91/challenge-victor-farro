
import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { PaymentsService } from './payments.service';
@Controller('payments')
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}
  @Post() create(@Body() body: any) { return this.svc.create(body); }
  @Get(':id') status(@Param('id') id: string) { return this.svc.status(id); }
}
