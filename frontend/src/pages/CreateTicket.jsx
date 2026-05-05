import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import { apiFetch } from "../lib/api";

const CATEGORY_OPTIONS = [
  "Hardware",
  "Software",
  "Network",
  "Access / Account",
  "Email",
  "Security",
  "Other",
];
const IMPACT_OPTIONS = [
  "Just me",
  "A small team",
  "A whole department",
  "Organization-wide",
];
const DEVICE_OPTIONS = [
  "",
  "Laptop",
  "Desktop",
  "Phone",
  "Tablet",
  "Printer",
  "Server",
  "Network device",
  "Other",
];
const CONTACT_METHOD_OPTIONS = [
  "Email",
  "Phone",
  "Teams / Slack",
  "In person",
  "Any of the above",
];

function Section({ title, hint, children }) {
  return (
    <div className="card flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {hint && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, error, children, required }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      )}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function CreateTicket() {
  const navigate = useNavigate();
  const { addToast } = useUI();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Low");
  const [category, setCategory] = useState("");
  const [impact, setImpact] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [deviceIdentifier, setDeviceIdentifier] = useState("");
  const [operatingSystem, setOperatingSystem] = useState("");
  const [location, setLocation] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [contactName, setContactName] = useState(
    user?.displayName || user?.username || ""
  );
  const [contactEmail, setContactEmail] = useState(user?.email || "");
  const [contactPhone, setContactPhone] = useState("");
  const [preferredContactMethod, setPreferredContactMethod] = useState("Email");
  const [bestContactTime, setBestContactTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const submitTicket = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (title.trim().length < 4)
      nextErrors.title = "Title must be at least 4 characters.";
    if (description.trim().length < 10)
      nextErrors.description = "Description must be at least 10 characters.";
    if (
      contactEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())
    ) {
      nextErrors.contactEmail = "Enter a valid email address.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await apiFetch("/tickets", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          priority,
          category: category || null,
          impact: impact || null,
          deviceType: deviceType || null,
          deviceIdentifier: deviceIdentifier.trim() || null,
          operatingSystem: operatingSystem.trim() || null,
          location: location.trim() || null,
          stepsToReproduce: stepsToReproduce.trim() || null,
          additionalNotes: additionalNotes.trim() || null,
          contactName: contactName.trim() || null,
          contactEmail: contactEmail.trim() || null,
          contactPhone: contactPhone.trim() || null,
          preferredContactMethod: preferredContactMethod || null,
          bestContactTime: bestContactTime.trim() || null,
        }),
      });

      if (!res.ok) throw new Error("Ticket could not be submitted.");

      const created = await res.json().catch(() => null);
      addToast("Ticket submitted successfully.");
      if (created?.id) {
        navigate(`/tickets/${created.id}`);
      } else {
        navigate("/tickets");
      }
    } catch (err) {
      addToast(err.message || "Submission failed.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Create Support Ticket</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          The more context you provide, the faster our team can resolve the issue.
        </p>
      </div>

      <form onSubmit={submitTicket} className="flex flex-col gap-5">
        <Section title="Issue summary" hint="A short, descriptive title and a clear summary.">
          <Field
            label="Ticket title"
            required
            error={errors.title}
            hint="Example: Outlook crashes when opening shared calendar"
          >
            <input
              className="input"
              placeholder="Brief description of the problem"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </Field>

          <Field
            label="What's happening?"
            required
            error={errors.description}
            hint="Describe the symptoms, error messages, and when it started."
          >
            <textarea
              className="input min-h-32"
              placeholder="Describe the issue in plain terms"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Priority" required>
              <select
                className="input"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </Field>
            <Field label="Category">
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select category…</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Business impact" hint="Who is affected right now?">
              <select
                className="input"
                value={impact}
                onChange={(e) => setImpact(e.target.value)}
              >
                <option value="">Select impact…</option>
                {IMPACT_OPTIONS.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        <Section
          title="Device information"
          hint="Optional — helps triage the issue and match it to a known environment."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Device type">
              <select
                className="input"
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value)}
              >
                {DEVICE_OPTIONS.map((d) => (
                  <option key={d || "empty"} value={d}>
                    {d || "Select device type…"}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Device identifier"
              hint="Asset tag, hostname, or serial (if known)."
            >
              <input
                className="input"
                placeholder="e.g. LAP-09283 or DESKTOP-ACME42"
                value={deviceIdentifier}
                onChange={(e) => setDeviceIdentifier(e.target.value)}
              />
            </Field>
            <Field
              label="Operating system"
              hint="Include version if you know it."
            >
              <input
                className="input"
                placeholder="e.g. Windows 11 23H2, macOS 14.5"
                value={operatingSystem}
                onChange={(e) => setOperatingSystem(e.target.value)}
              />
            </Field>
            <Field label="Location" hint="Office, floor, or remote.">
              <input
                className="input"
                placeholder="e.g. HQ Floor 3 — Desk 42"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Contact information"
          hint="How should the support team reach you about this ticket?"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Contact name"
              hint="Defaults to your account; change if someone else should be contacted."
            >
              <input
                className="input"
                placeholder="Full name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                autoComplete="name"
              />
            </Field>
            <Field
              label="Contact email"
              error={errors.contactEmail}
              hint="We'll use this for status updates."
            >
              <input
                className="input"
                placeholder="name@company.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                inputMode="email"
                autoComplete="email"
              />
            </Field>
            <Field label="Contact phone" hint="Optional — used for urgent issues.">
              <input
                className="input"
                placeholder="+1 (555) 123-4567"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
              />
            </Field>
            <Field label="Preferred contact method">
              <select
                className="input"
                value={preferredContactMethod}
                onChange={(e) => setPreferredContactMethod(e.target.value)}
              >
                {CONTACT_METHOD_OPTIONS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Best time to reach you"
              hint="Optional — e.g. weekdays 9–11am ET."
            >
              <input
                className="input sm:col-span-2"
                placeholder="e.g. Weekdays 9–11am ET"
                value={bestContactTime}
                onChange={(e) => setBestContactTime(e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Reproduction & extras"
          hint="Help us reproduce the issue and share anything else that matters."
        >
          <Field
            label="Steps to reproduce"
            hint="Number each step so we can repeat your path."
          >
            <textarea
              className="input min-h-28"
              placeholder={"1. Open Outlook\n2. Click on shared calendar\n3. Outlook crashes"}
              value={stepsToReproduce}
              onChange={(e) => setStepsToReproduce(e.target.value)}
            />
          </Field>
          <Field
            label="Additional notes"
            hint="Anything else: workarounds tried, related tickets, attachments location, availability windows."
          >
            <textarea
              className="input min-h-24"
              placeholder="Context or constraints we should know about"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
            />
          </Field>
        </Section>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => navigate("/tickets")}
          >
            Cancel
          </button>
          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Ticket"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateTicket;
