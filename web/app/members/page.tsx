"use client";
import { useEffect, useRef, useState } from "react";
import { api, type TeamMember, type UserOut } from "@/lib/api";
import { Github, UserPlus, Pencil, Trash2, Save, X, Building2, Camera } from "lucide-react";

export default function MembersPage() {
  const [items, setItems] = useState<TeamMember[]>([]);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [me, setMe] = useState<UserOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api.members();
      setItems(data.sort((a, b) => (a.order_index ?? 99) - (b.order_index ?? 99)));
    } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => {
    load();
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  const isAdmin = me?.role === "admin";

  async function save() {
    if (!editing) return;
    setErr(null); setMsg(null);
    try {
      await api.upsertMember(editing);
      setEditing(null);
      setMsg("Saved successfully.");
      load();
    } catch (e: any) { setErr(e.message); }
  }
  async function del(id?: number, name?: string) {
    if (!id) return;
    if (!confirm(`Remove "${name}" from the project administration?`)) return;
    try { await api.deleteMember(id); load(); } catch (e: any) { setErr(e.message); }
  }

  return (
    <>
      <section className="gov-hero">
        <div className="mx-auto max-w-container px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-7 w-7 text-brand" />
            <div className="t-eyebrow">The VeriCash Administration</div>
          </div>
          <h1 className="t-display">Project Team</h1>
          <p>
            VeriCash was created by a small interdisciplinary team. The roster
            below lists each member and their contribution to the project.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-container px-4 sm:px-6 py-8 space-y-6">
        {err && <div className="alert danger"><strong>Error.</strong> <span>{err}</span></div>}
        {msg && <div className="alert success">{msg}</div>}

        <div className="flex items-center justify-between">
          <h2 className="t-display text-2xl">Members of the administration</h2>
          {isAdmin && (
            <button
              className="btn btn-primary"
              onClick={() => setEditing({
                name: "", role: "", github: "", photo_url: "",
                contribution: "", order_index: items.length,
              })}
            >
              <UserPlus className="h-4 w-4" /> Add member
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((m, idx) => (
            <MemberCard
              key={m.id ?? idx}
              member={m}
              isAdmin={isAdmin}
              onEdit={() => setEditing({ ...m })}
              onDelete={() => del(m.id, m.name)}
            />
          ))}
        </div>

        {!isAdmin && (
          <div className="alert">
            <div>
              <strong>Public roster.</strong> To edit the project administration,
              sign in with an admin account on the{" "}
              <a href="/settings" className="text-link hover:underline">Settings</a> page.
            </div>
          </div>
        )}

        {editing && (
          <EditModal
            member={editing}
            onChange={setEditing}
            onSave={save}
            onClose={() => setEditing(null)}
          />
        )}
      </div>
    </>
  );
}

/* ─── Member card ─────────────────────────────────────────────────────── */
function MemberCard({
  member: m, isAdmin, onEdit, onDelete,
}: {
  member: TeamMember;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="card flex flex-col h-full">
      <div className="flex items-start gap-4">
        <MemberAvatar name={m.name} photoUrl={m.photo_url} size={64} />
        <div className="min-w-0 flex-1">
          <div className="t-display text-lg leading-tight">{m.name}</div>
          <div className="text-sm text-fg-secondary mt-0.5 leading-snug">{m.role}</div>
        </div>
      </div>
      {m.contribution && (
        <p className="mt-3 text-sm text-fg-secondary leading-relaxed">{m.contribution}</p>
      )}
      <div className="mt-auto pt-4 flex items-center justify-between gap-2">
        {m.github ? (
          <a href={m.github} target="_blank" rel="noreferrer" className="text-sm inline-flex items-center gap-1.5 text-link hover:underline">
            <Github className="h-4 w-4" /> GitHub
          </a>
        ) : <span />}
        {isAdmin && (
          <div className="flex gap-1">
            <button className="btn btn-ghost btn-sm" onClick={onEdit} aria-label="Edit member">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: "var(--counterfeit)" }}
              onClick={onDelete}
              aria-label="Remove member"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

/* ─── Avatar with initials fallback ──────────────────────────────────── */
function MemberAvatar({
  name, photoUrl, size = 64,
}: {
  name: string; photoUrl?: string | null; size?: number;
}) {
  const [imgErr, setImgErr] = useState(false);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (photoUrl && !imgErr) {
    return (
      <img
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        onError={() => setImgErr(true)}
        className="rounded-md object-cover border border-strong shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-md border border-strong shrink-0 flex items-center justify-center font-bold text-white select-none"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, var(--gov-navy) 0%, #1a4480 100%)",
        fontSize: size * 0.35,
        letterSpacing: "0.05em",
      }}
    >
      {initials || <Camera style={{ width: size * 0.35, height: size * 0.35, opacity: 0.6 }} />}
    </div>
  );
}

/* ─── Edit modal ──────────────────────────────────────────────────────── */
function EditModal({
  member, onChange, onSave, onClose,
}: {
  member: TeamMember;
  onChange: (m: TeamMember) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [previewErr, setPreviewErr] = useState(false);

  function field(label: string, key: keyof TeamMember, type = "text") {
    return (
      <label key={key} className="block">
        <span className="label">{label}</span>
        <input
          type={type}
          className="input"
          value={(member[key] as string) || ""}
          onChange={(e) => onChange({ ...member, [key]: e.target.value })}
        />
      </label>
    );
  }

  return (
    <div
      className="fixed inset-0 z-modal grid place-items-center p-4"
      style={{ background: "var(--bg-overlay)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-lg space-y-3 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="t-display text-xl">{member.id ? "Edit member" : "Add member"}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Profile picture section */}
        <div className="flex items-center gap-4 p-3 rounded-md bg-sunken border border-token">
          <div className="relative shrink-0">
            <MemberAvatar name={member.name || "?"} photoUrl={member.photo_url} size={64} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-fg-primary mb-1">Profile picture</div>
            <div className="flex gap-2 flex-wrap">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => photoInputRef.current?.click()}
                type="button"
              >
                <Upload className="h-3.5 w-3.5" /> Upload photo
              </button>
              {member.photo_url && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: "var(--counterfeit)" }}
                  onClick={() => { onChange({ ...member, photo_url: "" }); setPreviewErr(false); }}
                  type="button"
                >
                  <X className="h-3.5 w-3.5" /> Remove
                </button>
              )}
            </div>
            <p className="text-xs text-fg-tertiary mt-1">Or paste a URL below</p>
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                onChange({ ...member, photo_url: ev.target?.result as string });
                setPreviewErr(false);
              };
              reader.readAsDataURL(f);
            }}
          />
        </div>

        {field("Full name", "name")}
        {field("Role / Title", "role")}
        {field("Contribution", "contribution")}

        <label className="block">
          <span className="label">Photo URL</span>
          <input
            type="url"
            className="input"
            value={member.photo_url || ""}
            onChange={(e) => { onChange({ ...member, photo_url: e.target.value }); setPreviewErr(false); }}
            placeholder="https://…"
          />
        </label>

        {field("GitHub URL", "github", "url")}

        <div className="flex justify-end gap-2 pt-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave}>
            <Save className="h-4 w-4" /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Upload({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
