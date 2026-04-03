#!/usr/bin/env python
import requests
import sys

# Test ML service
ml_url = 'http://localhost:8001/predict'
test_image = r'c:\Users\Yugendra\Downloads\ParseFlow\parseflow_main\ml-service\test1.jpg'

print(f"Testing ML service at {ml_url}")
print(f"With test image: {test_image}")

payload = {'file_path': test_image}
print(f"Payload: {payload}")

try:
    response = requests.post(ml_url, json=payload, timeout=30)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    sys.exit(0)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
