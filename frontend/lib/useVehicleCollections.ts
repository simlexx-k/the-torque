"use client";

import { useCallback, useEffect, useState } from "react";

const SAVED_KEY = "torque:saved-listings";
const COMPARE_KEY = "torque:compare-listings";
const EVENT_NAME = "torque:collections-change";

type CollectionKey = string | number;

function normalizeKey(value: CollectionKey): string {
  return String(value).trim();
}

function readIds(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed
          .map((value) => normalizeKey(value as CollectionKey))
          .filter((value) => value.length > 0),
      ),
    );
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]) {
  window.localStorage.setItem(key, JSON.stringify(ids));
  window.dispatchEvent(new Event(EVENT_NAME));
}

function aliases(primary: CollectionKey, legacy?: CollectionKey): string[] {
  return Array.from(
    new Set([normalizeKey(primary), legacy === undefined ? "" : normalizeKey(legacy)].filter(Boolean)),
  );
}

function includesAny(current: string[], candidates: string[]): boolean {
  return candidates.some((candidate) => current.includes(candidate));
}

export function useVehicleCollections() {
  const [saved, setSaved] = useState<string[]>([]);
  const [compare, setCompare] = useState<string[]>([]);

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

  const toggleSaved = useCallback((id: CollectionKey, legacyId?: CollectionKey) => {
    const current = readIds(SAVED_KEY);
    const candidates = aliases(id, legacyId);
    const selected = includesAny(current, candidates);
    const next = selected
      ? current.filter((value) => !candidates.includes(value))
      : [...current.filter((value) => !candidates.includes(value)), normalizeKey(id)];
    writeIds(SAVED_KEY, next);
    return !selected;
  }, []);

  const toggleCompare = useCallback((id: CollectionKey, legacyId?: CollectionKey) => {
    const current = readIds(COMPARE_KEY);
    const candidates = aliases(id, legacyId);
    if (includesAny(current, candidates)) {
      const next = current.filter((value) => !candidates.includes(value));
      writeIds(COMPARE_KEY, next);
      return { selected: false, full: false };
    }
    if (current.length >= 4) return { selected: false, full: true };
    writeIds(COMPARE_KEY, [...current, normalizeKey(id)]);
    return { selected: true, full: false };
  }, []);

  const clearSaved = useCallback(() => writeIds(SAVED_KEY, []), []);
  const clearCompare = useCallback(() => writeIds(COMPARE_KEY, []), []);

  return {
    saved,
    compare,
    isSaved: (id: CollectionKey, legacyId?: CollectionKey) => includesAny(saved, aliases(id, legacyId)),
    isCompared: (id: CollectionKey, legacyId?: CollectionKey) => includesAny(compare, aliases(id, legacyId)),
    toggleSaved,
    toggleCompare,
    clearSaved,
    clearCompare,
  };
}
