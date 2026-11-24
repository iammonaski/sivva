import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "sivva:sidebar-collapsed";

function storageChange(key: string | null) {
  const event = new Event("storage");
  Object.defineProperty(event, "key", { value: key });
  return event;
}

// Supply only the browser storage/event environment; no app data is mocked.
function browserEnvironment(saved?: string) {
  const entries = new Map<string, string>();
  if (saved !== undefined) entries.set(STORAGE_KEY, saved);
  const browser = Object.assign(new EventTarget(), {
    localStorage: {
      getItem: vi.fn((key: string) => entries.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { entries.set(key, value); }),
    },
  });
  vi.stubGlobal("window", browser);
  return { browser, entries };
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("sidebar preference", () => {
  it("restores the saved collapse preference", async () => {
    browserEnvironment("true");
    const { getSidebarCollapsed } = await import("./sidebar-preference");
    expect(getSidebarCollapsed()).toBe(true);
  });

  it("persists a toggle, notifies subscribers and cleans up listeners", async () => {
    const { browser } = browserEnvironment();
    const { getSidebarCollapsed, setSidebarCollapsed, subscribeToSidebarPreference } = await import("./sidebar-preference");
    const onChange = vi.fn();
    const unsubscribe = subscribeToSidebarPreference(onChange);
    setSidebarCollapsed(true);
    expect(getSidebarCollapsed()).toBe(true);
    expect(browser.localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, "true");
    expect(onChange).toHaveBeenCalledOnce();
    unsubscribe();
    setSidebarCollapsed(false);
    browser.dispatchEvent(storageChange(STORAGE_KEY));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("follows another tab's preference and storage clearing", async () => {
    const { browser, entries } = browserEnvironment();
    const { getSidebarCollapsed, setSidebarCollapsed, subscribeToSidebarPreference } = await import("./sidebar-preference");
    const onChange = vi.fn();
    const unsubscribe = subscribeToSidebarPreference(onChange);
    setSidebarCollapsed(true);
    entries.set(STORAGE_KEY, "false");
    browser.dispatchEvent(storageChange(STORAGE_KEY));
    expect(getSidebarCollapsed()).toBe(false);
    entries.clear();
    browser.dispatchEvent(storageChange(null));
    expect(getSidebarCollapsed()).toBe(false);
    browser.dispatchEvent(storageChange("unrelated"));
    expect(onChange).toHaveBeenCalledTimes(3);
    unsubscribe();
  });

  it("keeps toggles functional when storage reads or writes are blocked", async () => {
    const { browser } = browserEnvironment("false");
    browser.localStorage.setItem.mockImplementation(() => { throw new Error("Storage blocked"); });
    const { getSidebarCollapsed, setSidebarCollapsed } = await import("./sidebar-preference");
    setSidebarCollapsed(true);
    expect(getSidebarCollapsed()).toBe(true);
    browser.localStorage.getItem.mockImplementation(() => { throw new Error("Storage blocked"); });
    setSidebarCollapsed(false);
    expect(getSidebarCollapsed()).toBe(false);
  });
});
