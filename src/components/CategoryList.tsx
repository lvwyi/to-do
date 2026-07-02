import { useMemo, useState } from 'react';
import { useTodoApp } from '../hooks/useAppState';
import { getCategoryColor, genId } from '../utils/helpers';

const DEFAULT_CAT_IDS = new Set(['work', 'personal', 'health', 'study', 'shopping']);
const COLOR_SWATCHES = [
  '#4361ee','#ef476f','#06d6a0','#ffd166','#7c3aed',
  '#0ea5e9','#f97316','#84cc16','#ec4899','#6366f1',
];

export default function CategoryList() {
  const { categories, todos, categoryFilter, switchCategory, addCategory, deleteCategory } = useTodoApp();
  const [showModal, setShowModal] = useState(false);
  const [catName, setCatName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_SWATCHES[0]);

  const customCats = useMemo(
    () => categories.filter(c => !DEFAULT_CAT_IDS.has(c.id)),
    [categories],
  );

  const handleSave = () => {
    const name = catName.trim();
    if (!name) return;
    // Generate stable baseId: prefer readable chars from name
    const baseId = name.slice(0, 10).toLowerCase().replace(/[^a-z一-鿿]/g, '') || genId();
    // Collision check: retry with appended timestamp suffix until unique
    let id = baseId;
    let attempt = 0;
    while (categories.find(c => c.id === id)) {
      id = `${baseId}_${attempt++}_${Date.now().toString(36)}`;
    }
    addCategory({ id, name });
    setCatName('');
    setShowModal(false);
  };

  // Count incomplete todos per category
  const catCounts = useMemo(() => {
    const map: Record<string, number> = {};
    todos.forEach(t => {
      if (!t.completed) {
        map[t.category] = (map[t.category] || 0) + 1;
      }
    });
    return map;
  }, [todos]);

  return (
    <>
      <div className="sidebar-section" style={{ flex: 1, overflowY: 'auto' }}>
        <div className="sidebar-section-title">分类</div>
        {customCats.length === 0 ? (
          <div style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>暂无自定义分类</div>
        ) : (
          customCats.map(cat => (
            <div
              key={cat.id}
              className={`sidebar-item cat-with-delete${categoryFilter === cat.id ? ' active' : ''}`}
              onClick={() => switchCategory(categoryFilter === cat.id ? null : cat.id)}
            >
              <span className="dot" style={{ background: getCategoryColor(cat) }} />
              <span>{cat.name}</span>
              <span className="count">{catCounts[cat.id] ?? 0}</span>
              <button
                className="action-btn cat-delete-btn"
                title="删除分类"
                onClick={e => { e.stopPropagation(); deleteCategory(cat.id); }}
              >
                &times;
              </button>
            </div>
          ))
        )}
      </div>

      <button className="add-category-btn" onClick={() => setShowModal(true)}>
        &#xFF0B; 添加分类
      </button>

      {showModal && (
        <div className="modal-overlay modal-open" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">添加分类</div>
            <div className="form-group">
              <label>分类名称</label>
              <input
                type="text"
                placeholder="如：旅行、运动…"
                maxLength={20}
                value={catName}
                onChange={e => setCatName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>颜色</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLOR_SWATCHES.map(c => (
                  <div
                    key={c}
                    style={{
                      width: 36, height: 36, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: `3px solid ${c === selectedColor ? 'var(--text)' : 'transparent'}`,
                      transition: 'border 0.15s',
                    }}
                    onClick={() => setSelectedColor(c)}
                  />
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSave}>保存</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
