FROM python:3.12-slim
WORKDIR /app
COPY server.py ./
COPY web ./web
ENV PORT=8787
ENV BIND=0.0.0.0
EXPOSE 8787
CMD ["python", "-u", "server.py"]
