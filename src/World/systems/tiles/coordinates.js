import * as THREE from 'three';
import { MAX_ATLAS_TILES } from './config.js';

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const worldPoint = new THREE.Vector3();
const worldCenter = new THREE.Vector3();
const worldScale = new THREE.Vector3();

function longitudeToX(longitude, zoom) {
  return ((longitude + 180) / 360) * 2 ** zoom;
}

function latitudeToY(latitude, zoom) {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const radians = THREE.MathUtils.degToRad(clamped);
  const mercator = 0.5 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / (2 * Math.PI);
  return mercator * 2 ** zoom;
}

function pointToTile(point, globe, zoom) {
  const local = globe.worldToLocal(point.clone()).normalize();
  const latitude = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(local.y, -1, 1)));
  let u = Math.atan2(local.z, -local.x) / (2 * Math.PI);
  if (u < 0) u += 1;

  return {
    x: u * 2 ** zoom,
    y: latitudeToY(latitude, zoom),
  };
}

export function zoomForCamera(camera, globe, viewportHeight, source) {
  globe.getWorldPosition(worldCenter);
  globe.getWorldScale(worldScale);
  const radius = globe.geometry.parameters.radius * worldScale.x;
  const distance = camera.position.distanceTo(worldCenter);
  const altitude = Math.max(distance - radius, radius * 0.0001);
  const visibleSpan = Math.min(
    2 * radius,
    2 * altitude * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)),
  );
  const detail = Math.min(viewportHeight, 1200);
  const zoom = Math.round(Math.log2((2 * Math.PI * radius * detail) / (256 * visibleSpan))) - 1;

  return THREE.MathUtils.clamp(zoom, source.minZoom, source.maxZoom);
}

export function visibleRegion(camera, globe, zoom, viewport, maxTiles = MAX_ATLAS_TILES) {
  globe.updateWorldMatrix(true, false);
  globe.getWorldPosition(worldCenter);
  globe.getWorldScale(worldScale);
  const radius = globe.geometry.parameters.radius * worldScale.x;
  const sphere = new THREE.Sphere(worldCenter, radius);
  const count = 2 ** zoom;
  const samples = [];
  const grid = [-1, -0.5, 0, 0.5, 1];

  for (const y of grid) {
    for (const x of grid) {
      ndc.set(x, y);
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectSphere(sphere, worldPoint)) {
        samples.push(pointToTile(worldPoint, globe, zoom));
      }
    }
  }

  if (!samples.length) return null;

  const center = samples.reduce((closest, sample) => {
    const distance = Math.abs(sample.x - count / 2) + Math.abs(sample.y - count / 2);
    return !closest || distance < closest.distance ? { sample, distance } : closest;
  }, null).sample;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const sample of samples) {
    const wrappedX = center.x + THREE.MathUtils.euclideanModulo(sample.x - center.x + count / 2, count) - count / 2;
    minX = Math.min(minX, wrappedX);
    maxX = Math.max(maxX, wrappedX);
    minY = Math.min(minY, sample.y);
    maxY = Math.max(maxY, sample.y);
  }

  const padding = 0.8;
  let x = Math.floor(minX - padding);
  let width = Math.min(count, Math.ceil(maxX + padding) - x);
  const y = Math.max(0, Math.floor(minY - padding));
  const maxYTile = Math.min(count - 1, Math.ceil(maxY + padding));
  let height = maxYTile - y + 1;

  if (width * height > maxTiles && zoom > 0) {
    return visibleRegion(camera, globe, zoom - 1, viewport, maxTiles);
  }

  width = Math.max(1, width);
  height = Math.max(1, height);
  return { z: zoom, x, y, width, height, key: `${zoom}/${x}/${y}/${width}/${height}` };
}

export function wrappedTileX(x, zoom) {
  return THREE.MathUtils.euclideanModulo(x, 2 ** zoom);
}
