import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { loadConfigSync, resolvePath } from "./config";

export interface SkillMeta {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  provider: string;
}

// NOTE: task steps run as isolated CLI calls (no shared context between
// steps), so every skill is a single self-contained step.
// Source of truth: `.agents/skills/*/SKILL.md` (frontmatter + body).

function skillsDir(): string {
  return path.join(process.cwd(), ".agents", "skills");
}

function parseSkill(id: string, raw: string): (SkillMeta & { step: string }) | null {
  const m = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/.exec(raw.trim());
  if (!m) return null;
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  const step = m[2].trim();
  if (!step) return null;
  return {
    id,
    name: meta.name || id,
    icon: meta.icon || "⚙️",
    blurb: meta.blurb || "",
    provider: meta.provider || "hermes",
    step,
  };
}

function loadSkills(): (SkillMeta & { step: string })[] {
  try {
    const dir = skillsDir();
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => {
        try {
          return parseSkill(e.name, readFileSync(path.join(dir, e.name, "SKILL.md"), "utf8"));
        } catch {
          return null;
        }
      })
      .filter((s): s is SkillMeta & { step: string } => s !== null);
  } catch {
    return [];
  }
}

function brainDir(): string {
  try {
    return resolvePath(loadConfigSync().paths.brain);
  } catch {
    return resolvePath("./.agent_brain");
  }
}

export function listSkills(): SkillMeta[] {
  return loadSkills().map(({ id, name, icon, blurb, provider }) => ({ id, name, icon, blurb, provider }));
}

export function renderSkill(id: string): { title: string; steps: string; provider: string } | null {
  const s = loadSkills().find((x) => x.id === id);
  if (!s) return null;
  return { title: `Skill: ${s.name}`, steps: s.step.replaceAll("{brain}", brainDir()), provider: s.provider };
}
