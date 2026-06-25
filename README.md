# Planara

Planara is a self-hosted project and changelog board for development teams.
Tasks, ideas, bug reports, roles and changelogs live in one focused workspace.
It runs on the Node.js standard library only - no external database and no build
step required.

- Custom branding (product name, logo, favicon, colors) from the UI
- Custom task statuses (name, color, order, done flag)
- Custom roles with fine-grained permissions
- Local accounts (username + password, hashed with scrypt) and optional Discord login
- API access with read or read/write Bearer tokens
- English and German interface, switchable via the environment
- Self-hosted Font Awesome icons (no external CDN)

Project page: https://planara.nexhub.dev

## Requirements

- Node.js 18 or newer (`node --version`)
- Linux, macOS or Windows for local use
- For production: a reverse proxy (Apache or Nginx) and a TLS certificate

## Quick start (local)

```bash
git clone https://github.com/NexHub-dev/planara.git
cd planara
cp .env.example .env
node server.js
```

Open http://localhost:4574 and register on the login screen. The first account
that registers becomes the administrator automatically and is approved right
away. Every account created after that has to be approved by an administrator.

No npm install is needed - Planara only uses Node.js built-in modules.

## Configuration (.env)

Copy `.env.example` to `.env` and adjust the values:

| Variable | Default | Description |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Interface the server binds to. Keep `127.0.0.1` behind a reverse proxy. |
| `PORT` | `4574` | Port the server listens on. |
| `NODE_ENV` | `production` | Use `production` for live deployments (enables secure cookies). |
| `LOCALE` | `en` | Interface language. `en` for English, `de` for German. |
| `TRUST_PROXY` | `false` | Set to `true` when running behind a TLS-terminating proxy such as Cloudflare, Apache or Nginx. Session cookies are then marked `Secure` and the real client IP is read from the `CF-Connecting-IP` / `X-Forwarded-For` headers. |
| `DISCORD_CLIENT_ID` | empty | Optional. Enables the "Continue with Discord" button. |
| `DISCORD_CLIENT_SECRET` | empty | Optional. Discord OAuth secret. |
| `DISCORD_REDIRECT_URI` | empty | Optional. Must match the redirect set in the Discord developer portal, e.g. `https://your-domain/auth/discord/callback`. |
| `ADMIN_DISCORD_IDS` | empty | Optional. Comma separated Discord IDs that become administrators on first Discord login. |
| `DISCORD_WEBHOOK_URL` | empty | Optional. Target for published changelogs. |
| `DISCORD_BOT_TOKEN` | empty | Optional. When set, a Discord user's avatar is refreshed on page load (throttled to once every 30 minutes), so a changed profile picture appears without signing in again. Without it, avatars still refresh on each Discord login. |
| `UPDATE_CHECK` | `true` | Set to `false` to disable the "update available" notice. |
| `UPDATE_REPO` | `NexHub-dev/planara` | Repository checked for new releases. Point it at your fork if you maintain one. |

Discord is fully optional. With an empty `.env`, Planara runs entirely on local
accounts and ships no credentials.

### Language

The interface defaults to English. Set `LOCALE=de` in `.env` for German. The
**default roles are always created in English** (Member, Developer,
Lead-Developer) regardless of the chosen language; you can rename or replace
them from the admin settings at any time.

## Data and uploads

Planara stores everything as JSON under `data/` and uploaded media under
`uploads/`. Both directories are created and seeded automatically on first
start. They are intentionally excluded from version control - your data never
ends up in the repository.

## Permissions (important)

For local use the default file permissions are fine. For a production install
that runs under a dedicated service user, the service account must be able to
**write** to `data/` and `uploads/`. Missing write permission on `uploads/` is
the most common cause of failed image and video uploads.

```bash
sudo useradd --system --home /opt/planara --shell /usr/sbin/nologin planara
sudo cp -r planara /opt/planara

sudo chown -R root:planara /opt/planara
sudo chown -R planara:planara /opt/planara/data /opt/planara/uploads
sudo chmod 750 /opt/planara /opt/planara/data /opt/planara/uploads
sudo chmod 750 /opt/planara/uploads/tasks /opt/planara/uploads/reports

sudo chown root:planara /opt/planara/.env
sudo chmod 640 /opt/planara/.env
```

If you sandbox the service with systemd (`ProtectSystem=strict`), you must list
**both** `data/` and `uploads/` in `ReadWritePaths`, otherwise uploads fail with
a read-only file system error. The provided unit (`deploy/planara.service`)
already does this:

```ini
ReadWritePaths=/opt/planara/data /opt/planara/uploads
```

## Production deployment (systemd + Apache)

1. Install Planara to `/opt/planara` and set permissions as shown above.
2. Install the service unit:

```bash
sudo cp /opt/planara/deploy/planara.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now planara
sudo systemctl status planara
```

3. Put a reverse proxy in front of it. A ready-to-edit Apache vhost is in
   `deploy/apache-planara.conf` (replace `planara.example.com` with your domain):

```bash
sudo a2enmod proxy proxy_http headers ssl
sudo cp /opt/planara/deploy/apache-planara.conf /etc/apache2/sites-available/planara.conf
sudo a2ensite planara.conf
sudo apache2ctl configtest
sudo systemctl reload apache2
```

4. Issue a certificate (DNS must point to the server and port 80 must be
   reachable):

```bash
sudo certbot --apache -d planara.example.com --redirect
```

The application binds to `127.0.0.1:4574` and should not be exposed directly.
The vhost blocks access to `.env`, `.git`, `data/`, `server.js` and
`package.json`. Uploads are limited to 250 MB.

## Roles and permissions

Roles are managed under the admin "Roles" page. Each role is a set of
permissions, for example:

- `view_app`, `create_task`, `claim_task`, `manage_tasks`
- `submit_changelog`, `approve_changelog`, `delete_changelog`, `push_changelog`
- `manage_users` - approve users and assign roles
- `manage_settings` - branding, statuses and API tokens (the Settings page)

`manage_settings` is its own permission, so you can let a non-admin role manage
branding, statuses and tokens without granting full administration.

## Customization (Settings)

Anyone with the `manage_settings` permission (and every administrator) can open
**Settings**:

- **Branding** - product name, tagline, logo and icon paths, primary and accent
  color. Changes apply across the whole interface immediately.
- **Task statuses** - add, recolor, reorder, mark a status as the default or as
  a completion status, and delete unused ones.
- **API tokens** - create read or read/write tokens. The plain token is shown
  only once.

## API

Authenticate requests with a token from **Settings > API tokens**:

```bash
curl -H "Authorization: Bearer plnr_xxxxxxxx" https://your-domain/api/tasks
```

- Read tokens may call `GET` endpoints (for example `/api/bootstrap`,
  `/api/tasks`, `/api/statuses`, `/api/branding`, `/api/ideas`, `/api/bugs`).
- `GET /api/ideas` and `GET /api/bugs` return each entry together with its
  current state: `converted` (whether a task was created from it) and
  `taskStatus` (the linked task's status, or `null`).
- Read/write tokens may additionally create ideas and bugs (`POST /api/ideas`,
  `POST /api/bugs`) and create/update tasks and changelog entries.
- Administrative configuration (roles, branding, statuses, tokens) is reserved
  for signed-in users with the matching permission and cannot be changed through
  a token.

When a newer release is published on GitHub, signed-in administrators see an
"update available" badge in the top bar that links to the release notes. You can
turn this off with `UPDATE_CHECK=false`.

## Guides

Step-by-step guides for common setups live in [docs/](docs/):

- [Hosting behind a Cloudflare Tunnel](docs/cloudflare-tunnel.md) - give a
  locally running Planara a fixed public HTTPS address without port forwarding.
- [Automation recipe with n8n, Telegram and email](docs/automation-recipe.md) -
  turn incoming requests into board cards and Telegram alerts using the API.

## Updating

```bash
git pull
sudo chown -R root:planara /opt/planara
sudo chown -R planara:planara /opt/planara/data /opt/planara/uploads
sudo systemctl restart planara
```

## Credits

Thanks to **Tobse** ([kicodebyts.com](https://www.kicodebyts.com/)) for the
original Cloudflare Tunnel and automation guides that the documents in
[docs/](docs/) are based on.

## License

Planara is **source-available** under the [Planara License](LICENSE). You may
self-host, modify, share and use it for **any purpose, including commercial use**
- run it in your business and even charge for services you provide with it. The
**one restriction: you may not sell Planara itself.** Selling, reselling, renting
or sublicensing the software for a fee is not allowed.

Bundled third-party assets (Font Awesome Free, Inter) keep their own permissive
licenses - see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
