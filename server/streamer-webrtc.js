// Force clean snapshot build for live server
const puppeteer = require('puppeteer');
const { Client } = require('pg');
const http = require('http');

const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebRTC Signalling Bridge Online');
});

const io = require('socket.io')(server, { cors: { origin: "*" } });
const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
pgClient.connect();

let activeUrl = "https://example.com";
let currentSlotId = null;

async function runSafetyShieldMonitor(urlToVerify) {
  if (urlToVerify === "https://example.com") return true;
  try {
    const webRiskUrl = `https://googleapis.com{process.env.GOOGLE_WEB_RISK_API_KEY}&uri=${encodeURIComponent(urlToVerify)}&threatTypes=MALWARE&threatTypes=SOCIAL_ENGINEERING`;
    const check = await fetch(webRiskUrl);
    const data = await check.json();
    if (data.threat && data.threat.threatTypes) {
      await pgClient.query(`UPDATE slots SET is_frozen = TRUE, expires_at = NOW() WHERE id = $1`, [currentSlotId]);
      activeUrl = "https://example.com";
      return false;
    }
    return true;
  } catch (err) {
    return true;
  }
}

async function loopStateVerification() {
  try {
    const res = await pgClient.query(`SELECT * FROM slots WHERE is_frozen = FALSE AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1`);
    if (res.rows.length > 0) {
      const live = res.rows[0];
      currentSlotId = live.id;
      if (live.current_url !== activeUrl) {
        const isSafe = await runSafetyShieldMonitor(live.current_url);
        if (isSafe) activeUrl = live.current_url;
      }
    } else {
      activeUrl = "https://example.com";
      currentSlotId = null;
    }
  } catch (err) {
    console.error("Database status pool exception:", err.message);
  }
}

async function initializeWebRTCCoreEngine() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-software-rasterizer']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.setJavaScriptEnabled(true);
  await page.setCacheEnabled(false);
  page.on('dialog', async d => await d.dismiss());

  setInterval(loopStateVerification, 2000);

  setInterval(async () => {
    try {
      if (page.url() !== activeUrl) {
        await page.goto(activeUrl, { waitUntil: 'domcontentloaded', timeout: 5000 }).catch(()=>{});
      }
      const frameBuffer = await page.screenshot({ type: 'jpeg', quality: 35 });
      if (io.sockets.sockets.size > 0) {
        io.volatile.emit('v-frame', frameBuffer.toString('base64'));
      }
    } catch (e) {
      activeUrl = "https://example.com";
    }
  }, 100);
}

server.listen(PORT, () => {
  initializeWebRTCCoreEngine();
  console.log(`Streaming core online via port ${PORT}`);
});
