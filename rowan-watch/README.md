# Rowan Watch App — Setup Guide

A standalone watchOS app that auto-counts reps using the Apple Watch accelerometer
and syncs sets directly to your Rowan dashboard.

---

## Developer Account

| Account type | Certificate lifespan | Best for |
|---|---|---|
| Free Apple ID | 7 days — weekly reinstall | Testing |
| Paid ($99/yr) | 1 year | Daily use |

For a gym app you use every day, the paid account is worth it. Free works fine to try it out.

---

## Step 1 — Create the Xcode project

1. Open Xcode (16+ recommended)
2. **File → New → Project**
3. Choose platform **watchOS**, template **App**
4. Settings:
   - Product Name: `RowanWatch`
   - Bundle Identifier: `com.YOUR_NAME.RowanWatch` (anything works for personal use)
   - Interface: **SwiftUI**
   - Minimum Deployment: **watchOS 8.0**
5. Click **Next**, save inside the `rowan-watch/` folder
6. Xcode will generate default files — **delete** `RowanWatchApp.swift` and `ContentView.swift` from the project navigator (move to trash)
7. Drag all `.swift` files from `rowan-watch/RowanWatch Watch App/` into the Xcode project navigator
8. When prompted: **Add to target "RowanWatch Watch App"** ✓

---

## Step 2 — Fill in Constants.swift

Edit `Constants.swift`:

```swift
static let apiBase = "https://YOUR_APP.vercel.app"  // or http://192.168.x.x:3000 for local
static let apiKey  = "0372f4dc2e4a8a7f50409821deca16ff"   // your WORKOUT_API_KEY
static let userId  = "PASTE_YOUR_SUPABASE_USER_UUID"
```

**Finding your user UUID:**
Supabase Dashboard → Authentication → Users → click your email → copy the `UUID` at the top.

**Local development:**
If testing before deploying to Vercel, use your Mac's LAN IP instead of the Vercel URL:
```
System Settings → Wi-Fi → Details → IP Address
e.g. "http://192.168.1.42:3000"
```

---

## Step 3 — Add capability (Core Motion)

In Xcode:
1. Click the project in the navigator (top of file tree)
2. Select target **RowanWatch Watch App**
3. Tab: **Signing & Capabilities**
4. Click **+ Capability** → add **HealthKit** (needed for some watch sensor access)
5. Core Motion is available by default — no extra capability needed for accelerometer

---

## Step 4 — Build and install

1. Connect iPhone to Mac (the watch installs via iPhone)
2. In Xcode, select **RowanWatch Watch App** scheme + your Apple Watch as the run target
3. Press **▶ Run** (⌘R)
4. First run: Xcode may ask you to trust the developer certificate on your phone and watch

---

## Step 5 — Add WORKOUT_API_KEY to your dashboard

Add to `.env.local`:
```
WORKOUT_API_KEY=0372f4dc2e4a8a7f50409821deca16ff
```

For production, add this same key in Vercel Dashboard → Settings → Environment Variables.

---

## How it works

```
Exercise Picker (Push/Pull/Legs)
         ↓
Weight Input (scroll crown in 2.5kg steps)
         ↓
Start Set → Core Motion samples at 50Hz
         ↓
Schmitt-trigger counts reps + haptic on each rep
         ↓
Done → adjust count with crown if needed
         ↓
Log Set ✓ → POST /api/workouts/log-set
         ↓
Dashboard updates in real-time (Supabase Realtime)
```

---

## Tuning rep sensitivity (RepDetector.swift)

Default thresholds work well for compound lifts (bench, squat, curl).
If you're getting false counts or missing reps, adjust:

```swift
private let HIGH: Double = 0.35  // raise for slower/lighter movements
private let LOW:  Double = 0.15  // lower = more sensitive to eccentric
private let MIN_INTERVAL: TimeInterval = 0.5  // min seconds between reps
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "No exercises" | Check Constants.swift values, make sure `/api/seed` was called |
| Set logs but count is 0 | Check Xcode console — accelerometer may be unavailable in simulator |
| Network error | Verify apiBase URL and that the Next.js server is running |
| Weekly re-sign required | Upgrade to paid Apple Developer account |
