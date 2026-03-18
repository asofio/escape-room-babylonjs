import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let errorOccurred = false;

  // Intercept module resolution errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[CONSOLE ERROR] ${msg.text()}`);
      errorOccurred = true;
    }
  });

  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
    console.log(error.stack);
    errorOccurred = true;
  });

  try {
    console.log('Loading page...');
    await page.goto('http://localhost:8081', { waitUntil: 'domcontentloaded' });
    
    console.log('Waiting for potential errors...');
    await page.waitForTimeout(2000);

    // Get the actual error from the page
    const errors = await page.evaluate(() => {
      return {
        hasWindow: typeof window !== 'undefined',
        hasBABYLON: typeof BABYLON !== 'undefined',
        hasScene: typeof window.scene !== 'undefined',
        hasEngine: typeof window.engine !== 'undefined',
        pageTitle: document.title,
        bodyHTML: document.body.innerHTML.substring(0, 500)
      };
    });

    console.log('\n=== PAGE STATE ===');
    console.log(JSON.stringify(errors, null, 2));

    if (errorOccurred) {
      console.log('\n!!! ERROR DETECTED DURING LOAD !!!');
    } else {
      console.log('\n✓ No errors during page load');
    }

  } catch (error) {
    console.error('Fatal error:', error.message);
  } finally {
    await browser.close();
  }
})();
