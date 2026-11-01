"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext({ theme: "dark", setTheme: () => {} });
const STORAGE_KEY = "theme";

export function ThemeProvider({ children, defaultTheme = "dark", enableSystem = true }) {
  const [theme, setResolvedTheme] = useState(defaultTheme);

  const setTheme = useCallback((nextTheme) => {
    const preference = typeof nextTheme === "function" ? nextTheme(theme) : nextTheme;
    if (!["light", "dark", "system"].includes(preference)) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Theme preference remains active for this page even if storage is unavailable.
    }
    const resolved = preference === "system" && enableSystem
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : preference;
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
    setResolvedTheme(resolved);
  }, [enableSystem, theme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    let preference = defaultTheme;
    try {
      preference = window.localStorage.getItem(STORAGE_KEY) || defaultTheme;
    } catch {
      preference = defaultTheme;
    }

    const applyPreference = () => {
      const resolved = preference === "system" && enableSystem
        ? (media.matches ? "dark" : "light")
        : preference;
      document.documentElement.classList.toggle("dark", resolved === "dark");
      document.documentElement.style.colorScheme = resolved;
      setResolvedTheme(resolved);
    };
    const onSystemChange = () => {
      if (preference === "system" && enableSystem) applyPreference();
    };
    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      preference = event.newValue || defaultTheme;
      applyPreference();
    };

    applyPreference();
    media.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [defaultTheme, enableSystem]);

  const contextValue = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
