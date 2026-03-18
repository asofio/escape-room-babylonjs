import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

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
      failure: request.failure()?.errorText || 'unknown'
    });
  });

  try {
    console.log('Navigating to http://localhost:8081...');
    await page.goto('http://localhost:8081', { waitUntil: 'domcontentloaded' });

    // Wait for scene to initialize
    console.log('Waiting for scene to load...');
    await page.waitForTimeout(3000);

    // Take a screenshot
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'black-screen-test.png', fullPage: true });

    // Get canvas details
    const canvasInfo = await page.evaluate(() => {
      const canvas = document.getElementById('renderCanvas');
      if (!canvas) return { error: 'Canvas not found' };
      
      const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl');
      const style = window.getComputedStyle(canvas);
      return {
        found: true,
        width: canvas.width,
        height: canvas.height,
        offsetWidth: canvas.offsetWidth,
        offsetHeight: canvas.offsetHeight,
        display: style.display,
        visibility: style.visibility,
        backgroundColor: style.backgroundColor,
        webglSupported: !!ctx
      };
    });

    console.log('\n=== CANVAS INFO ===');
    console.log(JSON.stringify(canvasInfo, null, 2));

    console.log('\n=== CONSOLE LOGS ===');
    if (logs.length === 0) {
      console.log('No console output');
    } else {
      logs.forEach(log => {
        console.log(`[${log.type.toUpperCase()}] ${log.text}`);
      });
    }

    console.log('\n=== ERRORS ===');
    if (errors.length === 0) {
      console.log('No page errors');
    } else {
      errors.forEach(err => {
        console.log(`\nError: ${err.message}`);
        console.log(err.stack);
      });
    }

    console.log('\n=== NETWORK ERRORS ===');
    if (networkErrors.length === 0) {
      console.log('No network errors');
    } else {
      networkErrors.forEach(err => {
        console.log(`Failed: ${err.url}`);
        console.log(`  Reason: ${err.failure}`);
      });
    }

    // Check Babylon and scene state
    const engineInfo = await page.evaluate(() => {
      const result = {
        babylonLoaded: typeof BABYLON !== 'undefined',
        hasScene: typeof window.scene !== 'undefined',
        hasEngine: typeof window.engine !== 'undefined'
      };
      
      if (typeof window.scene !== 'undefined' && window.scene) {
        result.sceneDetails = {
          meshCount: window.scene.meshes ? window.scene.meshes.length : 'unknown',
          isReady: window.scene.isReady?.() || false,
          activeCamera: window.scene.activeCamera ? window.scene.activeCamera.constructor.name : 'none'
        };
      }

      if (typeof window.engine !== 'undefined' && window.engine) {
        result.engineDetails = {
          isDisposed: window.engine.isDisposed,
          renderingCanvas: window.engine.getRenderingCanvas() ? 'present' : 'none',
          lastFrameId: window.engine.frameId
        };
      }

      return result;
    });

    console.log('\n=== BABYLON ENGINE INFO ===');
    console.log(JSON.stringify(engineInfo, null, 2));

    // Check for specific errors by looking at page content
    const htmlContent = await page.content();
    const hasCanvas = htmlContent.includes('renderCanvas');
    console.log(`\n=== PAGE STRUCTURE ===`);
    console.log(`Has renderCanvas element: ${hasCanvas}`);
    console.log(`Has main.js script: ${htmlContent.includes('src/main.js')}`);

  } catch (error) {
    console.error('Navigation error:', error);
  } finally {
    await browser.close();
  }
})();
