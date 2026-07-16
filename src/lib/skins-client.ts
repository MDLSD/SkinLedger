"use client";

import { useEffect, useState } from "react";
import type { SkinFamily } from "@/lib/skin-search";

let indexPromise: Promise<SkinFamily[]> | null = null;

export function loadSkinsIndex(): Promise<SkinFamily[]> {
  if (!indexPromise) {
    indexPromise = fetch("/api/skins")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .catch((e) => {
        indexPromise = null;
        throw e;
      });
  }
  return indexPromise;
}

/** Индекс семейств скинов (кэшируется в модуле — один fetch на вкладку). */
export function useSkinsIndex(): SkinFamily[] | null {
  const [families, setFamilies] = useState<SkinFamily[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadSkinsIndex()
      .then((f) => alive && setFamilies(f))
      .catch(() => alive && setFamilies([]));
    return () => {
      alive = false;
    };
  }, []);
  return families;
}
