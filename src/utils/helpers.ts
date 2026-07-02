export function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

/** Today's date as YYYY-MM-DD (shared across components to avoid duplication) */
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  const wday = days[d.getDay()];
  return `${month}月${day}日 周${wday}`;
}

export function isOverdue(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T23:59:59');
  return d.getTime() < Date.now();
}

export const PRIORITY_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1 };

export function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

/** Get category display color */
export function getCategoryColor(cat: { id: string; name: string }): string {
  const map: Record<string, string> = {
    work: '#3b82f6',
    personal: '#ec4899',
    health: '#10b981',
    study: '#f59e0b',
    shopping: '#8b5cf6',
  };
  if (map[cat.id]) return map[cat.id];
  // Generate deterministic color from id hash
  let h = 0;
  for (let i = 0; i < cat.id.length; i++) {
    h = cat.id.charCodeAt(i) + ((h << 5) - h);
  }
  return `hsl(${Math.abs(h) % 360}, 60%, 50%)`;
}
