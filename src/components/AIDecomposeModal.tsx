import { useState, useEffect } from 'react';
import { useTodoApp } from '../hooks/useAppState';
import { useAIDecomposition } from '../hooks/useAIDecomposition';
import type { Category } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

const EMPTY_DESC = '描述你要做的任务，例如：搭建一个个人博客网站、策划一次海边旅行…';
const CONTEXT_PLACEHOLDER = '补充背景信息（可选）：目标用户是谁？有什么特殊要求？预计多久完成？';

/** Map a category name/id back to actual id */
function resolveCategory(nameOrId: string, categories: Category[]): string {
  const byName = categories.find(c => c.name === nameOrId);
  if (byName) return byName.id;
  const byExact = categories.find(c => c.id === nameOrId);
  if (byExact) return byExact.id;
  const match = categories.find(c => c.id.includes(nameOrId) || nameOrId.includes(c.id));
  return match?.id ?? categories[0]?.id ?? 'work';
}

export default function AIDecomposeModal({ open, onClose }: Props) {
  const { addTodo, categories, showToast } = useTodoApp();
  const [description, setDescription] = useState('');
  const [context, setContext] = useState('');
  const ai = useAIDecomposition();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      ai.reset();
      setDescription('');
      setContext('');
    } else {
      ai.reset();
    }
  }, [open]);

  const handleDecompose = () => {
    if (!description.trim()) return;
    ai.decompose(description.trim(), context.trim(), categories);
  };

  const handleImportSelected = () => {
    if (!ai.results) return;
    const selected = ai.results.filter(r => r.selected);
    if (selected.length === 0) return;

    selected.forEach(r => {
      const catId = resolveCategory(r.category, categories);
      addTodo({
        text: r.name,
        description: r.description,
        priority: r.priority,
        category: catId,
        due: '',
        completed: false,
      });
    });

    showToast(`已导入 ${selected.length} 个子任务`, () => {});
  };

  const handleImportAll = () => {
    if (!ai.results) return;
    ai.selectAll(true);
    handleImportSelected();
  };

  if (!open) return null;

  const hasResults = !!ai.results && ai.results.length > 0;

  return (
    <div className="modal-overlay modal-open" onClick={e => { if ((e.target as HTMLElement).classList.contains('modal-overlay')) onClose(); }}>
      <div className={`modal ai-modal`} style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ai-modal-header">
          <span className="ai-title">&#x1F9E0; AI 智能拆解</span>
          <button className="action-btn" onClick={onClose}>&times;</button>
        </div>

        {/* Description input */}
        <div className="form-group">
          <label>任务描述 *</label>
          <textarea
            placeholder={EMPTY_DESC}
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleDecompose(); }}
            rows={3}
            autoFocus={!ai.loading}
            disabled={ai.loading}
          />
        </div>

        {/* Context input */}
        <div className="form-group">
          <label>补充说明</label>
          <input
            type="text"
            placeholder={CONTEXT_PLACEHOLDER}
            value={context}
            onChange={e => setContext(e.target.value)}
            disabled={ai.loading}
          />
        </div>

        {!ai.loading && !hasResults && (
          <button className="decompose-btn" onClick={handleDecompose} disabled={!description.trim()}>
            &#x1F4A1; 开始拆解
          </button>
        )}

        {/* Loading */}
        {ai.loading && (
          <div className="ai-loading">
            <div className="spinner">&#x2699;&#xFE0F;</div>
            <div className="loading-text">AI 正在分析你的任务...</div>
            <div className="loading-hint">根据复杂度可能需要几秒到几十秒</div>
          </div>
        )}

        {/* Error */}
        {ai.error && (
          <div className="ai-error">
            <div className="error-title">&#x274C; 拆解失败</div>
            <div className="error-message">{ai.error}</div>
            <div className="retry-btn">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => ai.decompose(description.trim(), context.trim(), categories)}
              >
                重试
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {hasResults && (
          <>
            <div className="ai-results-header">
              <span className="result-count">
                拆解结果 · {ai.results!.length} 个子任务
              </span>
              <div className="select-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => ai.selectAll(true)}>全选</button>
                <button className="btn btn-ghost btn-sm" onClick={() => ai.selectAll(false)}>取消</button>
              </div>
            </div>

            <div className="ai-results-scroll" style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 8 }}>
              {ai.results!.map((r) => {
                const catObj = categories.find(c => c.id === r.category) || categories.find(c => c.name === r.category);
                const priorityMap = { high: '高', medium: '中', low: '低' };

                return (
                  <div
                    key={r.id}
                    className={`ai-result-item${r.selected ? ' selected' : ''}`}
                    onClick={() => ai.toggleSelect(r.id)}
                  >
                    <div className="ai-result-checkbox">
                      {r.selected && <span className="check-icon">&#x2713;</span>}
                    </div>
                    <div className="ai-result-content">
                      <div className="ai-result-name">{r.name}</div>
                      {r.description && (
                        <div className="ai-result-desc">{r.description}</div>
                      )}
                      <div className="ai-result-tags">
                        <span className={`ai-priority-tag ${r.priority}`}>
                          {priorityMap[r.priority]}
                        </span>
                        {catObj && (
                          <span className={`todo-tag ${catObj.colorClass || 'cat-work'}`}>{catObj.name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer actions */}
            <div className="ai-footer-actions">
              <button className="btn btn-ghost" onClick={onClose}>关闭</button>
              <button className="btn btn-primary" onClick={handleImportAll}>
                &#x1F4CB; 导入全部 ({ai.results!.length})
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
