const query = new URLSearchParams(window.location.search);

export const TILE_SIZE = 256;
export const MAX_ATLAS_TILES = 48;

export const TILE_SOURCES = {
  satellite: {
    name: 'Esri World Imagery',
    url: (z, x, y) =>
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    minZoom: 0,
    maxZoom: 19,
  },
  terrain: {
    name: 'MapTiler Terrain RGB v2',
    // Add your key here, or use ?maptilerKey=YOUR_KEY. No key is committed.
    apiKey: query.get('maptilerKey') || '',
    url: (z, x, y, key) =>
      `https://api.maptiler.com/tiles/terrain-rgb-v2/${z}/${x}/${y}.webp?key=${key}`,
    minZoom: 0,
    maxZoom: 14,
    tileSize: 512,
  },
};
