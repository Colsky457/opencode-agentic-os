"use client";

import { create } from "zustand";

export type AppId =
  | "command"
  | "chat"
  | "agents"
  | "personas"
  | "arena"
  | "automations"
  | "tools"
  | "tasks"
  | "vault"
  | "system"
  | "goals"
  | "journal"
  | "graph"
  | "prompts"
  | "files"
  | "usage"
  | "guide"
  | "digest"
  | "hermesdash"
  | "router"
  | "settings";

interface OsState {
  booted: boolean;
  paletteOpen: boolean;
  activeApp: AppId;
  activeAgentId: string | null;
  demoMode: boolean;
  claudeVersion: string | null;
  providerId: string | null;
  claudeQuotaError: string | null;
  serverAddr: string | null;
  set: (p: Partial<OsState>) => void;
}

export const useOs = create<OsState>((set) => ({
  booted: false,
  paletteOpen: false,
  activeApp: "command",
  activeAgentId: null,
  demoMode: false,
  claudeVersion: null,
  providerId: null,
  claudeQuotaError: null,
  serverAddr: null,
  set: (p) => set(p),
}));

export const APPS: { id: AppId; name: string; icon: string; hint: string }[] = [
  { id: "command", name: "Command", icon: "◈", hint: "Mission overview" },
  { id: "chat", name: "AI Chat", icon: "✦", hint: "Talk to any provider" },
  { id: "agents", name: "Agents", icon: "⬢", hint: "Fleet control" },
  { id: "personas", name: "System & Personas", icon: "🎭", hint: "Platform roles & prompts" },
  { id: "arena", name: "Agent Arena", icon: "⚔️", hint: "Side-by-side collaborate" },
  { id: "automations", name: "Automations", icon: "⚙️", hint: "Schedules & webhooks" },
  { id: "tools", name: "Tool Registry", icon: "🧰", hint: "Permissions & approvals" },
  { id: "tasks", name: "Task Queue", icon: "📋", hint: "Background Kanban" },
  { id: "vault", name: "Vault Explorer", icon: "📚", hint: "Search notes & docs" },
  { id: "system", name: "System Telemetry", icon: "📊", hint: "Host & fleet health" },
  { id: "hermesdash", name: "Hermes Board", icon: "🖥️", hint: "Hermes web console · :9119" },
  { id: "router", name: "Router", icon: "🔀", hint: "9router gateway · :20128" },
  { id: "goals", name: "Goals", icon: "◎", hint: "Missions & targets" },
  { id: "journal", name: "Journal", icon: "❝", hint: "Daily log" },
  { id: "graph", name: "Memory Graph", icon: "⋈", hint: "Shared memory" },
  { id: "prompts", name: "Prompts", icon: "✎", hint: "Template library" },
  { id: "files", name: "Files", icon: "▤", hint: "Workspace browser" },
  { id: "usage", name: "Usage", icon: "◊", hint: "Tokens & cost" },
  { id: "guide", name: "Guide", icon: "📖", hint: "Build your own" },
  { id: "digest", name: "Digest", icon: "🌙", hint: "Nightly note" },
  { id: "settings", name: "Settings", icon: "⚙", hint: "System config" },
];
