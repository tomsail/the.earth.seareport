import * as THREE from 'three';
import { TileManager } from '../systems/tiles/TileManager.js';
import { createGlobeMaterial } from './globeMaterial.js';

let EARTH_R = 6.371; // in thousand of km
let SCALE = 40;
let earthMat;
const textureLoader = new THREE.TextureLoader();
const VIDEO_LAYERS = {
	temperature: document.getElementById( 'video-temperature' ),
	elevation: document.getElementById( 'video-elevation' ),
};
class Earth{
	constructor(params, renderer){
		this.params = params;
		this.renderer = renderer
		// textures
		const atmoShader = {
			side: THREE.BackSide,
			blending: THREE.AdditiveBlending,
			transparent: true,
			lights: true,
			uniforms: THREE.UniformsUtils.merge( [
	
				THREE.UniformsLib[ "common" ],
				THREE.UniformsLib[ "lights" ]
	
			] ),
			vertexShader: [
				"varying vec3 vViewPosition;",
				"varying vec3 vNormal;",
				"void main() {",
				THREE.ShaderChunk[ "beginnormal_vertex" ],
				THREE.ShaderChunk[ "defaultnormal_vertex" ],
	
				"	vNormal = normalize( transformedNormal );",
				"vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
				"vViewPosition = -mvPosition.xyz;",
				"gl_Position = projectionMatrix * mvPosition;",
				"}"
	
			].join( "\n" ),
	
			fragmentShader: [
	
				THREE.ShaderChunk[ "common" ],
				THREE.ShaderChunk[ "bsdfs" ],
				THREE.ShaderChunk[ "lights_pars_begin" ],
				THREE.ShaderChunk[ "lights_phong_pars_fragment" ],
	
				"void main() {",
				"vec3 normal = normalize( -vNormal );",
				"vec3 viewPosition = normalize( vViewPosition );",
				"#if NUM_DIR_LIGHTS > 0",
	
				"vec3 dirDiffuse = vec3( 0.0 );",
	
				"for( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {",
	
				"vec4 lDirection = viewMatrix * vec4( directionalLights[i].direction, 0.0 );",
				"vec3 dirVector = normalize( lDirection.xyz );",
				"float dotProduct = dot( viewPosition, dirVector );",
				"dotProduct = 1.0 * max( dotProduct, 0.0 ) + (1.0 - max( -dot( normal, dirVector ), 0.0 ));",
				"dotProduct *= dotProduct;",
				"dirDiffuse += max( 0.5 * dotProduct, 0.0 ) * directionalLights[i].color;",
				"}",
				"#endif",
	
				//Fade out atmosphere at edge
				"float viewDot = abs(dot( normal, viewPosition ));",
				"viewDot = clamp( pow( viewDot + 0.6, 10.0 ), 0.0, 1.0);",
	
				"vec3 color = vec3( 0.05, 0.09, 0.13 ) * dirDiffuse;",
				"gl_FragColor = vec4( color, viewDot );",
	
				"}"
	
			].join( "\n" )
		};
	
		const earthAtmoMat = new THREE.ShaderMaterial( atmoShader );
	
		// The Phong material retains the original tide video and lighting. Its
		// shader is extended with zoom-dependent satellite and terrain atlases.
		const globeMaterial = createGlobeMaterial(params);
		earthMat = globeMaterial.material;
		this.tileUniforms = globeMaterial.uniforms;

		this.earthGeo = new THREE.SphereBufferGeometry( EARTH_R * SCALE, 192, 128 );
		this.sphereMesh = new THREE.Mesh( this.earthGeo, earthMat );
		this.sphereMesh.castShadow = true;      //default is false
		this.sphereMesh.receiveShadow = true;   //default is false

		// by default load texture, spec, bumpmap from now
		this.loadVid();
		this.loadSpec();
		this.loadTerrain();

		this.earthDay = textureLoader.load( 'textures/planets/earth_day_2048.jpg' );
		this.earthDay.encoding = THREE.sRGBEncoding;
		this.tileUniforms.uDayMap.value = this.earthDay;

		const clouds = textureLoader.load( 'textures/planets/earth_clouds_2048.png' );
		clouds.encoding = THREE.sRGBEncoding;

		const earthCloudsMat = new THREE.MeshLambertMaterial( {
			color: 0xffffff,
			blending: THREE.NormalBlending,
			transparent: true,
			depthTest: false,
			map: clouds
		} );

		this.sphereCloudsMesh = new THREE.Mesh( this.earthGeo, earthCloudsMat );
		this.sphereCloudsMesh.scale.set( 1.001, 1.001, 1.001 );

		this.sphereAtmoMesh = new THREE.Mesh( this.earthGeo, earthAtmoMat );
		this.sphereAtmoMesh.scale.set( 1.03, 1.03, 1.03 );
	}

	initializeTiles(camera) {
		this.tileManager = new TileManager({
			camera,
			globe: this.sphereMesh,
			material: this.sphereMesh.material,
			uniforms: this.tileUniforms,
			renderer: this.renderer,
			params: this.params,
			statusElement: document.getElementById('tile-status'),
		});
	}

	updateTiles() {
		if (this.tileManager) this.tileManager.update();
	}

	updateSunDirection(sunPosition, camera) {
		this.tileUniforms.uSunDirectionView.value
			.copy(sunPosition)
			.normalize()
			.transformDirection(camera.matrixWorldInverse);
	}

	loadVid(){
		this.videoTextures = {};
		for (const [layer, video] of Object.entries(VIDEO_LAYERS)) {
			const texture = new THREE.VideoTexture(video);
			// VideoTexture defaults to RGBFormat, which discards the webm alpha channel
			texture.format = THREE.RGBAFormat;
			texture.encoding = THREE.sRGBEncoding;
			this.videoTextures[layer] = texture;
		}
		this.setVideoLayer(this.params.videoLayer);
	};
	setVideoLayer(layer){
		const next = VIDEO_LAYERS[layer];
		const current = VIDEO_LAYERS[this.videoLayer];
		if (!next || next === current) return;
		if (current) {
			current.pause();
			// keep roughly the same simulation time across layers
			if (next.duration) next.currentTime = current.currentTime % next.duration;
		}
		next.play();
		this.videoLayer = layer;
		this.sphereMesh.material.map = this.videoTextures[layer];
	};
	loadSpec(){
		textureLoader.load( 'textures/planets/earth_specular_2048.jpg', ( tex ) => {
			this.sphereMesh.material.specularMap = tex;
			this.sphereMesh.material.specularMap.encoding = THREE.sRGBEncoding;
			this.sphereMesh.material.needsUpdate = true;
		} );
	}
	// bump raster scaled by params.mapHeight (fixed, not in the GUI)
	loadTerrain(){
		textureLoader.load( 'textures/planets/earth_normal_2048.jpg', ( tex ) => {
			this.sphereMesh.material.bumpMap = tex;
			this.sphereMesh.material.bumpScale = this.params.mapHeight;
			this.sphereMesh.material.needsUpdate = true;
		} );
	}

	addToScene(scene){
		scene.add( this.sphereMesh );
	}

	addtoScenePPP(scene){
		scene.add( this.sphereCloudsMesh );
		scene.add( this.sphereAtmoMesh );
	}
	
	debugSceneAdd(debugScene){

		const vBGShader = [
			// "attribute vec2 uv;",
			"varying vec2 vUv;",
			"void main() {",
			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
			"}"

		].join( "\n" );

		const pBGShader = [

			"uniform sampler2D map;",
			"varying vec2 vUv;",

			"void main() {",

			"vec2 sampleUV = vUv;",
			"vec4 color = texture2D( map, sampleUV, 0.0 );",

			"gl_FragColor = vec4( color.xyz, 1.0 );",

			"}"

		].join( "\n" );

		// Skybox
		this.adaptiveLuminanceMat = new THREE.ShaderMaterial( {
			uniforms: {
				"map": { value: null }
			},
			vertexShader: vBGShader,
			fragmentShader: pBGShader,
			depthTest: false,
			// color: 0xffffff,
			blending: THREE.NoBlending
		} );

		this.currentLuminanceMat = new THREE.ShaderMaterial( {
			uniforms: {
				"map": { value: null }
			},
			vertexShader: vBGShader,
			fragmentShader: pBGShader,
			depthTest: false
			// color: 0xffffff
			// blending: THREE.NoBlending
		} );

		let quadBG = new THREE.Mesh( new THREE.PlaneBufferGeometry( 0.1, 0.1 ), this.currentLuminanceMat );
		quadBG.position.z = - 500;
		quadBG.position.x = - window.innerWidth * 0.5 + window.innerWidth * 0.05;
		quadBG.scale.set( window.innerWidth, window.innerHeight, 1 );
		debugScene.add( quadBG );

		quadBG = new THREE.Mesh( new THREE.PlaneBufferGeometry( 0.1, 0.1 ), this.adaptiveLuminanceMat );
		quadBG.position.z = - 500;
		quadBG.position.x = - window.innerWidth * 0.5 + window.innerWidth * 0.15;
		quadBG.scale.set( window.innerWidth, window.innerHeight, 1 );
		debugScene.add( quadBG );


	}
	updateTextures(params){
		this.sphereMesh.material.bumpScale = params.mapHeight;
		this.tileUniforms.uTerrainStrength.value = params.mapHeight / 1.8;
	}

	updateToneTextures(adaptToneMappingPass, params){
		adaptToneMappingPass.setAdaptionRate( params.adaptionRate );
		this.adaptiveLuminanceMat.uniforms[ "map" ].value = adaptToneMappingPass.luminanceRT;
		this.currentLuminanceMat.uniforms[ "map" ].value = adaptToneMappingPass.currentLuminanceRT;
		adaptToneMappingPass.enabled = params.enabled;
		adaptToneMappingPass.setMaxLuminance( params.maxLuminance );
		adaptToneMappingPass.setMiddleGrey( params.middleGrey );
	}
}
export {Earth};