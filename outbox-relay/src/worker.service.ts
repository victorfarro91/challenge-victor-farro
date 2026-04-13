import { Injectable, OnModuleInit } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { DbService } from './db.service';

@Injectable()
export class RelayService implements OnModuleInit {
  private readonly kafka = new Kafka({
    brokers: ['kafka:9092'],
  });

  private readonly producer = this.kafka.producer();

  constructor(private readonly db: DbService) {}

  async onModuleInit() {
    await this.producer.connect();

    setInterval(() => this.publishPendingEvents(), 2000);
  }

  private async publishPendingEvents() {
    const client = await this.db.pool.connect();

    try {
      const res = await client.query(
        `
        SELECT id, aggregate_id, type, payload
        FROM outbox_events
        WHERE published = false
        ORDER BY created_at
        LIMIT 10
        `
      );

      for (const event of res.rows) {
        await this.producer.send({
          topic: event.type,
          messages: [
            {
              value: JSON.stringify({
                eventId: event.id,
                aggregateId: event.aggregate_id,
                type: event.type,
                payload: event.payload,
                occurredAt: new Date().toISOString(),
              }),
            },
          ],
        });

        await client.query(
          `
          UPDATE outbox_events
          SET published = true
          WHERE id = $1
          `,
          [event.id]
        );
      }
    } finally {
      client.release();
    }
  }
}
