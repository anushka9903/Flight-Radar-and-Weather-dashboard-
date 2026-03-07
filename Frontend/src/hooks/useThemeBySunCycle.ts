import { useEffect } from "react";
import { useStore } from "../store";

export function useThemeBySunCycle() {
  const setTheme     = useStore((s) => s.setTheme);
  const manualTheme  = useStore((s) => s.manualTheme);

  useEffect(() => {
    if (manualTheme) return;

    const determineTheme = () => {
      const hour = new Date().getHours();
      // Daytime: 6am–7pm
      setTheme(hour >= 6 && hour < 19 ? "day" : "night");
    };

    determineTheme();
    const interval = setInterval(determineTheme, 60_000);
    return () => clearInterval(interval);
  }, [manualTheme, setTheme]);
}
