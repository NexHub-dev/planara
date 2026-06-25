# Automation recipe: incoming requests with n8n, Telegram and email

This is an example of how to wire Planara into an automation pipeline using its
API. A request arrives (for example from a website form), you get an instant
Telegram message with action buttons, the sender receives an automatic email,
and a card is created or updated on the board - all without opening the board by
hand.

It uses only documented, read/write API endpoints, so it works with a stock
Planara install. The automation tool used here is [n8n](https://n8n.io), but any
tool that can call HTTP endpoints works the same way.

```
 Visitor        Website backend        Automation (n8n)           Targets
 [ form ]  -->  [ stores + fires  -->  [ workflows ]  --> Telegram (alert + buttons)
                  a webhook ]                          --> Email to the sender
                                                       --> Planara board (create / update card)
```

## Building blocks

- A website form plus a small backend that stores the request and fires a
  webhook to n8n.
- n8n (cloud or self-hosted) holding the workflows.
- A Telegram bot for notifications and action buttons.
- An SMTP mailbox for sending email.
- A publicly reachable Planara instance so n8n can call its API. If Planara only
  runs locally, expose it first (see
  [Hosting behind a Cloudflare Tunnel](cloudflare-tunnel.md)) or run n8n locally too.

Store every secret as an n8n credential, never hard-coded in a node: the
Telegram bot token, the SMTP login, and an HTTP header auth credential for
Planara (`Authorization: Bearer <PLANARA_API_TOKEN>`).

## The Planara API for these workflows

Base URL: your public Planara address. Authentication: header
`Authorization: Bearer <PLANARA_API_TOKEN>`. Create the token in Planara under
**Settings > API tokens** as a **read/write** token (it is shown only once, so
save it straight into the n8n credential).

- `POST /api/tasks` - create a card: `{ title, description, status, projectType?, priority? }`
- `PATCH /api/tasks/:id` with `{ action: "set_status", status: "<STATUS_ID>" }` - set the status
- `POST /api/tasks/:id/notes` with `{ text }` - add a history note
- `GET /api/tasks`, `GET /api/statuses` - read

> Status IDs are instance specific and change if you recreate a status. Fetch
> them once with `GET /api/statuses` and keep a "status name to ID" map in a
> single code node, so you only maintain the mapping in one place.

## The workflows

Lay out several independent flows, each starting with its own trigger.

### Flow 1 - new request (intake)

`Webhook (POST)` -> `Telegram: send message` -> `Email` -> `Email 2`

- The webhook receives the request from your website backend.
- Telegram sends you the new request with inline action buttons.
- The two email nodes send, for example, a confirmation to the sender plus an
  internal copy.
- Optionally add `POST /api/tasks` here to create the board card immediately.

Secure the webhook with a shared secret or HMAC so not just anyone can POST to it.

### Flow 2 - Telegram actions (buttons)

`Telegram Trigger (callback_query)` -> `Code` -> `HTTP Request (Planara API)` -> `Telegram: send message` -> `Email`

- The Telegram trigger reacts to button clicks from Flow 1.
- The code node reads the button id (for example `setstatus:review`) and decides
  the next action. Clean inputs with `.trim()` to avoid whitespace bugs.
- The HTTP request calls the Planara API (`PATCH /api/tasks/:id` to set a status,
  or add a note).
- Telegram and email confirm the action and notify the sender.

### Flow 3 - sender reply / appointment

`Webhook (POST)` -> `Code` -> `HTTP Request (Planara API)` -> `Email`

Receives a reply (for example a link clicked in an email), works out what to do,
updates the card, and confirms by email.

### Flows 4 and 5 - simple notification hooks

`Webhook (POST)` -> `Telegram: send message`

Thin hooks for single events ("payment received", "training confirmed") that
only need to drop a short Telegram message. One webhook per event type.

## Telegram setup

### Create the bot

1. Open **@BotFather** in Telegram, run `/newbot`, pick a name and username.
2. You receive the **bot token** - keep it secret.
3. Add it in n8n under **Credentials > Telegram API**. Every Telegram node uses
   this credential.

### Find the chat ID

1. Send the bot `/start` once (or add it to a group).
2. Open `https://api.telegram.org/bot<TG_BOT_TOKEN>/getUpdates` in a browser.
3. Read `chat.id` from the response (group IDs are negative).

### Message with buttons (Flow 1)

In the Telegram "send message" node set the chat ID and the request text, then
add inline buttons via Reply Markup. Each button carries a `callback_data` id
that you evaluate later:

```json
{
  "inline_keyboard": [
    [ { "text": "In review", "callback_data": "setstatus:review" } ],
    [ { "text": "Suggest appointment", "callback_data": "action:appointment" } ],
    [ { "text": "Small", "callback_data": "settrack:small" },
      { "text": "Large", "callback_data": "settrack:large" } ],
    [ { "text": "Close", "callback_data": "setstatus:done" } ]
  ]
}
```

> `callback_data` is limited to 64 bytes. Use short ids and append a record id
> only if needed, for example `setstatus:review:<recordId>`.

### Handle button clicks (Flow 2)

Set the Telegram trigger to `callback_query`. In the code node, split the id and
decide the action:

```js
// n8n code node (simplified)
const data = $json.callback_query.data || "";
const [command, value, recordId] = data.split(":").map((s) => s.trim());
return [{ json: { command, value, recordId } }];
```

Then map `value` through your status map to the real `<STATUS_ID>` and call
`PATCH /api/tasks/:id` with `{ action: "set_status", status: "<STATUS_ID>" }`.
Optionally call `answerCallbackQuery` so the button stops showing its spinner.

## Security notes

- Keep tokens and passwords as n8n credentials only, never in node text or chat.
- Protect every webhook with a shared secret or HMAC.
- If a secret leaks, rotate it immediately (revoke the Telegram token in
  BotFather, delete and recreate the Planara API token, change the SMTP password).
- Run the board behind HTTPS (secure cookies) and expose only the paths you need.

## Suggested go-live order

1. Board public over HTTPS, API token created.
2. Telegram bot and SMTP set up in n8n.
3. Build and test Flows 1, 4 and 5 (Telegram / email) - these work without the
   board connection.
4. Add the board connection (Flows 2 and 3, HTTP request to the API), set the
   status map.
5. Point the website backend at the real webhook URL.
6. Run real test requests, then clean up the test cards.
