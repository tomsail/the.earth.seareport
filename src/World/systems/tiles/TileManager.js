import * as THREE from 'three';
import { TILE_SIZE, TILE_SOURCES } from './config.js';
import { visibleRegion, wrappedTileX, zoomForCamera } from './coordinates.js';
import { createHillshadeAtlas, decodeTerrainTile } from './terrain.js';

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Tile unavailable: ${url}`));
    image.src = url;
  });
}

export class TileManager {
  constructor({ camera, globe, uniforms, renderer, params, statusElement }) {
    this.camera = camera;
    this.globe = globe;
    this.uniforms = uniforms;
    this.params = params;
    this.statusElement = statusElement;
    this.maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    this.cache = new Map();
    this.pending = new Map();
    this.active = new Map();
    this.lastUpdate = 0;
    this.lastCameraKey = '';

    // A permanent world tile prevents uncovered high-resolution regions from
    // revealing a different layer while the next atlas is loading.
    const satellite = TILE_SOURCES.satellite;
    loadImage(satellite.url(0, 0, 0))
      .then(image => {
        const texture = new THREE.Texture(image);
        texture.encoding = THREE.sRGBEncoding;
        texture.anisotropy = this.maxAnisotropy;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        this.uniforms.uBaseDayAtlas.value = texture;
        this.uniforms.uBaseDayEnabled.value = 1;
      })
      .catch(() => {
        // Detailed atlases and the local day map remain available offline.
      });
  }

  update(time = performance.now()) {
    const enabled = this.params.dynamicTiles;
    this.uniforms.uDayEnabled.value = enabled && this.active.has('satellite') ? 1 : 0;
    this.uniforms.uDayOpacity.value = this.params.satelliteMix;
    this.uniforms.uTerrainEnabled.value = enabled && this.active.has('terrain') ? 1 : 0;

    if (!enabled) {
      if (this.enabled !== false) this.setStatus('Local maps', false, 0);
      this.enabled = false;
      return;
    }
    if (this.enabled === false) {
      this.lastCameraKey = '';
      const active = this.active.get('satellite');
      if (active) this.setStatus(`Esri imagery · z${active.region.z}`, false, active.region.z);
    }
    this.enabled = true;
    if (time - this.lastUpdate < 250) return;
    this.lastUpdate = time;

    const cameraKey = this.camera.position.toArray().map(value => value.toFixed(2)).join(',') + `/${this.globe.rotation.y.toFixed(3)}`;
    if (cameraKey === this.lastCameraKey) return;
    this.lastCameraKey = cameraKey;

    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const satelliteZoom = zoomForCamera(this.camera, this.globe, viewport.height, TILE_SOURCES.satellite);
    const region = visibleRegion(this.camera, this.globe, satelliteZoom, viewport);
    if (!region) return;

    this.request('satellite', region, TILE_SOURCES.satellite);

    const terrain = TILE_SOURCES.terrain;
    if (terrain.apiKey) {
      const terrainZoom = Math.min(satelliteZoom, terrain.maxZoom);
      const terrainRegion = visibleRegion(this.camera, this.globe, terrainZoom, viewport, 12);
      if (terrainRegion) this.request('terrain', terrainRegion, terrain);
    }
  }

  cachedTile(source, z, x, y) {
    const wrappedX = wrappedTileX(x, z);
    const key = `${source.name}/${z}/${wrappedX}/${y}`;
    if (this.cache.has(key)) {
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }

    const request = loadImage(source.url(z, wrappedX, y, source.apiKey));
    this.cache.set(key, request);
    request.catch(() => this.cache.delete(key));
    this.trimCache();
    return request;
  }

  trimCache() {
    while (this.cache.size > 320) {
      this.cache.delete(this.cache.keys().next().value);
    }
  }

  async request(layer, region, source) {
    if (this.pending.get(layer) === region.key) return;
    this.pending.set(layer, region.key);
    this.setStatus(`Loading z${region.z} tiles…`, true, region.z);

    const isTerrain = layer === 'terrain';
    const tileSize = isTerrain ? source.tileSize : TILE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = region.width * tileSize;
    canvas.height = region.height * tileSize;
    const context = canvas.getContext('2d');
    const elevations = isTerrain ? new Float32Array(canvas.width * canvas.height).fill(NaN) : null;
    const jobs = [];

    for (let row = 0; row < region.height; row += 1) {
      for (let column = 0; column < region.width; column += 1) {
        const x = region.x + column;
        const y = region.y + row;
        jobs.push(
          this.cachedTile(source, region.z, x, y)
            .then(image => {
              if (isTerrain) {
                const decoded = decodeTerrainTile(image, tileSize);
                for (let tileRow = 0; tileRow < tileSize; tileRow += 1) {
                  const sourceStart = tileRow * tileSize;
                  const targetStart = (row * tileSize + tileRow) * canvas.width + column * tileSize;
                  elevations.set(decoded.subarray(sourceStart, sourceStart + tileSize), targetStart);
                }
              } else {
                context.drawImage(image, column * tileSize, row * tileSize, tileSize, tileSize);
              }
              return true;
            })
            .catch(() => false),
        );
      }
    }

    const results = await Promise.all(jobs);
    if (this.pending.get(layer) !== region.key) return;
    if (!results.some(Boolean)) {
      this.pending.delete(layer);
      this.setStatus('Tile service unavailable — local maps active', false, region.z);
      return;
    }

    const outputCanvas = isTerrain
      ? createHillshadeAtlas(elevations, canvas.width, canvas.height, region.z, tileSize)
      : canvas;
    const texture = new THREE.CanvasTexture(outputCanvas);
    texture.encoding = isTerrain ? THREE.LinearEncoding : THREE.sRGBEncoding;
    texture.anisotropy = this.maxAnisotropy;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    this.apply(layer, texture, region);
    const loaded = results.filter(Boolean).length;
    this.setStatus(`${source.name} · z${region.z} · ${loaded}/${results.length} tiles`, false, region.z);
  }

  apply(layer, texture, region) {
    const previous = this.active.get(layer);
    this.active.set(layer, { texture, region });
    const prefix = layer === 'terrain' ? 'uTerrain' : 'uDay';
    this.uniforms[`${prefix}Atlas`].value = texture;
    this.uniforms[`${prefix}Bounds`].value.set(region.x, region.y, region.width, region.height);
    this.uniforms[`${prefix}Zoom`].value = region.z;
    this.uniforms[`${prefix}Enabled`].value = 1;

    if (previous) previous.texture.dispose();
    this.setStatus(`${layer === 'terrain' ? 'MapTiler hillshade' : 'Esri imagery'} · z${region.z}`, false, region.z);
  }

  setStatus(message, loading, zoom) {
    if (!this.statusElement) return;
    this.statusElement.textContent = message;
    this.statusElement.dataset.state = loading ? 'loading' : 'ready';
    this.statusElement.dataset.zoom = String(zoom);
  }
}
