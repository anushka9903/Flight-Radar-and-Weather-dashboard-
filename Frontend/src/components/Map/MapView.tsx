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

// Temperature color: cold=blue → mild=yellow → hot=red (like Zoom Earth)
function tempColor(t: number): string {
  if (t < 0)  return `rgba(30,80,200,0.75)`;
  if (t < 10) return `rgba(80,160,220,0.75)`;
  if (t < 20) return `rgba(160,220,160,0.75)`;
  if (t < 25) return `rgba(255,240,80,0.75)`;
  if (t < 30) return `rgba(255,180,40,0.75)`;
  if (t < 35) return `rgba(255,100,20,0.78)`;
  return `rgba(220,30,20,0.80)`;
}

// Humidity: dry=sand → wet=deep teal
function humidColor(h: number): string {
  if (h < 20) return `rgba(210,170,80,0.72)`;
  if (h < 40) return `rgba(180,200,100,0.72)`;
  if (h < 60) return `rgba(80,180,140,0.72)`;
  if (h < 80) return `rgba(30,130,160,0.75)`;
  return `rgba(10,80,140,0.78)`;
}

// Precipitation: none=transparent → heavy=purple
function rainColor(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes("thunderstorm") || c.includes("storm")) return `rgba(100,0,160,0.85)`;
  if (c.includes("heavy rain") || c.includes("heavy shower")) return `rgba(0,80,200,0.80)`;
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower")) return `rgba(0,160,255,0.70)`;
  if (c.includes("overcast") || c.includes("cloud")) return `rgba(100,130,180,0.45)`;
  return `rgba(0,0,0,0)`;
}

// Cloud: clear=transparent → overcast=blue-grey
function cloudColor(cover: number): string {
  if (cover < 10) return `rgba(0,0,0,0)`;
  if (cover < 30) return `rgba(180,200,230,0.30)`;
  if (cover < 60) return `rgba(120,150,200,0.50)`;
  if (cover < 85) return `rgba(80,110,170,0.65)`;
  return `rgba(50,70,140,0.78)`;
}

function makeIcon(heading: number, conflict: boolean, selected: boolean): L.DivIcon {
  const size = selected ? 26 : 20;
  const body = conflict ? "#dd1111" : selected ? "#0099cc" : "#111111";
  const stroke = conflict ? "#ff6666" : selected ? "#00d4ff" : "#ffffff";
  const sw = conflict ? 1.2 : 0.8;
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
  const containerRef     = useRef<HTMLDivElement>(null);
  const mapRef           = useRef<L.Map | null>(null);
  const markersRef       = useRef<Map<string, L.Marker>>(new Map());
  const prevPositions    = useRef<Map<string, [number, number]>>(new Map());
  const animFrameRef     = useRef<Map<string, number>>(new Map());
  const wxCanvasRef      = useRef<HTMLCanvasElement | null>(null);
  const windCanvasRef    = useRef<HTMLCanvasElement | null>(null);
  const windAnimRef      = useRef<number>(0);
  const particlesRef     = useRef<Particle[]>([]);
  const weatherDataRef   = useRef<WeatherCellData[]>([]);

  const aircraft         = useStore((s) => s.aircraft);
  const conflictIcaos    = useStore((s) => s.conflictIcaos);
  const selectedIcao     = useStore((s) => s.selectedIcao);
  const setSelectedIcao  = useStore((s) => s.setSelectedIcao);
  const activeWeather    = useStore((s) => s.activeWeatherMode);
  const weatherCells     = useStore((s) => s.weatherCells);

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

    // CartoDB Voyager — English labels
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.scale({ position: "bottomleft", imperial: false }).addTo(map);

    // ── Weather canvas overlays ────────────────────────────────────────────
    const wxCanvas = document.createElement("canvas");
    wxCanvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:300;opacity:0;transition:opacity 0.4s ease";
    containerRef.current!.appendChild(wxCanvas);
    wxCanvasRef.current = wxCanvas;

    const windCanvas = document.createElement("canvas");
    windCanvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:301;opacity:0;transition:opacity 0.4s ease";
    containerRef.current!.appendChild(windCanvas);
    windCanvasRef.current = windCanvas;

    // Resize canvases on map move/zoom
    const resizeCanvases = () => {
      const size = map.getSize();
      [wxCanvas, windCanvas].forEach(c => { c.width = size.x; c.height = size.y; });
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
            <div class="wx-popup-row"><span>🌡 Temperature</span><b>${nearestCell.temperature?.toFixed(1) ?? "—"}°C</b></div>
            <div class="wx-popup-row"><span>💨 Wind</span><b>${nearestCell.wind_speed?.toFixed(1) ?? "—"} m/s · ${Math.round(nearestCell.wind_direction ?? 0)}°</b></div>
            <div class="wx-popup-row"><span>💧 Humidity</span><b>${Math.round(nearestCell.humidity ?? 0)}%</b></div>
            <div class="wx-popup-row"><span>☁ Cloud Cover</span><b>${Math.round(nearestCell.cloud_cover ?? 0)}%</b></div>
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

  // ── Sync weatherDataRef ───────────────────────────────────────────────────
  useEffect(() => {
    weatherDataRef.current = weatherCells.map(c => c.data);
  }, [weatherCells]);

  // ── Draw weather canvas overlay ───────────────────────────────────────────
  const drawWeatherCanvas = useCallback(() => {
    const map = mapRef.current;
    const canvas = wxCanvasRef.current;
    if (!map || !canvas) return;

    const cells = weatherDataRef.current;
    if (!cells.length || activeWeather === "none" || activeWeather === "wind") {
      canvas.style.opacity = "0"; return;
    }

    const size = map.getSize();
    canvas.width = size.x; canvas.height = size.y;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw each weather cell as a large blurred circle
    cells.forEach(cell => {
      const pt = map.latLngToContainerPoint([cell.latitude, cell.longitude]);
      const zoom = map.getZoom();
      const radius = Math.max(60, 180 / Math.pow(2, zoom - 5));

      let color: string;
      switch (activeWeather) {
        case "temperature":   color = tempColor(cell.temperature); break;
        case "humidity":      color = humidColor(cell.humidity); break;
        case "precipitation": color = rainColor(cell.condition); break;
        case "clouds":        color = cloudColor(cell.cloud_cover); break;
        default: return;
      }
      if (color === "rgba(0,0,0,0)") return;

      const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
      grad.addColorStop(0, color);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });

    canvas.style.opacity = "1";
  }, [activeWeather]);

  // ── Wind particle animation ───────────────────────────────────────────────
  const animateWind = useCallback(() => {
    const map = mapRef.current;
    const canvas = windCanvasRef.current;
    if (!map || !canvas || activeWeather !== "wind") {
      if (canvas) canvas.style.opacity = "0";
      cancelAnimationFrame(windAnimRef.current);
      return;
    }

    const cells = weatherDataRef.current;
    const size = map.getSize();
    canvas.width = size.x; canvas.height = size.y;
    canvas.style.opacity = "1";
    const ctx = canvas.getContext("2d")!;

    // Spawn new particles
    if (particlesRef.current.length < 300) {
      for (let i = 0; i < 5; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        // Find nearest cell for wind at this position
        const latlng = map.containerPointToLatLng([x, y]);
        let best = cells[0];
        let minD = Infinity;
        cells.forEach(c => {
          const d = Math.hypot(c.latitude - latlng.lat, c.longitude - latlng.lng);
          if (d < minD) { minD = d; best = c; }
        });
        if (!best) continue;
        const spd = (best.wind_speed / 20) * 2.5;
        const rad = ((best.wind_direction - 180) * Math.PI) / 180;
        particlesRef.current.push({
          x, y,
          vx: Math.sin(rad) * spd,
          vy: -Math.cos(rad) * spd,
          age: 0,
          maxAge: 60 + Math.random() * 80,
        });
      }
    }

    // Blue-purple-green gradient bg for wind (like Zoom Earth)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bgGrad.addColorStop(0, "rgba(10,20,60,0.55)");
    bgGrad.addColorStop(0.5, "rgba(20,50,100,0.50)");
    bgGrad.addColorStop(1, "rgba(5,30,70,0.55)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw particles
    particlesRef.current = particlesRef.current.filter(p => p.age < p.maxAge);
    particlesRef.current.forEach(p => {
      const alpha = Math.sin((p.age / p.maxAge) * Math.PI) * 0.85;
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      // Color by speed: slow=purple, medium=blue, fast=cyan/green
      const hue = speed < 1 ? 260 : speed < 2 ? 210 : 160;
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * 4, p.y - p.vy * 4);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = `hsla(${hue},90%,70%,${alpha})`;
      ctx.lineWidth = 1.2;
      ctx.lineCap = "round";
      ctx.stroke();
      p.x += p.vx; p.y += p.vy; p.age++;
    });

    windAnimRef.current = requestAnimationFrame(animateWind);
  }, [activeWeather]);

  // ── Trigger weather rendering when mode/cells change ─────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    cancelAnimationFrame(windAnimRef.current);
    particlesRef.current = [];

    if (activeWeather === "wind") {
      if (wxCanvasRef.current) wxCanvasRef.current.style.opacity = "0";
      animateWind();
    } else {
      if (windCanvasRef.current) windCanvasRef.current.style.opacity = "0";
      drawWeatherCanvas();
      // Redraw on map move
      map.off("moveend zoomend", drawWeatherCanvas);
      if (activeWeather !== "none") map.on("moveend zoomend", drawWeatherCanvas);
    }
  }, [activeWeather, weatherCells, drawWeatherCanvas, animateWind]);

  // ── Smooth aircraft movement ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();

    aircraft.forEach((ac) => {
      seen.add(ac.icao);
      const isConflict = conflictIcaos.has(ac.icao);
      const isSelected = ac.icao === selectedIcao;
      const icon = makeIcon(ac.heading, isConflict, isSelected);
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
`;
