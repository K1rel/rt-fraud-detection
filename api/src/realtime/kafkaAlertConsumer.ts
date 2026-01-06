import {Consumer, Kafka, logLevel } from "kafkajs";
import { RealtimeConfig } from "./config";

export type AlertHandler = (alert: any) => void;

export type KafkaAlertsConsumer = {
    start: () => Promise<void>;
    stop: () => Promise<void>;
};

function safeJsonParse(raw: string): any | null {
    try {
        return JSON.parse(raw);
    } catch{
        return null;
    }
}

export function createKafkaAlertsConsumer(cfg: RealtimeConfig, onAlert: AlertHandler): KafkaAlertsConsumer{
    const kafka = new Kafka({
        clientId: "api-realtime-alerts",
        brokers: cfg.kafkaBrokers,
        logLevel: logLevel.WARN
    });

    let consumer: Consumer | null = null;
    let stopping = false;

    async function start(): Promise<void>{
        if (consumer) return;

        consumer = kafka.consumer({
            groupId: cfg.consumerGroupId,
        });

        consumer.on(consumer.events.CRASH, (e) => {
            const msg = (e as any)?.payload?.error?.message || "unknown";
            console.error(`[kafka-consumer] CRASH: ${msg}`);
        });

        await consumer.connect();
        await consumer.subscribe({topic: cfg.alertsTopic, fromBeginning: false});

        consumer
            .run({
                partitionsConsumedConcurrently: 1,
                eachMessage: async ({message}) => {
                    if (stopping) return;

                    const raw = message.value ? message.value.toString("utf-8") : "";
                    if (!raw) return;

                    const parsed = safeJsonParse(raw);
                    if (!parsed) return;

                    const nowMs = Date.now();

                    const enriched = {
                        ...parsed,
                        _rt: {
                            ...(parsed?._rt || {}),
                            apiConsumerTs: nowMs,
                        },
                    };

                    onAlert(enriched);
                },
            })
            .catch((err) => {
                console.error("[kafka-consumer] run() failed:", err?.message || err);
            });
    console.log(
        `[kafka-consumer] connected brokers=${cfg.kafkaBrokers.join(",")} topic=${cfg.alertsTopic} group=${cfg.consumerGroupId}`,
    );
    }


    async function stop(): Promise<void> {
        stopping = true;
        if(!consumer) return;
        try{
            await consumer.stop();
            await consumer.disconnect();
        } catch (err: any){
            console.error("[kafka-consumer] disconnect failed:", err?.message || err);
        } finally {
            consumer = null;
        }
    }

    return {start, stop};
}