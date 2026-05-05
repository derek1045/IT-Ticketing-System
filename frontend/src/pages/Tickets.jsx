import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";
import SkeletonCard from "../components/SkeletonCard";
import { useUI } from "../context/UIContext";
import { apiFetch } from "../lib/api";

const STATUS_OPTIONS = ["All", "Open", "In Progress", "Closed"];
const PRIORITY_OPTIONS = ["All", "High", "Medium", "Low"];
const SORT_OPTIONS = ["Newest First", "Oldest First", "Highest Priority"];

function Tickets() {
  const { addToast, globalSearch } = useUI();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialStatus = STATUS_OPTIONS.includes(searchParams.get("status"))
    ? searchParams.get("status")
    : "All";
  const initialPriority = PRIORITY_OPTIONS.includes(searchParams.get("priority"))
    ? searchParams.get("priority")
    : "All";

  const [tickets, setTickets] = useState([]);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState(initialPriority);
  const [sort, setSort] = useState("Newest First");
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [savedView, setSavedView] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  const PAGE_SIZE = 6;

  const fetchTickets = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/tickets");
      if (!res.ok) throw new Error("Failed to fetch tickets.");
      const data = await res.json();
      setTickets(data);
    } catch (err) {
      setError(err.message || "Unable to load tickets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    if (globalSearch) {
      setQuery(globalSearch);
    }
  }, [globalSearch]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, priorityFilter, sort, query]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (statusFilter && statusFilter !== "All") next.set("status", statusFilter);
    else next.delete("status");
    if (priorityFilter && priorityFilter !== "All") next.set("priority", priorityFilter);
    else next.delete("priority");
    if (query) next.set("q", query);
    else next.delete("q");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter, query]);

  const saveCurrentView = () => {
    const viewName = window.prompt("Save this view as:");
    if (!viewName) return;
    localStorage.setItem(
      `view:${viewName}`,
      JSON.stringify({ statusFilter, priorityFilter, sort, query })
    );
    setSavedView(viewName);
    addToast(`Saved view "${viewName}"`);
  };

  const applySavedView = (name) => {
    setSavedView(name);
    if (!name) return;
    const raw = localStorage.getItem(`view:${name}`);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    setStatusFilter(parsed.statusFilter || "All");
    setPriorityFilter(parsed.priorityFilter || "All");
    setSort(parsed.sort || "Newest First");
    setQuery(parsed.query || "");
  };

  const savedViews = useMemo(
    () =>
      Object.keys(localStorage)
        .filter((key) => key.startsWith("view:"))
        .map((key) => key.replace("view:", "")),
    [tickets.length]
  );

  const filteredTickets = useMemo(
    () =>
      tickets
        .filter((ticket) => {
          if (statusFilter !== "All" && ticket.status !== statusFilter) return false;
          if (priorityFilter !== "All" && ticket.priority !== priorityFilter) return false;
          if (
            query &&
            !`${ticket.title} ${ticket.description} ${ticket.category || ""} ${ticket.device_type || ""}`
              .toLowerCase()
              .includes(query.toLowerCase())
          ) {
            return false;
          }
          return true;
        })
        .sort((a, b) => {
          if (sort === "Newest First") {
            return new Date(b.created_at) - new Date(a.created_at);
          }
          if (sort === "Oldest First") {
            return new Date(a.created_at) - new Date(b.created_at);
          }
          if (sort === "Highest Priority") {
            const order = { High: 3, Medium: 2, Low: 1 };
            return order[b.priority] - order[a.priority];
          }
          return 0;
        }),
    [tickets, statusFilter, priorityFilter, sort, query]
  );

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));
  const pagedTickets = filteredTickets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const statusTone = (status) => {
    if (status === "Open") return "open";
    if (status === "In Progress") return "progress";
    if (status === "Closed") return "closed";
    return "neutral";
  };

  const priorityTone = (priority) => {
    if (priority === "High") return "high";
    if (priority === "Medium") return "medium";
    if (priority === "Low") return "low";
    return "neutral";
  };

  const activeFilterCount =
    (statusFilter !== "All" ? 1 : 0) +
    (priorityFilter !== "All" ? 1 : 0) +
    (query ? 1 : 0);

  const clearFilters = () => {
    setStatusFilter("All");
    setPriorityFilter("All");
    setQuery("");
    setSort("Newest First");
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Support Tickets</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Track incidents, update statuses, and manage workload efficiently.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="btn-ghost"
          aria-expanded={showFilters}
        >
          {showFilters ? "Hide filters" : "Show filters"}
          {activeFilterCount > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="card mb-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <input
              className="input lg:col-span-2"
              placeholder="Search title, description, category…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              className="input"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select
              className="input"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              className="input"
              value={savedView}
              onChange={(e) => applySavedView(e.target.value)}
            >
              <option value="">Saved views</option>
              {savedViews.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {statusFilter !== "All" && (
                <Badge tone={statusTone(statusFilter)}>Status: {statusFilter}</Badge>
              )}
              {priorityFilter !== "All" && (
                <Badge tone={priorityTone(priorityFilter)}>
                  Priority: {priorityFilter}
                </Badge>
              )}
              {query && <Badge tone="neutral">Search: “{query}”</Badge>}
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={saveCurrentView}>
                Save view
              </button>
              {activeFilterCount > 0 && (
                <button className="btn-ghost" onClick={clearFilters}>
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && error && <EmptyState title="Unable to load tickets" message={error} />}
      {!loading && !error && pagedTickets.length === 0 && (
        <EmptyState
          title="No tickets match this filter"
          message="Try changing your filters or search query."
        />
      )}

      {!loading && !error && pagedTickets.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {pagedTickets.map((ticket) => (
            <Link
              key={ticket.id}
              to={`/tickets/${ticket.id}`}
              className="card animate-slide-up group block cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold transition group-hover:text-blue-600 dark:group-hover:text-blue-300">
                  {ticket.title}
                </h2>
                <span
                  aria-hidden
                  className="shrink-0 text-xs text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-500"
                >
                  Open →
                </span>
              </div>
              <p className="mt-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">
                {ticket.description}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone={priorityTone(ticket.priority)}>{ticket.priority}</Badge>
                <Badge tone={statusTone(ticket.status)}>{ticket.status}</Badge>
                {ticket.category && <Badge tone="neutral">{ticket.category}</Badge>}
                {ticket.device_type && <Badge tone="neutral">{ticket.device_type}</Badge>}
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>#{ticket.id}</span>
                <span>{new Date(ticket.created_at).toLocaleString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {filteredTickets.length === 0
              ? "0 tickets"
              : `Showing ${(page - 1) * PAGE_SIZE + 1}-${Math.min(
                  page * PAGE_SIZE,
                  filteredTickets.length
                )} of ${filteredTickets.length}`}
          </p>
          <div className="flex gap-2">
            <button
              className="btn-ghost"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              className="btn-ghost"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Tickets;
