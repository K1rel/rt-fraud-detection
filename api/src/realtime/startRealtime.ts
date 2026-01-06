import { Server as IOServer} from "socket.io";
import { configureSocketHandlers, emitAlert } from "./socketHandlers";
import { createKafkaAlertsConsumer } from "./kafkaAlertConsumer";
import { readRealtimeConfig } from "./config";

export type StopRealtime = () => Promise<void>;

export async function startRealtime(io: IOServer): Promise<StopRealtime>{
    const cfg = readRealtimeConfig();

    configureSocketHandlers(io, cfg);

    const consumer = createKafkaAlertsConsumer(cfg, (alert) => {
        emitAlert(io, cfg, alert);
    });

    await consumer.start();

    return async () => {
        await consumer.stop();
    };
}