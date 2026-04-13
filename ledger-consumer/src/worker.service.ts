import { Injectable, OnModuleInit } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { DbService } from './db.service';

const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

@Injectable()
export class WorkerService implements OnModuleInit {
  private readonly consumerName = process.env.CONSUMER_NAME!;
  private readonly topic = 'payment.created.v1';

  constructor(private readonly db: DbService) {}

  async onModuleInit() {
    const kafka = new Kafka({
      brokers: ['kafka:9092'],
      retry: {
        retries: 10,
        initialRetryTime: 300,
      },
    });

    const consumer = kafka.consumer({
      groupId: this.consumerName,
      allowAutoTopicCreation: true,
    });

    // 🔁 Retry de arranque
    // Tolera:
    // - leader election
    // - metadata inconsistencies
    // - rebalances
    while (true) {
      try {
        console.log(`[${this.consumerName}] Connecting to Kafka...`);

        await consumer.connect();

        console.log(
          `[${this.consumerName}] Subscribing to topic: ${this.topic}`,
        );

        await consumer.subscribe({
          topic: this.topic,
          fromBeginning: false,
        });

        console.log(`[${this.consumerName}] Starting consumption`);

        await consumer.run({
          eachMessage: async ({ message }) => {
            if (!message.value) return;

            const event = JSON.parse(message.value.toString());
            await this.handleEvent(event);
          },
        });

        break; // ✅ Arranque exitoso
      } catch (err: any) {
        console.error(
          `[${this.consumerName}] Kafka not ready yet, retrying...`,
          err.message,
        );
        await sleep(2000);
      }
    }
  }

  private async handleEvent(event: any) {
    const client = await this.db.pool.connect();

    try {
      await client.query('BEGIN');

      // ✅ Idempotencia
      const exists = await client.query(
        `
        SELECT 1
        FROM processed_events
        WHERE event_id = $1 AND consumer = $2
        `,
        [event.eventId, this.consumerName],
      );

      if (exists.rowCount === 0) {
        await client.query(
          `
          INSERT INTO payment_ack (payment_id, consumer, status)
          VALUES ($1, $2, 'ok')
          `,
          [event.aggregateId, this.consumerName],
        );

        await client.query(
          `
          INSERT INTO processed_events (event_id, consumer, processed_at)
          VALUES ($1, $2, now())
          `,
          [event.eventId, this.consumerName],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}