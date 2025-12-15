import express, {Application} from 'express';
import cors from "cors";
import morgan from 'morgan';
import {Client} from '@elastic/elasticsearch';
import alertsRouterFactory from './routes/alerts';
import statsRouterFactory from "./routes/stats";

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

app.listen(PORT, () => {
    console.log(`[api-service] Listening on port ${PORT}`);
    console.log(`[api-service] Elasticsearch endpoint: ${ES_NODE}`);
});