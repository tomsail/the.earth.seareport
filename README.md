# The World Tides

An interactive Three.js Earth showing SeaReport global ocean model output (sea surface temperature and water level), with day/night lighting, clouds, atmosphere, and zoom-dependent satellite imagery.

## Run

```sh
npm install
npm run dev
```

Create a production build with `npm run build`. The `base: './'` Vite setting keeps the build compatible with GitHub Pages.

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main`. One-time setup: repository Settings → Pages → Source: **GitHub Actions**.

## Zoom imagery

The globe streams visible XYZ tiles from **Esri World Imagery**. Camera distance selects the tile zoom; rays through the screen determine the visible geographic bounds. Tiles are cached, stitched into a texture atlas, and sampled in the existing globe shader with the correct equirectangular-to-Web-Mercator conversion. The previous atlas remains visible while its replacement loads.

- Drag to rotate; scroll or pinch to zoom.
- **Zoom imagery** enables or disables streamed imagery.
- **Satellite blend** controls the mix between the tide video and satellite imagery where the video is opaque. Transparent video pixels (land) always show satellite imagery, or the static day map until tiles load.
- **Video layer** selects the animated layer: `Temperature` (`temperatures_r1205.webm`) or `Water level` (`elevations_r1205.webm`). Both are preloaded; only the selected one plays.
- **About the model** (bottom-right button) opens a short description of the model.
- The night side is darkened with a smooth sun-driven terminator (no night-lights texture).
- Terrain relief is fixed at a subtle `mapHeight: 0.2` (bump raster `earth_normal_2048.jpg`) and is not exposed in the GUI.
- Clouds continue to use the existing local cloud map.
- Both automatic Earth rotation and automatic camera rotation are off by default.

No Cesium runtime or API key is required for satellite imagery.

## Optional high-resolution terrain

The original local bump map is the default. To replace it progressively with **MapTiler Terrain RGB v2**, either:

1. Add your key to `TILE_SOURCES.terrain.apiKey` in `src/World/systems/tiles/config.js`, or
2. Open the app with `?maptilerKey=YOUR_KEY`.

Terrain tiles are decoded at their native 512px resolution using MapTiler's RGB elevation formula. A hillshade atlas is calculated from the elevation gradients, with neighboring samples across tile edges and no hillshading over oceans. The result is blended into the globe's daylight material; it does not displace the sphere geometry. Terrain RGB is capped at zoom 14. Do not commit a private API key.

## Structure

- `src/World/components/earth.js` — Earth meshes, local textures, and tile-system lifecycle.
- `src/World/components/globeMaterial.js` — shader extension for satellite and terrain atlases.
- `src/World/systems/tiles/coordinates.js` — camera-to-visible-tile calculations and projection conversions.
- `src/World/systems/tiles/TileManager.js` — tile requests, caching, atlas assembly, decoding, and material updates.
- `src/World/systems/tiles/config.js` — external sources and zoom limits.
- `src/World/World.js` — scene composition.
- `src/World/systems/Loop.js` — animation and per-frame updates.
- `public/textures/` — deployed local maps, cloud imagery, and tide video.

## Data credits

- Satellite imagery: Esri World Imagery.
- Terrain (optional): MapTiler; underlying data attribution is shown in the application.
- Animation: SCHISM.

Review provider terms and attribution requirements before public deployment.

## Model

> **Disclaimer:** SeaReport is under active development. The data shown are a purely qualitative demonstration.

### Details
SeaReport is a global 3D baroclinic ocean model developed by the JRC E.1 Floods team (Disaster Risk Management Unit) to strengthen JRC expertise on coastal risks.

- Solver: [SCHISM](https://schism-dev.github.io/schism/master/index.html), developed by Y. J. Zhang at [VIMS](https://www.vims.edu/ccrm/).
- Mesh: global unstructured grid down to the coastline, about 11 million nodes, 33 vertical levels.
- Forcing: ECMWF IFS HRES operational forecasts from the MARS archive (~9 km), hourly:
  - 10 m wind components (m/s)
  - mean sea-level pressure (Pa)
  - 2 m air temperature and specific humidity
  - downward short- and long-wave radiation (W/m²)
  - total precipitation (kg/m²/s)
- Animations: latest mesh run (version `r12`), 10 days of water levels and 1 month of temperatures. 

### EuroHPC
The model runs on [EuroHPC](https://eurohpcsupport.eu/supported-project/seareport/) supercomputers: MeluXina (LuxProvide, Regular Access) and MareNostrum 5 (BSC, Extreme Scale Access).

### Acknowledgements
- [oceanmodeling GitHub community](https://github.com/oceanmodeling)
- [SCHISM](https://schism-dev.github.io/schism/master/index.html) community
- [TELEMAC](https://opentelemac.org/en) community
- [LuxProvide](https://www.luxprovide.lu/) and [BSC](https://bsc.es) for the MeluXina and MareNostrum 5 EuroHPC facilities
- [EPICURE](https://epicure-hpc.eu/2026/02/28/advancing-global-coastal-risk-modelling-through-reproducible-hpc-workflows-with-epicure/) support team

### Articles and publications:

 * [EuroHPC](https://eurohpcsupport.eu/supported-project/seareport/) project page
 * [EPICURE](https://epicure-hpc.eu/2026/02/28/advancing-global-coastal-risk-modelling-through-reproducible-hpc-workflows-with-epicure/) blog post
 * [TELEMAC User Conference 2024](https://hdl.handle.net/20.500.11970/114351)
 * [Waveworkshop 2025](https://www.waveworkshop.org/conferences/2025/Presentations/CC1_ThomasSailor_1330_JRC_seareport-STOFS2D-intercomparison_wave_workshop_thomas_saillour_v7.pdf)
 * [EGU 2026](https://doi.org/10.5194/egusphere-egu26-7777)