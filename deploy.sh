#!/bin/bash
# ViyaWay — Cloud Build deploy script
# Run from the ViyaWay-Personal directory: bash deploy.sh

set -e

PROJECT_ID="viyaway-travel-app"

# Load env values from .env.local
if [ ! -f .env.local ]; then
  echo "❌  .env.local not found — run from the ViyaWay-Personal directory"
  exit 1
fi

source .env.local

echo "🚀  Submitting build to Cloud Build (project: $PROJECT_ID)..."

gcloud builds submit \
  --project="$PROJECT_ID" \
  --region=us-central1 \
  --config=cloudbuild.yaml \
  --substitutions=\
_GOOGLE_API_KEY="$GOOGLE_API_KEY",\
_NEXT_PUBLIC_FIREBASE_API_KEY="$NEXT_PUBLIC_FIREBASE_API_KEY",\
_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",\
_NEXT_PUBLIC_FIREBASE_PROJECT_ID="$NEXT_PUBLIC_FIREBASE_PROJECT_ID",\
_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",\
_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",\
_NEXT_PUBLIC_FIREBASE_APP_ID="$NEXT_PUBLIC_FIREBASE_APP_ID",\
_NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="$NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID" \
  .

echo "✅  Deploy submitted. Watch progress at:"
echo "    https://console.cloud.google.com/cloud-build/builds?project=$PROJECT_ID"
