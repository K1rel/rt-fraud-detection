# Service Endpoints (Local & In-Network)

**Docker network name:** `fraud_net`  
**Internal DNS names:** equal to container names

| Service          | Internal URL (containers)           | Host URL (localhost)            |
|------------------|-------------------------------------|---------------------------------|
| Zookeeper        | `zookeeper:2181`                    | `127.0.0.1:2181`                |
| Kafka            | `kafka:9092`                        | `127.0.0.1:9092`                |
| Flink REST (JM)  | `flink-jobmanager:8081`             | `http://127.0.0.1:8081`         |
| Flink TM         | `flink-taskmanager:6122` (RPC)      | n/a                              |
| Elasticsearch    | `http://elasticsearch:9200`         | `http://127.0.0.1:9200`         |
| Kibana           | `http://kibana:5601`                | `http://127.0.0.1:5601`         |

**Topics**
- `transactions`
- `fraud_alerts`

**Time format**
- ISO-8601 UTC (`@timestamp`, `ingest_ts`)
