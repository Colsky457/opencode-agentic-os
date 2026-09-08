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
const SKILLS: (SkillMeta & { step: string })[] = [
  {
    id: "cleanup",
    name: "Vault cleanup",
    icon: "🧹",
    blurb: "Dedupe + organize brain vault",
    provider: "hermes",
    step: `You are the Operations Manager for a personal knowledge vault rooted at {brain}/Agentic OS (subfolders: Chats, Goals, Journal, Daily Notes). Audit the markdown notes: merge near-duplicate notes (keep the fuller version), fix broken or missing frontmatter, move misfiled notes into the right subfolder, and remove only empty or junk files. NEVER delete notes with real writing in them. When done, reply with a short report: a CHANGED list (file → what you did) and then DONE.`,
  },
];

function brainDir(): string {
  try {
    return resolvePath(loadConfigSync().paths.brain);
  } catch {
    return "~/brain";
  }
}

export function listSkills(): SkillMeta[] {
  return SKILLS.map(({ id, name, icon, blurb, provider }) => ({ id, name, icon, blurb, provider }));
}

export function renderSkill(id: string): { title: string; steps: string; provider: string } | null {
  const s = SKILLS.find((x) => x.id === id);
  if (!s) return null;
  return { title: `Skill: ${s.name}`, steps: s.step.replaceAll("{brain}", brainDir()), provider: s.provider };
}
