import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";

const stylesheet = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const darkBlock = stylesheet.match(/\.dark\s*\{([^}]+)\}/)?.[1] ?? "";
const darkTokens = Object.fromEntries(
  [...darkBlock.matchAll(/(--[\w-]+):\s*(#[\da-f]+);/gi)].map((match) => [match[1], match[2]]),
);

function contrast(first: string, second: string) {
  const luminance = (hex: string) => {
    const channels = hex.slice(1).match(/../g)!.map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

// Exercise the actual pre-hydration script against browser boundary inputs.
function initializeTheme({ savedTheme, systemDark }: { savedTheme: string | null; systemDark: boolean }) {
  const html = renderToStaticMarkup(<ThemeProvider><ThemeToggle /></ThemeProvider>);
  const script = html.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1];
  expect(script).toBeTruthy();
  const classes = new Set<string>();
  const root = {
    classList: {
      remove: (...values: string[]) => values.forEach((value) => classes.delete(value)),
      add: (value: string) => classes.add(value),
    },
    style: { colorScheme: "" },
  };
  runInNewContext(script!, {
    document: { documentElement: root },
    localStorage: { getItem: (key: string) => { expect(key).toBe("sivva-theme"); return savedTheme; } },
    window: { matchMedia: () => ({ matches: systemDark }) },
  });
  return { classes, colorScheme: root.style.colorScheme };
}

describe("app theme", () => {
  it("renders a stable, accessible toggle before hydration", () => {
    const html = renderToStaticMarkup(<ThemeProvider><ThemeToggle /></ThemeProvider>);
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-label="Dark mode"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('disabled=""');
    expect(html).toContain("dark:hidden");
    expect(html).toContain("hidden dark:block");
  });

  it.each([false, true])("follows system dark=%s before first paint", (systemDark) => {
    const result = initializeTheme({ savedTheme: null, systemDark });
    expect(result.classes.has(systemDark ? "dark" : "light")).toBe(true);
    expect(result.colorScheme).toBe(systemDark ? "dark" : "light");
  });

  it.each(["light", "dark"])("restores saved %s mode regardless of system preference", (savedTheme) => {
    const result = initializeTheme({ savedTheme, systemDark: savedTheme === "light" });
    expect(result.classes.has(savedTheme)).toBe(true);
    expect(result.colorScheme).toBe(savedTheme);
  });

  it("overrides every semantic color in dark mode", () => {
    const lightBlock = stylesheet.match(/:root\s*\{([^}]+)\}/)![1];
    for (const match of lightBlock.matchAll(/(--[\w-]+):\s*#[\da-f]+;/gi)) {
      expect(darkTokens, match[1]).toHaveProperty(match[1]);
    }
  });

  it.each([
    ["--foreground", "--background"],
    ["--foreground", "--surface"],
    ["--muted-foreground", "--surface"],
    ["--muted-foreground", "--muted"],
    ["--primary", "--surface"],
    ["--primary", "--accent"],
    ["--primary-foreground", "--primary"],
    ["--secondary-foreground", "--secondary"],
    ["--accent-foreground", "--accent"],
    ["--destructive-foreground", "--destructive"],
    ["--success", "--surface"],
    ["--warning", "--surface"],
    ["--destructive", "--surface"],
  ])("keeps %s text on %s at WCAG AA contrast", (foreground, background) => {
    expect(contrast(darkTokens[foreground], darkTokens[background])).toBeGreaterThanOrEqual(4.5);
  });
});
