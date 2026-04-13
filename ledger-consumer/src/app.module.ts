
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DbService } from './db.service';
import { WorkerService } from './worker.service';
@Module({ imports: [ScheduleModule.forRoot()], providers: [DbService, WorkerService] })
export class AppModule {}
