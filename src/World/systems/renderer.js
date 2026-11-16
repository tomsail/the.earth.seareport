import * as THREE from 'three';

function createRenderer() {
  const renderer = new THREE.WebGLRenderer();
  
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.shadowMap.enabled = true;
  
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.autoClear = false;
  renderer.setClearColor( 0xffffff, 0);
  renderer.physicallyCorrectLights = true;

  return renderer;
}

export { createRenderer };
