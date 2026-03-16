FROM python:3.12-slim

WORKDIR /app

# minimal OS deps; keep image small
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

CMD ["python", "data_generator.py", "--help"]
