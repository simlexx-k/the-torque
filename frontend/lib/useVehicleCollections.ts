"use client";

import { useCallback, useEffect, useState } from "react";

const SAVED_KEY = "torque:saved-listings";
const COMPARE_KEY = "torque:compare-listings";
const EVENT_NAME = "torque:collections-change";

function readIds(key: string): number[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.map(Number).filter((value) => Number.isFinite(value) && value > 0)));
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: number[]) {
  window.localStorage.setItem(key, JSON.stringify(ids));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function useVehicleCollections() {
  const [saved, setSaved] = useState<number[]>([]);
  const [compare, setCompare] = useState<number[]>([]);

  const sync = useCallback(() => {
    setSaved(readIds(SAVED_KEY));
    setCompare(readIds(COMPARE_KEY));
  }, []);

  useEffect(() => {
    sync();
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT_NAME, onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT_NAME, onStorage);
    };
  }, [sync]);

  const toggleSaved = useCallback((id: number) => {
    const current = readIds(SAVED_KEY);
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    writeIds(SAVED_KEY, next);
    return next.includes(id);
  }, []);

  const toggleCompare = useCallback((id: number) => {
    const current = readIds(COMPARE_KEY);
    if (current.includes(id)) {
      const next = current.filter((value) => value !== id);
      writeIds(COMPARE_KEY, next);
      return { selected: false, full: false };
    }
    if (current.length >= 4) return { selected: false, full: true };
    writeIds(COMPARE_KEY, [...current, id]);
    return { selected: true, full: false };
  }, []);

  const clearSaved = useCallback(() => writeIds(SAVED_KEY, []), []);
  const clearCompare = useCallback(() => writeIds(COMPARE_KEY, []), []);

  return {
    saved,
    compare,
    isSaved: (id: number) => saved.includes(id),
    isCompared: (id: number) => compare.includes(id),
    toggleSaved,
    toggleCompare,
    clearSaved,
    clearCompare,
  };
}
