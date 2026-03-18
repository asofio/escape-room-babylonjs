import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const networkLog = [];
  const resourceErrors = [];

  // Log all network requests and responses
  page.on('response', response => {
    networkLog.push({
      url: response.url(),
      status: response.status(),
      statusText: response.statusText()
    });
  });

  // Capture failed requests
  page.on('requestfailed', request => {
    resourceErrors.push({
      url: request.url(),
      failure: request.failure()?.errorText || 'unknown'
    });
  });

  try {
    console.log('Loading page...');
    const response = await page.goto('http://localhost:8081', { waitUntil: 'domcontentloaded' });
    
    // Wait briefly for script parsing
    await page.waitForTimeout(1000);

    console.log('\n=== NETWORK REQUESTS ===');
    networkLog.slice(0, 20).forEach(req => {
      console.log(`${req.status} ${req.url}`);
    });

    if (resourceErrors.length > 0) {
      console.log('\n=== FAILED REQUESTS ===');
      resourceErrors.forEach(err => {
        console.log(`FAILED: ${err.url}`);
      });
    }

    // Get detailed error from console
    const allErrors = await page.evaluate(() => {
      const errors = [];
      
      // Check if there are any errors logged
      if (window.__errors) {
        errors.push(...window.__errors);
      }

      // Try to parse the script error from the page
      const scripts = document.querySelectorAll('script');
      return {
        scriptCount: scripts.length,
        hasModuleScripts: Array.from(scripts).some(s => s.type === 'module'),
        errors
      };
    });

    console.log('\n=== SCRIPT ANALYSIS ===');
    console.log(JSON.stringify(allErrors, null, 2));

    // Check main.js content for the problematic import
    const mainJsResponse = await page.goto('http://localhost:8081/src/main.js');
    if (mainJsResponse.ok()) {
      const content = await mainJsResponse.text();
      if (content.includes('@babylonjs/core')) {
        console.log('\n=== MAIN.JS ISSUE FOUND ===');
        console.log('main.js imports from @babylonjs/core, which are treated as bare imports');
        console.log('This fails because the HTML only includes CDN bundle imports, not individual module imports');
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
