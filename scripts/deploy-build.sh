#!/bin/bash
set -e

echo "=== Deployment Build Script ==="
echo "Moving large files out of workspace to reduce bundle size..."

mkdir -p /tmp/deploy-stash

if [ -d "uploads/drone-imagery" ]; then
  echo "Stashing uploads/drone-imagery/ (raw TIFFs - not needed in production)"
  mv uploads/drone-imagery /tmp/deploy-stash/drone-imagery
  mkdir -p uploads/drone-imagery
fi

if [ -d "uploads/cesium-tilesets" ]; then
  echo "Stashing uploads/cesium-tilesets/ (served from Object Storage in production)"
  mv uploads/cesium-tilesets /tmp/deploy-stash/cesium-tilesets
  mkdir -p uploads/cesium-tilesets
fi

echo "Running build..."
npm run build

echo "=== Build complete ==="
echo "Large files excluded from deployment bundle."
echo "Production serves drone tiles and cesium tilesets from Object Storage."
