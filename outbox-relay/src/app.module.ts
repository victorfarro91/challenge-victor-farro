import { Module } from '@nestjs/common';
import { RelayService } from './worker.service';
import { DbModule } from './db.module';

@Module({
  imports: [DbModule],
  providers: [RelayService],
})
export class AppModule {}
