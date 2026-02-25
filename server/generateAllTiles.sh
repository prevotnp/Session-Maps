#!/bin/bash
# Generate tiles for a single drone image using GDAL
# Usage: ./generateAllTiles.sh <image_id> <tiff_path>

IMAGE_ID=$1
TIFF_PATH=$2
TILE_DIR="/tmp/drone-tiles-${IMAGE_ID}"

echo "=== Processing image ${IMAGE_ID} ==="
echo "  Source: ${TIFF_PATH}"

# Clean up any previous tiles
rm -rf "${TILE_DIR}"
mkdir -p "${TILE_DIR}"

# Step 1: Reproject to WGS84
echo "  Step 1: Reprojecting to WGS84..."
WGS84_FILE="/tmp/drone_${IMAGE_ID}_wgs84.tif"
rm -f "${WGS84_FILE}"
gdalwarp -t_srs EPSG:4326 -of GTiff -co TILED=YES -co BLOCKXSIZE=512 -co BLOCKYSIZE=512 \
  "${TIFF_PATH}" "${WGS84_FILE}" 2>&1

if [ ! -f "${WGS84_FILE}" ]; then
  echo "  ERROR: Reprojection failed"
  exit 1
fi

# Step 2: Create small version for low zoom
echo "  Step 2: Creating small version for zoom 14-17..."
SMALL_FILE="/tmp/drone_${IMAGE_ID}_small.tif"
rm -f "${SMALL_FILE}"
gdal_translate -of GTiff -outsize 4096 0 -co TILED=YES \
  "${WGS84_FILE}" "${SMALL_FILE}" 2>&1

gdal2tiles.py --profile=mercator --zoom=14-17 --tilesize=512 --processes=1 \
  --xyz --resampling=bilinear --no-kml \
  "${SMALL_FILE}" "${TILE_DIR}" 2>&1
rm -f "${SMALL_FILE}"

# Step 3: Create medium version for zoom 18-19
echo "  Step 3: Creating medium version for zoom 18-19..."
MEDIUM_FILE="/tmp/drone_${IMAGE_ID}_medium.tif"
rm -f "${MEDIUM_FILE}"
gdal_translate -of GTiff -outsize 12000 0 -co TILED=YES \
  "${WGS84_FILE}" "${MEDIUM_FILE}" 2>&1

gdal2tiles.py --profile=mercator --zoom=18-19 --tilesize=512 --processes=1 \
  --xyz --resampling=bilinear --no-kml \
  "${MEDIUM_FILE}" "${TILE_DIR}" 2>&1
rm -f "${MEDIUM_FILE}"

# Step 4: Generate zoom 20 from full resolution
echo "  Step 4: Generating zoom 20 from full resolution..."
gdal2tiles.py --profile=mercator --zoom=20 --tilesize=512 --processes=1 \
  --xyz --resampling=bilinear --no-kml \
  "${WGS84_FILE}" "${TILE_DIR}" 2>&1

# Clean up
rm -f "${WGS84_FILE}"

# Report
TOTAL=$(find "${TILE_DIR}" -name "*.png" | wc -l)
echo "  Generated ${TOTAL} tiles"
echo "=== Image ${IMAGE_ID} complete ==="
