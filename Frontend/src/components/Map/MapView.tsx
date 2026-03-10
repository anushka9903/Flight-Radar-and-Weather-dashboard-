import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import { useStore } from "../../store";
import { Aircraft } from "../../types";
import { api } from "../../services/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Weather canvas renderer ───────────────────────────────────────────────────
// Instead of OWM tiles (need paid key), we render weather data from our backend
// as a beautiful canvas overlay — temperature gradient, wind particles, etc.

interface WeatherCellData {
  latitude: number; longitude: number;
  temperature: number; wind_speed: number; wind_direction: number;
  humidity: number; cloud_cover: number; visibility: number; condition: string;
}



function getAirlineColors(callsign: string | undefined | null): { body: string; stroke: string } {
  if (!callsign) return { body: "#111111", stroke: "#ffffff" };
  const cs = callsign.toUpperCase();

  // IndiGo - Blue / Light Blue
  if (cs.startsWith("IGO") || cs.startsWith("IFLY") || cs.startsWith("6E")) return { body: "#001B94", stroke: "#00E0FF" };
  // Air India - Red / Orange
  if (cs.startsWith("AIC") || cs.startsWith("AI")) return { body: "#ED1C24", stroke: "#F7941D" };
  // SpiceJet - Red / Yellow
  if (cs.startsWith("SEJ") || cs.startsWith("SG")) return { body: "#EB1C24", stroke: "#FCEE21" };
  // Vistara - Purple / Gold
  if (cs.startsWith("VTI") || cs.startsWith("UK")) return { body: "#3E103F", stroke: "#8C6A3E" };
  // Akasa Air - Orange/Purple
  if (cs.startsWith("AKJ") || cs.startsWith("QP")) return { body: "#FF6B00", stroke: "#7A00B7" };
  // Air Asia India / Air India Express
  if (cs.startsWith("IAD") || cs.startsWith("AXB") || cs.startsWith("IX")) return { body: "#FF0000", stroke: "#FFFFFF" };
  // Alliance Air
  if (cs.startsWith("LLR") || cs.startsWith("9I")) return { body: "#00AEEF", stroke: "#003A70" };
  // Emirates
  if (cs.startsWith("UAE") || cs.startsWith("EK")) return { body: "#FF0000", stroke: "#D4AF37" };
  // Qatar Airways
  if (cs.startsWith("QTR") || cs.startsWith("QR")) return { body: "#5C0632", stroke: "#B38B5D" };

  return { body: "#111111", stroke: "#ffffff" };
}

function makeIcon(ac: Aircraft, conflict: boolean, selected: boolean): L.DivIcon {
  const size = selected ? 26 : 20;

  let body = "#111111";
  let stroke = "#ffffff";

  if (conflict) {
    body = "#dd1111"; stroke = "#ff6666";
  } else if (selected) {
    body = "#0099cc"; stroke = "#00d4ff";
  } else {
    const colors = getAirlineColors(ac.callsign);
    body = colors.body; stroke = colors.stroke;
  }

  const sw = conflict ? 1.2 : 0.8;
  const heading = ac.heading;
  const shadow = conflict
    ? "filter:drop-shadow(0 0 6px #ff3333) drop-shadow(0 0 14px #ff000077);"
    : selected ? "filter:drop-shadow(0 0 5px #00d4ff99);"
      : "filter:drop-shadow(1px 1px 3px rgba(0,0,0,0.7));";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40"
    style="transform:rotate(${heading}deg);${shadow}display:block;">
    <ellipse cx="20" cy="20" rx="2.5" ry="13" fill="${body}" stroke="${stroke}" stroke-width="${sw}"/>
    <ellipse cx="20" cy="8" rx="2" ry="4" fill="${body}"/>
    <path d="M20 18 L4 28 L7 30 L20 22 L33 30 L36 28 Z" fill="${body}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
    <path d="M20 30 L13 36 L15 37 L20 33 L25 37 L27 36 Z" fill="${body}" stroke="${stroke}" stroke-width="${sw * 0.8}" stroke-linejoin="round"/>
    <ellipse cx="20" cy="9" rx="1" ry="1.5" fill="rgba(255,255,255,0.4)"/>
    ${conflict ? `<circle cx="20" cy="20" r="18" fill="none" stroke="#ff3333" stroke-width="1.5" opacity="0.6"/>` : ""}
    ${selected ? `<circle cx="20" cy="20" r="18" fill="none" stroke="#00d4ff" stroke-width="1.5" opacity="0.8"/>` : ""}
  </svg>`;

  return L.divIcon({ html: svg, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function makeTooltip(ac: Aircraft, conflict: boolean): string {
  const fl = ac.altitude > 100 ? `FL${Math.round(ac.altitude / 100).toString().padStart(3, "0")}` : "GND";
  const col = conflict ? "#ff8888" : "#00d4ff";
  const border = conflict ? "rgba(255,51,51,0.5)" : "rgba(0,212,255,0.3)";
  return `<div style="font-family:'Orbitron',monospace;font-size:10px;color:${col};
    background:rgba(6,10,22,0.94);border:1px solid ${border};padding:5px 11px;
    border-radius:6px;white-space:nowrap;pointer-events:none;box-shadow:0 2px 14px rgba(0,0,0,0.6);">
    ${conflict ? "⚠ " : ""}${ac.callsign ?? ac.icao}
    <br/><span style="color:#4a6a8a;font-size:8px">${fl} · ${Math.round(ac.velocity)} kts</span>
  </div>`;
}

// ── Wind particle system ──────────────────────────────────────────────────────
interface Particle { x: number; y: number; vx: number; vy: number; age: number; maxAge: number; }

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const prevPositions = useRef<Map<string, [number, number]>>(new Map());
  const animFrameRef = useRef<Map<string, number>>(new Map());
  const wxTileLayerRef = useRef<L.TileLayer | L.TileLayer[] | null>(null);
  const rainAnimTimerRef = useRef<number>(0);
  const windCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const windAnimRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const weatherDataRef = useRef<WeatherCellData[]>([]);

  const aircraft = useStore((s) => s.aircraft);
  const conflictIcaos = useStore((s) => s.conflictIcaos);
  const selectedIcao = useStore((s) => s.selectedIcao);
  const setSelectedIcao = useStore((s) => s.setSelectedIcao);
  const activeWeather = useStore((s) => s.activeWeatherMode);
  const weatherCells = useStore((s) => s.weatherCells);
  const theme = useStore((s) => s.theme);
  const baseLayerRef = useRef<L.TileLayer | null>(null);

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [20.5, 82.0], zoom: 5,
      zoomControl: false, attributionControl: false,
    });

    map.createPane("weatherPane");
    map.getPane("weatherPane")!.style.zIndex = "300";
    map.getPane("weatherPane")!.style.pointerEvents = "none";
    map.createPane("aircraftPane");
    map.getPane("aircraftPane")!.style.zIndex = "700";

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.scale({ position: "bottomleft", imperial: false }).addTo(map);

    // ── Weather canvas overlays ────────────────────────────────────────────
    const windCanvas = document.createElement("canvas");
    windCanvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:431;opacity:0;transition:opacity 0.4s ease";
    containerRef.current!.appendChild(windCanvas);
    windCanvasRef.current = windCanvas;

    // Resize canvases on map move/zoom
    const resizeCanvases = () => {
      const size = map.getSize();
      windCanvas.width = size.x; windCanvas.height = size.y;
    };
    map.on("moveend zoomend resize", resizeCanvases);
    resizeCanvases();

    // ── Map click → weather popup (always available) ─────────────────────
    map.on("click", async (e) => {
      setSelectedIcao(null);
      const { lat, lng } = e.latlng;

      const popup = L.popup({ className: "wx-popup", closeButton: true, minWidth: 230 })
        .setLatLng(e.latlng)
        .setContent(`<div class="wx-popup-loading">⏳ Fetching weather…</div>`)
        .openOn(map);

      try {
        const data = await api.getWeather();
        const cells = Array.isArray(data?.cells) ? data.cells : [];
        let nearestCell = null, minDist = Infinity;
        for (const c of cells) {
          const d = Math.hypot(c.data.latitude - lat, c.data.longitude - lng);
          if (d < minDist) { minDist = d; nearestCell = c.data; }
        }
        if (!nearestCell) throw new Error("No data");

        popup.setContent(`
          <div class="wx-popup-content">
            <div class="wx-popup-title">📍 ${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E</div>
            <div class="wx-popup-row"><span>🌡 Temp</span><b>${nearestCell.temperature.toFixed(1)}°C</b></div>
            <div class="wx-popup-row"><span>💨 Wind</span><b>${(nearestCell.wind_speed * 3.6).toFixed(1)} km/h</b></div>
            <div class="wx-popup-row"><span>💧 Humid</span><b>${nearestCell.humidity.toFixed(0)}%</b></div>
            <div class="wx-popup-row"><span>☁ Cover</span><b>${nearestCell.cloud_cover.toFixed(0)}%</b></div>
            <div class="wx-popup-row"><span>👁 Visibility</span><b>${((nearestCell.visibility ?? 0) / 1000).toFixed(1)} km</b></div>
            <div class="wx-popup-row"><span>🌤 Condition</span><b>${nearestCell.condition ?? "—"}</b></div>
          </div>`);
      } catch {
        popup.setContent(`<div class="wx-popup-error">⚠ Weather data unavailable</div>`);
      }
    });

    mapRef.current = map;
    return () => {
      cancelAnimationFrame(windAnimRef.current);
      map.remove(); mapRef.current = null; markersRef.current.clear();
    };
  }, [setSelectedIcao]);

  // ── Handle Theme Base Map Changes ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current);

    // Default map styles for light vs dark
    const isNight = theme === "night";
    const url = isNight
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    baseLayerRef.current = L.tileLayer(url, {
      subdomains: "abcd", maxZoom: 19,
    }).addTo(map);
  }, [theme]);

  // ── Sync weatherDataRef ───────────────────────────────────────────────────
  useEffect(() => {
    weatherDataRef.current = weatherCells.map(c => c.data);
  }, [weatherCells]);

  // ── Tile-based Weather Layers ─────────────────────────────────────────────
  const OWM_API_KEY = "45328962c2facdd9624dcc3499023068"; // OpenWeatherMap free API for demonstration

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Cleanup previous tile layers
    if (wxTileLayerRef.current) {
      if (Array.isArray(wxTileLayerRef.current)) {
        wxTileLayerRef.current.forEach(l => map.removeLayer(l));
      } else {
        map.removeLayer(wxTileLayerRef.current);
      }
      wxTileLayerRef.current = null;
    }
    clearTimeout(rainAnimTimerRef.current);

    const pane = map.getPane("weatherPane");
    if (pane) {
      if (activeWeather === "temperature" || activeWeather === "humidity") {
        pane.style.mixBlendMode = "multiply";
        pane.style.filter = "none";
      } else {
        pane.style.mixBlendMode = "normal";
        pane.style.filter = "none";
      }
    }

    if (activeWeather === "temperature") {
      wxTileLayerRef.current = L.tileLayer(`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`, {
        pane: "weatherPane", opacity: 1, keepBuffer: 2, className: "weather-tile-heavy"
      }).addTo(map);
    } else if (activeWeather === "clouds") {
      wxTileLayerRef.current = L.tileLayer(`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`, {
        pane: "weatherPane", opacity: 0.9, keepBuffer: 2, className: "weather-tile-clouds"
      }).addTo(map);
    } else if (activeWeather === "humidity") {
      wxTileLayerRef.current = L.tileLayer(`https://tile.openweathermap.org/map/humidity_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`, {
        pane: "weatherPane", opacity: 1, keepBuffer: 2, className: "weather-tile-heavy"
      }).addTo(map);
    } else if (activeWeather === "precipitation") {
      fetch("https://api.rainviewer.com/public/weather-maps.json")
        .then(r => r.json())
        .then(data => {
          if (useStore.getState().activeWeatherMode !== "precipitation" || !mapRef.current) return;
          const pastCoords = data.radar.past;
          const layers = pastCoords.map((frame: any) =>
            L.tileLayer(`https://tilecache.rainviewer.com/v2/radar/${frame.time}/256/{z}/{x}/{y}/2/1_1.png`, {
              pane: "weatherPane", opacity: 0, zIndex: 430
            }).addTo(mapRef.current!)
          );
          wxTileLayerRef.current = layers;

          let currentFrame = 0;
          const animateRadar = () => {
            if (!mapRef.current || useStore.getState().activeWeatherMode !== "precipitation") return;
            layers.forEach((l: L.TileLayer, i: number) => {
              l.setOpacity(i === currentFrame ? 0.75 : 0);
            });
            currentFrame = (currentFrame + 1) % pastCoords.length;
            rainAnimTimerRef.current = setTimeout(animateRadar, 1500) as unknown as number;
          };
          animateRadar();
        });
    }
  }, [activeWeather]);

  // ── Wind particle animation ───────────────────────────────────────────────
  const animateWeather = useCallback(() => {
    const map = mapRef.current;
    const canvas = windCanvasRef.current;
    if (!map || !canvas || activeWeather !== "wind") {
      if (canvas) canvas.style.opacity = "0";
      cancelAnimationFrame(windAnimRef.current);
      return;
    }

    const cells = weatherDataRef.current;
    if (!cells || cells.length === 0) {
      windAnimRef.current = requestAnimationFrame(animateWeather);
      return;
    }

    canvas.style.opacity = "1";
    const ctx = canvas.getContext("2d")!;
    const width = canvas.width;
    const height = canvas.height;

    const maxParticles = 3000;

    // Trail effect
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";

    // Spawn new particles
    if (particlesRef.current.length < maxParticles) {
      for (let i = 0; i < maxParticles / 20; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;

        const latlng = map.containerPointToLatLng([x, y]);
        let best = cells[0];
        let minD = Infinity;
        cells.forEach(c => {
          const d = Math.hypot(c.latitude - latlng.lat, c.longitude - latlng.lng);
          if (d < minD) { minD = d; best = c; }
        });

        if (!best) continue;

        // Use wind vector data (u/v components)
        const speed = best.wind_speed;
        const rad = ((best.wind_direction - 180) * Math.PI) / 180;
        const u = Math.sin(rad) * speed;
        const v = -Math.cos(rad) * speed;

        const vx = (u / 20) * 3;
        const vy = (v / 20) * 3;
        const maxAge = 40 + Math.random() * 60;

        particlesRef.current.push({ x, y, vx, vy, age: 0, maxAge });
      }
    }

    particlesRef.current = particlesRef.current.filter(p => p.age < p.maxAge && p.x >= -50 && p.x <= width + 50 && p.y >= -50 && p.y <= height + 50);

    particlesRef.current.forEach(p => {
      let alpha = Math.sin((p.age / p.maxAge) * Math.PI) * 0.95;
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const hue = speed < 1 ? 260 : speed < 2.5 ? 210 : 160;

      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * 4, p.y - p.vy * 4);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = `hsla(${hue},90%,70%,${alpha})`;
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      ctx.stroke();

      p.x += p.vx; p.y += p.vy; p.age++;
    });

    windAnimRef.current = requestAnimationFrame(animateWeather);
  }, [activeWeather]);

  // ── Trigger wind animation ────────────────────────────────────────────────
  useEffect(() => {
    cancelAnimationFrame(windAnimRef.current);
    particlesRef.current = [];
    if (activeWeather === "wind") {
      animateWeather();
    } else {
      if (windCanvasRef.current) windCanvasRef.current.style.opacity = "0";
    }
  }, [activeWeather, animateWeather]);

  // ── Smooth aircraft movement ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();

    aircraft.forEach((ac) => {
      seen.add(ac.icao);
      const isConflict = conflictIcaos.has(ac.icao);
      const isSelected = ac.icao === selectedIcao;
      const icon = makeIcon(ac, isConflict, isSelected);
      const targetLat = ac.latitude, targetLng = ac.longitude;

      const existing = markersRef.current.get(ac.icao);
      if (existing) {
        // Smooth interpolation to new position
        const prev = prevPositions.current.get(ac.icao);
        if (prev) {
          const [fromLat, fromLng] = prev;
          const steps = 20, duration = 14000; // 14s matches poll interval
          const stepTime = duration / steps;
          let step = 0;

          // Cancel any existing animation for this aircraft
          const existingFrame = animFrameRef.current.get(ac.icao);
          if (existingFrame) clearTimeout(existingFrame);

          const animate = () => {
            if (step >= steps) return;
            step++;
            const t = step / steps;
            const lat = fromLat + (targetLat - fromLat) * t;
            const lng = fromLng + (targetLng - fromLng) * t;
            existing.setLatLng([lat, lng]);
            const timer = setTimeout(animate, stepTime) as unknown as number;
            animFrameRef.current.set(ac.icao, timer);
          };
          animate();
        } else {
          existing.setLatLng([targetLat, targetLng]);
        }
        existing.setIcon(icon);
        existing.getTooltip()?.setContent(makeTooltip(ac, isConflict));
        existing.setZIndexOffset(isConflict ? 2000 : isSelected ? 1000 : 0);
      } else {
        const marker = L.marker([targetLat, targetLng], {
          icon, pane: "aircraftPane",
          zIndexOffset: isConflict ? 2000 : isSelected ? 1000 : 0,
        })
          .addTo(map)
          .bindTooltip(makeTooltip(ac, isConflict), {
            permanent: false, direction: "top", className: "ac-tooltip", offset: [0, -10],
          })
          .on("click", (ev) => {
            L.DomEvent.stopPropagation(ev);
            setSelectedIcao(ac.icao === useStore.getState().selectedIcao ? null : ac.icao);
          });
        markersRef.current.set(ac.icao, marker);
      }

      prevPositions.current.set(ac.icao, [targetLat, targetLng]);
    });

    markersRef.current.forEach((marker, icao) => {
      if (!seen.has(icao)) {
        marker.remove(); markersRef.current.delete(icao);
        prevPositions.current.delete(icao);
        const t = animFrameRef.current.get(icao);
        if (t) { clearTimeout(t); animFrameRef.current.delete(icao); }
      }
    });
  }, [aircraft, conflictIcaos, selectedIcao, setSelectedIcao]);

  return (
    <>
      <div ref={containerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      <style>{LEAFLET_CSS}</style>
    </>
  );
}

const LEAFLET_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap');
  .leaflet-container { cursor: crosshair !important; font-family: 'Orbitron', monospace; }
  .ac-tooltip { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
  .ac-tooltip::before { display: none !important; }
  .leaflet-tooltip.ac-tooltip { background: transparent !important; }
  .wx-popup .leaflet-popup-content-wrapper {
    background: rgba(6,10,22,0.96) !important; border: 1px solid rgba(0,212,255,0.35) !important;
    border-radius: 12px !important; box-shadow: 0 8px 32px rgba(0,0,0,0.7) !important; padding: 0 !important;
  }
  .wx-popup .leaflet-popup-content { margin: 0 !important; padding: 0 !important; }
  .wx-popup .leaflet-popup-tip { background: rgba(6,10,22,0.96) !important; }
  .wx-popup .leaflet-popup-close-button { color: #4a6a8a !important; font-size:18px !important; top:8px !important; right:10px !important; }
  .wx-popup .leaflet-popup-close-button:hover { color: #00d4ff !important; }
  .wx-popup-loading { font-family:'Orbitron',monospace; font-size:10px; color:#4a6a8a; padding:18px 20px; text-align:center; letter-spacing:1px; }
  .wx-popup-error { font-family:'Orbitron',monospace; font-size:10px; color:#ff6666; padding:14px 16px; text-align:center; }
  .wx-popup-content { font-family:'Orbitron',monospace; padding:14px 16px 12px; }
  .wx-popup-title { font-size:9px; letter-spacing:1.5px; color:#00d4ff; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid rgba(0,212,255,0.18); }
  .wx-popup-row { display:flex; justify-content:space-between; align-items:center; font-size:9px; color:#6a8aaa; padding:5px 0; border-bottom:1px solid rgba(255,255,255,0.04); }
  .wx-popup-row:last-child { border-bottom:none; }
  .wx-popup-row b { color:#d0e8ff; font-weight:500; }
  .leaflet-control-zoom { border:none !important; box-shadow:none !important; }
  .leaflet-control-zoom a { width:34px !important; height:34px !important; line-height:34px !important; background:rgba(6,10,22,0.88) !important; color:#00d4ff !important; border:1px solid rgba(0,212,255,0.22) !important; font-size:18px !important; transition:background 0.2s; }
  .leaflet-control-zoom a:first-child { border-radius:8px 8px 0 0 !important; margin-bottom:1px; }
  .leaflet-control-zoom a:last-child  { border-radius:0 0 8px 8px !important; }
  .leaflet-control-zoom a:hover { background:rgba(0,212,255,0.15) !important; }
  .leaflet-control-scale-line { background:rgba(6,10,22,0.82) !important; border:1px solid rgba(0,212,255,0.22) !important; border-top:none !important; color:#5a7a9a !important; font-family:'Orbitron',monospace !important; font-size:8px !important; padding:2px 7px !important; border-radius:0 0 6px 6px !important; }
  .weather-tile-heavy { 
    background-color: white !important; 
    filter: brightness(0.35) saturate(9.0) contrast(3.0) !important;
    transition: none !important;
    opacity: 1 !important;
  }
  .weather-tile-clouds { 
    filter: invert(1) hue-rotate(180deg) contrast(1.8) opacity(0.7) !important; 
    mix-blend-mode: multiply !important; 
    transition: none !important;
  }
`;
