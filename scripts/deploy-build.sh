#!/bin/bash
set -e

echo "=== Deployment Build Script ==="
echo "Removing large files from deployment copy (dev workspace is unaffected)..."

if [ -d "uploads/drone-imagery" ]; then
  echo "Clearing uploads/drone-imagery/ (raw TIFFs - served from Object Storage in production)"
  rm -rf uploads/drone-imagery/*
fi

if [ -d "uploads/cesium-tilesets" ]; then
  echo "Clearing uploads/cesium-tilesets/ (served from Object Storage in production)"
  rm -rf uploads/cesium-tilesets/*
fi

if [ -d "uploads/drone-models" ]; then
  echo "Clearing uploads/drone-models/"
  rm -rf uploads/drone-models/*
fi

echo "Running build..."
npm run build

echo "=== Build complete ==="
echo "Large files excluded from deployment bundle."
echo "Production serves drone tiles and cesium tilesets from Object Storage."
