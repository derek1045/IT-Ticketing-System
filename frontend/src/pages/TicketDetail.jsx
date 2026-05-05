import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";
import SkeletonCard from "../components/SkeletonCard";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import { apiFetch } from "../lib/api";

function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isStaff, isAdmin, user } = useAuth();
  const { addToast } = useUI();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");

  const [threadData, setThreadData] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState("");
  const [messageType, setMessageType] = useState("comment");
  const [visibility, setVisibility] = useState("public");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteVisibility, setNoteVisibility] = useState("internal");
  const [notePinned, setNotePinned] = useState(false);
  const [postingNote, setPostingNote] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusNote, setStatusNote] = useState("");

  useEffect(() => {
    const fetchTicket = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiFetch(`/tickets/${id}`);
        if (res.status === 401) {
          setError("Please sign in again.");
          return;
        }
        if (!res.ok) throw new Error("Ticket not found.");
        const data = await res.json();
        setTicket(data);
      } catch (err) {
        setError(err.message || "Could not load ticket.");
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [id]);

  const loadThread = async () => {
    setThreadLoading(true);
    setThreadError("");
    try {
      const res = await apiFetch(`/tickets/${id}/thread`);
      if (!res.ok) throw new Error("Could not load discussion.");
      const data = await res.json();
      setThreadData(data);
    } catch (e) {
      setThreadError(e.message || "Discussion unavailable.");
    } finally {
      setThreadLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "discussion" && id) {
      loadThread();
    }
  }, [tab, id]);

  const loadNotes = async () => {
    setNotesLoading(true);
    try {
      const res = await apiFetch(`/tickets/${id}/notes`);
      if (!res.ok) throw new Error("Could not load notes.");
      const data = await res.json();
      setNotes(data);
    } catch (e) {
      addToast(e.message || "Notes unavailable.", "error");
    } finally {
      setNotesLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadNotes();
  }, [id]);

  useEffect(() => {
    if (!isStaff) setNoteVisibility("public");
  }, [isStaff]);

  const submitNote = async (e) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    setPostingNote(true);
    try {
      const res = await apiFetch(`/tickets/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({
          body: noteBody.trim(),
          visibility: isStaff ? noteVisibility : "public",
          isPinned: isStaff ? notePinned : false,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not add note.");
      }
      setNoteBody("");
      setNotePinned(false);
      addToast("Note added.");
      await loadNotes();
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setPostingNote(false);
    }
  };

  const togglePin = async (note) => {
    try {
      const res = await apiFetch(`/tickets/${id}/notes/${note.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPinned: !note.is_pinned }),
      });
      if (!res.ok) throw new Error("Could not update note.");
      await loadNotes();
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  const removeNote = async (note) => {
    if (!window.confirm("Delete this note?")) return;
    try {
      const res = await apiFetch(`/tickets/${id}/notes/${note.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not delete note.");
      addToast("Note deleted.");
      await loadNotes();
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  const updateTicketStatus = async ({ status, priority } = {}) => {
    if (status == null && priority == null) return;
    if (status === ticket.status && priority === ticket.priority) return;
    setStatusSaving(true);
    try {
      const payload = {};
      if (status != null && status !== ticket.status) payload.status = status;
      if (priority != null && priority !== ticket.priority) payload.priority = priority;
      if (statusNote.trim()) payload.note = statusNote.trim();
      const res = await apiFetch(`/tickets/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Update failed.");
      }
      const data = await res.json();
      setTicket(data);
      setStatusNote("");
      addToast("Ticket updated.");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setStatusSaving(false);
    }
  };

  const deleteTicket = async () => {
    if (!window.confirm("Permanently delete this ticket? This cannot be undone.")) return;
    const res = await apiFetch(`/tickets/${id}`, { method: "DELETE" });
    if (res.status === 403) {
      addToast("Only administrators can delete tickets.", "error");
      return;
    }
    if (!res.ok) {
      addToast("Could not delete ticket.", "error");
      return;
    }
    addToast("Ticket deleted.");
    navigate("/tickets");
  };

  const postMessage = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/tickets/${id}/thread/messages`, {
        method: "POST",
        body: JSON.stringify({
          messageType,
          visibility: isStaff ? visibility : "public",
          body: body.trim(),
        }),
      });
      if (res.status === 403) {
        addToast("You cannot post with that visibility.", "error");
        return;
      }
      if (!res.ok) throw new Error("Failed to post.");
      setBody("");
      addToast("Posted.");
      await loadThread();
    } catch (err) {
      addToast(err.message || "Post failed.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUpvote = async (messageId, hasVoted) => {
    try {
      if (hasVoted) {
        const res = await apiFetch(`/thread/messages/${messageId}/upvote`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Unvote failed");
      } else {
        const res = await apiFetch(`/thread/messages/${messageId}/upvote`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Upvote failed");
        const data = await res.json().catch(() => ({}));
        if (data.awarded === false && data.reason === "already_voted") {
          addToast("Already upvoted.", "error");
          return;
        }
      }
      await loadThread();
    } catch {
      addToast("Vote action failed.", "error");
    }
  };

  const acceptAnswer = async (messageId) => {
    try {
      const res = await apiFetch(`/thread/messages/${messageId}/accept`, {
        method: "POST",
      });
      if (res.status === 403) {
        addToast("Only staff can accept solutions.", "error");
        return;
      }
      if (!res.ok) throw new Error("Accept failed");
      addToast("Marked as accepted solution.");
      await loadThread();
    } catch {
      addToast("Could not accept answer.", "error");
    }
  };

  if (loading) return <SkeletonCard />;
  if (error) return <EmptyState title="Could not open ticket" message={error} />;
  if (!ticket)
    return <EmptyState title="Ticket missing" message="No matching ticket was found." />;

  // local helpers rendered below
  function MetaItem({ label, value }) {
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 text-sm text-slate-800 dark:text-slate-100">
          {value || <span className="text-slate-400">—</span>}
        </p>
      </div>
    );
  }

  function DeviceRow({ label, value, mono }) {
    return (
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0 dark:border-slate-800">
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
        <dd className={`text-right text-sm text-slate-800 dark:text-slate-100 ${mono ? "font-mono" : ""}`}>
          {value || <span className="text-slate-400">—</span>}
        </dd>
      </div>
    );
  }

  function Block({ title, body, mono }) {
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
        <p
          className={`mt-1 whitespace-pre-wrap text-sm ${
            mono ? "font-mono text-[13px]" : ""
          } text-slate-700 dark:text-slate-200`}
        >
          {body}
        </p>
      </div>
    );
  }

  function timeAgo(iso) {
    if (!iso) return "";
    const then = new Date(iso).getTime();
    const diff = Math.max(0, Date.now() - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  function ContactItem({ label, value, href }) {
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {value ? (
          href ? (
            <a
              href={href}
              className="mt-0.5 block break-words text-sm font-medium text-blue-600 hover:underline dark:text-blue-300"
            >
              {value}
            </a>
          ) : (
            <p className="mt-0.5 break-words text-sm text-slate-800 dark:text-slate-100">
              {value}
            </p>
          )
        ) : (
          <p className="mt-0.5 text-sm text-slate-400">—</p>
        )}
      </div>
    );
  }

  const statusTone =
    ticket.status === "Open"
      ? "open"
      : ticket.status === "In Progress"
        ? "progress"
        : "closed";
  const priorityTone =
    ticket.priority === "High"
      ? "high"
      : ticket.priority === "Medium"
        ? "medium"
        : "low";

  const acceptedId = threadData?.acceptedSolution?.message_id;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "overview"
              ? "bg-blue-600 text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "discussion"
              ? "bg-blue-600 text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
          onClick={() => setTab("discussion")}
        >
          Discussion & Q&A
        </button>
      </div>

      {tab === "overview" && (
        <>
          <div className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Ticket #{ticket.id}
                </p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight">{ticket.title}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={priorityTone}>{ticket.priority}</Badge>
                <Badge tone={statusTone}>{ticket.status}</Badge>
                {ticket.category && <Badge tone="neutral">{ticket.category}</Badge>}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <MetaItem label="Created" value={new Date(ticket.created_at).toLocaleString()} />
              <MetaItem label="Category" value={ticket.category} />
              <MetaItem label="Impact" value={ticket.impact} />
              <MetaItem label="Location" value={ticket.location} />
            </div>
          </div>

          {isStaff && (
            <div className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">Update status & priority</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Closing a ticket awards reputation. Changes are recorded in the activity log.
                  </p>
                </div>
                {statusSaving && (
                  <span className="text-xs text-slate-500">Saving…</span>
                )}
              </div>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Status
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["Open", "In Progress", "Closed"].map((s) => {
                      const active = ticket.status === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={statusSaving || active}
                          onClick={() => updateTicketStatus({ status: s })}
                          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                            active
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Priority
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["Low", "Medium", "High"].map((p) => {
                      const active = ticket.priority === p;
                      const tones = {
                        Low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
                        Medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
                        High: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
                      };
                      return (
                        <button
                          key={p}
                          type="button"
                          disabled={statusSaving || active}
                          onClick={() => updateTicketStatus({ priority: p })}
                          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                            active
                              ? tones[p]
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Optional change note
                </label>
                <input
                  className="input"
                  type="text"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Why are you changing the status or priority? (optional)"
                />
              </div>
            </div>
          )}

          {(ticket.contact_name ||
            ticket.contact_email ||
            ticket.contact_phone ||
            ticket.preferred_contact_method ||
            ticket.best_contact_time) && (
            <div className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Contact information</h2>
                {ticket.preferred_contact_method && (
                  <Badge tone="progress">
                    Preferred: {ticket.preferred_contact_method}
                  </Badge>
                )}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <ContactItem label="Name" value={ticket.contact_name} />
                <ContactItem
                  label="Email"
                  value={ticket.contact_email}
                  href={ticket.contact_email ? `mailto:${ticket.contact_email}` : null}
                />
                <ContactItem
                  label="Phone"
                  value={ticket.contact_phone}
                  href={ticket.contact_phone ? `tel:${ticket.contact_phone}` : null}
                />
                <ContactItem label="Best time" value={ticket.best_contact_time} />
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="card md:col-span-2">
              <h2 className="text-lg font-semibold">Issue details</h2>
              <div className="mt-3 space-y-4 text-sm text-slate-700 dark:text-slate-200">
                <Block title="Description" body={ticket.description} />
                {ticket.steps_to_reproduce && (
                  <Block title="Steps to reproduce" body={ticket.steps_to_reproduce} mono />
                )}
                {ticket.additional_notes && (
                  <Block title="Additional notes" body={ticket.additional_notes} />
                )}
                {!ticket.steps_to_reproduce && !ticket.additional_notes && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No reproduction steps or extra notes were added with this ticket.
                  </p>
                )}
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold">Device information</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <DeviceRow label="Type" value={ticket.device_type} />
                <DeviceRow label="Identifier" value={ticket.device_identifier} mono />
                <DeviceRow label="Operating system" value={ticket.operating_system} />
                <DeviceRow label="Location" value={ticket.location} />
              </dl>
              {!ticket.device_type &&
                !ticket.device_identifier &&
                !ticket.operating_system &&
                !ticket.location && (
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    No device info was captured. Ask the requester for device type and OS.
                  </p>
                )}
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold">Activity</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li>Ticket created at {new Date(ticket.created_at).toLocaleString()}.</li>
              <li>Priority set to {ticket.priority}.</li>
              <li>Status currently {ticket.status}.</li>
              {ticket.impact && <li>Reported impact: {ticket.impact}.</li>}
            </ul>
          </div>

          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Notes</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {isStaff
                    ? "Capture quick context, follow-ups, or internal-only observations. Pin important notes to the top."
                    : "Leave a quick note that will be visible to support staff."}
                </p>
              </div>
              {notes.length > 0 && (
                <span className="text-xs text-slate-500">
                  {notes.length} note{notes.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            <form onSubmit={submitNote} className="mt-3 space-y-3">
              <textarea
                className="input min-h-[80px]"
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Add a note…"
                maxLength={2000}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                  {isStaff && (
                    <>
                      <label className="flex items-center gap-1">
                        <span className="font-medium text-slate-500">Visibility:</span>
                        <select
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                          value={noteVisibility}
                          onChange={(e) => setNoteVisibility(e.target.value)}
                        >
                          <option value="internal">Internal (staff only)</option>
                          <option value="public">Public (visible to requester)</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={notePinned}
                          onChange={(e) => setNotePinned(e.target.checked)}
                        />
                        Pin to top
                      </label>
                    </>
                  )}
                  <span className="text-slate-400">{noteBody.length}/2000</span>
                </div>
                <button
                  type="submit"
                  className="btn-primary text-sm"
                  disabled={postingNote || !noteBody.trim()}
                >
                  {postingNote ? "Adding…" : "Add note"}
                </button>
              </div>
            </form>

            <div className="mt-4 space-y-2">
              {notesLoading && notes.length === 0 && (
                <p className="text-xs text-slate-500">Loading notes…</p>
              )}
              {!notesLoading && notes.length === 0 && (
                <p className="text-xs text-slate-500">No notes yet.</p>
              )}
              {notes.map((note) => {
                const canDelete = isStaff || note.author_user_id === user?.id;
                return (
                  <div
                    key={note.id}
                    className={`rounded-lg border p-3 ${
                      note.is_pinned
                        ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20"
                        : note.visibility === "internal"
                          ? "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40"
                          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {note.author_display_name || note.author_username}
                      </span>
                      <span>·</span>
                      <span>{timeAgo(note.created_at)}</span>
                      {note.is_pinned && <Badge tone="medium">Pinned</Badge>}
                      {note.visibility === "internal" ? (
                        <Badge tone="neutral">Internal</Badge>
                      ) : (
                        <Badge tone="open">Public</Badge>
                      )}
                      <div className="ml-auto flex items-center gap-2">
                        {isStaff && (
                          <button
                            type="button"
                            className="text-xs text-slate-500 hover:text-blue-600"
                            onClick={() => togglePin(note)}
                          >
                            {note.is_pinned ? "Unpin" : "Pin"}
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="text-xs text-slate-500 hover:text-rose-600"
                            onClick={() => removeNote(note)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">
                      {note.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {isAdmin && (
            <div className="card border-rose-200 dark:border-rose-900/60">
              <h2 className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                Danger zone
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Deleting a ticket removes all associated discussion and votes.
              </p>
              <button
                type="button"
                className="btn-ghost mt-3 text-rose-700 dark:text-rose-300"
                onClick={deleteTicket}
              >
                Delete ticket
              </button>
            </div>
          )}
        </>
      )}

      {tab === "discussion" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-lg font-semibold">Team discussion</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Public messages are visible to the requester. Internal notes are visible only to staff.
            </p>
          </div>

          {threadLoading && <SkeletonCard />}
          {!threadLoading && threadError && (
            <EmptyState title="Discussion unavailable" message={threadError} />
          )}
          {!threadLoading && !threadError && threadData && (
            <>
              <form onSubmit={postMessage} className="card flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Type</label>
                    <select
                      className="input"
                      value={messageType}
                      onChange={(e) => setMessageType(e.target.value)}
                    >
                      <option value="comment">Comment</option>
                      <option value="answer">Answer</option>
                    </select>
                  </div>
                  {isStaff && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        Visibility
                      </label>
                      <select
                        className="input"
                        value={visibility}
                        onChange={(e) => setVisibility(e.target.value)}
                      >
                        <option value="public">Public</option>
                        <option value="internal">Internal</option>
                      </select>
                    </div>
                  )}
                </div>
                <textarea
                  className="input min-h-24"
                  placeholder="Write a clear update, hypothesis, or resolution steps…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                />
                <button className="btn-primary w-fit" type="submit" disabled={submitting}>
                  {submitting ? "Posting…" : "Post"}
                </button>
              </form>

              <div className="space-y-3">
                {threadData.messages.map((m) => {
                  const isAuthor = user?.id && m.author_user_id === user.id;
                  const accepted = acceptedId === m.id;
                  return (
                    <div
                      key={m.id}
                      className={`card ${m.visibility === "internal" ? "border-amber-200 dark:border-amber-900" : ""}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={m.message_type === "answer" ? "progress" : "neutral"}>
                            {m.message_type}
                          </Badge>
                          <Badge tone={m.visibility === "internal" ? "medium" : "low"}>
                            {m.visibility}
                          </Badge>
                          {accepted && <Badge tone="open">Accepted solution</Badge>}
                        </div>
                        <span className="text-xs text-slate-500">
                          {new Date(m.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">
                        {m.body}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">
                          {m.upvote_count ?? 0} upvote{(m.upvote_count === 1 ? "" : "s")}
                        </span>
                        {!isAuthor && (
                          <button
                            type="button"
                            className="btn-ghost text-xs"
                            onClick={() => toggleUpvote(m.id, m.viewer_has_upvoted)}
                          >
                            {m.viewer_has_upvoted ? "Remove upvote" : "Upvote"}
                          </button>
                        )}
                        {isStaff && m.message_type === "answer" && !accepted && (
                          <button
                            type="button"
                            className="btn-primary text-xs"
                            onClick={() => acceptAnswer(m.id)}
                          >
                            Accept solution
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default TicketDetail;
