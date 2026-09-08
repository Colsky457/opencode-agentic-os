/** 📖 Guide content — one source of truth for the dashboard + vault export. */

export interface GuideLesson {
  n: number;
  icon: string;
  title: string;
  minutes: number;
  goals: string[];
  body: string;
  prompt: string;
  codeRef: { label: string; path: string };
}

export const FAST_TRACK_MD = `## 🚀 Fast track — your own mission control in 10 minutes

Follow the steps. Tick the boxes. You can do this. 💪

### 📦 Step 1 — Get the tools

- [ ] Install **Node 20+** from 👉 https://nodejs.org (click the big green button, keep clicking Next)
- [ ] Open a terminal (black box where you type commands — on Windows it's called PowerShell)
- [ ] Type this and press Enter:
\`\`\`
node --version
\`\`\`
- [ ] You see a number like \`v22.x\`? 🎉 You win. Move on.

🌱 **Plain words:** Node lets your computer run JavaScript outside a browser.

### 🤖 Step 2 — Meet Claude

- [ ] Install Claude Code by typing:
\`\`\`
npm install -g @anthropic-ai/claude-code
\`\`\`
- [ ] Type \`claude --version\` — see a number? 🎉
- [ ] Type \`claude "say hi in 5 words"\` — Claude answers! That's your AI. 🧡

> 🆘 **Stuck?** If it talks about quotas or errors, your account needs credit. No stress — the dashboard has a **demo mode** that works with zero quota.

### ⬇️ Step 3 — Grab the system

- [ ] Clone it and go inside:
\`\`\`
git clone <your-repo-url> claude-os
cd claude-os
\`\`\`
- [ ] Run the magic one-liner:
\`\`\`
./setup.sh
\`\`\`
(Windows friends: \`./setup.ps1\` instead 🪟)
- [ ] Wait for the coffee break ☕ — it installs + builds by itself.

### 🧙 Step 4 — The wizard does the boring parts

- [ ] Open 👉 http://127.0.0.1:3000
- [ ] The wizard **finds your AI tools by itself** 🔍 — pick your favorite
- [ ] Point it at your vault (a folder for your notes — \`~/brain\` is fine, Obsidian loves it 🧠)
- [ ] Press **launch** ◈ — welcome home!

### 🎮 Step 5 — Play!

- [ ] 💬 Chat with Claude
- [ ] ⬢ Make an agent and press **run**
- [ ] ◎ Set a goal, ❝ write a journal line
- [ ] Watch them appear as files in your vault 🪄

🎉 **Done!** Hungry for more? The 🏗️ full course below rebuilds all of this piece by piece.
`;

export const LESSONS: GuideLesson[] = [
  {
    n: 1,
    icon: "🎨",
    title: "The shell — your pretty frame",
    minutes: 20,
    goals: ["Scaffold a Next.js app", "Add the dark glassy look", "Make pages slide between each other"],
    body: `## 🎨 Lesson 1 — The shell

Every house needs walls. Your app's walls = **Next.js** (the frame) + **Tailwind** (the paint). 🏠

### 🧱 Do this

- [ ] Make the app:
\`\`\`
npx create-next-app@latest my-os --typescript --tailwind --app --src-dir
cd my-os
\`\`\`
- [ ] Add the fun packages:
\`\`\`
npm install framer-motion next-themes zustand
\`\`\`
- [ ] Make \`src/app/layout.tsx\` hold your TopBar + Sidebar + content, like a picture frame 🖼️
- [ ] Make \`src/app/template.tsx\` slide pages in with Framer Motion (copy ours — it's tiny!)
- [ ] Put your colors in \`globals.css\` with \`@theme\` — one place, whole app changes 🎨

🌱 **Plain words:** A *layout* is the stuff that never moves (menu, header). A *template* re-runs on every page — perfect for slide animations.

> 🆘 **Stuck?** Errors about Turbopack on Android? Build with \`--webpack\` instead. Phones are picky. 📱
`,
    prompt: `I have a fresh Next.js app with Tailwind. Add: 1) a root layout with a sticky glass TopBar and a dock-style Sidebar nav, 2) a template.tsx with Framer Motion page slide transitions (AnimatePresence mode="wait"), 3) dark/light theme with next-themes, 4) a warm dark color theme with one neon accent color in globals.css using @theme. Keep it clean and simple.`,
    codeRef: { label: "Our layout + shell", path: "src/app/layout.tsx" },
  },
  {
    n: 2,
    icon: "✦",
    title: "Talking to Claude — the magic wire",
    minutes: 25,
    goals: ["Call Claude from your code", "Stream words live like magic", "Save every chat"],
    body: `## ✦ Lesson 2 — Talking to Claude

Here's the secret: Claude Code is a **program you can call**, like asking a friend to do homework. 📞

### 🧱 Do this

- [ ] The magic command (try it in your terminal!):
\`\`\`
claude -p "say hi" --output-format stream-json --verbose
\`\`\`
- [ ] See lines of JSON flying by? Each line is a piece of the answer arriving **live**. ⚡
- [ ] In code, run that command with Node's \`child_process.spawn\` and read each line as it arrives
- [ ] Send the lines to the browser with SSE (Server-Sent Events = a one-way tap that drips text 💧)
- [ ] Show the drips in a chat bubble that grows while Claude "types" 💬
- [ ] Save the finished chat as a markdown file. Future-you says thanks. 🙏

🌱 **Plain words:** *Streaming* = showing words as they arrive instead of waiting for the whole answer. Like watching someone type!

> 🆘 **Stuck?** Error 402 = out of credit, not broken code. Add credit or flip on demo mode and keep building. 💳
`,
    prompt: `In my Next.js app, add an API route POST /api/chat that: 1) spawns "claude -p <message> --output-format stream-json --verbose --include-partial-messages --permission-mode dontAsk" via child_process, 2) parses each stdout line as JSON, extracts assistant text deltas, 3) forwards them to the browser as SSE events {type:"delta"|"done"|"error"}, 4) reads the final "result" event for token usage. Then build a chat UI with a message list and an auto-growing composer (Enter sends, Shift+Enter newline). Handle CLI errors gracefully.`,
    codeRef: { label: "Our Claude bridge", path: "src/lib/claude.ts" },
  },
  {
    n: 3,
    icon: "⬢",
    title: "The agent fleet — your robot team",
    minutes: 25,
    goals: ["Give each agent a personality", "Run agents as real programs", "Watch them live + stop them"],
    body: `## ⬢ Lesson 3 — Your robot team

An **agent** = a name + a personality note (system prompt) + its own folder. Give the same order to a pirate 🏴‍☠️ and a professor 🎓 — different answers!

### 🧱 Do this

- [ ] Save agents as simple objects: \`{ name, persona, systemPrompt, model, color }\`
- [ ] To **run** one: spawn the same Claude command, but with \`--append-system-prompt\` = its personality, and \`cwd\` = its own folder 📁
- [ ] Save its process ID. That's your leash. 🦮
- [ ] Pour everything it prints into \`agent.log\` — your window into its brain 👀
- [ ] Add a **stop** button that kills the process (polite SIGTERM first, forceful SIGKILL if stubborn 😤)
- [ ] Draw each agent a generative avatar: gradient + shapes picked by hashing its name. Same name = same face, forever. 🎭

🌱 **Plain words:** A *process* is a running program. Your computer can run many at once — that's your "fleet".

> 🆘 **Stuck?** Agent stuck "running" forever? Kill by PID, check the log tail — the answer is always in the log. 📜
`,
    prompt: `Add an agent fleet to my Next.js app: 1) a JSON store for agents {name, persona, systemPrompt, model, color}, 2) POST /api/agents/run that spawns the Claude CLI as a detached child process with cwd=workspaces/<agentId> and appends stdout to agent.log, tracking pid in memory, 3) DELETE that kills the process (SIGTERM then SIGKILL fallback), 4) GET log endpoint, 5) a fleet UI with cards, run/stop buttons, and a live log console polling every 3s.`,
    codeRef: { label: "Our fleet manager", path: "src/lib/claude.ts" },
  },
  {
    n: 4,
    icon: "🧠",
    title: "The second brain — notes that write themselves",
    minutes: 20,
    goals: ["Auto-save chats as files", "Track goals as checkboxes", "Keep a daily journal"],
    body: `## 🧠 Lesson 4 — Notes that write themselves

Best trick in the system: **everything becomes a markdown file** in your vault. Your app forgets nothing, and Obsidian can read it all. 🪄

### 🧱 Do this

- [ ] After every chat, write \`Vault/Chats/2026-01-31/14-02-my-question.md\` with the full conversation 📝
- [ ] Goals live in ONE file, \`Goals.md\`, as real checkboxes:
\`\`\`
- [ ] Morning run 📅 2026-02-01
- [x] Read 20 pages
\`\`\`
Obsidian Tasks understands these natively! ✅
- [ ] Journal = one file per day (\`Journal/2026-01-31.md\`), new entries appended under \`## time\` headings 📓
- [ ] Never let a crash lose a note: saving to the vault must **never throw** — wrap it, swallow errors, keep chatting. 🛡️

🌱 **Plain words:** *Markdown* is fancy text files. \`# big\`, \`- [ ] todo\`, **bold**. Humans and apps both read them.

> 🆘 **Stuck?** Files not appearing? Check the vault path in config — \`\~\` means your home folder. Print the resolved path and look there first. 🔍
`,
    prompt: `Add a second-brain module to my Next.js app: 1) a brain.ts writer with functions saveChatToBrain(session) writing Chats/YYYY-MM-DD/HH-MM-slug.md with frontmatter + transcript, syncGoalsIndex(goals) rewriting Goals.md as - [ ]/- [x] checkbox lists grouped Active/Done/Archived, appendJournalToBrain(entry) appending to Journal/YYYY-MM-DD.md under ## HH:MM headings, 2) all writers must never throw (catch internally), 3) vault root from config with ~ expansion, 4) call them fire-and-forget from my chat/goals/journal APIs.`,
    codeRef: { label: "Our brain engine", path: "src/lib/brain.ts" },
  },
  {
    n: 5,
    icon: "✨",
    title: "The delight layer — dopamine please",
    minutes: 20,
    goals: ["Add voice typing everywhere", "Animate everything that moves", "Keep it fast + kind"],
    body: `## ✨ Lesson 5 — Dopamine please

Features get users. **Feelings keep them.** This lesson is pure candy. 🍬

### 🧱 Do this

- [ ] 🎙️ **Voice typing**: the browser has FREE speech recognition built in (\`SpeechRecognition\`)! One button per text box, words appear as you talk. No API keys. Hide the button where browsers lack it (Firefox 🙈).
- [ ] 🚀 **Boot sequence**: a 2-second "starting systems…" animation makes everything feel expensive. 💎
- [ ] ⌘K **Command palette**: one shortcut to jump anywhere. Power users will love you. ⚡
- [ ] 🫧 **Chat feel**: avatars, typing dots, timestamps, date dividers, copy + regenerate buttons.
- [ ] 🧘 **Be kind**: respect \`prefers-reduced-motion\`, keep buttons big, never punish errors — explain + offer a way forward.

🌱 **Plain words:** *Delight* = tiny surprises that make software feel alive. A bounce here, a glow there.

> 🆘 **Stuck?** Mic button missing? You need Chrome/Edge/Safari + HTTPS or localhost. Firefox simply can't — that's why we hide it. 🎤
`,
    prompt: `Add delight to my Next.js app: 1) a reusable VoiceField wrapper using the Web Speech API (SpeechRecognition with webkit fallback, interim captions, final transcript appends to the field, renders nothing when unsupported, created only in effects/handlers for SSR safety), 2) a 2-second skippable boot splash with progress lines, 3) a Cmd+K command palette with fuzzy app/agent search, 4) chat polish: grouped bubbles, typing indicator, timestamps, date dividers, message actions. Gate big motion behind prefers-reduced-motion.`,
    codeRef: { label: "Our voice wrapper", path: "src/components/chat/VoiceField.tsx" },
  },
  {
    n: 6,
    icon: "🚢",
    title: "Sharing it — one command for everyone",
    minutes: 20,
    goals: ["One config file, zero hardcodes", "A wizard that sets itself up", "Teach with this guide"],
    body: `## 🚢 Lesson 6 — Share it with the world

Code that only runs on YOUR computer is a diary. Code that runs on ANYONE's is a gift. 🎁

### 🧱 Do this

- [ ] Put every setting in \`os.config.json\` (host, port, paths, model names). Env vars override it. Nothing hardcoded — grep for \`3000\` and kill every hit. 🔪
- [ ] Write \`setup.sh\`: check Node → install (try bun, fall back to npm!) → build → start. Test it in a **fresh folder** — that's what your friends will do. 🧪
- [ ] Build a **setup wizard**: detect installed AI tools (\`--version\` checks 👀), ask for the vault path (with a write test!), check the port is free, then write the config.
- [ ] Write the guide you're reading right now. Simple words. Lots of emojis. A stuck-box per lesson. Future builders will thank you. 💌

🌱 **Plain words:** *Onboarding* = a new person's first 10 minutes. Make it magic and they stay forever.

> 🆘 **Stuck?** "Works on my machine"? Delete everything, clone fresh, run setup.sh. If it fails there, it'll fail for friends. Fix it there. 🧹
`,
    prompt: `Make my Next.js app shareable: 1) a config system (os.config.json + os.config.example.json, env overrides, mtime-checked cache so rewrites apply without restart, ~ expansion and relative-path resolution), 2) a provider detector probing known AI CLIs via --version, 3) a 3-step first-run setup wizard (providers, vault path with writability test, host/port with clash check) that writes the config, gated by a config-exists check, 4) a POSIX setup.sh (node check, bun→npm fallback install, build, start). Gitignore the personal config.`,
    codeRef: { label: "Our config system", path: "src/lib/config.ts" },
  },
];

export const GUIDE_META = {
  title: "Build Your Own ClaudeOS",
  subtitle: "From zero to mission control — with Claude holding your hand 🤝",
  vaultPath: "Guides/Build-Your-Own-ClaudeOS.md",
};

/** Full vault markdown — hub intro + fast track + all lessons. */
export function guideVaultMarkdown(): string {
  const parts = [
    "---",
    'title: "Build Your Own ClaudeOS"',
    "type: guide",
    `updated: ${new Date().toISOString()}`,
    "---",
    "",
    "# 📖 Build Your Own ClaudeOS",
    "",
    "Your friendly guide to building this exact system with Claude. Two ways to play:",
    "",
    "- 🚀 **Fast track** — running in 10 minutes (below)",
    "- 🏗️ **Full course** — rebuild it piece by piece (the lessons)",
    "",
    "---",
    "",
    FAST_TRACK_MD,
    "",
    "---",
    "",
    "# 🏗️ Full rebuild course",
    "",
  ];
  for (const l of LESSONS) {
    parts.push(
      `---`,
      ``,
      `# ${l.icon} Lesson ${l.n}: ${l.title}`,
      ``,
      `*About ${l.minutes} minutes.* Goals: ${l.goals.join(" · ")}`,
      ``,
      l.body,
      ``,
      `**🤖 Paste this into Claude Code:**`,
      ``,
      "```",
      l.prompt,
      "```",
      ``,
      `📁 See it built: \`${l.codeRef.path}\``,
      ``
    );
  }
  parts.push("🎉 **You built it. Now teach someone else.** That's how this guide was born. 💌", "");
  return parts.join("\n");
}
