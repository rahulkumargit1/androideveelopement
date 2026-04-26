"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, Activity } from "lucide-react";
import { api } from "@/lib/api";
import clsx from "clsx";

interface ServiceStatus {
  name: string;
  status: "ok" | "error" | "checking";
  detail?: string;
  latency?: number;
}

export default function StatusPage() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: "Backend API",       status: "checking" },
    { name: "Database / ORM",    status: "checking" },
    { name: "Currency catalogue",status: "checking" },
    { name: "Settings store",    status: "checking" },
  ]);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    setServices((s) => s.map((x) => ({ ...x, status: "checking" })));

    const results: ServiceStatus[] = [];

    // 1. Backend root endpoint (GET / returns {"app":"VeriCash API","status":"ok"})
    const t0 = Date.now();
    try {
      const res = await fetch(`${api.apiBase}/`);
      const latency = Date.now() - t0;
      if (res.ok) {
        const json = await res.json();
        results.push({ name: "Backend API", status: "ok", detail: json.status || "healthy", latency });
      } else {
        results.push({ name: "Backend API", status: "error", detail: `HTTP ${res.status}`, latency });
      }
    } catch (e: any) {
      results.push({ name: "Backend API", status: "error", detail: e.message || "Unreachable", latency: Date.now() - t0 });
    }

    // 2 + 3. Database / ORM AND Currency catalogue — one request, two checks
    const t1 = Date.now();
    try {
      const currencies = await api.currencies();
      const latency = Date.now() - t1;
      results.push({
        name: "Database / ORM",
        status: "ok",
        detail: `${currencies.length} currencies loaded`,
        latency,
      });
      const enabled = currencies.filter((x) => x.enabled);
      results.push({
        name: "Currency catalogue",
        status: enabled.length > 0 ? "ok" : "error",
        detail: `${enabled.length} of ${currencies.length} enabled`,
        latency,
      });
    } catch {
      const latency = Date.now() - t1;
      results.push({ name: "Database / ORM",    status: "error", detail: "Query failed",  latency });
      results.push({ name: "Currency catalogue", status: "error", detail: "Unavailable",   latency });
    }

    // 4. Settings store
    const t3 = Date.now();
    try {
      const settings = await api.settings();
      results.push({
        name: "Settings store",
        status: settings.length > 0 ? "ok" : "error",
        detail: `${settings.length} keys`,
        latency: Date.now() - t3,
      });
    } catch {
      results.push({ name: "Settings store", status: "error", detail: "Unavailable", latency: Date.now() - t3 });
    }

    setServices(results);
    setCheckedAt(new Date());
    setChecking(false);
  }

  useEffect(() => { check(); }, []);

  const allOk = services.every((s) => s.status === "ok");
  const hasError = services.some((s) => s.status === "error");

  return (
    <>
      <section className="gov-hero">
        <div className="mx-auto max-w-container px-4 sm:px-6">
          <div className="t-eyebrow mb-1">Bureau Operations</div>
          <h1 className="t-display">System Status</h1>
          <p>
            Real-time health of the VeriCash backend, database, and
            supporting services.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-container px-4 sm:px-6 py-8 space-y-6 max-w-2xl">

        {/* Overall badge */}
        <div
          className={clsx(
            "rounded-md px-5 py-4 flex items-center gap-3 border",
            hasError
              ? "bg-counterfeit-bg border-counterfeit text-counterfeit-fg"
              : allOk
              ? "bg-authentic-bg border-authentic text-authentic-fg"
              : "bg-suspicious-bg border-suspicious text-suspicious-fg"
          )}
        >
          <Activity className="h-6 w-6 shrink-0" />
          <div>
            <div className="font-bold text-lg">
              {hasError ? "Service degraded" : allOk ? "All systems operational" : "Checking…"}
            </div>
            {checkedAt && (
              <div className="text-sm opacity-75">
                Last checked: {checkedAt.toLocaleTimeString()}
              </div>
            )}
          </div>
          <button
            className="ml-auto btn btn-ghost btn-sm"
            onClick={check}
            disabled={checking}
            aria-label="Refresh"
          >
            <RefreshCw className={clsx("h-4 w-4", checking && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* Service rows */}
        <div className="card !p-0 overflow-hidden divide-y divide-token">
          {services.map((svc) => (
            <div key={svc.name} className="flex items-center gap-4 px-5 py-4">
              {svc.status === "checking" ? (
                <RefreshCw className="h-5 w-5 text-fg-tertiary animate-spin shrink-0" />
              ) : svc.status === "ok" ? (
                <CheckCircle2 className="h-5 w-5 text-authentic shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-counterfeit shrink-0" />
              )}
              <div className="flex-1">
                <div className="font-semibold text-fg-primary">{svc.name}</div>
                {svc.detail && (
                  <div className="text-sm text-fg-secondary">{svc.detail}</div>
                )}
              </div>
              <div className="text-right">
                <span
                  className={clsx(
                    "chip text-xs",
                    svc.status === "ok"
                      ? "chip-authentic"
                      : svc.status === "error"
                      ? "chip-counterfeit"
                      : ""
                  )}
                >
                  {svc.status === "checking" ? "checking…" : svc.status}
                </span>
                {svc.latency !== undefined && (
                  <div className="text-xs text-fg-tertiary mt-1 t-mono">{svc.latency} ms</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Backend info */}
        <div className="card space-y-2">
          <div className="t-eyebrow mb-1">API endpoints</div>
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            {[
              ["Health",     `${api.apiBase}/`],
              ["API docs",   `${api.apiBase}/docs`],
              ["OpenAPI",    `${api.apiBase}/openapi.json`],
              ["Scan",       `${api.apiBase}/api/scan`],
              ["Currencies", `${api.apiBase}/api/currencies`],
              ["Settings",   `${api.apiBase}/api/settings`],
            ].map(([label, url]) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-md bg-sunken border border-token px-3 py-2 hover:border-strong no-underline"
              >
                <span className="font-medium text-fg-primary">{label}</span>
                <span className="t-mono text-xs text-fg-tertiary truncate ml-3 max-w-[160px]">{url.replace(api.apiBase, "")}</span>
              </a>
            ))}
          </div>
        </div>

        <p className="text-xs text-fg-tertiary">
          This page is refreshed on load. Click <strong>Refresh</strong> for an
          on-demand check. Backend URL:{" "}
          <span className="t-mono">{api.apiBase}</span>
        </p>
      </div>
    </>
  );
}
