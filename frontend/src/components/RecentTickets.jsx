import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiFetch } from "../lib/api";

const PRIORITY_DOT = {
  High: "bg-rose-500",
  Medium: "bg-amber-500",
  Low: "bg-emerald-500",
};

const STATUS_LABEL = {
  Open: "text-emerald-600 dark:text-emerald-300",
  "In Progress": "text-blue-600 dark:text-blue-300",
  Closed: "text-slate-500 dark:text-slate-400",
};

function timeAgo(dateString) {
  if (!dateString) return "";
  const then = new Date(dateString).getTime();
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

export default function RecentTickets({ limit = 5, onNavigate }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiFetch("/tickets");
        if (!res.ok) throw new Error("load_failed");
        const data = await res.json();
        if (!cancelled) {
          setTickets(Array.isArray(data) ? data.slice(0, limit) : []);
        }
      } catch {
        if (!cancelled) setError("Could not load recent tickets.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [limit, location.pathname]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Recent tickets
        </p>
        <Link
          to="/tickets"
          onClick={onNavigate}
          className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-300"
        >
          View all
        </Link>
      </div>

      {loading && (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800"
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="px-1 text-xs text-rose-600 dark:text-rose-300">{error}</p>
      )}

      {!loading && !error && tickets.length === 0 && (
        <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
          No tickets yet.
        </p>
      )}

      {!loading && !error && tickets.length > 0 && (
        <ul className="space-y-1">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                to={`/tickets/${t.id}`}
                onClick={onNavigate}
                className="group flex items-start gap-2 rounded-md px-2 py-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                title={t.title}
              >
                <span
                  className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                    PRIORITY_DOT[t.priority] || "bg-slate-400"
                  }`}
                  aria-label={`${t.priority} priority`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-300">
                    {t.title}
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2 text-[11px]">
                    <span
                      className={`truncate ${
                        STATUS_LABEL[t.status] || "text-slate-500"
                      }`}
                    >
                      #{t.id} · {t.status}
                    </span>
                    <span className="shrink-0 text-slate-400">
                      {timeAgo(t.created_at)}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
