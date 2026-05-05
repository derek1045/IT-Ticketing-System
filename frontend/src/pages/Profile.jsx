import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";
import SkeletonCard from "../components/SkeletonCard";
import { apiFetch } from "../lib/api";

export default function Profile() {
  const { userId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [reputation, setReputation] = useState(null);
  const [level, setLevel] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [p, m, r, l] = await Promise.all([
          apiFetch(`/profiles/${userId}`),
          apiFetch(`/profiles/${userId}/metrics?range=30`),
          apiFetch(`/profiles/${userId}/reputation`),
          apiFetch(`/profiles/${userId}/level`),
        ]);
        if (!p.ok) throw new Error("Profile not found.");
        const pj = await p.json();
        const mj = m.ok ? await m.json() : { series: [] };
        const rj = r.ok ? await r.json() : { totalPoints: 0, events: [] };
        const lj = l.ok ? await l.json() : null;
        if (!cancelled) {
          setSummary(pj);
          setMetrics(mj);
          setReputation(rj);
          setLevel(lj);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }
  if (error) return <EmptyState title="Profile unavailable" message={error} />;
  if (!summary) return <EmptyState title="Profile unavailable" message="No data." />;

  const u = summary.user;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{u.display_name}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          @{u.username} · Support performance and knowledge contribution
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="neutral">{u.role}</Badge>
          {level && (
            <Badge tone="progress">
              Level {level.level_number}: {level.level_name}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total points</h2>
          <p className="mt-2 text-2xl font-semibold">{reputation?.totalPoints ?? 0}</p>
          <p className="mt-1 text-xs text-slate-500">Quality-adjusted reputation ledger</p>
        </div>
        <div className="card">
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">Progress to next tier</h2>
          <p className="mt-2 text-2xl font-semibold">
            {level ? `${Number(level.progress_percent).toFixed(0)}%` : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">Based on rolling contribution score</p>
        </div>
        <div className="card">
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">Badges earned</h2>
          <p className="mt-2 text-2xl font-semibold">{summary.badges?.length ?? 0}</p>
          <p className="mt-1 text-xs text-slate-500">Criteria-based recognitions</p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold">Badges</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(summary.badges || []).length === 0 && (
            <p className="text-sm text-slate-500">No badges yet.</p>
          )}
          {(summary.badges || []).map((b) => (
            <Badge key={b.code} tone="neutral">
              {b.name}
            </Badge>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold">Daily metrics (last {metrics?.rangeDays ?? 30} days)</h2>
        <div className="mt-3 max-h-56 overflow-auto text-sm">
          {(metrics?.series || []).length === 0 ? (
            <p className="text-slate-500">No daily metrics recorded yet.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Resolved</th>
                  <th className="py-2 pr-2">Completion %</th>
                  <th className="py-2">SLA breaches</th>
                </tr>
              </thead>
              <tbody>
                {metrics.series.map((row) => (
                  <tr key={String(row.metric_date)} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-1 pr-2">{String(row.metric_date)}</td>
                    <td className="py-1 pr-2">{row.tickets_resolved}</td>
                    <td className="py-1 pr-2">{row.completion_rate ?? "—"}</td>
                    <td className="py-1">{row.sla_breaches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold">Reputation timeline</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(reputation?.events || []).length === 0 && (
            <li className="text-slate-500">No reputation events yet.</li>
          )}
          {(reputation?.events || []).map((ev) => (
            <li key={ev.id} className="flex justify-between gap-4 border-b border-slate-100 pb-2 dark:border-slate-800">
              <span>
                <span className="font-medium">{ev.reason_code}</span>
                <span className="text-slate-500"> · {ev.source_entity_type}</span>
              </span>
              <span className={ev.points_delta > 0 ? "text-emerald-600" : "text-rose-600"}>
                {ev.points_delta > 0 ? "+" : ""}
                {ev.points_delta}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
