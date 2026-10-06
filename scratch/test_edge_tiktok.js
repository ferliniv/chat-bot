const puppeteer = require('puppeteer-core');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function run() {
  console.log('Launching Edge headless...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Monitor network requests for webcast/chat
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('webcast') || url.includes('chat') || url.includes('im/fetch')) {
      console.log('Intercepted webcast URL:', url.substring(0, 100));
    }
  });

  console.log('Navigating to TikTok live...');
  await page.goto('https://www.tiktok.com/@gamescoffeesr/live', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  console.log('Page loaded! Title:', await page.title());

  // Wait a few seconds to inspect chat container
  await new Promise(r => setTimeout(r, 6000));

  const chatInfo = await page.evaluate(() => {
    // Look for chat elements
    const allDivs = Array.from(document.querySelectorAll('*'));
    const chatLike = allDivs.filter(el => {
      const cls = el.className || '';
      return typeof cls === 'string' && (cls.includes('chat') || cls.includes('comment') || cls.includes('message'));
    }).slice(0, 10).map(el => ({ tag: el.tagName, class: el.className, text: el.innerText.substring(0, 100) }));

    return {
      bodyLength: document.body.innerText.length,
      chatLike
    };
  });

  console.log('Chat Info:', JSON.stringify(chatInfo, null, 2));

  await browser.close();
}

run().catch(console.error);
