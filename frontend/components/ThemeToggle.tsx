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

  const activeTheme = mounted && (theme === "dark" || theme === "light") ? theme : "light";

  return (
    <div className="theme-switch" role="group" aria-label="Colour theme" data-ready={mounted ? "true" : "false"}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className={activeTheme === "light" ? "active" : ""}
            onClick={() => setTheme("light")}
            aria-label="Use light theme"
            aria-pressed={activeTheme === "light"}
            disabled={!mounted}
          >
            <Sun size={15} />
            <span>Light</span>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="torque-tooltip" side="bottom" sideOffset={8}>
            Light theme
            <Tooltip.Arrow className="torque-tooltip-arrow" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className={activeTheme === "dark" ? "active" : ""}
            onClick={() => setTheme("dark")}
            aria-label="Use dark theme"
            aria-pressed={activeTheme === "dark"}
            disabled={!mounted}
          >
            <Moon size={15} />
            <span>Dark</span>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="torque-tooltip" side="bottom" sideOffset={8}>
            Dark theme
            <Tooltip.Arrow className="torque-tooltip-arrow" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </div>
  );
}
