import { Injectable, OnModuleInit } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { DbService } from './db.service';
import { randomUUID } from 'crypto';

const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

@Injectable()
export class StatusWorkerService implements OnModuleInit {
  private readonly kafka = new Kafka({
    brokers: ['kafka:9092'],
  });

  private readonly producer = this.kafka.producer();

  constructor(private readonly db: DbService) {}

  async onModuleInit() {
    await this.producer.connect();

    while (true) {
      try {
        await this.processPendingPayments();
      } catch (err) {
        console.error('[status-worker] error', err);
      }
      await sleep(3000);
    }
  }

  private async processPendingPayments() {
    const client = await this.db.pool.connect();

    try {
      const payments = await client.query(`
        SELECT id
        FROM payments
        WHERE status = 'pending'
      `);

      for (const row of payments.rows) {
        const acks = await client.query(
          `
          SELECT status
          FROM payment_ack
          WHERE payment_id = $1
          `,
          [row.id],
        );

        if ((acks.rowCount ?? 0) < 2) continue

        const failed = acks.rows.some(r => r.status !== 'ok');
        const finalStatus = failed ? 'failed' : 'settled';
        const topic =
          finalStatus === 'settled'
            ? 'payment.settled.v1'
            : 'payment.failed.v1';

        await client.query(
          `UPDATE payments SET status = $1 WHERE id = $2`,
          [finalStatus, row.id],
        );

        await this.producer.send({
          topic,
          messages: [
            {
              value: JSON.stringify({
                eventId: randomUUID(),
                aggregateId: row.id,
                type: topic,
                payload: { status: finalStatus },
                occurredAt: new Date().toISOString(),
              }),
            },
          ],
        });

        console.log(
          `[status-worker] Payment ${row.id} -> ${finalStatus}`,
        );
      }
    } finally {
      client.release();
    }
  }
}