import pkg from 'pg';
const { Client } = pkg;
import { Server } from 'socket.io';
import express from 'express';
import http from 'http';
import puppeteer from 'puppeteer';

const app = express();
const server = http.createServer(app);

const io = new Server(server, { 
  path: "/socket.io/", 
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ['websocket']
});

const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.status(200).send('The Only Tab Streaming Core Engine is Active!');
});

let browser = null;
let page = null;
let currentUrlInStream = "";

async function initPuppeteer() {
  try {
    console.log("Launching headless cloud browser via native package layer allocation...");
    
    browser = await puppeteer.launch({
      headless: "new",
      // Geen hardcoded schijfpaden meer; Puppeteer wijst nu automatisch de meegeleverde Chromium-binary toe
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--window-size=1280,720'
      ],
      defaultViewport: { width: 1280, height: 720 }
    });
    
    page = await browser.newPage();
    await page.setDefaultNavigationTimeout(15000);
    await page.setBypassCSP(true); // Omzeilt CSP/X-Frame-Options beveiligingen van externe websites
    
    console.log("Cloud browser successfully initialized and stabilized via package engine.");
  } catch (err) {
    console.error("Fatal Error initializing Puppeteer runtime layout:", err.message);
  }
}

async function startStreamingCore() {
  const dbConnectionString = process.env.DATABASE_URL;

  await initPuppeteer();

  // Real-time database synchronisatie loop (elke 4 seconden)
  setInterval(async () => {
    try {
      const pgClient = new Client({
        connectionString: dbConnectionString,
        ssl: { rejectUnauthorized: false }
      });
      await pgClient.connect();
      
      const res = await pgClient.query(
        `SELECT current_url, display_name FROM slots WHERE is_frozen = FALSE AND expires_at > NOW() LIMIT 1`
      );
      await pgClient.end();

      let targetUrl = "https://theonlytab.io"; 
      let displayLabel = "SYSTEM IDLE";

      if (res.rows && res.rows.length > 0) {
        targetUrl = res.rows.current_url;
        displayLabel = res.rows.display_name || "LIVE FEED";
      }

      if (targetUrl !== currentUrlInStream && page) {
        console.log(`Stream target shifted! Steering browser to: ${targetUrl}`);
        currentUrlInStream = targetUrl;
        
        // Versnelde navigatie (wacht enkel op de HTML body structuur, niet op zware trackers)
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

        await page.evaluate((labelText) => {
          const oldBadge = document.getElementById('tot-live-badge');
          if (oldBadge) oldBadge.remove();

          const badge = document.createElement('div');
          badge.id = 'tot-live-badge';
          
          Object.assign(badge.style, {
            position: 'fixed',
            top: '24px',
            right: '24px',
            backgroundColor: '#13131A',
            color: '#F59E0B', 
            border: '2px solid #262626',
            borderRadius: '12px',
            padding: '10px 18px',
            fontFamily: 'monospace',
            fontSize: '14px',
            fontWeight: '900',
            letterSpacing: '0.15em',
            zIndex: '2147483647', 
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7)',
            textTransform: 'uppercase'
          });
          
          badge.innerText = `ON STAGE: ${labelText.substring(0, 15)}`;
          document.body.appendChild(badge);
        }, displayLabel).catch(() => {});
      }

    } catch (dbErr) {
      console.error("Database sync loop error:", dbErr.message);
    }
  }, 4000);

  // Live WebSocket frame broadcast (24 FPS)
  setInterval(async () => {
    if (!page || !browser) return;
    try {
      const screenshotBase64 = await page.screenshot({
        type: 'jpeg',
        quality: 42,
        encoding: 'base64'
      });
      io.emit('v-frame', screenshotBase64);
    } catch (streamErr) {
      // Slokt navigatie-flikkeringen geruisloos op tijdens het laden van pagina's
    }
  }, 41);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server fully bound and locked on port ${PORT}`);
  startStreamingCore();
});
