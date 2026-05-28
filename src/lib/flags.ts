export const FLAGS = {
  USE_NEW_ANALYTICS_PIPELINE: true,
  USE_NEW_ANALYTICS_VISUALS:  true,
  USE_LLM_PLAN_PROPOSER:      false,
} as const;


export type FlagName = keyof typeof FLAGS;

export function isFlagOn(name: FlagName): boolean {
  if (typeof window !== 'undefined') {
    try {
      const devOverride = window.localStorage.getItem(`flags_${name}`);
      if (devOverride === 'true') return true;
      if (devOverride === 'false') return false;
    } catch {
      // Local storage disabled or inaccessible
    }
  }
  return FLAGS[name];
}
