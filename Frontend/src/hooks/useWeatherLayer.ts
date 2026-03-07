import { useEffect, useRef } from "react";
import { api } from "../services/api";
import { useStore } from "../store";

const WEATHER_POLL_MS = 300_000; // 5 minutes

export function useWeatherLayer() {
  const setWeatherCells      = useStore((s) => s.setWeatherCells);
  const setWeatherAdvisories = useStore((s) => s.setWeatherAdvisories);
  const intervalRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef           = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const fetchWeather = async () => {
      try {
        const [wRes, aRes] = await Promise.allSettled([
          api.getWeather(),
          api.getWeatherAdvisories(),
        ]);
        if (!mountedRef.current) return;
        if (wRes.status === "fulfilled") setWeatherCells(wRes.value.cells);
        if (aRes.status === "fulfilled") setWeatherAdvisories(aRes.value.advisories);
      } catch (e) {
        console.warn("[Weather] fetch error:", e);
      }
    };

    // Delay first weather fetch by 2s to not compete with aircraft fetch
    const init = setTimeout(() => {
      fetchWeather();
      intervalRef.current = setInterval(fetchWeather, WEATHER_POLL_MS);
    }, 2000);

    return () => {
      mountedRef.current = false;
      clearTimeout(init);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [setWeatherCells, setWeatherAdvisories]);
}
