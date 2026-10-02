FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Banco e anexos ficam em /data (monte um volume nesse caminho para não perder nada)
ENV CRM_DB=/data/crm.db \
    CRM_ANEXOS=/data/anexos
RUN mkdir -p /data
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
