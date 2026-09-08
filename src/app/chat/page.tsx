"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AgentAvatar } from "@/components/os/AgentAvatar";
import { Card, Pill } from "@/components/os/ui";
import { dayLabel, formatClock, renderMarkdown, SpeakerAvatar, TypingDots } from "@/components/chat/bits";
import { VoiceField } from "@/components/chat/VoiceField";
import { useOs } from "@/lib/os-store";
import { cn } from "@/lib/utils";

interface Citation {
  file: string;
  title: string;
  chunkIndex: number;
  text: string;
}
interface Msg {
  role: "user" | "assistant";
  content: string;
  ts: number;
  citations?: Citation[];
}
interface SessionMeta {
  id: string;
  title: string;
  agentId: string | null;
  updatedAt: number;
  count: number;
  provider?: string;
  autoRouted?: boolean;
}
interface ProviderOpt {
  id: string;
  label: string;
  glyph: string;
  color: string;
  streaming: boolean;
  installed: boolean;
}
interface AgentLite {
  id: string;
  name: string;
  color: string;
  avatarSeed?: number;
  status?: "idle" | "running" | "error";
  persona?: string;
  provider?: string;
}

const FALLBACK_MODELS = ["default", "opus", "sonnet", "haiku"];

function ChatInner() {
  const router = useRouter();
  const search = useSearchParams();
  const demoMode = useOs((s) => s.demoMode);
  const set = useOs((s) => s.set);

  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("default");
  const [models, setModels] = useState<string[]>(FALLBACK_MODELS);
  const [providers, setProviders] = useState<ProviderOpt[]>([]);
  const [provider, setProvider] = useState("auto");
  const [route, setRoute] = useState<{ provider: string; label: string; glyph: string; matched: string[]; live: boolean } | null>(null);
  const [agentId, setAgentId] = useState<string>("");
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [stuckBottom, setStuckBottom] = useState(true);
  const [useVault, setUseVault] = useState(false);
  const [expandedCite, setExpandedCite] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const activeAgent = agents.find((a) => a.id === agentId) ?? null;

  const refreshSessions = useCallback(
    (agent?: string) => {
      const q = agent ? `?agent=${agent}` : "";
      fetch(`/api/chat${q}`).then((r) => r.json()).then((d) => setSessions(d.sessions ?? [])).catch(() => {});
    },
    []
  );

  // init from URL (?s= session, ?agent= persona)
  useEffect(() => {
    fetch("/api/agents").then((r) => r.json()).then((d) => setAgents(d.agents ?? [])).catch(() => {});
    fetch("/api/status").then((r) => r.json()).then((d) => {
      if (Array.isArray(d.models) && d.models.length) setModels(d.models);
      if (Array.isArray(d.providers) && d.providers.length) {
        setProviders(d.providers.filter((p: ProviderOpt) => p.installed));
        // default stays "auto"; explicit default only applies when opening old sessions
      }
    }).catch(() => {});
    const s = search.get("s");
    const a = search.get("agent");
    if (a) setAgentId(a);
    refreshSessions(a ?? undefined);
    if (s) openSession(s, a ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncUrl = (s: string | null, a: string) => {
    const p = new URLSearchParams();
    if (s) p.set("s", s);
    if (a) p.set("agent", a);
    router.replace(`/chat${p.toString() ? `?${p}` : ""}`, { scroll: false });
  };

  const openSession = async (id: string, agentOverride?: string) => {
    const r = await fetch(`/api/chat?id=${id}`).then((x) => x.json());
    if (r.session) {
      setSessionId(r.session.id);
      setMsgs(r.session.messages.filter((m: { role: string }) => m.role !== "system"));
      setModel(r.session.model ?? "default");
      const ag = agentOverride ?? r.session.agentId ?? "";
      setAgentId(ag);
      const agObj = agents.find((a) => a.id === ag);
      if (r.session.autoRouted && r.session.provider) {
        setProvider("auto");
        const p = providers.find((x) => x.id === r.session.provider);
        setRoute({ provider: r.session.provider, label: p?.label ?? r.session.provider, glyph: p?.glyph ?? "•", matched: [], live: false });
      } else if (r.session.provider) {
        setProvider(r.session.provider);
        setRoute(null);
      } else if (agObj?.provider) {
        setProvider(agObj.provider);
        setRoute(null);
      }
      setUsage(null);
      setErr(null);
      setStuckBottom(true);
      syncUrl(r.session.id, ag);
    }
  };

  const newChat = (agent?: string) => {
    const ag = agent ?? agentId;
    setSessionId(null);
    setMsgs([]);
    setUsage(null);
    setErr(null);
    setAgentId(ag);
    setRoute(null);
    syncUrl(null, ag);
    composerRef.current?.focus();
  };

  // scroll behavior
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setStuckBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 90);
  };
  useEffect(() => {
    if (stuckBottom) scrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" });
  }, [msgs, stuckBottom, streaming]);
  const jumpBottom = () => {
    setStuckBottom(true);
    scrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" });
  };

  // autogrow composer
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 150) + "px";
  }, [input]);

  // live routing preview while typing in Auto mode (debounced)
  useEffect(() => {
    if (provider !== "auto" || streaming) return;
    const text = input.trim();
    if (!text) {
      setRoute(null);
      return;
    }
    const t = setTimeout(async () => {
      const d = await fetch("/api/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 2000) }),
      }).then((r) => r.json()).catch(() => null);
      if (d?.provider) setRoute({ provider: d.provider, label: d.label, glyph: d.glyph, matched: d.matched ?? [], live: true });
    }, 350);
    return () => clearTimeout(t);
  }, [input, provider, streaming]);

  const routeLabel = (id: string) => {
    const p = providers.find((x) => x.id === id);
    return p ? `${p.glyph} ${p.label}` : id;
  };

  const send = async (text?: string, retryOf?: string) => {
    const content = (retryOf ?? text ?? input).trim();
    if (!content || streaming) return;
    setInput("");
    setErr(null);
    setUsage(null);
    setStuckBottom(true);
    setMsgs((m) => [...m, { role: "user", content, ts: Date.now() }, { role: "assistant", content: "", ts: Date.now() }]);
    setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          model: model === "default" ? undefined : model,
          agentId: agentId || null,
          sessionId,
          provider,
          vault: useVault || undefined,
          demo: demoMode || undefined,
        }),
        signal: abortRef.current.signal,
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const evt = JSON.parse(line.slice(5));
          if (evt.type === "meta" && evt.sessionId) {
            setSessionId(evt.sessionId);
            if (evt.provider) {
              if (provider === "auto") {
                const p = providers.find((x) => x.id === evt.provider);
                setRoute({ provider: evt.provider, label: p?.label ?? evt.provider, glyph: p?.glyph ?? "•", matched: evt.matched ?? [], live: false });
              } else {
                setProvider(evt.provider);
              }
            }
            syncUrl(evt.sessionId, agentId);
          }
          if (evt.type === "delta") {
            acc += evt.text;
            setMsgs((m) => {
              const copy = [...m];
              copy[copy.length - 1] = { ...copy[copy.length - 1], content: acc };
              return copy;
            });
          }
          if (evt.type === "done") {
            setUsage(evt.usage ?? null);
            if (Array.isArray(evt.citations) && evt.citations.length) {
              const cites: Citation[] = evt.citations;
              setMsgs((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { ...copy[copy.length - 1], citations: cites };
                return copy;
              });
            }
            refreshSessions(agentId || undefined);
          }
          if (evt.type === "error") {
            setErr(evt.error);
            setMsgs((m) => m.slice(0, -1));
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setErr(e instanceof Error ? e.message : "send failed");
        setMsgs((m) => m.slice(0, -1));
      }
    } finally {
      setStreaming(false);
    }
  };

  const copyMsg = (t: string) => navigator.clipboard.writeText(t).catch(() => {});
  const saveAsPrompt = async (t: string) => {
    await fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t.slice(0, 48), body: t, tags: ["from-chat"] }),
    }).catch(() => {});
    router.push("/prompts");
  };

  const switchAgent = (a: string) => {
    setAgentId(a);
    const agObj = agents.find((x) => x.id === a);
    if (agObj?.provider) setProvider(agObj.provider);
    refreshSessions(a || undefined);
    newChat(a);
  };

  const isQuotaErr = err ? /402|quota|budget/i.test(err) : false;

  // group + date dividers
  let lastDay = "";
  let lastRole = "";

  return (
    <div className="grid gap-4 lg:grid-cols-[290px_1fr]">
      {/* ── session rail ── */}
      <Card className={cn("h-fit p-3", !showNew && "hidden lg:block")}>
        <div className="mb-2 flex items-center gap-2 px-1">
          <AgentAvatar seed={agentId || "direct"} seedNum={activeAgent?.avatarSeed ?? 0} color={activeAgent?.color ?? "#ff6b1a"} name={activeAgent?.name ?? "AI"} size={34} status={activeAgent?.status ?? null} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate font-display text-sm font-bold">{activeAgent ? `with ${activeAgent.name}` : "Direct channel"}</div>
            <div className="truncate text-[11px] opacity-50">{activeAgent?.persona ?? "Direct provider channel"}</div>
          </div>
          <button onClick={() => newChat()} title="New chat" className="rounded-full bg-[#ff6b1a]/15 px-3 py-1.5 text-xs font-bold text-[#ffb27a] transition hover:scale-105 hover:bg-[#ff6b1a]/25">
            +
          </button>
        </div>

        {/* persona switcher */}
        <div className="mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <button onClick={() => switchAgent("")} className={cn("avatar-hover shrink-0 rounded-full border p-0.5", agentId === "" ? "border-[#ff6b1a]" : "border-transparent opacity-60 hover:opacity-100")} title="Direct (no persona)">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#ff6b1a] to-[#8b5cf6] text-sm text-white">✦</span>
          </button>
          {agents.map((a) => (
            <button key={a.id} onClick={() => switchAgent(a.id)} title={a.name} className={cn("avatar-hover shrink-0 rounded-full border p-0.5", agentId === a.id ? "border-[#ff6b1a]" : "border-transparent opacity-60 hover:opacity-100")}>
              <AgentAvatar seed={a.id} seedNum={a.avatarSeed ?? 0} color={a.color} name={a.name} size={32} ring={false} />
            </button>
          ))}
          <Link href="/agents" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-white/20 text-sm opacity-60 hover:opacity-100" title="Manage agents">
            +
          </Link>
        </div>

        <div className="max-h-[46vh] space-y-1 overflow-y-auto lg:max-h-[54vh]">
          {sessions.map((s) => {
            const sa = agents.find((a) => a.id === s.agentId);
            return (
              <button
                key={s.id}
                onClick={() => openSession(s.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left text-sm transition",
                  s.id === sessionId ? "border border-[#ff6b1a]/40 bg-[#ff6b1a]/12" : "border border-transparent hover:bg-white/6"
                )}
              >
                {sa ? (
                  <AgentAvatar seed={sa.id} seedNum={sa.avatarSeed ?? 0} color={sa.color} name={sa.name} size={30} ring={false} />
                ) : (
                  <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#ff6b1a] to-[#8b5cf6] text-xs text-white">✦</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{s.title}</span>
                  <span className="block text-[11px] opacity-50">
                    {s.count} msgs · {dayLabel(s.updatedAt)}
                    {s.provider ? ` · ${(providers.find((p) => p.id === s.provider)?.glyph ?? "")} ${(providers.find((p) => p.id === s.provider)?.label ?? s.provider)}` : ""}
                  </span>
                </span>
              </button>
            );
          })}
          {sessions.length === 0 && (
            <div className="px-2 py-8 text-center text-sm opacity-50">
              {agentId ? `no chats with ${activeAgent?.name ?? "agent"} yet` : "no chats yet — say hi ✦"}
            </div>
          )}
        </div>
      </Card>

      {/* mobile session toggle */}
      <div className="lg:hidden">
        <button onClick={() => setShowNew((s) => !s)} className="glass w-full rounded-2xl py-2 text-xs opacity-70">
          {showNew ? "hide sessions ▴" : "browse sessions ▾"}
        </button>
      </div>

      {/* ── thread ── */}
      <Card className="flex min-h-[72vh] flex-col p-0">
        {/* thread header */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-3 py-3 sm:gap-3 sm:px-4">
          {activeAgent ? (
            <Link href={`/agents/${activeAgent.id}`} className="avatar-hover flex min-w-0 items-center gap-3">
              <AgentAvatar seed={activeAgent.id} seedNum={activeAgent.avatarSeed ?? 0} color={activeAgent.color} name={activeAgent.name} size={38} status={activeAgent.status ?? null} />
              <span className="min-w-0">
                <span className="block truncate font-display text-[15px] font-bold leading-tight">{activeAgent.name} <span className="font-normal opacity-40">→ profile</span></span>
                <span className="block truncate text-[11px] opacity-50">{activeAgent.status === "running" ? "● live process" : activeAgent.persona}</span>
              </span>
            </Link>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff6b1a] to-[#8b5cf6] text-lg text-white glow-orange">✦</span>
              <span className="min-w-0">
                <span className="block font-display text-[15px] font-bold leading-tight">Direct</span>
                <span className="block truncate text-[11px] opacity-50">
                  direct · {(() => {
                    const p = providers.find((x) => x.id === provider);
                    return p ? `${p.glyph} ${p.label}${p.streaming === false ? " (answers whole)" : ""}` : "AI provider";
                  })()}
                </span>
              </span>
            </div>
          )}
          <div className="flex-1" />
          {demoMode && <Pill tone="violet">demo</Pill>}
          <button
            onClick={() => setUseVault((v) => !v)}
            title={useVault ? "Vault context ON — answers cite your notes" : "Vault context OFF"}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition",
              useVault ? "border-[#22e6c8]/60 bg-[#22e6c8]/15 text-[#7ef0dd]" : "border-white/15 opacity-60 hover:opacity-100"
            )}
          >
            📚 {useVault ? "vault on" : "vault"}
          </button>
          {providers.length > 1 && (
            <select
              value={provider}
              onChange={(e) => { setProvider(e.target.value); setRoute(null); }}
              title="AI provider — Auto routes by keywords, or pick one to override"
              className="max-w-[128px] truncate rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs outline-none"
            >
              <option value="auto">✨ Auto</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.glyph} {p.label}
                </option>
              ))}
            </select>
          )}
          {provider === "auto" && route && (
            <span
              title={route.matched.length ? `Matched: ${route.matched.join(", ")}` : route.live ? "No keywords matched — fallback provider" : "Routed automatically"}
              className="rounded-full border border-[#8b5cf6]/50 bg-[#8b5cf6]/15 px-3 py-1.5 text-xs font-bold text-[#c4b0ff]"
            >
              {route.live ? "→" : "Auto:"} {route.glyph} {route.label}
            </span>
          )}
          <select value={model} onChange={(e) => setModel(e.target.value)} className="max-w-[128px] truncate rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs outline-none">
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* messages */}
        <div ref={scrollRef} onScroll={onScroll} className="relative max-h-[62vh] min-h-[38vh] flex-1 space-y-1 overflow-y-auto px-4 py-4 lg:max-h-[52vh]">
          {msgs.length === 0 && (
            <div className="py-8 text-center">
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3 }}>
                {activeAgent ? (
                  <AgentAvatar seed={activeAgent.id} seedNum={activeAgent.avatarSeed ?? 0} color={activeAgent.color} name={activeAgent.name} size={64} status={activeAgent.status ?? null} />
                ) : (
                  <span className="text-5xl">✦</span>
                )}
              </motion.div>
              <div className="font-display mt-3 text-xl font-bold">
                {activeAgent ? `Chat with ${activeAgent.name}` : "What are we building today, commander?"}
              </div>
              <div className="text-sm opacity-50">{activeAgent?.persona ?? "Streaming straight from your local AI provider."}</div>
              <div className="mx-auto mt-3 flex max-w-lg flex-wrap justify-center gap-2">
                {(activeAgent ? [`Brief me as ${activeAgent.name}`, "What can you do for me?", "Draft a plan of attack"] : ["Mission brief: summarize my OS", "Explain how my agent fleet works", "Draft a launch checklist"]).map((s) => (
                  <button key={s} onClick={() => send(s)} className="glass rounded-full px-3 py-1.5 text-xs transition hover:scale-105 hover:border-[#ff6b1a]/50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m, i) => {
            const day = dayLabel(m.ts);
            const showDay = day !== lastDay;
            lastDay = day;
            const grouped = lastRole === m.role && !showDay;
            lastRole = m.role;
            const isUser = m.role === "user";
            const isStreamingBubble = streaming && i === msgs.length - 1 && !isUser;
            return (
              <div key={i}>
                {showDay && (
                  <div className="my-3 flex items-center gap-3 text-[11px] opacity-40">
                    <span className="h-px flex-1 bg-white/10" />
                    {day}
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                )}
                <div className={cn("msg-pop group flex gap-2.5", isUser ? "flex-row-reverse" : "", grouped ? "mt-0.5" : "mt-3")}>
                  {!grouped ? (
                    <SpeakerAvatar who={isUser ? "user" : "assistant"} agent={activeAgent} size={30} />
                  ) : (
                    <span className="w-[30px] shrink-0" />
                  )}
                  <div className="min-w-0 max-w-[82%] break-words sm:max-w-[75%]">
                    {!grouped && (
                      <div className={cn("mb-0.5 flex items-baseline gap-2 text-[11px] opacity-50", isUser && "flex-row-reverse")}>
                        <span className="font-bold">{isUser ? "You" : activeAgent?.name ?? providers.find((x) => x.id === provider)?.label ?? "AI"}</span>
                        <span>{formatClock(m.ts)}</span>
                      </div>
                    )}
                    <div className={cn("rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", isUser ? "bubble-user" : "bubble-ai glass")}>
                      {m.content ? (
                        isUser ? <span className="break-words whitespace-pre-wrap">{m.content}</span> : renderMarkdown(m.content)
                      ) : isStreamingBubble ? (
                        <span className="opacity-70"><TypingDots /></span>
                      ) : null}
                    </div>
                    {!isUser && m.content && !streaming && (
                      <div className="mt-1 flex gap-2 text-[11px] opacity-0 transition group-hover:opacity-60">
                        <button onClick={() => copyMsg(m.content)} className="hover:underline">copy</button>
                        <button onClick={() => saveAsPrompt(m.content)} className="hover:underline">save as prompt</button>
                        {i > 0 && <button onClick={() => send(undefined, msgs[i - 1].content)} className="hover:underline">regenerate</button>}
                      </div>
                    )}
                    {!isUser && m.citations && m.citations.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {m.citations.map((c, ci) => {
                          const key = `${i}-${ci}`;
                          const open = expandedCite === key;
                          return (
                            <div key={key} className="max-w-full">
                              <button
                                onClick={() => setExpandedCite(open ? null : key)}
                                title={c.file}
                                className="flex max-w-full items-center gap-1 rounded-full border border-[#22e6c8]/40 bg-[#22e6c8]/10 px-2 py-0.5 text-[10px] text-[#7ef0dd] transition hover:bg-[#22e6c8]/20"
                              >
                                <span>📄</span>
                                <span className="truncate">{c.title}</span>
                              </button>
                              {open && (
                                <div className="mt-1 rounded-xl border border-[#22e6c8]/25 bg-black/40 p-2 text-[11px] leading-relaxed break-words whitespace-pre-wrap opacity-90">
                                  {c.text}
                                  <div className="mt-1 font-mono text-[10px] opacity-50">{c.file} · chunk {c.chunkIndex + 1}</div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {streaming && msgs.length > 0 && msgs[msgs.length - 1].role === "user" && (
            <div className="msg-pop mt-3 flex gap-2.5">
              <SpeakerAvatar who="assistant" agent={activeAgent} size={30} />
              <div className="bubble-ai glass rounded-2xl px-4 py-2.5 text-sm opacity-80"><TypingDots /></div>
            </div>
          )}

          <AnimatePresence>
            {!stuckBottom && msgs.length > 0 && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                onClick={jumpBottom}
                className="glass sticky bottom-2 left-1/2 -translate-x-1/2 rounded-full px-3.5 py-1.5 text-xs font-bold"
              >
                ↓ latest
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* error / quota */}
        {err && (
          <div className="mx-4 mb-2 rounded-2xl border border-red-400/40 bg-red-400/10 p-3 text-sm">
            <span className="font-bold text-red-300">Provider hiccup: </span>
            <span className="opacity-80">{err.slice(0, 280)}</span>
            {isQuotaErr && (
              <button onClick={() => set({ demoMode: true })} className="ml-2 rounded-full bg-[#8b5cf6]/25 px-3 py-1 text-xs font-bold text-[#c4b0ff] hover:bg-[#8b5cf6]/40">
                enable demo mode →
              </button>
            )}
          </div>
        )}
        {usage && (
          <div className="px-4 pb-1 text-[11px] opacity-50">
            ⚡ {usage.input}+{usage.output} tokens · ${Number(usage.cost).toFixed(4)} · {(usage.ms / 1000).toFixed(1)}s
            {(() => {
              const p = providers.find((x) => x.id === provider);
              return p ? ` · via ${p.glyph} ${p.label}` : "";
            })()}
          </div>
        )}

        {/* composer */}
        <div className="p-3 pt-1">
          <div className="composer glass flex items-end gap-2 rounded-3xl p-2 pl-4 transition">
            <VoiceField value={input} onText={setInput} multiline className="flex-1">
              <textarea
                ref={composerRef}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder={activeAgent ? `Message ${activeAgent.name}…  (↵ send · ⇧↵ newline)` : demoMode ? "Demo core listening…" : "Message…  (↵ send · ⇧↵ newline)"}
                className="max-h-[150px] w-full flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-white/30"
              />
            </VoiceField>
            {streaming ? (
              <button onClick={() => abortRef.current?.abort()} title="Stop" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/85 text-sm font-bold text-white transition hover:scale-105 hover:bg-red-500">■</button>
            ) : (
              <button onClick={() => send()} disabled={!input.trim()} title="Send" className="glow-orange flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff6b1a] to-[#ff9a3d] text-base text-white transition hover:scale-105 disabled:opacity-35 disabled:hover:scale-100">
                ➤
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center opacity-60">opening channel…</div>}>
      <ChatInner />
    </Suspense>
  );
}
