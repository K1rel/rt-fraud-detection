FROM apache/flink:2.0.0-java17

# Prevent plugin-classloader from loading the ES connector
RUN rm -rf /opt/flink/plugins/elasticsearch || true