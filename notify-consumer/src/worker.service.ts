import { Injectable, OnModuleInit } from '@nestjs/common';
import { Kafka } from 'kafkajs';

const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

@Injectable()
export class WorkerService implements OnModuleInit {
  private readonly consumerName = 'notify';

  private readonly topics = [
    'payment.created.v1',
    'payment.settled.v1',
    'payment.failed.v1',
  ];

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

    // 🔁 Retry de arranque (igual al resto de tus consumers)
    while (true) {
      try {
        console.log('[notify] Connecting to Kafka...');
        await consumer.connect();

        // ✅ SOLO aquí se usa "topic", como variable local
        for (const topic of this.topics) {
          console.log(`[notify] Subscribing to topic: ${topic}`);
          await consumer.subscribe({
            topic,
            fromBeginning: false,
          });
        }

        console.log('[notify] Starting consumption');

        await consumer.run({
          eachMessage: async ({ message }) => {
            if (!message.value) return;

            const event = JSON.parse(message.value.toString());

            console.log(
              `[notify] ${event.type} for payment ${event.aggregateId}`,
              event.payload,
            );
          },
        });

        break; // ✅ arranque exitoso
      } catch (err: any) {
        console.error(
          '[notify] Kafka not ready yet, retrying...',
          err.message,
        );
        await sleep(2000);
      }
    }
  }
}
``