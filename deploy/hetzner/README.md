# Streamer on a Hetzner VPS

Only `server/streamer-webrtc.js` moves. Next.js stays on Vercel; Postgres stays where it is (the streamer uses `DATABASE_URL`, so there is no DB migration).

The Docker **build context is the repo root** (`context: ../..` in compose; `docker build -f deploy/hetzner/Dockerfile .`). The image installs from `server/package.json` / `server/package-lock.json` with `npm ci --omit=dev`.

## 1. Provision
1. Create a Hetzner Cloud server, Ubuntu 24.04. Headless Chromium needs real CPU/RAM: use a dedicated-vCPU plan (CCX) or a sufficiently sized shared plan (>= 2 vCPU / 4 GB). Confirm current pricing and included traffic on Hetzner's site.
2. Add your SSH public key at creation.

## 2. Harden
```bash
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
# /etc/ssh/sshd_config.d/hardening.conf:
#   PermitRootLogin no
#   PasswordAuthentication no
systemctl restart ssh
ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw enable
apt install -y fail2ban unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```
Note: Docker-published ports bypass ufw; only Caddy publishes ports (80/443), the streamer is `expose`d on the internal network only.

## 3. Install Docker
Follow https://docs.docker.com/engine/install/ubuntu/ then `sudo usermod -aG docker deploy`.

## 4. DNS
Create an `A` record for your stream domain (e.g. `stream.example.com`) pointing at the server IP.

## 5. Deploy
```bash
git clone <repo-url> && cd theonlytab-core/deploy/hetzner
cp .env.example .env && nano .env     # set DATABASE_URL, STREAM_DOMAIN, STREAM_ALLOWED_ORIGINS
docker compose up -d --build
curl -fsS https://$STREAM_DOMAIN/     # "The Only Tab Streaming Core Engine is Active!"
```

## Operations
- Logs: `docker compose logs -f streamer` (a `Stream metrics` line is logged every 60 s: frames, bytes, viewers).
- Update/redeploy: `git pull && docker compose up -d --build`.
- Roll back to Render: set `NEXT_PUBLIC_STREAM_URL` on Vercel back to the Render URL and redeploy.

## Cutover checklist
- [ ] Deploy on the VPS and test with a temporary frontend (or a Vercel preview with `NEXT_PUBLIC_STREAM_URL` set).
- [ ] Set `NEXT_PUBLIC_STREAM_URL=https://<stream domain>` on Vercel production and redeploy.
- [ ] Keep Render running for a day.
- [ ] Turn Render off.

## Notes
- `PUPPETEER_DISABLE_SANDBOX=true` is set inside the container only (Chromium's sandbox needs privileges the container lacks). Tradeoff: no Chrome sandbox; the non-root user, container isolation and the SSRF navigation policy remain.
- Follow-up hardening: the streamer connects to Postgres with `ssl: { rejectUnauthorized: false }`. Behaviour is unchanged here; consider verifying the server certificate later.
