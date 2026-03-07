import { useEffect, useState } from "react";
import { MapView }          from "./components/Map/MapView";
import { TopBar }           from "./components/TopBar/TopBar";
import { SidePanel }        from "./components/SidePanel/SidePanel";
import { DetailDrawer }     from "./components/Drawer/DetailDrawer";
import { useAircraftStream }  from "./hooks/useAircraftStream";
import { useWeatherLayer }    from "./hooks/useWeatherLayer";
import { useThemeBySunCycle } from "./hooks/useThemeBySunCycle";
import { useWebSocket }       from "./hooks/useWebSocket";
import { useStore }      from "./store";

export default function App() {
  const [booting, setBooting] = useState(true);
  const [bootOut, setBootOut] = useState(false);
  const theme = useStore((s) => s.theme);

  useAircraftStream();
  useWeatherLayer();
  useThemeBySunCycle();
  useWebSocket();

  useEffect(() => {
    const fadeOut = setTimeout(() => setBootOut(true), 2400);
    const remove  = setTimeout(() => setBooting(false), 3000);
    return () => { clearTimeout(fadeOut); clearTimeout(remove); };
  }, []);

  return (
    <div className="app-root" data-theme={theme}>
      {booting && (
        <div className={`boot-screen ${bootOut ? "boot-out" : ""}`}>
          <div className="boot-ring"><div className="boot-ring-inner">✈</div></div>
          <div className="boot-wordmark">AEROINTEL</div>
          <div className="boot-sub">AIRSPACE INTELLIGENCE PLATFORM</div>
          <div className="boot-bar"><div className="boot-bar-fill" /></div>
        </div>
      )}
      <div className="map-layer"><MapView /></div>
      <TopBar />
      <SidePanel />
      <DetailDrawer />
    </div>
  );
}
