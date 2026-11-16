import * as THREE from 'three';

export function createGlobeMaterial(params) {
  const uniforms = {
    uDayAtlas: { value: null },
    uBaseDayAtlas: { value: null },
    uBaseDayEnabled: { value: 0 },
    uDayBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
    uDayZoom: { value: 0 },
    uDayEnabled: { value: 0 },
    uDayOpacity: { value: params.satelliteMix },
    uDayMap: { value: null },
    uTideEnabled: { value: 1 },
    uTerrainAtlas: { value: null },
    uTerrainBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
    uTerrainZoom: { value: 0 },
    uTerrainEnabled: { value: 0 },
    uTerrainStrength: { value: 1 },
    uSunDirectionView: { value: new THREE.Vector3(1, 0, 0) },
  };

  const material = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    shininess: 60,
  });

  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    const helpers = `
      uniform sampler2D uDayAtlas;
      uniform sampler2D uBaseDayAtlas;
      uniform float uBaseDayEnabled;
      uniform vec4 uDayBounds;
      uniform float uDayZoom;
      uniform float uDayEnabled;
      uniform float uDayOpacity;
      uniform sampler2D uDayMap;
      uniform float uTideEnabled;
      uniform sampler2D uTerrainAtlas;
      uniform vec4 uTerrainBounds;
      uniform float uTerrainZoom;
      uniform float uTerrainEnabled;
      uniform float uTerrainStrength;
      uniform vec3 uSunDirectionView;

      vec2 globeToAtlasUv(vec2 globeUv, vec4 bounds, float zoom) {
        float latitude = (globeUv.y - 0.5) * 3.141592653589793;
        float mercatorY = 0.5 - log(tan(0.7853981633974483 + latitude * 0.5)) / 6.283185307179586;
        float tileCount = exp2(zoom);
        vec2 globalTile = vec2(globeUv.x, mercatorY) * tileCount;
        float atlasCenterX = bounds.x + bounds.z * 0.5;
        globalTile.x = atlasCenterX + mod(
          globalTile.x - atlasCenterX + tileCount * 0.5,
          tileCount
        ) - tileCount * 0.5;
        vec2 atlasUv = (globalTile - bounds.xy) / bounds.zw;
        return vec2(atlasUv.x, 1.0 - atlasUv.y);
      }

      vec4 sampleAtlas(sampler2D atlas, vec2 globeUv, vec4 bounds, float zoom, float enabled) {
        vec2 atlasUv = globeToAtlasUv(globeUv, bounds, zoom);
        float inside = step(0.0, atlasUv.x) * step(atlasUv.x, 1.0)
          * step(0.0, atlasUv.y) * step(atlasUv.y, 1.0);
        vec4 tile = texture2D(atlas, atlasUv);
        tile.a *= inside * enabled;
        return tile;
      }
    `;

    shader.fragmentShader = helpers + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
        #include <map_fragment>
        vec4 staticDayTexel = mapTexelToLinear(vec4(texture2D(uDayMap, vUv).rgb, 1.0));
        // video alpha selects between the static day map and the video frame
        float videoAlpha = uTideEnabled * diffuseColor.a;
        diffuseColor.rgb = mix(staticDayTexel.rgb, diffuseColor.rgb, videoAlpha);
        diffuseColor.a = 1.0;

        vec4 baseSatelliteTile = sampleAtlas(
          uBaseDayAtlas,
          vUv,
          vec4(0.0, 0.0, 1.0, 1.0),
          0.0,
          uBaseDayEnabled
        );
        vec4 satelliteTile = sampleAtlas(uDayAtlas, vUv, uDayBounds, uDayZoom, uDayEnabled);
        float detailedCoverage = satelliteTile.a;
        satelliteTile = mix(baseSatelliteTile, satelliteTile, detailedCoverage);
        satelliteTile.a = max(baseSatelliteTile.a, detailedCoverage);
        satelliteTile = mapTexelToLinear(satelliteTile);
        // transparent video pixels (land) show satellite imagery fully; the blend only applies over the video
        float satelliteOpacity = mix(1.0, uDayOpacity, videoAlpha);
        diffuseColor.rgb = mix(diffuseColor.rgb, satelliteTile.rgb, satelliteTile.a * satelliteOpacity);

        vec4 terrainTile = sampleAtlas(uTerrainAtlas, vUv, uTerrainBounds, uTerrainZoom, uTerrainEnabled);
        float terrainShade = mix(0.58, 1.32, terrainTile.r);
        diffuseColor.rgb *= mix(1.0, terrainShade, terrainTile.a * clamp(uTerrainStrength, 0.0, 1.0));
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `
        float sunAmount = smoothstep(-0.16, 0.20, dot(normalize(normal), normalize(uSunDirectionView)));
        outgoingLight *= mix(0.035, 1.0, sunAmount);
        #include <opaque_fragment>
      `,
    );
  };

  material.customProgramCacheKey = () => 'earth-tides-atlas-v7';
  return { material, uniforms };
}
