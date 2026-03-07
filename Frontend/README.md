# AeroIntel — Airspace Intelligence Platform

Production-ready frontend for the FlightRadar backend. Built with React + TypeScript + Mapbox GL JS.

---

## Prerequisites

- Node.js 18+ installed
- Backend running at `http://localhost:8000` (your Docker containers)
- Free Mapbox account (for the map)

---

## Step 1 — Get a Mapbox Token (Required)

1. Go to → https://account.mapbox.com/auth/signup
2. Create a free account
3. On the dashboard, copy your **Default public token** (starts with `pk.eyJ1...`)

---

## Step 2 — Configure Environment

Open `.env` in this folder and replace the Mapbox token:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_MAPBOX_TOKEN=pk.eyJ1...your_actual_token_here
```

---

## Step 3 — Install Dependencies

```bash
npm install
```

---

## Step 4 — Make Sure Backend is Running

```bash
# In your flight_radar folder:
cd path/to/flight_radar
docker-compose up -d
```

---

## Step 5 — Start the Frontend

```bash
npm run dev
```

Open → **http://localhost:3000**

---

## What You'll See

| Feature | Description |
|---|---|
| **Satellite map** | Realistic Mapbox satellite imagery of India |
| **Live aircraft dots** | Real aircraft from OpenSky, updated every 15s |
| **Click aircraft** | Opens right-side detail drawer |
| **Weather layers** | 5 weather overlay modes (Temp/Wind/Rain/Cloud/Humidity) |
| **Conflict alerts** | Red flashing panel when aircraft violate separation |
| **Day/Night theme** | Auto-switches based on time, manual toggle in topbar |
| **Risk assessment** | Per-aircraft conflict + weather + icing risk bars |

---

## Build for Production

```bash
npm run build
npm run preview
```

The `dist/` folder contains the static build ready for any web server.

---

## Folder Structure

```
src/
├── components/
│   ├── Map/MapView.tsx          — Mapbox map + all layers
│   ├── TopBar/TopBar.tsx        — Header with live stats
│   ├── Weather/WeatherPanel.tsx — Weather mode selector
│   ├── Conflicts/ConflictPanel.tsx — Conflict alert panel
│   └── Drawer/DetailDrawer.tsx  — Aircraft detail panel
├── hooks/
│   ├── useAircraftStream.ts     — Polls /api/v1/aircraft every 15s
│   ├── useWeatherLayer.ts       — Polls /api/v1/weather every 5min
│   ├── useThemeBySunCycle.ts    — Auto day/night by clock
│   └── useWebSocket.ts          — Optional WS with auto-reconnect
├── services/api.ts              — Axios client with auto-login
├── store/index.ts               — Zustand global state
├── types/index.ts               — All TypeScript types
├── utils/mapHelpers.ts          — GeoJSON builders + formatters
└── styles/global.css            — Complete design system
```
