
import { Module } from '@nestjs/common';
import { PaymentsModule } from './payments/payments.module';
import { DbModule } from './db/db.module';
@Module({ imports: [DbModule, PaymentsModule] })
export class AppModule {}
