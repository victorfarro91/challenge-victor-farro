
import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { randomUUID } from 'crypto';
@Injectable()
export class PaymentsService {
  constructor(private readonly db: DbService) {}
  async create(dto: any) {
    const c = await this.db.pool.connect();
    try {
      await c.query('BEGIN');
      const id = randomUUID();
      await c.query("INSERT INTO payments VALUES ($1,$2,$3,'pending',now())", [id,dto.amount,dto.currency]);
      await c.query("INSERT INTO outbox_events VALUES ($1,$2,'payment.created.v1',$3,false,now())", [randomUUID(),id,JSON.stringify(dto)]);
      await c.query('COMMIT');
      return { paymentId: id, status: 'pending' };
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
  async status(id: string) {
    const p = await this.db.pool.query('SELECT * FROM payments WHERE id=$1',[id]);
    if (!p.rowCount) throw new Error('not found');
    const a = await this.db.pool.query('SELECT consumer,status FROM payment_ack WHERE payment_id=$1',[id]);
    const req = ['fraud','ledger'];

    const ackCount = a.rowCount ?? 0;
    if (ackCount < req.length) { return { paymentId:id,status:'pending',acknowledgedBy: a.rows.map((r: { consumer: string }) => r.consumer) };}
    const failed = a.rows.some(
      (r: { status: string }) => r.status === 'fail'
    );
    const fs = failed?'failed':'settled';
    await this.db.pool.query('UPDATE payments SET status=$1 WHERE id=$2',[fs,id]);
    return { paymentId:id,status:fs };
  }
}
