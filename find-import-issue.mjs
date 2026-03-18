import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Monitor all network requests
  const failedUrls = [];
  page.on('requestfailed', request => {
    failedUrls.push(request.url());
  });

  // Detailed console logging
  const messages = [];
  page.on('console', msg => {
    messages.push({ type: msg.type(), text: msg.text() });
  });

  // Intercept responses to check content
  page.on('response', response => {
    const url = response.url();
    if (url.includes('@babylonjs') && url.endsWith('.js')) {
      response.text().then(text => {
        if (text.includes('import "@babylonjs') || text.includes('import {') && text.includes('@babylonjs')) {
          console.log(`Found bare import in: ${url}`);
          const lines = text.split('\n');
          lines.forEach((line, idx) => {
            if (line.includes('@babylonjs')) {
              console.log(`  Line ${idx + 1}: ${line.trim()}`);
            }
          });
        }
      }).catch(() => {});
    }
  });

  try {
    console.log('Loading page...');
    await page.goto('http://localhost:8081', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    console.log('\n=== Failed URLs ===');
    failedUrls.forEach(url => console.log(url));

    console.log('\n=== Console Messages ===');
    messages.forEach(m => {
      if (m.type === 'error') {
        console.log(`[ERROR] ${m.text}`);
      }
    });

  } finally {
    await browser.close();
  }
})();
