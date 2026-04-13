
import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
@Injectable()
export class DbService {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
}
