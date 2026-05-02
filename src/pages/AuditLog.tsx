import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  History,
  Receipt,
  Search,
  Settings,
  ShieldAlert,
  Truck,
  UserRound,
  Users,
} from "lucide-react";
import { format, isToday, parseISO } from "date-fns";
import { useErp } from "../context/ErpContext";
import { AuditEntityType, AuditLog as AuditLogEntry } from "../types";
import { cn } from "../lib/utils";
import { EmptyState } from "../components/ui/EmptyState";

type ActionFilter = "all" | "created" | "updated" | "status" | "deleted" | "settings";

const ENTITY_FILTERS: Array<"all" | AuditEntityType> = [
  "all",
  "Slip",
  "Invoice",
  "Customer",
  "Vehicle",
  "Transaction",
  "Task",
  "Material",
  "Settings",
  "System",
];

const ACTION_FILTERS: { id: ActionFilter; label: string }[] = [
  { id: "all", label: "All actions" },
  { id: "created", label: "Created" },
  { id: "updated", label: "Updated" },
  { id: "status", label: "Status" },
  { id: "deleted", label: "Deleted" },
  { id: "settings", label: "Settings" },
];

function formatTimestamp(timestamp: string) {
  try {
    return format(parseISO(timestamp), "dd MMM yyyy, hh:mm a");
  } catch {
    return timestamp;
  }
}

function matchesActionFilter(log: AuditLogEntry, filter: ActionFilter) {
  const action = log.action.toLowerCase();
  if (filter === "all") return true;
  if (filter === "created") return action.includes("created");
  if (filter === "updated") return action.includes("updated");
  if (filter === "status") return action.includes("status") || action.includes("marked");
  if (filter === "deleted") {
    return (
      action.includes("deleted") ||
      action.includes("deactivated") ||
      action.includes("cancelled") ||
      action.includes("purged")
    );
  }
  return log.entityType === "Settings" || log.entityType === "Material";
}

function isRiskAction(log: AuditLogEntry) {
  const action = log.action.toLowerCase();
  return (
    action.includes("deleted") ||
    action.includes("deactivated") ||
    action.includes("cancelled") ||
    action.includes("purged")
  );
}

function entityIcon(entityType: AuditEntityType) {
  switch (entityType) {
    case "Slip":
    case "Vehicle":
      return Truck;
    case "Invoice":
      return Receipt;
    case "Customer":
      return Users;
    case "Transaction":
      return FileText;
    case "Settings":
    case "Material":
      return Settings;
    case "Task":
      return CheckCircle2;
    default:
      return History;
  }
}

function actionTone(log: AuditLogEntry) {
  if (isRiskAction(log)) return "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20";
  if (log.action.toLowerCase().includes("created")) return "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20";
  if (log.action.toLowerCase().includes("status") || log.action.toLowerCase().includes("marked")) return "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20";
  return "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
}

function actorInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function AuditLog() {
  const { auditLogs, userRole } = useErp();
  const [query, setQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState<"all" | AuditEntityType>("all");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [dateFilter, setDateFilter] = useState("");

  const sortedLogs = useMemo(
    () => [...auditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [auditLogs],
  );

  const filteredLogs = useMemo(() => {
    const search = query.trim().toLowerCase();
    return sortedLogs.filter((log) => {
      if (entityFilter !== "all" && log.entityType !== entityFilter) return false;
      if (!matchesActionFilter(log, actionFilter)) return false;
      if (dateFilter && log.timestamp.slice(0, 10) !== dateFilter) return false;
      if (!search) return true;
      const haystack = [
        log.actorName,
        log.actorRole,
        log.action,
        log.entityType,
        log.entityLabel,
        log.entityId,
        log.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [sortedLogs, query, entityFilter, actionFilter, dateFilter]);

  const todayCount = useMemo(
    () => auditLogs.filter((log) => {
      try {
        return isToday(parseISO(log.timestamp));
      } catch {
        return false;
      }
    }).length,
    [auditLogs],
  );

  const riskCount = useMemo(() => auditLogs.filter(isRiskAction).length, [auditLogs]);
  const actorCount = useMemo(() => new Set(auditLogs.map((log) => log.actorName)).size, [auditLogs]);

  if (userRole !== "Admin") {
    return (
      <div className="flex h-full flex-col items-center justify-center text-zinc-500">
        <ShieldAlert className="mb-4 h-12 w-12 text-rose-400" />
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Access Denied</h2>
        <p>Only Admins can view audit logs.</p>
      </div>
    );
  }

  const hasFilters = query.trim() || entityFilter !== "all" || actionFilter !== "all" || dateFilter;

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">
            Audit Log
          </h2>
          <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {filteredLogs.length} event{filteredLogs.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          { label: "Total Events", value: auditLogs.length, icon: History, tone: "text-zinc-500" },
          { label: "Today", value: todayCount, icon: CalendarDays, tone: "text-blue-500" },
          { label: "Sensitive", value: riskCount, icon: AlertTriangle, tone: "text-rose-500" },
          { label: "Users", value: actorCount, icon: UserRound, tone: "text-emerald-500" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {label}
              </span>
              <Icon className={cn("h-4 w-4", tone)} />
            </div>
            <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-2 border-b border-zinc-100 p-3 dark:border-zinc-800 md:grid-cols-[minmax(220px,1fr)_160px_160px_150px_auto] md:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search user, slip, invoice..."
              className="min-h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            />
          </div>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value as "all" | AuditEntityType)}
            className="min-h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
          >
            {ENTITY_FILTERS.map((entity) => (
              <option key={entity} value={entity}>
                {entity === "all" ? "All entities" : entity}
              </option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as ActionFilter)}
            className="min-h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
          >
            {ACTION_FILTERS.map((action) => (
              <option key={action.id} value={action.id}>{action.label}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="min-h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
          />
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setEntityFilter("all");
                setActionFilter("all");
                setDateFilter("");
              }}
              className="min-h-11 rounded-xl px-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
            >
              Clear
            </button>
          )}
        </div>

        <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
          {filteredLogs.map((log) => {
            const Icon = entityIcon(log.entityType);
            return (
              <article key={log.id} className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", actionTone(log))}>
                        {log.action}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white break-words">
                      {log.description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">{log.actorName}</span>
                      <span>{log.actorRole}</span>
                      <span>{log.entityType}</span>
                      {log.entityLabel && <span className="truncate max-w-40">{log.entityLabel}</span>}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          {filteredLogs.length === 0 && (
            <EmptyState
              icon={Clock3}
              title={hasFilters ? "No matching audit entries" : "No audit entries yet"}
              className="py-14"
            />
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Record</th>
                <th className="px-4 py-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredLogs.map((log) => {
                const Icon = entityIcon(log.entityType);
                return (
                  <tr key={log.id} className="align-top hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="whitespace-nowrap px-4 py-4 text-zinc-500 dark:text-zinc-400">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-xs font-bold text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                          {actorInitials(log.actorName)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-zinc-900 dark:text-white truncate">{log.actorName}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{log.actorRole}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", actionTone(log))}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
                        <div className="min-w-0">
                          <p className="font-semibold text-zinc-900 dark:text-white">{log.entityType}</p>
                          <p className="max-w-52 truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {log.entityLabel || log.entityId || "-"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">
                      <span className="block max-w-xl break-words">{log.description}</span>
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={Clock3}
                      title={hasFilters ? "No matching audit entries" : "No audit entries yet"}
                      className="py-14"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
