import { useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';

interface Options {
  onTap?: () => void;
  /** Fires once after holdMs, then every repeatMs while still held (if repeatMs is set). */
  onHold?: () => void;
  holdMs?: number;
  repeatMs?: number;
  onPressChange?: (pressing: boolean) => void;
}

/**
 * Tap / hold handling that only fires for presses that *started* on this element,
 * so lifting a finger after the layout changes underneath it never triggers anything.
 */
export function useHoldPress({ onTap, onHold, holdMs = 450, repeatMs, onPressChange }: Options) {
  const state = useRef({ armed: false, held: false, timer: 0, repeat: 0 });
  const cb = useRef({ onTap, onHold, onPressChange });
  cb.current = { onTap, onHold, onPressChange };

  const stop = () => {
    const st = state.current;
    clearTimeout(st.timer);
    clearInterval(st.repeat);
    if (st.armed) cb.current.onPressChange?.(false);
    st.armed = false;
  };

  useEffect(() => stop, []);

  return {
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const st = state.current;
      stop();
      st.armed = true;
      st.held = false;
      cb.current.onPressChange?.(true);
      if (cb.current.onHold) {
        st.timer = window.setTimeout(() => {
          st.held = true;
          cb.current.onHold?.();
          if (repeatMs) st.repeat = window.setInterval(() => cb.current.onHold?.(), repeatMs);
          else stop();
        }, holdMs);
      }
    },
    onPointerUp: () => {
      const st = state.current;
      const tap = st.armed && !st.held;
      stop();
      if (tap) cb.current.onTap?.();
    },
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e: PointerEvent | React.MouseEvent) => e.preventDefault(),
  };
}
