
import {Router} from 'express';
import {Client} from '@elastic/elasticsearch';
import {ALERT_INDEX_PATTERN, AlertSearchParams, buildAlertSearchBody, parseAlertSearchParams } from "../es/alertsQuery";


export default function createAlertsRouter(esClient: Client) : Router{
    const router = Router();


    //GET /api/alerts
    router.get('/',
        async (req, res, next) => {
            try{
                const params: AlertSearchParams = parseAlertSearchParams(req.query);
                const body = buildAlertSearchBody(params);

                const result: any = await esClient.search({
                    index: ALERT_INDEX_PATTERN,
                    ...body,
                });

                const hits = result.hits?.hits ?? [];
                const total = result.hits?.total?.value;

                const items = hits.map((hit:any) => {
                    const src = hit._source || {};
                    return {
                        id: hit._id,
                        index: hit._index,
                        ...src,
                    };
                });

                res.json({
                    items,
                    pagination: {
                        offset: params.offset,
                        limit: params.limit,
                        total,
                        returned: items.length,
                        hasMore: params.offset + items.length < total,
                    },
                    timing: {
                        tookMs: result.took,
                    },
                    filters: params,
                });
            } catch (err){
                next(err);
            }
        }
        );

    // GET /api/alerts/:id

        router.get(
            '/:id',
            async (req, res, next) => {
                try{
                    const {id} = req.params;

                    let result = await esClient.search({
                        index: ALERT_INDEX_PATTERN,
                        size: 1,
                        query: {
                            term: {
                                "alertId.keyword": id,
                            }
                        },
                    } as any);

                    let hits = result.hits?.hits ?? [];
                    if (!hits.length) {
                        return res.status(404).json({ error: 'Alert not found', id });
                    }

                    const hit = hits[0];
                    const src = hit._source || {};

                    return res.json({
                        id: hit._id,
                        index: hit._index,
                        ...src,
                    });
                } catch (err: any){
                    if (err.meta?.statusCode === 404){
                        return res.status(404).json({error: 'Alert not found', id: req.params.id});
                    }
                    next(err);
                }
            }
        );

        return router;

}