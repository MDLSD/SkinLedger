"use client";

import { useEffect, useState } from "react";

// Названия для анимации подсказки (печатаются и стираются по букве).
export const PLACEHOLDER_SKINS = [
  "AK-47 | Redline",
  "AWP | Dragon Lore",
  "M4A4 | Howl",
  "AWP | Asiimov",
  "Glock-18 | Fade",
  "Desert Eagle | Blaze",
  "Karambit | Doppler",
  "AK-47 | Fire Serpent",
  "USP-S | Kill Confirmed",
  "M4A1-S | Hyper Beast",
];

/**
 * Подсказка, которая печатается и стирается по букве; когда строка пуста —
 * показывает `idle`. Пока `active` false, анимация не идёт и подсказка равна
 * `idle` — так поле не мельтешит, когда пользователь в него уже пишет.
 */
export function useTypedPlaceholder(active: boolean, idle = "Поиск"): string {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let nameIdx = 0;
    let charIdx = 0;
    let phase: "typing" | "pause" | "deleting" | "idle" = "typing";
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (cancelled) return;
      const name = PLACEHOLDER_SKINS[nameIdx];
      let delay = 80;
      if (phase === "typing") {
        charIdx += 1;
        setTyped(name.slice(0, charIdx));
        if (charIdx >= name.length) {
          phase = "pause";
          delay = 1300;
        } else delay = 60 + Math.random() * 70;
      } else if (phase === "pause") {
        phase = "deleting";
        delay = 400;
      } else if (phase === "deleting") {
        charIdx -= 1;
        setTyped(name.slice(0, Math.max(0, charIdx)));
        if (charIdx <= 0) {
          phase = "idle";
          setTyped(idle);
          delay = 1000;
        } else delay = 35;
      } else {
        nameIdx = (nameIdx + 1) % PLACEHOLDER_SKINS.length;
        charIdx = 0;
        phase = "typing";
        delay = 250;
      }
      timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, idle]);

  return active ? typed || idle : idle;
}
