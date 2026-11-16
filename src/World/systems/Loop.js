import { Clock } from 'three';
import { updateEffectComposer } from '../components/scene.js';

const clock = new Clock();
const OCCLUSION_LAYER = 1;
const DEFAULT_LAYER = 0;

class Loop {
  constructor(camera,cameraCube, scene, renderer,effectComposer) {
    this.camera = camera;
    this.cameraCube = cameraCube;
    this.scene = scene;
    this.renderer = renderer;
    this.effectComposer = effectComposer;
    this.updatables = [];
  }

  start(stats,orbitControls, sun,earth,params, composer) {
    this.renderer.setAnimationLoop(() => {
      // tell every animated object to tick forward one frame
      this.tick();
      stats.update();
      orbitControls.update();
      updateEffectComposer(params, earth);
      earth.updateTextures(params);
      earth.updateTiles();
      earth.updateSunDirection(sun.spotLight.position, this.camera);
      sun.update(params);
      // render a frame
      earth.sphereMesh.rotation.y += params.earthRotation;
      // this.camera.lookAt( this.scene.position );
      this.cameraCube.rotation.copy( this.camera.rotation );

      this.renderer.setViewport( 0, 0 ,window.innerWidth  , window.innerHeight );
      this.effectComposer.render( 0.017 );
      earth.sphereCloudsMesh.rotation.y += params.earthRotation * 2;
      earth.sphereCloudsMesh.rotation.z += params.earthRotation / 4;

      if ( params.showClouds ) {
        earth.sphereCloudsMesh.visible = true;
      }
      else {
        earth.sphereCloudsMesh.visible = false;
      }

    });
  }

  stop() {
    this.renderer.setAnimationLoop(null);
  }

  tick() {
    // only call the getDelta function once per frame!
    const delta = clock.getDelta();

    // console.log(
    //   `The last frame rendered in ${delta * 1000} milliseconds`,
    // );

    for (const object of this.updatables) {
      object.tick(delta);
    }
  }
}

export { Loop };
