import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import SkeletonCard from "../components/SkeletonCard";
import { apiFetch } from "../lib/api";

function StatCard({ to, label, value, accent = "blue", hint }) {
  const palette = {
    blue: "from-blue-50 to-blue-100 text-blue-900 dark:from-blue-900/30 dark:to-blue-900/10 dark:text-blue-100",
    amber: "from-amber-50 to-amber-100 text-amber-900 dark:from-amber-900/30 dark:to-amber-900/10 dark:text-amber-100",
    slate: "from-slate-50 to-slate-100 text-slate-800 dark:from-slate-800/60 dark:to-slate-800/20 dark:text-slate-100",
  };
  return (
    <Link
      to={to}
      className={`card group flex flex-col bg-gradient-to-br ${palette[accent]} transition hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium opacity-80">{label}</h2>
        <span
          aria-hidden
          className="text-xs opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-80"
        >
          →
        </span>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs opacity-70">{hint}</p>}
    </Link>
  );
}

function PriorityRow({ to, label, count, tone }) {
  const tones = {
    high: "bg-rose-50 text-rose-800 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-200 dark:hover:bg-rose-900/30",
    medium:
      "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-200 dark:hover:bg-amber-900/30",
    low: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-200 dark:hover:bg-emerald-900/30",
  };
  return (
    <Link
      to={to}
      className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition ${tones[tone]}`}
    >
      <span>{label}</span>
      <span className="text-base font-semibold">{count}</span>
    </Link>
  );
}

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    closed: 0,
    high: 0,
    medium: 0,
    low: 0,
  });

  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiFetch("/tickets");
        if (!res.ok) throw new Error("Failed to load dashboard data.");
        const data = await res.json();

        const open = data.filter((t) => t.status === "Open").length;
        const inProgress = data.filter((t) => t.status === "In Progress").length;
        const closed = data.filter((t) => t.status === "Closed").length;
        const high = data.filter((t) => t.priority === "High").length;
        const medium = data.filter((t) => t.priority === "Medium").length;
        const low = data.filter((t) => t.priority === "Low").length;

        setStats({ total: data.length, open, inProgress, closed, high, medium, low });
      } catch (err) {
        setError(err.message || "Could not load dashboard.");
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Dashboard unavailable" message={error} />;
  }

  const openShare = stats.total ? Math.round((stats.open / stats.total) * 100) : 0;
  const inProgShare = stats.total ? Math.round((stats.inProgress / stats.total) * 100) : 0;
  const closedShare = stats.total ? Math.round((stats.closed / stats.total) * 100) : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Real-time service health snapshot. Click any card to open the matching ticket queue.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          to="/tickets"
          label="Total Tickets"
          value={stats.total}
          accent="slate"
          hint="All statuses"
        />
        <StatCard
          to="/tickets?status=Open"
          label="Open Tickets"
          value={stats.open}
          accent="blue"
          hint={`${openShare}% of volume`}
        />
        <StatCard
          to="/tickets?status=In%20Progress"
          label="In Progress"
          value={stats.inProgress}
          accent="amber"
          hint={`${inProgShare}% of volume`}
        />
        <StatCard
          to="/tickets?status=Closed"
          label="Closed Tickets"
          value={stats.closed}
          accent="slate"
          hint={`${closedShare}% resolved`}
        />
      </div>

      <div className="card mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Priority Distribution</h2>
          <Link
            to="/tickets"
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-300"
          >
            View all →
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <PriorityRow to="/tickets?priority=High" label="High priority" count={stats.high} tone="high" />
          <PriorityRow to="/tickets?priority=Medium" label="Medium priority" count={stats.medium} tone="medium" />
          <PriorityRow to="/tickets?priority=Low" label="Low priority" count={stats.low} tone="low" />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
