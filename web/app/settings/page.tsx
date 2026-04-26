"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  api,
  type CurrencyConfig,
  type UserOut,
  type ScanResult,
  type TeamMember,
  ApiError,
} from "@/lib/api";
import {
  Save, Trash2, Plus, LogIn, LogOut, KeyRound, X,
  ShieldAlert, ShieldCheck, Building2, Palette, Info,
  FlaskConical, Coins, Upload, Users, Lock, Pencil,
  RefreshCw, Eye, EyeOff, UserPlus, RotateCcw,
} from "lucide-react";
import ResultCard from "@/components/ResultCard";
import clsx from "clsx";

/* ─── Section registry ────────────────────────────────────────────────── */
const SECTIONS = [
  "Account", "Users", "Detection", "Currencies", "Appearance",
  "Branding", "Validation", "About",
] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_META: Record<Section, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  adminOnly: boolean;
}> = {
  Account:    { icon: KeyRound,    label: "Account",      adminOnly: false },
  Users:      { icon: Users,       label: "Users",        adminOnly: true  },
  Detection:  { icon: ShieldCheck, label: "Detection",    adminOnly: true  },
  Currencies: { icon: Coins,       label: "Currencies",   adminOnly: true  },
  Appearance: { icon: Palette,     label: "Appearance",   adminOnly: false },
  Branding:   { icon: Building2,   label: "Branding",     adminOnly: true  },
  Validation: { icon: FlaskConical,label: "Validation",   adminOnly: true  },
  About:      { icon: Info,        label: "About & Team", adminOnly: false  },
};

/* ─── 7 PBL Techniques ────────────────────────────────────────────────── */
const PBL_TECHNIQUES = [
  { num: 1, name: "Image Enhancement",          detail: "CLAHE contrast equalisation + adaptive gamma correction" },
  { num: 2, name: "Histogram Processing",       detail: "Entropy scoring and reference-histogram matching" },
  { num: 3, name: "Spatial Filtering",          detail: "Bilateral denoising + Laplacian sharpness measurement" },
  { num: 4, name: "Frequency-Domain Filtering", detail: "FFT high-pass filter — scores micro-print survival" },
  { num: 5, name: "Noise Removal",              detail: "MAD-based sigma estimate + Non-local Means denoising" },
  { num: 6, name: "Morphological Operations",   detail: "Vertical security-thread continuity via top-hat + erosion" },
  { num: 7, name: "Color-Space Transformations", detail: "HSV saturation + CIE Lab fingerprint classification" },
];

/* ─── Root page ───────────────────────────────────────────────────────── */
export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsInner />
    </Suspense>
  );
}

function SettingsInner() {
  const params = useSearchParams();
  const initSection = (() => {
    const s = params.get("s") || params.get("section") || "";
    const found = SECTIONS.find((x) => x.toLowerCase() === s.toLowerCase());
    return found ?? "Account";
  })();
  const [section, setSection] = useState<Section>(initSection);
  const [me, setMe] = useState<UserOut | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);

  function refreshMe() {
    api.me()
      .then((u) => { setMe(u); setMeLoaded(true); })
      .catch(() => { setMe(null); setMeLoaded(true); });
  }
  useEffect(() => {
    refreshMe();
    const onAuth = () => refreshMe();
    window.addEventListener("vc-auth-changed", onAuth);
    return () => window.removeEventListener("vc-auth-changed", onAuth);
  }, []);

  const isAdmin = me?.role === "admin";
  const meta = SECTION_META[section];

  return (
    <>
      <section className="gov-hero">
        <div className="mx-auto max-w-container px-4 sm:px-6">
          <div className="t-eyebrow mb-1">Bureau Configuration</div>
          <h1 className="t-display">Settings</h1>
          <p>
            Account, detection thresholds, currency catalogue, appearance,
            branding, and validation harness.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-container px-4 sm:px-6 py-8 grid md:grid-cols-[220px_1fr] gap-6">
        {/* ── Sidebar ────────────────────────────────────────────────── */}
        <aside className="card !p-2 h-fit sticky top-4">
          <nav aria-label="Settings navigation">
            <ul className="space-y-0.5">
              {SECTIONS.map((s) => {
                const m = SECTION_META[s];
                const SIcon = m.icon;
                const locked = m.adminOnly && !isAdmin;
                const active = s === section;
                return (
                  <li key={s}>
                    <button
                      onClick={() => setSection(s)}
                      className={clsx(
                        "w-full text-left rounded-md px-3 h-10 text-sm transition-colors flex items-center gap-2.5",
                        active
                          ? "bg-gov-navy text-white"
                          : "text-fg-secondary hover:bg-sunken hover:text-fg-primary"
                      )}
                    >
                      <SIcon className={clsx("h-4 w-4 shrink-0", active ? "text-white" : "text-fg-tertiary")} />
                      <span className="flex-1">{m.label}</span>
                      {locked && <Lock className="h-3 w-3 shrink-0 text-fg-disabled" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="border-t border-token mt-2 pt-2 px-3 py-2 text-xs text-fg-tertiary">
            {meLoaded && me ? (
              <div>
                <div className="font-semibold text-fg-primary truncate">{me.full_name}</div>
                <div className="truncate">{me.email}</div>
                <div className="mt-1.5">
                  <span className={me.role === "admin" ? "chip chip-gold" : "chip"}>{me.role}</span>
                </div>
              </div>
            ) : meLoaded ? (
              <div className="text-fg-tertiary">Not signed in.</div>
            ) : (
              <div className="text-fg-tertiary">Loading…</div>
            )}
          </div>
        </aside>

        {/* ── Panel area ─────────────────────────────────────────────── */}
        <section>
          {meta.adminOnly && !isAdmin ? (
            <AdminGate section={section} signedIn={!!me} onSwitchToAccount={() => setSection("Account")} />
          ) : (
            <>
              {section === "Account"    && <AccountPanel    me={me} onChanged={refreshMe} />}
              {section === "Users"      && <UsersPanel      me={me} />}
              {section === "Detection"  && <DetectionPanel  />}
              {section === "Currencies" && <CurrenciesPanel />}
              {section === "Appearance" && <AppearancePanel />}
              {section === "Branding"   && <BrandingPanel   />}
              {section === "Validation" && <ValidationPanel />}
              {section === "About"      && <AboutPanel      />}
            </>
          )}
        </section>
      </div>
    </>
  );
}

/* ─── AdminGate ───────────────────────────────────────────────────────── */
function AdminGate({ section, signedIn, onSwitchToAccount }: {
  section: string; signedIn: boolean; onSwitchToAccount: () => void;
}) {
  return (
    <div className="card flex items-start gap-4 max-w-xl">
      <ShieldAlert className="h-6 w-6 text-counterfeit shrink-0 mt-0.5" />
      <div className="space-y-2">
        <h2 className="t-display text-xl">Admin only</h2>
        <p className="text-fg-secondary text-sm">
          The <strong>{section}</strong> panel is restricted to administrators.{" "}
          {signedIn
            ? "Your current account does not have the required privileges."
            : "Please sign in with an administrator account to continue."}
        </p>
        <button className="btn btn-primary" onClick={onSwitchToAccount}>
          <LogIn className="h-4 w-4" /> {signedIn ? "Switch account" : "Go to Account"}
        </button>
      </div>
    </div>
  );
}

/* ─── Account Panel ───────────────────────────────────────────────────── */
type AuthMode = "login" | "register" | "forgot" | "reset";

function AccountPanel({ me, onChanged }: { me: UserOut | null; onChanged: () => void }) {
  // ── Logged-in state ──────────────────────────────────────────────────
  const [editName, setEditName] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  const [curPw, setCurPw]     = useState("");
  const [newPw, setNewPw]     = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [pwBusy, setPwBusy]   = useState(false);
  const [pwMsg, setPwMsg]     = useState<string | null>(null);
  const [pwErr, setPwErr]     = useState<string | null>(null);

  useEffect(() => { if (me) setEditName(me.full_name); }, [me]);

  async function saveProfile() {
    setProfileErr(null); setProfileMsg(null);
    if (!editName.trim()) { setProfileErr("Name cannot be empty."); return; }
    setProfileBusy(true);
    try {
      await api.updateProfile({ full_name: editName.trim() });
      setProfileMsg("Profile updated.");
      onChanged();
    } catch (e: any) {
      setProfileErr(e instanceof ApiError ? e.message : "Update failed.");
    } finally { setProfileBusy(false); }
  }

  async function savePassword() {
    setPwErr(null); setPwMsg(null);
    if (!curPw || !newPw || !confirmPw) { setPwErr("All fields are required."); return; }
    if (newPw.length < 6) { setPwErr("New password must be at least 6 characters."); return; }
    if (newPw !== confirmPw) { setPwErr("Passwords do not match."); return; }
    setPwBusy(true);
    try {
      await api.changePassword(curPw, newPw);
      setPwMsg("Password changed successfully.");
      setCurPw(""); setNewPw(""); setConfirmPw("");
    } catch (e: any) {
      setPwErr(e instanceof ApiError ? e.message : "Password change failed.");
    } finally { setPwBusy(false); }
  }

  function logout() { api.logout(); onChanged(); }

  if (me) {
    return (
      <div className="space-y-5 max-w-lg">
        {/* Profile info */}
        <div className="card space-y-4">
          <h2 className="t-display text-xl flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-brand" /> Account
          </h2>

          {/* Avatar + info */}
          <div className="flex items-center gap-4">
            <div
              className="h-14 w-14 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0"
              style={{ background: "var(--gov-navy)" }}
            >
              {me.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-fg-primary">{me.full_name}</div>
              <div className="text-sm text-fg-secondary">{me.email}</div>
              <span className={clsx("chip mt-1", me.role === "admin" && "chip-gold")}>{me.role}</span>
            </div>
          </div>

          {me.role === "admin" && (
            <div className="rounded-md bg-sunken border border-token px-4 py-3 text-sm text-fg-secondary">
              <ShieldCheck className="h-4 w-4 inline mr-2 text-brand" />
              Full admin access — all panels are unlocked.
            </div>
          )}

          {/* Edit name */}
          <div className="border-t border-token pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-fg-primary">Edit profile</h3>
            <PwField label="Display name" value={editName} onChange={setEditName} type="text" show />
            <div className="flex items-center gap-3">
              <button className="btn btn-primary" onClick={saveProfile} disabled={profileBusy}>
                <Save className="h-4 w-4" /> {profileBusy ? "Saving…" : "Save name"}
              </button>
              {profileMsg && <span className="chip chip-authentic text-xs">{profileMsg}</span>}
            </div>
            {profileErr && <div className="alert danger text-sm"><strong>Error.</strong> {profileErr}</div>}
          </div>

          <div className="flex gap-2 pt-1">
            <button className="btn btn-secondary" onClick={logout}>
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>

        {/* Change password */}
        <div className="card space-y-4">
          <h2 className="t-display text-lg flex items-center gap-2">
            <Lock className="h-4 w-4 text-brand" /> Change password
          </h2>
          <PwField label="Current password" value={curPw} onChange={setCurPw} show={showPw} />
          <PwField label="New password (min 6 chars)" value={newPw} onChange={setNewPw} show={showPw} />
          <PwField label="Confirm new password" value={confirmPw} onChange={setConfirmPw} show={showPw} />
          <div className="flex items-center gap-3 flex-wrap">
            <button className="btn btn-primary" onClick={savePassword} disabled={pwBusy}>
              <Save className="h-4 w-4" /> {pwBusy ? "Saving…" : "Change password"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm flex items-center gap-1.5"
              onClick={() => setShowPw(!showPw)}
            >
              {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPw ? "Hide" : "Show"} passwords
            </button>
            {pwMsg && <span className="chip chip-authentic text-xs">{pwMsg}</span>}
          </div>
          {pwErr && <div className="alert danger text-sm"><strong>Error.</strong> {pwErr}</div>}
        </div>
      </div>
    );
  }

  // ── Logged-out state ─────────────────────────────────────────────────
  return <AuthForms onChanged={onChanged} />;
}

/* ─── Auth forms (login / register / forgot / reset) ─────────────────── */
function AuthForms({ onChanged }: { onChanged: () => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [pw, setPw]       = useState("");
  const [name, setName]   = useState("");
  const [code, setCode]   = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState<string | null>(null);
  const [msg, setMsg]     = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  function reset() {
    setErr(null); setMsg(null); setDemoCode(null);
    setPw(""); setNewPw(""); setConfirmPw(""); setCode("");
  }

  async function submit() {
    setErr(null); setMsg(null);
    if (!email && mode !== "reset") { setErr("Email is required."); return; }
    setBusy(true);
    try {
      if (mode === "login") {
        if (!pw) { setErr("Password is required."); setBusy(false); return; }
        await api.login(email, pw);
        setMsg("Signed in.");
        onChanged();
      } else if (mode === "register") {
        if (!pw || pw.length < 6) { setErr("Password must be at least 6 characters."); setBusy(false); return; }
        await api.register(email, pw, name || undefined);
        setMsg("Account created.");
        onChanged();
      } else if (mode === "forgot") {
        const res = await api.forgotPassword(email);
        setMsg(res.message);
        if (res.demo_code) {
          setDemoCode(res.demo_code);
          setMode("reset");
        }
      } else if (mode === "reset") {
        if (!code || !newPw || !confirmPw) { setErr("All fields are required."); setBusy(false); return; }
        if (newPw !== confirmPw) { setErr("Passwords do not match."); setBusy(false); return; }
        if (newPw.length < 6) { setErr("Password must be at least 6 characters."); setBusy(false); return; }
        await api.resetPassword(email, code, newPw);
        setMsg("Password reset successfully. You can now sign in.");
        setMode("login");
        setDemoCode(null);
      }
    } catch (e: any) {
      setErr(e instanceof ApiError ? e.message : "An error occurred.");
    } finally { setBusy(false); }
  }

  const title: Record<AuthMode, string> = {
    login: "Sign in",
    register: "Create account",
    forgot: "Forgot password",
    reset: "Reset password",
  };

  return (
    <div className="card space-y-4 max-w-lg">
      <h2 className="t-display text-xl flex items-center gap-2">
        <LogIn className="h-5 w-5 text-brand" /> {title[mode]}
      </h2>

      {mode === "register" && (
        <p className="text-sm text-fg-secondary">
          The first registered user is automatically promoted to admin.
        </p>
      )}
      {mode === "forgot" && (
        <p className="text-sm text-fg-secondary">
          Enter your email address. A 6-digit reset code will be generated.
        </p>
      )}
      {mode === "reset" && (
        <p className="text-sm text-fg-secondary">
          Enter the reset code sent to your email along with your new password.
        </p>
      )}

      {/* Demo code banner */}
      {demoCode && (
        <div className="rounded-md border border-gov-gold/50 bg-gov-gold/10 px-4 py-3 text-sm">
          <div className="font-semibold text-fg-primary mb-0.5">Demo reset code (no email server)</div>
          <div className="t-mono text-2xl tracking-[0.2em] text-brand font-bold">{demoCode}</div>
          <div className="text-xs text-fg-tertiary mt-1">Valid for 15 minutes. Pre-filled below.</div>
        </div>
      )}

      {mode === "register" && (
        <label className="block">
          <span className="label">Full name (optional)</span>
          <input type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
      )}

      {(mode === "login" || mode === "register" || mode === "forgot") && (
        <label className="block">
          <span className="label">Email</span>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
      )}

      {(mode === "login" || mode === "register") && (
        <div className="space-y-1">
          <PwField
            label={mode === "register" ? "Password (min 6 characters)" : "Password"}
            value={pw}
            onChange={setPw}
            show={showPw}
          />
          <button
            type="button"
            className="text-xs text-fg-tertiary hover:text-fg-secondary flex items-center gap-1"
            onClick={() => setShowPw(!showPw)}
          >
            {showPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showPw ? "Hide" : "Show"} password
          </button>
        </div>
      )}

      {mode === "reset" && (
        <>
          <label className="block">
            <span className="label">Email</span>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Reset code</span>
            <input
              type="text"
              className="input t-mono tracking-widest"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
            />
          </label>
          <PwField label="New password (min 6 chars)" value={newPw} onChange={setNewPw} show={showPw} />
          <PwField label="Confirm new password" value={confirmPw} onChange={setConfirmPw} show={showPw} />
        </>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
        <div className="flex gap-2 text-sm flex-wrap">
          {mode === "login" && (
            <>
              <button className="text-link hover:underline" onClick={() => { reset(); setMode("register"); }}>
                Register →
              </button>
              <button className="text-link hover:underline" onClick={() => { reset(); setMode("forgot"); }}>
                Forgot password?
              </button>
            </>
          )}
          {(mode === "register" || mode === "forgot" || mode === "reset") && (
            <button className="text-link hover:underline" onClick={() => { reset(); setMode("login"); }}>
              ← Back to sign in
            </button>
          )}
        </div>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "register" ? "Register" : mode === "forgot" ? "Send code" : "Reset password"}
        </button>
      </div>

      {err && <div className="alert danger text-sm"><strong>Error.</strong> <span>{err}</span></div>}
      {msg && !demoCode && <div className="alert success text-sm">{msg}</div>}
    </div>
  );
}

/* ─── Users Panel (admin) ─────────────────────────────────────────────── */
function UsersPanel({ me }: { me: UserOut | null }) {
  const [users, setUsers]     = useState<UserOut[]>([]);
  const [editing, setEditing] = useState<UserOut | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editName, setEditName] = useState("");
  const [editPw, setEditPw]   = useState("");
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const [msg, setMsg]         = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName,  setNewName]  = useState("");
  const [newPw,    setNewPw]    = useState("");
  const [newRole,  setNewRole]  = useState("inspector");
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  async function load() {
    try { setUsers(await api.listUsers()); }
    catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  function openEdit(u: UserOut) {
    setEditing(u);
    setEditName(u.full_name);
    setEditRole(u.role);
    setEditPw("");
    setErr(null); setMsg(null);
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      await api.updateUser(editing.id, {
        full_name: editName || undefined,
        role: editRole || undefined,
        password: editPw || undefined,
      });
      setMsg("User updated.");
      setEditing(null);
      load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function del(id: number, name: string) {
    if (!confirm(`Remove user "${name}"? This cannot be undone.`)) return;
    try { await api.deleteUser(id); load(); }
    catch (e: any) { setErr(e.message); }
  }

  async function create() {
    setCreateErr(null);
    if (!newEmail || !newPw) { setCreateErr("Email and password are required."); return; }
    if (newPw.length < 6) { setCreateErr("Password must be at least 6 characters."); return; }
    setCreateBusy(true);
    try {
      // Register the user via the auth register endpoint.
      // IMPORTANT: api.register() stores the new user's token, which would log
      // the admin out. Save + restore the admin token so the session is intact.
      const adminToken = typeof window !== "undefined"
        ? localStorage.getItem("vc_token")
        : null;

      const res = await api.register(newEmail, newPw, newName || undefined);

      // Restore admin session immediately after register() overwrites it
      if (adminToken && typeof window !== "undefined") {
        localStorage.setItem("vc_token", adminToken);
        window.dispatchEvent(new Event("vc-auth-changed"));
      }

      // Now update role using admin token (restored above)
      if (newRole !== "inspector") {
        await api.updateUser(res.user.id, { role: newRole });
      }
      setMsg(`User ${newEmail} created with role: ${newRole}.`);
      setCreating(false);
      setNewEmail(""); setNewName(""); setNewPw(""); setNewRole("inspector");
      load();
    } catch (e: any) { setCreateErr(e.message); }
    finally { setCreateBusy(false); }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="t-display text-xl flex items-center gap-2">
          <Users className="h-5 w-5 text-brand" /> User management
        </h2>
        <button className="btn btn-primary" onClick={() => { setCreating(true); setCreateErr(null); }}>
          <UserPlus className="h-4 w-4" /> Add user
        </button>
      </div>

      {err && <div className="alert danger"><strong>Error.</strong> <span>{err}</span></div>}
      {msg && <div className="alert success">{msg}</div>}

      <div className="card !p-0 overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium text-fg-primary">{u.full_name}</td>
                <td className="text-fg-secondary text-sm">{u.email}</td>
                <td>
                  <span className={clsx("chip", u.role === "admin" && "chip-gold")}>{u.role}</span>
                </td>
                <td className="text-right whitespace-nowrap">
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {me?.id !== u.id && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: "var(--counterfeit)" }}
                      onClick={() => del(u.id, u.full_name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={4} className="text-center text-fg-tertiary py-6">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editing && (
        <Modal onClose={() => setEditing(null)} title="Edit user">
          <label className="block">
            <span className="label">Display name</span>
            <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Role</span>
            <select className="input" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
              <option value="admin">admin</option>
              <option value="inspector">inspector</option>
              <option value="viewer">viewer</option>
            </select>
          </label>
          <label className="block">
            <span className="label">New password (leave blank to keep current)</span>
            <input className="input" type="password" value={editPw} onChange={(e) => setEditPw(e.target.value)} placeholder="••••••••" />
          </label>
          {err && <div className="alert danger text-sm"><strong>Error.</strong> {err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveEdit} disabled={busy}>
              <Save className="h-4 w-4" /> Save
            </button>
          </div>
        </Modal>
      )}

      {/* Create modal */}
      {creating && (
        <Modal onClose={() => setCreating(false)} title="Create user">
          <label className="block">
            <span className="label">Email</span>
            <input className="input" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="off" />
          </label>
          <label className="block">
            <span className="label">Full name (optional)</span>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Password (min 6 chars)</span>
            <input className="input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="block">
            <span className="label">Role</span>
            <select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              <option value="inspector">inspector</option>
              <option value="admin">admin</option>
              <option value="viewer">viewer</option>
            </select>
          </label>
          {createErr && <div className="alert danger text-sm"><strong>Error.</strong> {createErr}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={create} disabled={createBusy}>
              <UserPlus className="h-4 w-4" /> {createBusy ? "Creating…" : "Create"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── Detection Panel ─────────────────────────────────────────────────── */
function DetectionPanel() {
  const [auth, setAuth] = useState(0.75);
  const [susp, setSusp] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.settings().then((rows) => {
      rows.forEach((r) => {
        if (r.key === "authentic_threshold")  setAuth(Number(r.value));
        if (r.key === "suspicious_threshold") setSusp(Number(r.value));
      });
    }).catch(() => {});
  }, []);

  async function save() {
    setBusy(true); setErr(null); setMsg(null);
    if (susp >= auth) {
      setErr("Suspicious threshold must be lower than authentic threshold.");
      setBusy(false); return;
    }
    try {
      await Promise.all([
        api.setSetting("authentic_threshold", auth),
        api.setSetting("suspicious_threshold", susp),
      ]);
      setMsg("Thresholds saved.");
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="card space-y-5 max-w-xl">
      <h2 className="t-display text-xl flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-brand" /> Detection thresholds
      </h2>
      <p className="text-sm text-fg-secondary">
        Scores at or above the <strong>authentic threshold</strong> are reported as{" "}
        <em>authentic</em>; scores between the two thresholds are <em>suspicious</em>;
        everything below is <em>counterfeit</em>.
      </p>
      <div className="rounded-md overflow-hidden border border-token text-xs font-medium">
        <div className="grid grid-cols-3">
          <div className="bg-counterfeit-bg text-counterfeit-fg px-3 py-2 text-center">
            Counterfeit<br /><span className="t-mono font-bold">0 – {susp.toFixed(2)}</span>
          </div>
          <div className="bg-suspicious-bg text-suspicious-fg px-3 py-2 text-center border-x border-token">
            Suspicious<br /><span className="t-mono font-bold">{susp.toFixed(2)} – {auth.toFixed(2)}</span>
          </div>
          <div className="bg-authentic-bg text-authentic-fg px-3 py-2 text-center">
            Authentic<br /><span className="t-mono font-bold">{auth.toFixed(2)} – 1.0</span>
          </div>
        </div>
      </div>
      <Slider label="Authentic threshold" value={auth} on={setAuth} />
      <Slider label="Suspicious threshold" value={susp} on={setSusp} />
      <div className="flex items-center gap-3 pt-1">
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          <Save className="h-4 w-4" /> Save thresholds
        </button>
        {msg && <span className="chip chip-authentic">{msg}</span>}
      </div>
      {err && <div className="alert danger"><strong>Error.</strong> <span>{err}</span></div>}
    </div>
  );
}

/* ─── Currencies Panel ────────────────────────────────────────────────── */
function CurrenciesPanel() {
  const [items, setItems] = useState<CurrencyConfig[]>([]);
  const [editing, setEditing] = useState<CurrencyConfig | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try { setItems(await api.currencies()); }
    catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing) return;
    try {
      await api.upsertCurrency(editing);
      setEditing(null); setMsg("Currency saved."); load();
    } catch (e: any) { setErr(e.message); }
  }
  async function toggle(c: CurrencyConfig) {
    try {
      const next = { ...c, enabled: !c.enabled };
      await api.upsertCurrency(next);
      setItems(items.map((x) => (x.code === c.code ? next : x)));
    } catch (e: any) { setErr(e.message); }
  }
  async function del(code: string) {
    if (!confirm(`Remove ${code} from the catalogue?`)) return;
    try { await api.deleteCurrency(code); load(); }
    catch (e: any) { setErr(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="t-display text-xl flex items-center gap-2">
          <Coins className="h-5 w-5 text-brand" /> Currency catalogue
        </h2>
        <button
          className="btn btn-primary"
          onClick={() => setEditing({ code: "", name: "", enabled: true, denominations: [] })}
        >
          <Plus className="h-4 w-4" /> Add currency
        </button>
      </div>
      {err && <div className="alert danger"><strong>Error.</strong> <span>{err}</span></div>}
      {msg && <div className="alert success">{msg}</div>}
      <div className="card !p-0 overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Code</th><th>Name</th><th>Denominations</th><th>Enabled</th><th /></tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.code}>
                <td className="t-mono font-semibold">{c.code}</td>
                <td>{c.name}</td>
                <td>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {c.denominations.slice(0, 8).map((d) => (
                      <span key={d} style={{
                        display: "inline-block", padding: "1px 7px",
                        borderRadius: "var(--r-full)",
                        background: "var(--bg-sunken)", border: "1px solid var(--border)",
                        fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)",
                        color: "var(--fg-secondary)",
                      }}>{d}</span>
                    ))}
                    {c.denominations.length > 8 && (
                      <span style={{ fontSize: 11, color: "var(--fg-tertiary)", alignSelf: "center" }}>
                        +{c.denominations.length - 8}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <label className="switch">
                    <input type="checkbox" checked={c.enabled} onChange={() => toggle(c)} />
                    <span className="track"><span className="thumb" /></span>
                  </label>
                </td>
                <td className="text-right whitespace-nowrap">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(c)}>Edit</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: "var(--counterfeit)" }} onClick={() => del(c.code)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? "Edit currency" : "Add currency"}>
          <Field label="ISO code (e.g. INR)" v={editing.code} on={(v) => setEditing({ ...editing, code: v.toUpperCase() })} />
          <Field label="Name" v={editing.name} on={(v) => setEditing({ ...editing, name: v })} />
          <DenomInput
            values={editing.denominations}
            onChange={(d) => setEditing({ ...editing, denominations: d })}
          />
          <label className="flex items-center justify-between">
            <span className="label !mb-0">Enabled</span>
            <span className="switch">
              <input type="checkbox" checked={editing.enabled} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} />
              <span className="track"><span className="thumb" /></span>
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}><Save className="h-4 w-4" /> Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── Appearance Panel ────────────────────────────────────────────────── */
function AppearancePanel() {
  const [theme, setTheme] = useState<"light" | "dark">(
    typeof document !== "undefined"
      ? ((document.documentElement.getAttribute("data-theme") as any) || "light")
      : "light"
  );
  function set(next: "light" | "dark") {
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("vc_theme", next); } catch {}
    setTheme(next);
  }
  return (
    <div className="card space-y-4 max-w-md">
      <h2 className="t-display text-xl flex items-center gap-2">
        <Palette className="h-5 w-5 text-brand" /> Appearance
      </h2>
      <p className="text-sm text-fg-secondary">
        Choose a theme for the inspector console. The setting persists locally.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {(["light", "dark"] as const).map((t) => (
          <button
            key={t}
            onClick={() => set(t)}
            className={clsx(
              "rounded-md border p-4 text-left transition-colors",
              theme === t ? "border-gov-navy ring-2 ring-gov-gold" : "border-token hover:border-strong"
            )}
          >
            <div className={clsx("h-16 rounded-sm mb-2 border border-token", t === "light" ? "bg-white" : "bg-[#0b1220]")} />
            <div className="font-semibold capitalize text-fg-primary">{t}</div>
            <div className="text-xs text-fg-tertiary">
              {t === "light" ? "Official daytime" : "Operations / low-light"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Branding Panel ──────────────────────────────────────────────────── */
function BrandingPanel() {
  const [orgName, setOrgName] = useState("");
  const [mission, setMission] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.settings().then((rows) => {
      rows.forEach((r) => {
        if (r.key === "organization_name") setOrgName(String(r.value));
        if (r.key === "mission_statement")  setMission(String(r.value));
      });
    }).catch(() => {});
  }, []);

  async function save() {
    setBusy(true); setErr(null); setMsg(null);
    try {
      await Promise.all([
        api.setSetting("organization_name", orgName),
        api.setSetting("mission_statement",  mission),
      ]);
      setMsg("Branding saved.");
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="card space-y-5 max-w-xl">
      <h2 className="t-display text-xl flex items-center gap-2">
        <Building2 className="h-5 w-5 text-brand" /> Branding
      </h2>
      <p className="text-sm text-fg-secondary">
        Organisation name and mission statement shown in the page hero and About panel.
      </p>
      <label className="block">
        <span className="label">Organisation name</span>
        <input type="text" className="input" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
      </label>
      <label className="block">
        <span className="label">Mission statement</span>
        <textarea className="input" style={{ height: "6rem", resize: "vertical" }} value={mission} onChange={(e) => setMission(e.target.value)} />
      </label>
      {(orgName || mission) && (
        <div className="rounded-md bg-sunken border border-token p-4">
          <div className="text-xs text-fg-tertiary mb-2 uppercase tracking-wider">Preview</div>
          {orgName && <div className="font-bold text-fg-primary">{orgName}</div>}
          {mission && <p className="text-sm text-fg-secondary mt-1">{mission}</p>}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save branding"}
        </button>
        {msg && <span className="chip chip-authentic">{msg}</span>}
      </div>
      {err && <div className="alert danger"><strong>Error.</strong> <span>{err}</span></div>}
    </div>
  );
}

/* ─── Validation Panel ────────────────────────────────────────────────── */
const HINT_OPTIONS = [
  { value: "",    label: "Auto-detect" },
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — Pound Sterling" },
  { value: "JPY", label: "JPY — Japanese Yen" },
  { value: "AED", label: "AED — UAE Dirham" },
];

function ValidationPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run() {
    if (!file) { setErr("Please select an image file first."); return; }
    setBusy(true); setErr(null); setResult(null);
    try { setResult(await api.scan(file, hint || undefined)); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  function reset() {
    setFile(null); setResult(null); setErr(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="card space-y-4">
        <h2 className="t-display text-xl flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-brand" /> Validation harness
        </h2>
        <p className="text-sm text-fg-secondary">
          Upload any banknote image to run the full seven-technique pipeline and
          inspect the raw breakdown.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="label">Test image</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="block w-full text-sm text-fg-secondary
                file:mr-3 file:rounded file:border-0
                file:bg-gov-navy file:px-3 file:py-1.5
                file:text-sm file:font-medium file:text-white
                hover:file:bg-gov-navy-dark cursor-pointer"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setErr(null); }}
            />
          </label>
          <label className="block">
            <span className="label">Currency hint (optional)</span>
            <select className="input" value={hint} onChange={(e) => setHint(e.target.value)}>
              {HINT_OPTIONS.map((h) => (
                <option key={h.value || "auto"} value={h.value}>{h.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button className="btn btn-primary" onClick={run} disabled={busy || !file}>
            <Upload className="h-4 w-4" />
            {busy ? "Running pipeline…" : "Run pipeline"}
          </button>
          {file && (
            <span className="text-xs text-fg-secondary flex items-center gap-1.5">
              <span className="chip">{file.name}</span>
              <button className="text-fg-tertiary hover:text-fg-primary" onClick={reset} aria-label="Clear">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
        {err && <div className="alert danger"><strong>Error.</strong> <span>{err}</span></div>}
        <details className="text-xs">
          <summary className="cursor-pointer text-fg-tertiary hover:text-fg-secondary select-none">
            View pipeline stages ({PBL_TECHNIQUES.length} techniques)
          </summary>
          <ol className="mt-2 space-y-1 pl-1">
            {PBL_TECHNIQUES.map((t) => (
              <li key={t.num} className="flex gap-2 items-baseline text-fg-secondary">
                <span className="t-mono w-3 shrink-0 text-fg-tertiary">{t.num}.</span>
                <span><strong>{t.name}</strong> — {t.detail}</span>
              </li>
            ))}
          </ol>
        </details>
      </div>
      {result && (
        <div>
          <div className="t-eyebrow mb-3">Pipeline result</div>
          <ResultCard r={result} />
        </div>
      )}
    </div>
  );
}

/* ─── About Panel ─────────────────────────────────────────────────────── */
function AboutPanel() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [orgName, setOrgName] = useState("VeriCash — Office of Currency Authentication");
  const [mission, setMission] = useState(
    "Detect counterfeit banknotes through transparent, auditable image-processing."
  );

  useEffect(() => {
    api.members().then((m) => setMembers(m.sort((a, b) => (a.order_index ?? 99) - (b.order_index ?? 99)))).catch(() => {});
    api.settings().then((rows) => {
      rows.forEach((r) => {
        if (r.key === "organization_name") setOrgName(String(r.value));
        if (r.key === "mission_statement")  setMission(String(r.value));
      });
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="card space-y-3">
        <h2 className="t-display text-2xl">{orgName}</h2>
        {mission && <p className="text-fg-secondary">{mission}</p>}
        <div className="flex flex-wrap gap-2">
          <span className="chip chip-brand">
            <ShieldCheck className="h-3 w-3 inline mr-1" />7 PBL techniques
          </span>
          <span className="chip">CIE Lab fingerprint classifier</span>
          <span className="chip chip-gold">Heuristic v3 · k-means dominant</span>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold text-fg-primary text-lg flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-brand" /> Detection pipeline — 7 PBL techniques
        </h3>
        <ol className="space-y-3">
          {PBL_TECHNIQUES.map((t) => (
            <li key={t.num} className="flex gap-3 text-sm items-start">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gov-navy text-white text-xs font-bold">
                {t.num}
              </span>
              <div>
                <span className="font-semibold text-fg-primary">{t.name}</span>
                <span className="text-fg-tertiary"> — {t.detail}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold text-fg-primary text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-brand" /> Project team
        </h3>
        {members.length === 0 ? (
          <div className="text-sm text-fg-tertiary">Loading team…</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {members.map((m) => (
              <div key={m.id} className="flex items-start gap-3 p-3 rounded-md bg-sunken border border-token">
                <MemberAvatar name={m.name} photoUrl={m.photo_url} size={40} />
                <div className="min-w-0">
                  <div className="font-semibold text-fg-primary text-sm">{m.name}</div>
                  <div className="text-xs text-fg-secondary mt-0.5">{m.role}</div>
                  {m.contribution && (
                    <p className="text-xs text-fg-tertiary mt-1 line-clamp-3">{m.contribution}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-fg-tertiary border-t border-token pt-3">
          Full roster is managed on the{" "}
          <a href="/members" className="text-link hover:underline">Administration</a> page.
        </p>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold text-fg-primary text-lg">Technology stack</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
          {[
            ["Backend",    "FastAPI + SQLite"],
            ["CV",         "OpenCV + Pillow"],
            ["Classifier", "CIE Lab k-means"],
            ["Web",        "Next.js 14 App Router"],
            ["Mobile",     "Expo / React Native"],
            ["Auth",       "JWT Bearer tokens"],
          ].map(([label, val]) => (
            <div key={label} className="rounded-md bg-sunken border border-token px-3 py-2">
              <div className="text-xs text-fg-tertiary uppercase tracking-wide">{label}</div>
              <div className="font-medium text-fg-primary mt-0.5">{val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Shared helpers ──────────────────────────────────────────────────── */
/* ─── Denomination chip-tag input ─────────────────────────────────────── */
function DenomInput({
  values,
  onChange,
}: {
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const trimmed = raw.trim().replace(/[^0-9]/g, "");
    if (!trimmed || values.includes(trimmed)) { setDraft(""); return; }
    // Insert in numeric order
    const next = [...values, trimmed].sort((a, b) => Number(a) - Number(b));
    onChange(next);
    setDraft("");
  }

  function remove(val: string) {
    onChange(values.filter((v) => v !== val));
  }

  return (
    <div>
      <span className="label">Denominations</span>
      <div
        style={{
          display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
          minHeight: 42, padding: "6px 10px",
          border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)",
          background: "var(--bg-canvas)", cursor: "text",
        }}
        onClick={(e) => {
          const inp = (e.currentTarget as HTMLElement).querySelector("input");
          inp?.focus();
        }}
      >
        {values.map((v) => (
          <span key={v} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            height: 24, padding: "0 8px",
            background: "var(--gov-blue-50)", color: "var(--gov-navy)",
            border: "1px solid var(--gov-blue-light)",
            borderRadius: "var(--r-full)", fontSize: 12, fontWeight: 600,
            fontFamily: "var(--font-mono)",
          }}>
            {v}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(v); }}
              style={{
                display: "inline-flex", alignItems: "center", background: "none",
                border: "none", padding: 0, cursor: "pointer",
                color: "var(--gov-navy)", opacity: 0.6, lineHeight: 1,
              }}
              aria-label={`Remove ${v}`}
            >
              <X style={{ width: 11, height: 11 }} />
            </button>
          </span>
        ))}
        <input
          type="text"
          inputMode="numeric"
          placeholder={values.length === 0 ? "Type a value, press Enter" : "Add…"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === " ") {
              e.preventDefault(); commit(draft);
            }
            if (e.key === "Backspace" && draft === "" && values.length > 0) {
              remove(values[values.length - 1]);
            }
          }}
          onBlur={() => { if (draft.trim()) commit(draft); }}
          style={{
            flex: 1, minWidth: 90, border: "none", outline: "none",
            background: "transparent", fontSize: 14,
            color: "var(--fg-primary)", fontFamily: "var(--font-sans)",
          }}
        />
      </div>
      <p style={{ fontSize: 12, color: "var(--fg-tertiary)", marginTop: 5 }}>
        Press <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>Enter</kbd> or{" "}
        <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>Space</kbd> to add a denomination.
        Click × to remove.
      </p>
    </div>
  );
}

function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-modal grid place-items-center p-4"
      style={{ background: "var(--bg-overlay)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-lg space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="t-display text-xl">{title}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, v, on, type }: {
  label: string; v: string; on: (s: string) => void; type?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input type={type || "text"} className="input" value={v} onChange={(e) => on(e.target.value)} autoComplete="off" />
    </label>
  );
}

function PwField({ label, value, onChange, show, type }: {
  label: string; value: string; onChange: (s: string) => void; show?: boolean; type?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        type={type ?? (show ? "text" : "password")}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
    </label>
  );
}

function Slider({ label, value, on }: { label: string; value: number; on: (n: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="label !mb-0">{label}</span>
        <span className="t-mono text-sm text-fg-primary font-semibold">{value.toFixed(2)}</span>
      </div>
      <input
        type="range" min={0} max={1} step={0.01} value={value}
        onChange={(e) => on(Number(e.target.value))}
        className="w-full accent-gov-navy"
      />
    </div>
  );
}

function MemberAvatar({ name, photoUrl, size = 40 }: { name: string; photoUrl?: string | null; size?: number }) {
  const [imgErr, setImgErr] = useState(false);
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (photoUrl && !imgErr) {
    return (
      <img
        src={photoUrl}
        alt=""
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
      className="rounded-md border border-strong shrink-0 flex items-center justify-center text-white font-bold"
      style={{
        width: size,
        height: size,
        background: "var(--gov-navy)",
        fontSize: size * 0.35,
      }}
    >
      {initials}
    </div>
  );
}
