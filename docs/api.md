# Planara API reference

Planara ships a small JSON HTTP API. It is used by the web interface itself and
by external integrations (for example a Discord bot that files bug reports, or an
n8n workflow that turns incoming requests into board cards).

Everything is plain JSON over HTTP. There is no SDK and nothing to install - a
`curl` call or a `fetch` is all you need.

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Rate limiting](#rate-limiting)
- [Conventions](#conventions)
- [Endpoints](#endpoints)
  - [Bootstrap and read models](#bootstrap-and-read-models)
  - [Tasks](#tasks)
  - [Ideas](#ideas)
  - [Bug reports](#bug-reports)
  - [Bug media (images and videos)](#bug-media-images-and-videos)
  - [Converting ideas and bugs into tasks](#converting-ideas-and-bugs-into-tasks)
  - [Task images](#task-images)
  - [Serving uploaded files](#serving-uploaded-files)
  - [Changelogs](#changelogs)
- [Object shapes](#object-shapes)

## Base URL

All paths below are relative to your instance, for example:

```
https://planara.example.com/api/tasks
```

The application binds to `127.0.0.1` and is meant to sit behind a reverse proxy,
so the public base URL is whatever host the proxy serves.

## Authentication

There are two ways to authenticate. Every endpoint accepts one or both.

### 1. Bearer token (for integrations)

Create a token under **Settings > API tokens**. The plaintext token (prefixed
`plnr_`) is shown only once. Send it as a Bearer token:

```bash
curl -H "Authorization: Bearer plnr_xxxxxxxxxxxx" https://planara.example.com/api/tasks
```

Tokens have a scope:

| Scope | May call |
| --- | --- |
| **read** | `GET` endpoints (`/api/bootstrap`, `/api/tasks`, `/api/statuses`, `/api/branding`, `/api/ideas`, `/api/bugs`, and serving uploaded files) |
| **read/write** | everything a read token can, plus `POST /api/ideas`, `POST /api/bugs`, `POST /api/bugs/:id/media`, and creating/updating tasks and changelog entries |

Administrative configuration (roles, areas, branding, statuses, tokens, user
approval) is **never** available through a token - it requires a signed-in user
with the matching permission.

### 2. Session cookie (for the web UI / same-origin calls)

Signing in through `/api/auth/login` (or Discord) sets a `SameSite=Lax` session
cookie. Cookie-authenticated **write** requests must be same-origin: send an
`Origin` (or `Referer`) header that matches the host. Cross-origin write attempts
are rejected. Token-authenticated requests are exempt from this check.

## Rate limiting

- **Login** is limited to 10 failed attempts per IP per 15 minutes.
- **Registration** is limited to 5 attempts per IP per 30 minutes.
- **API tokens** can be limited with the `API_RATE_LIMIT` env var (requests per
  minute per token; `0` disables it). Session/UI requests are not affected.

When a limit is hit the API responds `429 Too Many Requests`.

## Conventions

- Request and response bodies are JSON. Send `Content-Type: application/json` on
  writes (the one exception is [bug media](#bug-media-images-and-videos), which
  is a raw binary upload).
- Success is `200`/`201`. Errors return a matching HTTP status and a body of the
  shape `{ "error": "human readable message" }`.
- Timestamps are ISO 8601 strings (UTC).
- IDs are UUID strings unless noted.

Common status codes: `400` invalid input, `401` not authenticated, `403`
missing permission, `404` not found, `409` conflict (for example a duplicate),
`413` upload too large, `429` rate limited.

## Endpoints

### Bootstrap and read models

#### `GET /api/bootstrap`

Returns everything the UI needs in one call: the current user, users, groups,
areas, tasks, ideas, bugs, changelogs, statuses and branding. Great for a first
sync.

#### `GET /api/branding`

Public. Returns the product name, tagline, logo/icon paths and colors.

#### `GET /api/statuses`

Returns the configured task statuses:

```json
{ "statuses": [
  { "id": "offen", "name": "Open", "color": "#8b5cf6", "isDefault": true, "isDone": false, "order": 0 },
  { "id": "abgeschlossen", "name": "Done", "color": "#22c55e", "isDefault": false, "isDone": true, "order": 3 }
] }
```

### Tasks

#### `GET /api/tasks`

Returns all tasks. See [Task object](#task).

#### `POST /api/tasks`  *(write)*

Creates a task. Requires the `create_task` permission (token or user).

```bash
curl -X POST https://planara.example.com/api/tasks \
  -H "Authorization: Bearer plnr_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix the login redirect",
    "description": "Users land on a blank page after login.",
    "priority": "hoch",
    "projectType": "kleinprojekt",
    "areaId": null,
    "assigneeIds": ["<userId>", "<userId>"]
  }'
```

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | required, max 100 |
| `description` | string | optional, no length limit |
| `roadmap` | string | optional, max 3000 |
| `priority` | `niedrig` \| `mittel` \| `hoch` \| `kritisch` | default `mittel` |
| `projectType` | `kleinprojekt` \| `mittelprojekt` \| `grossprojekt` | default `kleinprojekt` |
| `status` | string | a status id; defaults to the default status |
| `areaId` | string \| null | must be an existing area |
| `assigneeIds` | string[] | **zero or more** user ids. Each must be an approved user who belongs to the task's area. |

A task can be assigned to **several people**. `assigneeIds` is the canonical
field; the response also includes `assigneeId` (the first assignee, or `null`)
for backward compatibility. `assigneeId` is still accepted on input as a
single-value shortcut.

#### `PATCH /api/tasks/:id`  *(write)*

Two modes, selected by the `action` field:

- **Self-service actions** (available to the assignee, or with `claim_task` /
  `manage_tasks` as appropriate):
  - `{ "action": "claim" }` - claim an unassigned task for yourself.
  - `{ "action": "set_status", "status": "<statusId>" }`
  - `{ "action": "set_due_date", "dueDate": "2026-08-01" }`
  - `{ "action": "set_area", "areaId": "<areaId>" }`
- **General edit** (no `action`, requires `manage_tasks`): send any of `title`,
  `description`, `roadmap`, `priority`, `projectType`, `status`, `areaId`,
  `assigneeIds`. Sending `assigneeIds: []` clears all assignees.

### Ideas

#### `GET /api/ideas`

Returns all ideas, each annotated with its state: `converted` (whether a task
was created from it) and `taskStatus` (the linked task's status, or `null`).

#### `POST /api/ideas`  *(write)*

```json
{ "text": "It would be great to have dark mode." }
```

`text` is required (max 2000).

### Bug reports

#### `GET /api/bugs`

Returns all bug reports, each annotated with `converted` and `taskStatus` just
like ideas, plus a `media` array (see below).

#### `POST /api/bugs`  *(write)*

```json
{
  "subject": "Save button does nothing",
  "description": "Clicking Save on the profile page has no effect.",
  "importance": "hoch"
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `subject` | string | required, max 120 |
| `description` | string | required, max 3000 |
| `importance` | `niedrig` \| `mittel` \| `hoch` \| `kritisch` | default `mittel` |

Returns `{ "bug": { ... } }`. The new bug starts with an empty `media` array;
attach files with the next endpoint.

### Bug media (images and videos)

A bug can carry **up to 10** images or videos. Each file is uploaded as a
separate raw binary request (not multipart, not base64).

#### `POST /api/bugs/:id/media`  *(write)*

- Body: the raw file bytes.
- `Content-Type`: the file's MIME type. Allowed: `image/jpeg`, `image/png`,
  `image/webp`, `image/gif`, `video/mp4`, `video/webm`, `video/x-matroska`
  (`.mkv`), `video/quicktime` (`.mov`).
- `X-File-Name`: URL-encoded original file name (optional but recommended).
- Max 250 MB per file. The upload is rejected if the bytes do not match the
  declared type (magic-byte check).

```bash
curl -X POST "https://planara.example.com/api/bugs/$BUG_ID/media" \
  -H "Authorization: Bearer plnr_xxx" \
  -H "Content-Type: image/png" \
  -H "X-File-Name: screenshot.png" \
  --data-binary @screenshot.png
```

Response:

```json
{
  "media": { "id": "...", "url": "/uploads/reports/....png", "kind": "image", "mimeType": "image/png", "size": 12345, "originalName": "screenshot.png", "uploadedAt": "..." },
  "mediaList": [ /* all media on the bug so far */ ],
  "bug": { /* the updated bug */ }
}
```

Call the endpoint once per file to attach several. Uploading beyond 10 returns
`409`. Only the bug's author or a user with `create_task` may attach media.

> **MKV note:** `.mkv` files are stored and served, but in-browser playback of
> Matroska depends on the viewer's browser and codecs. Planara always offers a
> download in the media viewer as a fallback.

### Converting ideas and bugs into tasks

#### `POST /api/ideas/:id/convert` · `POST /api/bugs/:id/convert`  *(write)*

Requires `create_task`. Body is the same as `POST /api/tasks` (title,
description, assigneeIds, ...). Creates a task, links the source to it, and marks
the source as converted. When converting a **bug**, its uploaded media is copied
onto the new task as `reportMedia`, so the team sees the screenshots and clips
right on the task.

#### `DELETE /api/ideas/:id` · `DELETE /api/bugs/:id`

Deletes the source entry (author or `create_task`). Deleting a bug also removes
its uploaded media files.

### Task images

Separate from bug media, a task can hold up to 5 inline images.

- `POST /api/tasks/:id/images` *(write)* - JSON body `{ "name": "...", "mimeType": "image/png", "data": "data:image/png;base64,..." }` (`image/jpeg|png|webp|gif`, max 5 MB). Allowed to the task creator or `manage_tasks`.
- `DELETE /api/tasks/:id/images/:imageId` *(write, `manage_tasks`)*

### Serving uploaded files

#### `GET /uploads/reports/:file` · `GET /uploads/tasks/:file`

Serves an uploaded file. **Requires authentication** (`view_app`) - uploads are
not public. Supports HTTP range requests for video streaming. File names are
validated against a strict whitelist, so these paths cannot be used to reach
anything else on disk.

### Changelogs

- `GET /api/changelogs` - list entries.
- `POST /api/changelogs` *(write)* - submit an entry (`submit_changelog`).
- `POST /api/changelogs/push` - publish approved entries to the configured
  Discord webhook (`push_changelog`).

Fine-grained changelog moderation (`approve_changelog`, `delete_changelog`) is
reserved for signed-in users with those permissions.

## Object shapes

### Task

```json
{
  "id": "uuid",
  "title": "Fix the login redirect",
  "description": "…",
  "roadmap": "1. …",
  "priority": "hoch",
  "projectType": "kleinprojekt",
  "status": "offen",
  "dueDate": null,
  "areaId": null,
  "assigneeId": "uuid-or-null",
  "assigneeIds": ["uuid", "uuid"],
  "createdBy": "uuid",
  "images": [ { "id": "…", "url": "/uploads/tasks/….png", "originalName": "…", "size": 123 } ],
  "reportMedia": [ { "id": "…", "url": "/uploads/reports/….mp4", "kind": "video", "originalName": "…", "size": 123 } ],
  "notes": [ { "id": "…", "authorId": "…", "authorName": "…", "text": "…", "createdAt": "…" } ],
  "source": { "type": "bug", "id": "uuid" },
  "createdAt": "…",
  "updatedAt": "…"
}
```

### Bug

```json
{
  "id": "uuid",
  "subject": "Save button does nothing",
  "description": "…",
  "importance": "hoch",
  "media": [
    { "id": "…", "url": "/uploads/reports/….png", "kind": "image", "mimeType": "image/png", "originalName": "screenshot.png", "size": 12345, "uploadedAt": "…" }
  ],
  "authorId": "uuid",
  "authorName": "…",
  "taskId": "uuid-or-null",
  "converted": false,
  "taskStatus": null,
  "createdAt": "…",
  "updatedAt": "…"
}
```

`kind` is `"image"` or `"video"`. `media` is always an array (older single-file
bug reports are normalized to a one-element array on read).

### Idea

```json
{
  "id": "uuid",
  "text": "It would be great to have dark mode.",
  "authorId": "uuid",
  "authorName": "…",
  "taskId": "uuid-or-null",
  "converted": false,
  "taskStatus": null,
  "createdAt": "…",
  "updatedAt": "…"
}
```
