import { World } from './World/World.js';

const DEFAULT_LOCATION = { lat: 20, lon: 0 };

function locate() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve(DEFAULT_LOCATION);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      () => resolve(DEFAULT_LOCATION),
      { timeout: 4000, maximumAge: 300000 },
    );
  });
}

async function main() {
  const { lat, lon } = await locate();
  const container = document.getElementById('scene-container');
  const world = new World(container, lat, lon);
  world.init();
  world.start();
}

main().catch(error => {
  console.error(error);
  const status = document.getElementById('tile-status');
  status.textContent = 'WebGL could not start on this device.';
  status.dataset.state = 'error';
});
