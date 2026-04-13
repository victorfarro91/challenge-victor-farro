import { Module } from '@nestjs/common';
import { StatusWorkerService } from './status-worker.service';
import { DbService } from './db.service';
 
@Module({
  providers: [DbService, StatusWorkerService],
})
export class AppModule {}