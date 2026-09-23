const { Client } = require('pg');
const { Server } = require('socket.io');
const http = require('http');
const puppeteer = require('puppeteer');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('The Only Tab Streaming Core is Active\n');
});

const PORT = process.env.PORT || 8080;
const io = new Server(server, { cors: { origin: "*" } });

console.log(`Streaming core online via port ${PORT}`);

let browser = null;
let page = null;
let currentTargetUrl = "";

async function startStreamingEngine() {
  try {
    const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();
    console.log("Database synced successfully via IPv4/5432.");

    // Start Puppeteer headless Chrome
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium', // Nixpacks chromium pad
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--headless']
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Elke 3 seconden de database checken en screenshots streamen
    setInterval(async () => {
      try {
        // Vraag aan de Next.js API wat de huidige actieve URL is (inclusief fallback)
        const res = await fetch('https://theonlytab.io');
        if (res.ok) {
          const payload = await res.json();
          const targetUrl = payload.data?.currentUrl || "https://theonlytab.io";

          // Als de URL is veranderd, surf er naartoe!
          if (targetUrl !== currentTargetUrl && page) {
            currentTargetUrl = targetUrl;
            console.log(`Browsing live node to: ${currentTargetUrl}`);
            await page.goto(currentTargetUrl, { waitUntil: 'networkidle2', timeout: 15000 }).catch(e => console.log(e.message));
          }
        }

        // Neem een screenshot en schiet hem via WebSockets (Socket.io) naar de website!
        if (page) {
          const screenshot = await page.screenshot({ type: 'jpeg', quality: 60 });
          const base64Data = screenshot.toString('base64');
          io.emit('v-frame', base64Data);
        }
      } catch (err) {
        console.error("Streaming loop tick error:", err.message);
      }
    }, 3000);

  } catch (err) {
    console.error("Engine launch error:", err.message);
  }
}

startStreamingEngine();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server bound to port ${PORT}`);
});
