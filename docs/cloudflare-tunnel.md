# Hosting Planara behind a Cloudflare Tunnel

This guide gives a Planara instance a stable public address (for example
`https://board.your-domain.tld`) without opening a port on your router. It is
useful when Planara runs on a machine at home or in an office (PC, NAS, Docker)
and you still want a fixed HTTPS URL that other services - such as an automation
tool - can reach.

A Cloudflare Tunnel keeps the connection outbound only: the `cloudflared` agent
on your machine dials out to Cloudflare, and Cloudflare forwards public requests
back down that connection. Nothing has to be port-forwarded.

You can delegate either a whole domain or a single subdomain to Cloudflare. The
steps below delegate only a subdomain (for example `board`), so the rest of your
domain (website, mail) can stay with your current DNS provider.

> Requirement: your current DNS provider must allow `NS` records on a subdomain.
> If it does not, delegate the whole domain to Cloudflare instead.

## 1. Cloudflare account and subdomain

1. Create a free account at cloudflare.com.
2. Choose "Add a site" and enter the subdomain you want to use, for example
   `board.your-domain.tld`.
3. Pick the Free plan.
4. Cloudflare shows two nameservers (for example `aaa.ns.cloudflare.com` and
   `bbb.ns.cloudflare.com`) and asks you to add them at your parent zone. Note
   both names.

## 2. Delegate the subdomain at your DNS provider

In your current DNS editor add two records:

- Type `NS`, host `board`, target `aaa.ns.cloudflare.com`
- Type `NS`, host `board`, target `bbb.ns.cloudflare.com`

Save and wait until Cloudflare marks the subdomain as "Active" (minutes to
hours).

## 3. Create a named tunnel on the host

Install `cloudflared` on the machine that runs Planara, then:

```bash
cloudflared tunnel login            # authorise board.your-domain.tld in the browser
cloudflared tunnel create board     # creates the tunnel and a credentials JSON
cloudflared tunnel route dns board board.your-domain.tld
```

Create a config file (path shown for Windows; on Linux use
`~/.cloudflared/config.yml`):

```yaml
tunnel: <TUNNEL-ID-FROM-CREATE>
credentials-file: <PATH-TO-THE-TUNNEL-CREDENTIALS-JSON>
ingress:
  - hostname: board.your-domain.tld
    service: http://localhost:4574
  - service: http_status:404
```

Install it as a service so it starts automatically:

```bash
cloudflared service install
```

## 4. Switch Planara to production

Because the board is now public, run it with secure cookies:

- Set `NODE_ENV=production` and `TRUST_PROXY=true` in your `.env`
  (or the `environment` block of your `docker-compose.yml`), then restart.

`TRUST_PROXY=true` tells Planara it sits behind a TLS-terminating proxy, so it
marks session cookies as `Secure` and reads the real client IP from the
`CF-Connecting-IP` header.

## 5. Update anything that points at the old address

If you previously used a temporary `*.trycloudflare.com` URL, replace it with
your fixed `https://board.your-domain.tld` everywhere it is referenced (for
example in an automation tool that calls the Planara API).

That is it: the board stays reachable at your fixed HTTPS address, the tunnel
starts with the machine, and the public URL never changes again.
