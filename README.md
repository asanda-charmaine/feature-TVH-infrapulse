# InfraPulse

*Improving infrastructure, improving lives.*

A hackathon prototype for municipal infrastructure reporting and maintenance operations (Tshwane / Pretoria demo data).

- **Citizen side** (no login): Home → Log Report → Report History
- **Technician side** (one-click demo login): Dashboard, Asset Registry, GIS Map, Reports, Work Orders, Data & Analytics, Notifications

## Run it

```bash
npm install
npm run dev        # web app on http://localhost:5173, email API on :8787
```

Production-style: `npm start` builds the app and serves it (plus the API) from http://localhost:8787.

The app is fully client-side (data lives in `localStorage`, seeded on first load, synced across tabs).
The small Express server in `server/` exists only to send SMTP emails. If it is not running, or SMTP is not configured,
the app simulates the email and shows *"Demo confirmation prepared for …"* — submission is never blocked.

## SMTP (optional)

Copy `.env.example` to `.env` and fill in:

```env
SMTP_HOST=  SMTP_PORT=587  SMTP_USERNAME=  SMTP_PASSWORD=
SMTP_FROM_EMAIL=  SMTP_FROM_NAME=InfraPulse  SMTP_USE_TLS=true
```

Preview the branded HTML email at http://localhost:8787/api/email/preview (`?type=update&status=Resolved` for status-update emails).
Status-update emails are also sent when a report is assigned, started or resolved and the citizen supplied an email.

## Demo script

**Citizen** (`/`)
1. *Log Report* → pick a category → use a demo photo. Try **Unrelated** first to see *Verification Failed*, then a matching photo.
2. *Use Demo Location* (or type / tap the map / current location) → optional email → review → submit → reference `INF-2026-…`.
3. *Report History* → open a report → read-only progress timeline.

**Technician** (click *Technician Login* on the public header — no credentials)
1. Dashboard: KPIs, priority issues, today's work orders, map preview.
2. *Reports*: search (`INF-2026-00421`, `Pretoria CBD`), filter, open a report.
3. **Evidence rule**: open `INF-2026-00416` (AI report with no photo) → *Create Work Order* → *Evidence Required* → attach an image.
4. Create a work order on any *Submitted/Verified* report → *Start Work* → *Complete Work*.
5. Pick a **Wrong asset** / **Blurry** / **Still damaged** demo repair photo (or *Simulate Off-Site*) to see verification fail; then a repaired photo to pass and enable *Mark as Completed*.
6. Completed work order shows BEFORE / AFTER; the report becomes *Resolved* (visible on the citizen side), the asset history updates and dashboard counts change.
7. *GIS Map*: layers, add / move / edit markers, mark maintenance areas. *Asset Registry*: search, filter, add / edit vehicles and assets.
8. *Data & Analytics*: charts, exports (CSV / Excel / PDF everywhere), **Upload CSV** (or *Use sample dataset*).

*Profile → Reset Demo Data* restores the seeded data.

## How the "AI" works (simulated)

No computer-vision model is used. Generated demo photos carry their true content; uploaded files are recognised by
file-name keywords (`pothole`, `traffic`, `street`, `cat`, `blur`, …); any other real photo is trusted to match.
Repair verification also checks distance between the technician's location and the reported site. Risk scores are
deterministic (severity band adjusted by asset condition, age and fault history). Swap `src/lib/ai.js` for a real model later.

## Structure

```
server/            Express + nodemailer, HTML email templates
src/lib/           store (state + actions), seed data, simulated AI, risk, geo, csv, exporters
src/components/    layouts, UI kit, charts, Leaflet map wrapper, forms/modals
src/pages/public/  citizen pages          src/pages/tech/  technician pages
```
