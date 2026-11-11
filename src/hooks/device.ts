import { useEffect, useRef, useState } from 'react';

/** Re-renders on an interval with the current time. Keep it in small leaf components. */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Keeps the screen awake while `active`. Re-acquires after the tab comes back. */
export function useWakeLock(active: boolean) {
  const lock = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let cancelled = false;
    const acquire = async () => {
      try {
        const l = await navigator.wakeLock.request('screen');
        if (cancelled) l.release();
        else lock.current = l;
      } catch {
        /* denied or unsupported: fine */
      }
    };
    const onVis = () => document.visibilityState === 'visible' && acquire();
    acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      lock.current?.release().catch(() => {});
      lock.current = null;
    };
  }, [active]);
}

/* ---------- sound & vibration ---------- */

let ctx: AudioContext | null = null;

/** Browsers only allow audio after a user gesture; call this from any tap. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* no audio */
  }
}

export function beep(freq = 880, durationS = 0.12, count = 1, gapS = 0.12) {
  if (!ctx) return;
  try {
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * (durationS + gapS);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + durationS);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + durationS + 0.02);
    }
  } catch {
    /* ignore */
  }
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}
