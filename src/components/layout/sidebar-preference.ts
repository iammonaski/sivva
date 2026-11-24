"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "sivva:sidebar-collapsed";
const CHANGE_EVENT = "sivva:sidebar-change";
let currentCollapsed: boolean | undefined;

export function getSidebarCollapsed() {
  if (currentCollapsed !== undefined) return currentCollapsed;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setSidebarCollapsed(collapsed: boolean) {
  // Keep the toggle working even when browser storage is blocked.
  currentCollapsed = collapsed;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  } catch {
    // The preference lasts for this session when storage is unavailable.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeToSidebarPreference(onChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY || event.key === null) {
      currentCollapsed = undefined;
      onChange();
    }
  }

  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

const getServerSnapshot = () => false;

export function useSidebarPreference() {
  return useSyncExternalStore(
    subscribeToSidebarPreference,
    getSidebarCollapsed,
    getServerSnapshot,
  );
}
