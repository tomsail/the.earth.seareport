const scratch = document.createElement('canvas');

export function decodeTerrainTile(image, tileSize) {
  scratch.width = tileSize;
  scratch.height = tileSize;
  const context = scratch.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, tileSize, tileSize);
  const pixels = context.getImageData(0, 0, tileSize, tileSize).data;
  const elevations = new Float32Array(tileSize * tileSize);

  for (let source = 0, target = 0; source < pixels.length; source += 4, target += 1) {
    elevations[target] = -10000 + (pixels[source] * 65536 + pixels[source + 1] * 256 + pixels[source + 2]) * 0.1;
  }
  return elevations;
}

export function createHillshadeAtlas(elevations, width, height, zoom, tileSize) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const output = context.createImageData(width, height);
  const metersPerPixel = 40075016.686 / (tileSize * 2 ** zoom);
  const zenith = Math.PI / 4;
  const azimuth = (315 * Math.PI) / 180;

  const elevationAt = (x, y, fallback) => {
    const value = elevations[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))];
    return Number.isFinite(value) ? value : fallback;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const elevation = elevations[index];
      const target = index * 4;
      if (!Number.isFinite(elevation) || elevation <= 0) {
        output.data[target + 3] = 0;
        continue;
      }

      const left = elevationAt(x - 1, y, elevation);
      const right = elevationAt(x + 1, y, elevation);
      const top = elevationAt(x, y - 1, elevation);
      const bottom = elevationAt(x, y + 1, elevation);
      const dzdx = (right - left) / (2 * metersPerPixel);
      const dzdy = (bottom - top) / (2 * metersPerPixel);
      const slope = Math.atan(Math.hypot(dzdx, dzdy) * 1.25);
      const aspect = Math.atan2(dzdy, -dzdx);
      const hillshade = Math.max(
        0,
        Math.cos(zenith) * Math.cos(slope)
          + Math.sin(zenith) * Math.sin(slope) * Math.cos(azimuth - aspect),
      );
      const encoded = Math.round(Math.min(1, Math.pow(hillshade, 0.85)) * 255);
      output.data[target] = encoded;
      output.data[target + 1] = encoded;
      output.data[target + 2] = encoded;
      output.data[target + 3] = 255;
    }
  }

  context.putImageData(output, 0, 0);
  return canvas;
}
