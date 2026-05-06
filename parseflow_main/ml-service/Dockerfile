# Base image with Python 3.10
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Copy files
COPY . .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose port
EXPOSE 8001

# Run app using gunicorn
CMD ["gunicorn", "ml_api:app", "--bind", "0.0.0.0:8001"]