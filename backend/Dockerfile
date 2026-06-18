FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p uploads/moods
ENV PORT=5001
EXPOSE 5001
CMD gunicorn wsgi:application --bind 0.0.0.0:${PORT} --workers 2 --threads 4 --timeout 120
