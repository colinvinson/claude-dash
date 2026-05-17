# Wake-up system setup (Alarmy + NFC + Rowan)

Rowan can't be the alarm (iOS PWA can't wake a sleeping phone, can't read
HealthKit sleep stages, can't loop alarm audio). The alarm itself lives
in **Alarmy**. Rowan owns the data + coaching layer:

- Apple Health → Oura already feeds sleep data into Rowan via the
  existing `/api/oura/poll` route → `health_logs`. No setup needed for
  the sleep-data side beyond having Oura connected.
- The **wake-confirm signal** (the new piece) — an NFC tag on the
  kitchen counter that dismisses Alarmy AND POSTs to Rowan in one act.
  This is what turns "did Sir get out of bed by target" into a
  tamper-resistant log that feeds scoring + Jarvis coaching.

This doc is rebuildable from scratch on a new phone. 10–15 min once.

---

## 1. Set wake target in Rowan

Open Rowan → Settings → Profile. Set **Wake target** (defaults
`07:30`). The NFC tap counts as "on-time" only if it fires at or before
this time.

## 2. Buy an NFC sticker

NTAG215 sticker (~$2 on Amazon). Examples: any "NTAG215 NFC tag
sticker" pack. iPhone reads them natively (iPhone 7+).

Stick it somewhere that requires a real walk away from bed:
- kitchen counter (recommended)
- fridge door
- bathroom mirror
- coffee maker

NOT on the bedside table — defeats the purpose.

## 3. Configure Alarmy

1. App Store → Alarmy. Premium isn't required for NFC dismiss
   (Premium adds photo-of-sky, math problems, etc.).
2. New alarm, set time to whatever you want to wake at.
3. Dismiss method → **NFC tag**. Alarmy walks you through scanning the
   tag once to bind it.
4. Test: set an alarm for 1 min from now, walk to the kitchen, tap the
   tag with the back of the phone. Alarm dismisses.

## 4. Set up the iOS Shortcut to POST wake-confirm

Open the **Shortcuts** app (built-in iOS app).

**New Shortcut: "Wake confirm"**
- Action 1: **Get contents of URL**
  - URL: `https://rowan-dashboard.vercel.app/api/wake-confirm`
  - Method: `POST`
  - Request body: `JSON`, empty object `{}`
  - Headers:
    - Key: `Authorization`
    - Value: `Bearer <YOUR_WAKE_CONFIRM_TOKEN>`
- (Optional) Action 2: **Open URL** → `https://rowan-dashboard.vercel.app/home`
  — opens Rowan to the morning brief right after the tap.

**Token:** generate any long random string, e.g. via
`openssl rand -hex 32` in a terminal. Set it in your Vercel project
as both:
- `WAKE_CONFIRM_TOKEN` = the random string
- `WAKE_CONFIRM_USER_ID` = your Supabase user ID (find via the SQL
  editor: `select id from auth.users where email = 'colinvinson@icloud.com';`)

Without these env vars the endpoint returns 503; that's intentional so
the route can't be hit anonymously by random web traffic.

## 5. Bind the Shortcut to the NFC tag

Two ways, pick one:

**Option A (recommended): Personal Automation**
1. Shortcuts app → **Automation** tab → `+` → **NFC**.
2. Scan the same kitchen tag.
3. Action: **Run Shortcut** → "Wake confirm".
4. Toggle off "Ask Before Running" so it fires silently when you tap.

This means a single tap of the kitchen tag dismisses Alarmy AND fires
the Shortcut.

**Option B: One tag dismisses, a second NFC tag (or location) fires
Rowan.** Slightly more annoying. Stick with A unless you hit a conflict.

## 6. Manual fallback

For the rare day NFC fails (forgot phone in kitchen, damaged tag), open
Rowan and use the manual confirm button (TODO: surface inline somewhere
visible). The `useWakeConfirm` hook exposes `confirmNow()` which writes
the row directly via the Supabase client and is RLS-protected.

---

## How Rowan uses this

- **Daily score** ([lib/scoring.ts](../lib/scoring.ts)): wake-on-time is
  a 10-weight component. Self-excludes when no wake_log exists (so you
  don't get penalized at 6am for not having tapped yet).
- **Jarvis context** ([lib/ai/context-builder.ts](../lib/ai/context-builder.ts)):
  `context.lifestyle.wake` carries target / confirmedToday / wakeAt /
  onTime / streak14d.
- **21-day snapshot CSV** ([lib/ai/snapshot-builder.ts](../lib/ai/snapshot-builder.ts)):
  `wake_on_time` column. The autonomous correlation engine picks up
  patterns like "wake_on_time correlates -0.6 with alcohol_drinks the
  night before" without anyone asking for it.
- **DayBrief**: existing prompt already calls out sleep state — once
  wake-confirm data accumulates, the brief naturally ties poor wake
  days to upstream causes (drinks, caffeine, late screen).

## Cost summary

- Apple Developer Program: **$0** (not native)
- Alarmy: free for NFC dismiss
- NFC tag: ~$2
- iCloud / iOS Shortcuts: $0
- Vercel + Supabase: existing
