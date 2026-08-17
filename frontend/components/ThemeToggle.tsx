"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Tooltip } from "radix-ui";
import { useEffect, useState } from "react";

const THEME_COLORS = {
  light: "#f3f2ed",
  dark: "#0e1013",
} as const;

export function ThemeRuntime() {
  const { theme } = useTheme();

  useEffect(() => {
    if (theme !== "light" && theme !== "dark") return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = THEME_COLORS[theme];
  }, [theme]);

  return null;
}

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && theme === "dark";
  const destination = isDark ? "light" : "dark";

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className="theme-toggle"
          data-theme-state={isDark ? "dark" : "light"}
          aria-label={`Switch to ${destination} theme`}
          aria-pressed={isDark}
          onClick={() => setTheme(destination)}
          disabled={!mounted}
        >
          <span className="theme-toggle-icon theme-toggle-icon-sun" aria-hidden="true"><Sun size={14} /></span>
          <span className="theme-toggle-track" aria-hidden="true"><span className="theme-toggle-thumb" /></span>
          <span className="theme-toggle-icon theme-toggle-icon-moon" aria-hidden="true"><Moon size={14} /></span>
          <span className="theme-toggle-label">{isDark ? "Dark" : "Light"}</span>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="torque-tooltip" side="bottom" sideOffset={8}>
          Switch to {destination} theme
          <Tooltip.Arrow className="torque-tooltip-arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
