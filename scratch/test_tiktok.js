const https = require('https');

async function testTikTok() {
  try {
    const res = await fetch('https://www.tiktok.com/@gamescoffeesr/live', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log('TikTok HTTP status:', res.status);
    const html = await res.text();
    console.log('HTML length:', html.length);
    const m = html.match(/"roomId":"(\d+)"/);
    if (m) {
      console.log('Found Room ID:', m[1]);
    } else {
      console.log('No roomId found in HTML directly. Looking for liveRoom or SIGI_STATE...');
      const sigiMatch = html.match(/id="__UNIVERSAL_DATA_FOR_REHYDRATION__">([^<]+)<\/script>/);
      if (sigiMatch) {
        try {
          const data = JSON.parse(sigiMatch[1]);
          console.log('Found Universal Data keys:', Object.keys(data));
          const defaultScope = data['__DEFAULT_SCOPE__'];
          if (defaultScope && defaultScope['webapp.live-detail']) {
            console.log('Live detail:', JSON.stringify(defaultScope['webapp.live-detail']).substring(0, 300));
          }
        } catch (e) {
          console.log('JSON parse err:', e.message);
        }
      }
    }
  } catch (err) {
    console.error('Fetch err:', err.message);
  }
}

testTikTok();
