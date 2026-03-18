import { test } from '@playwright/test';

test('diagnose black screen issue', async ({ page }) => {
  const errors = [];
  const logs = [];
  const networkErrors = [];

  // Capture console messages
  page.on('console', msg => {
    logs.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });

  // Capture errors
  page.on('pageerror', error => {
    errors.push({
      message: error.message,
      stack: error.stack
    });
  });

  // Capture network errors
  page.on('requestfailed', request => {
    networkErrors.push({
      url: request.url(),
      failure: request.failure()
    });
  });

  // Navigate to the app
  console.log('Navigating to http://localhost:8081...');
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });

  // Wait a bit for scene to load
  await page.waitForTimeout(3000);

  // Take a screenshot
  console.log('Taking screenshot...');
  await page.screenshot({ path: 'black-screen-test.png', fullPage: true });

  // Get canvas details
  const canvasInfo = await page.evaluate(() => {
    const canvas = document.getElementById('renderCanvas');
    if (!canvas) return { error: 'Canvas not found' };
    
    const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return {
      found: true,
      width: canvas.width,
      height: canvas.height,
      style: window.getComputedStyle(canvas),
      webglSupported: !!ctx,
      displaySize: {
        width: canvas.offsetWidth,
        height: canvas.offsetHeight
      }
    };
  });

  console.log('\n=== CANVAS INFO ===');
  console.log(JSON.stringify(canvasInfo, null, 2));

  console.log('\n=== CONSOLE LOGS ===');
  logs.forEach(log => {
    console.log(`[${log.type}] ${log.text} at ${log.location.url}:${log.location.lineNumber}`);
  });

  console.log('\n=== ERRORS ===');
  if (errors.length === 0) {
    console.log('No page errors');
  } else {
    errors.forEach(err => {
      console.log(`Error: ${err.message}`);
      console.log(err.stack);
    });
  }

  console.log('\n=== NETWORK ERRORS ===');
  if (networkErrors.length === 0) {
    console.log('No network errors');
  } else {
    networkErrors.forEach(err => {
      console.log(`Failed to load: ${err.url}`);
      console.log(`Reason: ${err.failure.errorText}`);
    });
  }

  // Check for Babylon engine
  const engineInfo = await page.evaluate(() => {
    if (typeof BABYLON === 'undefined') {
      return { error: 'BABYLON namespace not found' };
    }
    return {
      engineAvailable: true,
      hasScene: window.scene !== undefined,
      sceneDetails: window.scene ? {
        meshCount: window.scene.meshes ? window.scene.meshes.length : 'unknown',
        isReady: window.scene.isReady ? window.scene.isReady() : 'unknown'
      } : null
    };
  });

  console.log('\n=== BABYLON ENGINE INFO ===');
  console.log(JSON.stringify(engineInfo, null, 2));
});
