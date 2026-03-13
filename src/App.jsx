import { useEffect, useState } from "react";
import LoginScreen from "./features/auth/LoginScreen";
import Tracker from "./features/tracker/Tracker";
import useAuthUser from "./hooks/useAuthUser";
import { globalCSS } from "./constants/styles";
import LoadingScreen from "./components/ui/LoadingScreen";

const THEME_STORAGE_KEY = "resale-tracker-theme";
const DEFAULT_THEME = "default";
const AVAILABLE_THEMES = new Set([DEFAULT_THEME, "vercel-dark"]);

const getStoredTheme = () => {
  if (typeof window === "undefined") return DEFAULT_THEME;

  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY) || "";
    return AVAILABLE_THEMES.has(raw) ? raw : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

export default function App() {
  const { user, checking } = useAuthUser();
  const [theme, setTheme] = useState(() => getStoredTheme());

  useEffect(() => {
    if (typeof document === "undefined") return;

    const nextTheme = AVAILABLE_THEMES.has(theme) ? theme : DEFAULT_THEME;
    const root = document.documentElement;

    if (nextTheme === DEFAULT_THEME) root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", nextTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage issues (private mode, quota, etc).
    }
  }, [theme]);

  if (checking) {
    return <LoadingScreen fullBackground />;
  }

  return (
    <>
      <style>{globalCSS}</style>
      {user ? <Tracker user={user} theme={theme} onThemeChange={setTheme} /> : <LoginScreen />}
    </>
  );
}
