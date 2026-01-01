#!/bin/bash
# Script to fetch OpenAPI specification from the API and save it to openapi.json

set -e

API_BASE_URL="${API_BASE_URL:-http://localhost:8081}"
OPENAPI_URL="${API_BASE_URL}/api/v1/openapi.json"
OUTPUT_FILE="${OUTPUT_FILE:-openapi.json}"

echo "Fetching OpenAPI specification from ${OPENAPI_URL}..."

# Fetch the OpenAPI spec
if curl -s --max-time 10 "${OPENAPI_URL}" | python3 -m json.tool > "${OUTPUT_FILE}" 2>/dev/null; then
    echo "✅ Successfully fetched and saved OpenAPI spec to ${OUTPUT_FILE}"
    echo "   File size: $(wc -l < "${OUTPUT_FILE}") lines"
    echo "   Valid JSON: ✓"
else
    echo "❌ Failed to fetch OpenAPI spec"
    echo "   Make sure the API server is running on ${API_BASE_URL}"
    exit 1
fi
