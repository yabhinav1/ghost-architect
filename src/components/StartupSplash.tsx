"use client";

import { useEffect, useState } from "react";
import { MascotLoader } from "@/components/MascotLoader";

/** A brief brand entrance on full page loads; route fallbacks handle actual navigation waits. */
export function StartupSplash() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 950;
    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  // CSS also dismisses it, so missing/delayed JavaScript cannot trap someone behind the splash.
  return <div className="startup-splash fixed inset-0 z-50 flex items-center justify-center bg-canvas print:hidden" aria-hidden="true"><MascotLoader /></div>;
}
