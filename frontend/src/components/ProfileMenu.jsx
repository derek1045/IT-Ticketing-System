import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";

export default function ProfileMenu() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useUI();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const initials = user.username
    ? user.username.slice(0, 2).toUpperCase()
    : "??";
  const profilePath = user.id ? `/profiles/${user.id}` : null;
  const roleLabel =
    user.role === "admin"
      ? "Admin"
      : user.role === "technician"
        ? "Technician"
        : "Requester";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-semibold text-white shadow-sm ring-1 ring-slate-200 transition hover:shadow dark:ring-slate-700"
        title={user.username}
      >
        {initials}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-64 origin-top-right rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="rounded-lg px-3 py-2">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {user.displayName || user.username}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              @{user.username} · {roleLabel}
            </p>
          </div>
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          {profilePath && (
            <Link
              to={profilePath}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              role="menuitem"
            >
              My profile
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setTheme(theme === "dark" ? "light" : "dark");
            }}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            role="menuitem"
          >
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            <span className="text-xs text-slate-400">
              {theme === "dark" ? "☀" : "☾"}
            </span>
          </button>
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-900/30"
            role="menuitem"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
