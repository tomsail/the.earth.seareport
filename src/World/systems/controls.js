import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'three/examples/jsm/libs/dat.gui.module.js';

function createControls(camera, canvas, rotation) {
  const controls = new OrbitControls(camera, canvas);

  controls.enableDamping = true;
  controls.autoRotate = false;
  controls.autoRotateSpeed = rotation;
  controls.enablePan = false;
  controls.minDistance = 255.35;
  controls.maxDistance = 2200;
  controls.zoomSpeed = 0.85;

  // Dragging the globe should become finer as the camera gets closer.
  const updateRotateSpeed = () => {
    const distance = camera.position.distanceTo(controls.target);
    const zoomRange = controls.maxDistance - controls.minDistance;
    const normalizedDistance = Math.min(
      1,
      Math.max(0, (distance - controls.minDistance) / zoomRange),
    );
    controls.rotateSpeed = 0.12 + 0.73 * Math.sqrt(normalizedDistance);
  };

  updateRotateSpeed();
  controls.tick = () => {
    updateRotateSpeed();
    controls.update();
  };
  return controls;
}

function initParams(){
  const params = {
    sunLight: 2,
    earthRotation: 0,
    showClouds: false,
    videoLayer: 'temperature',

    enabled: true,
    avgLuminance: 1.3,
    middleGrey: 3.2,
    maxLuminance: 30,
    adaptionRate: 2.0,

    // fixed subtle relief, not exposed in the GUI
    mapHeight: 2,
    dynamicTiles: true,
    satelliteMix: 0.55
  };
  return params
}

function initGui(params, earth){
  const gui = new GUI();
  gui.close();

  gui.add( params, 'earthRotation', 0, 0.0006 ).name( 'Rotation speed' );
  gui.add( params, 'showClouds' ).name( 'Show clouds' );
  gui.add( params, 'videoLayer', { 'Temperature': 'temperature', 'Water level': 'elevation' } )
    .name( 'Video layer' )
    .onChange( layer => earth.setVideoLayer( layer ) );
  gui.add( params, 'satelliteMix', 0, 1, 0.01 ).name( 'Satellite blend' );

  return gui
}

export { createControls, initParams, initGui};