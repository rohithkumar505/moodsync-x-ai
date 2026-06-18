export interface AchievementItem {
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
  target: number;
  percent: number;
  progressLabel: string;
  secondaryProgress?: number;
  secondaryTarget?: number;
  secondaryLabel?: string;
  secondaryPercent?: number;
}

export interface AchievementCategory {
  id: string;
  label: string;
  items: AchievementItem[];
}

export interface AchievementBundle {
  summary: {
    unlocked: number;
    total: number;
    percent: number;
    streak: number;
    totalCheckIns: number;
    nextUp: AchievementItem | null;
  };
  categories: AchievementCategory[];
  items: AchievementItem[];
}

function isAchievementItem(value: unknown): value is AchievementItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'slug' in value &&
    'name' in value &&
    typeof (value as AchievementItem).slug === 'string'
  );
}

function groupByCategory(items: AchievementItem[]): AchievementCategory[] {
  const map = new Map<string, AchievementItem[]>();
  for (const item of items) {
    const key = item.category || 'Other';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries()).map(([label, catItems]) => ({
    id: label.toLowerCase().replace(/\s+/g, '_'),
    label,
    items: catItems,
  }));
}

function buildSummary(items: AchievementItem[], streak = 0): AchievementBundle['summary'] {
  const unlocked = items.filter((i) => i.unlocked).length;
  const total = items.length;
  const locked = items.filter((i) => !i.unlocked);
  const nextUp = locked.length
    ? locked.reduce((best, item) => (item.percent > best.percent ? item : best), locked[0])
    : null;

  return {
    unlocked,
    total,
    percent: total ? Math.round((unlocked / total) * 100) : 0,
    streak,
    totalCheckIns: 0,
    nextUp,
  };
}

/** Accept new bundle or legacy array responses from the API. */
export function normalizeAchievementBundle(data: unknown): AchievementBundle | null {
  if (!data) return null;

  if (Array.isArray(data)) {
    const items = data.filter(isAchievementItem);
    if (!items.length) return null;
    return {
      summary: buildSummary(items),
      categories: groupByCategory(items),
      items,
    };
  }

  if (typeof data === 'object' && data !== null && 'items' in data) {
    const raw = data as Partial<AchievementBundle>;
    const items = Array.isArray(raw.items) ? raw.items.filter(isAchievementItem) : [];
    if (!items.length) return null;

    const summary = raw.summary
      ? {
          unlocked: raw.summary.unlocked ?? 0,
          total: raw.summary.total ?? items.length,
          percent: raw.summary.percent ?? 0,
          streak: raw.summary.streak ?? 0,
          totalCheckIns: raw.summary.totalCheckIns ?? 0,
          nextUp: raw.summary.nextUp ?? null,
        }
      : buildSummary(items);

    const categories =
      raw.categories && raw.categories.length > 0
        ? raw.categories.map((cat) => ({
            id: cat.id,
            label: cat.label,
            items: (cat.items || []).filter(isAchievementItem),
          })).filter((cat) => cat.items.length > 0)
        : groupByCategory(items);

    return { summary, categories, items };
  }

  return null;
}
