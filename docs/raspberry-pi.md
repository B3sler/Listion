# Raspberry Pi test server

A Raspberry Pi 4 (2 GB is enough) runs the production stack and follows `main` on its own. It is
reachable from the internet over HTTPS through Tailscale Funnel.

```
push to main ─► CI ─► Publish images (arm64) ─► ghcr.io/b3sler/listion-{backend,frontend}
                                                          │
           Pi: listion-deploy@.timer, every 5 min ◄───────┘  git pull + docker compose pull/up
                                                          │
           https://<name>.<tailnet>.ts.net ─► Tailscale Funnel ─► 127.0.0.1:8080 (nginx)
```

The Pi never builds anything: a frontend build (`vue-tsc` and `vite build` in parallel) does not fit
in 2 GB. `.github/workflows/publish-images.yml` builds the images on GitHub's arm64 runners after CI
has passed on `main`. At runtime the three containers need about 300 MB.

Listion itself does not listen on the network: nginx is bound to `127.0.0.1:8080`, and the Pi only
makes outgoing connections, to GitHub, GHCR and Tailscale.

## 1. Publish the images once

The workflow runs only from `main`. After this setup is merged, open **Actions → Publish images**
and check that both jobs went green (or start the workflow by hand with **Run workflow**).

GHCR creates new packages as private. Make both public: **github.com/B3sler → Packages →
listion-backend → Package settings → Change visibility → Public**, then do the same for
`listion-frontend`. (To keep them private, run `docker login ghcr.io -u B3sler` on the Pi instead
and use a classic token that has only `read:packages` as the password.)

## 2. Prepare the Pi

Flash **Raspberry Pi OS Lite (64-bit)** with Raspberry Pi Imager. In its settings, set a user and
enable SSH with your public key. A USB SSD outlives an SD card under Postgres, but an SD card works
for testing.

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y git unattended-upgrades
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
```

Log out and back in so that the docker group applies.

## 3. Check out the repository and add secrets

```bash
sudo mkdir /opt/listion && sudo chown "$USER": /opt/listion
git clone https://github.com/B3sler/Listion.git /opt/listion
cd /opt/listion
cp deploy/pi/.env.example .env
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|; s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
chmod 600 .env
```

`.env` sets `COMPOSE_FILE`, so a plain `docker compose ps` / `logs` in `/opt/listion` uses
`docker-compose.prod.yml` together with `docker-compose.pi.yml`.

## 4. First start and automatic updates

```bash
./deploy/pi/deploy.sh
docker compose ps                      # all three healthy after about a minute
curl -s http://127.0.0.1:8080/api/health
```

Then install the timer. The instance name is the user that owns `/opt/listion`:

```bash
sudo cp deploy/pi/listion-deploy@.service deploy/pi/listion-deploy@.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now "listion-deploy@$USER.timer"
```

Every 5 minutes, `deploy.sh` pulls `main` (compose files) and the `latest` images, and restarts only
the containers that changed. The backend applies new migrations on startup. A push therefore shows
up about 10 minutes later: CI, then the image build, then the next check on the Pi.

```bash
systemctl list-timers 'listion-deploy@*'          # next run
journalctl -u "listion-deploy@$USER" -f           # what the last runs did
sudo systemctl start "listion-deploy@$USER"       # update right now
```

## 5. Make it public with Tailscale Funnel

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
sudo tailscale set --hostname listion
sudo tailscale funnel --bg 8080
```

The first `funnel` call prints a link where you allow Funnel for your tailnet. In the admin console,
**DNS → HTTPS Certificates** must be enabled as well. `tailscale funnel status` shows the public
address, `https://listion.<tailnet>.ts.net`. The DNS name can take a few minutes to resolve the
first time.

HTTPS is required, not optional: in production the backend sets the login cookie with `Secure`, so a
browser on plain `http://<pi-ip>` would never stay logged in.

Funnel puts the real client address into `X-Forwarded-For`. nginx takes it from private addresses
only (`frontend/nginx.conf`), so rate limits apply per visitor and not to everyone together.

## Before you share the link

- **Anyone can register.** `POST /api/auth/register` is open to whoever has the URL.
- **Swagger is public** at `/api/docs`. It only describes the API: the bit, packet, flow and
  dependency endpoints still need a login.
- **Backups:** the data lives in the `postgres_data` volume.
  `docker compose exec -T postgres pg_dump -U listion_user listion > listion.sql` saves it.
- Turn Funnel off with `sudo tailscale funnel reset`. To keep the app reachable from your own
  tailnet devices only, run `sudo tailscale serve --bg 8080` afterwards.
