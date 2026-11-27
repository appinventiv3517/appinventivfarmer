import { useEffect, useState } from 'react';
import type { Weather } from '@/types';
import { HOME_COORDS } from '@/data/people';
import { openMeteoUrl, parseOpenMeteo, sampleWeather } from '@/lib/weather';

let cache: Weather | null = null;

/** Live weather for the Didi's cluster (Open-Meteo); a labelled sample forecast if it can't be reached. */
export function useWeather() {
  const [weather, setWeather] = useState<Weather | null>(cache);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    const label = HOME_COORDS.label;
    (async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(openMeteoUrl(HOME_COORDS.latitude, HOME_COORDS.longitude), { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) throw new Error('weather');
        cache = parseOpenMeteo(await res.json(), label);
      } catch {
        cache = sampleWeather(label);
      }
      if (alive) setWeather(cache);
    })();
    return () => {
      alive = false;
    };
  }, []);
  return weather;
}
