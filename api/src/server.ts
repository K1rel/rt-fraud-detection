import express, {Application} from 'express';
import cors from "cors";
import morgan from 'morgan';
import http from "http";
import {Client} from '@elastic/elasticsearch';
import alertsRouterFactory from './routes/alerts';
import statsRouterFactory from "./routes/stats";
import { Server as SocketIOServer } from "socket.io";
import {startRealtime, type StopRealtime } from "./realtime/startRealtime";


const PORT: number = Number(process.env.PORT);
const ES_NODE: string = process.env.ELASTICSEARCH_NODE || "";

const app: Application = express();

const corsOptions: cors.CorsOptions = {
    origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://ui:3000'
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.use(morgan('combined'))

export const esClient = new Client({node: ES_NODE});

app.get('/health', async (req, res) => {
    let esStatus: 'up' | 'down' | 'unknown' = 'unknown';

    try {
        await esClient.ping();
        esStatus = 'up';
    } catch (err: any){
        console.error('[health] Elasticsearch ping failed:',err?.message || err);
        esStatus = 'down';
    }

    res.status(200).json({
        status: "ok",
        es: esStatus,
        elasticsearch_node: ES_NODE,
        timestamp: new Date().toISOString()
    });
});

//alerts api

app.use('/api/alerts', alertsRouterFactory(esClient));

//stats api
app.use("/api/stats", statsRouterFactory(esClient));

app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        path: req.originalUrl
    });
});

const errorHandler: express.ErrorRequestHandler = (err, req, res, _next) => {
    console.error('[error]', err);

    const anyErr = err as any;
    const status = anyErr?.statusCode || anyErr?.status || 500;

    res.status(status).json({
        error: anyErr?.message || 'Internal Server Error',
    });
};


app.use(errorHandler);

async function main(): Promise<void>{
    const httpServer = http.createServer(app);

    const io = new SocketIOServer(httpServer, {
        cors: {
            origin: corsOptions.origin as any,
            methods: ["GET", "POST"],
            credentials: true,
        },
        transports: ["websocket"],
        connectionStateRecovery: {
            maxDisconnectionDuration: 2 * 60 * 1000,
            skipMiddlewares: false,
        },
    });

    let stopRealtime: StopRealtime | null = null;

    const shutdown = async (signal: string) => {
        console.log(`[api-service] shutdown signal=${signal}`);

        try {
            if(stopRealtime) await stopRealtime();
        } catch (e: any){
            console.error("[api-service] stopRealtime failed:", e?.message || e);
        }

        try{
            io.close();
        } catch {}

        httpServer.close(() => {
            console.log("[api-service] HTTP server closed");
            process.exit(0);
        });

        setTimeout(() => process.exit(1), 5000).unref();
    };

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));

    httpServer.listen(PORT, async () => {
        console.log(`[api-service] Listening on port ${PORT}`);
        console.log(`[api-service] Elasticsearch endpoint: ${ES_NODE}`);
        console.log(`[api-service] WebSocket endpoint: ws://localhost:${PORT}`);

        try{
            stopRealtime = await startRealtime(io);
            console.log("[api-service] realtime started");
        } catch (e: any){
            console.error("[api-service] realtime failed to start:", e?.message || e);
            process.exit(1);
        }
    });
}

void main();

