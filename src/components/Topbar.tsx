import { useTodoApp } from '../hooks/useAppState';
import type { SortOrder } from '../types';

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'created-desc', label: '最新创建' },
  { value: 'created-asc', label: '最早创建' },
  { value: 'priority-desc', label: '优先级高→低' },
  { value: 'priority-asc', label: '优先级低→高' },
  { value: 'due-asc', label: '到期日近→远' },
  { value: 'alpha', label: '按名称排序' },
];

const TITLES: Record<string, string> = {
  all: '全部事项', today: '今天', upcoming: '近期', completed: '已完成',
};

const SUBTITLES: Record<string, string> = {
  all: '管理你的所有任务', today: '今天的待办事项',
  upcoming: '未来 7 天的到期事项', completed: '已完成的记录',
};

export default function Topbar() {
  const { view, categoryFilter, search, setSearch, sort, setSort, categories } = useTodoApp();

  let title = categoryFilter
    ? categories.find(c => c.id === categoryFilter)?.name ?? '分类'
    : TITLES[view] ?? '全部事项';

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="topbar-title">{title}</div>
        <div className="topbar-subtitle">
          {categoryFilter
            ? '查看此分类下的待办'
            : (SUBTITLES[view] ?? '')}
        </div>
      </div>
      <div className="search-box">
        <span className="search-icon">&#x1F50D;</span>
        <input
          type="text"
          placeholder="搜索待办…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          data-focus-target="search"
        />
      </div>
      <div className="topbar-actions">
        <select
          className="sort-select"
          value={sort}
          onChange={e => setSort(e.target.value as SortOrder)}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
