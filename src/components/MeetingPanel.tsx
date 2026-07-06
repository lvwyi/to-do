import { useState, useCallback } from 'react';
import { useTodoApp } from '../hooks/useAppState';
import { parseMeeting } from '../utils/meetingParser';
import type { MeetingResult } from '../utils/meetingParser';
import { formatDate, escapeHtml, todayStr } from '../utils/helpers';

export default function MeetingPanel() {
  const { addTodo, showToast } = useTodoApp();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<MeetingResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'input' | 'result'>('input');

  /** Parse meeting text and extract structured info */
  const handleParse = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setProcessing(true);
    // Small delay to let UI update before processing
    requestAnimationFrame(() => {
      try {
        const extracted = parseMeeting(trimmed);
        setResult(extracted);
        setActiveTab('result');
      } catch (err) {
        showToast('解析失败，请检查输入内容');
        console.error(err);
      } finally {
        setProcessing(false);
      }
    });
  }, [input, showToast]);

  /** Add a single task to todos */
  const addTaskToTodo = useCallback((task: NonNullable<MeetingResult['tasks']>[0]) => {
    addTodo({
      text: `[会议] ${task.content}`,
      description: `来源：${result?.info.title}（${result?.info.time}）\n负责人：${task.assignee}`,
      priority: 'medium',
      category: 'work',
      due: task.due || todayStr(),
      completed: false,
    });
    showToast(`已添加待办："${task.content}"`);
  }, [result, addTodo, showToast]);

  /** Add all tasks to todos */
  const addAllTasks = useCallback(() => {
    if (!result?.tasks.length) {
      showToast('没有可添加的任务');
      return;
    }
    result.tasks.forEach(task => {
      addTodo({
        text: `[会议] ${task.content}`,
        description: `来源：${result.info.title}（${result.info.time}）\n负责人：${task.assignee}`,
        priority: 'medium',
        category: 'work',
        due: task.due || todayStr(),
        completed: false,
      });
    });
    showToast(`已将 ${result.tasks.length} 项任务添加到待办`);
  }, [result, addTodo, showToast]);

  /** Reset panel */
  const handleReset = useCallback(() => {
    setInput('');
    setResult(null);
    setActiveTab('input');
  }, []);

  const taskCount = result?.tasks.length ?? 0;
  const decisionCount = result?.decisions.length ?? 0;

  return (
    <div className="meeting-panel">
      {/* Header tabs */}
      <div className="meeting-tabs">
        <button
          className={`meeting-tab ${activeTab === 'input' ? 'active' : ''}`}
          onClick={() => setActiveTab('input')}
        >
          📝 输入会议文稿
        </button>
        <button
          className={`meeting-tab ${activeTab === 'result' ? 'active' : ''}`}
          onClick={() => setActiveTab('result')}
        >
          📋 提取结果
          {result && <span className="tab-badge">{taskCount}</span>}
        </button>
      </div>

      {/* Input tab */}
      {activeTab === 'input' && (
        <div className="meeting-input-section">
          <textarea
            className="meeting-textarea"
            placeholder="粘贴会议原始文稿到这里…&#10;&#10;支持：会议纪要、培训记录、读书笔记、项目复盘等场景&#10;系统会自动提取标题、时间、参会人、决议与待办任务（含截止时间）"
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={12}
          />
          <div className="meeting-actions">
            <button
              className="btn btn-primary meeting-parse-btn"
              onClick={handleParse}
              disabled={processing || !input.trim()}
            >
              {processing ? '⏳ 正在解析…' : '🔍 智能解析'}
            </button>
            {result && (
              <button className="btn" onClick={handleReset}>
                重新输入
              </button>
            )}
          </div>
        </div>
      )}

      {/* Result tab */}
      {activeTab === 'result' && result && (
        <div className="meeting-result-section">
          {/* Info card */}
          <div className="meeting-info-card">
            <h3>{escapeHtml(result.info.title)}</h3>
            <div className="meeting-meta">
              <span>📅 {result.info.time}</span>
              {result.info.participants.length > 0 && (
                <span>👥 {result.info.participants.join('、')}</span>
              )}
            </div>
          </div>

          {/* Quick actions bar */}
          <div className="meeting-quick-actions">
            <button className="btn btn-primary btn-sm" onClick={addAllTasks}>
              ➕ 全部加入待办（{taskCount}项）
            </button>
            {decisionCount > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={() => {
                // Add decisions as todos too
                result.decisions.forEach(d => {
                  addTodo({
                    text: d.content,
                    description: `来自会议纪要`,
                    priority: 'medium',
                    category: 'work',
                    due: '',
                    completed: false,
                  });
                });
                showToast(`已将 ${decisionCount} 项决议添加到待办`);
              }}>
                📌 决议也加入待办
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => {
              // Copy cleaned text
              navigator.clipboard.writeText(result.cleanedText).then(() => {
                showToast('已复制到剪贴板');
              }).catch(() => {
                showToast('复制失败');
              });
            }}>
              📋 复制纪要原文
            </button>
          </div>

          {/* Decisions section */}
          {decisionCount > 0 && (
            <section className="meeting-section">
              <h4>
                <span className="section-icon">✅</span> 会议决议
                <span className="section-count">{decisionCount}</span>
              </h4>
              <ul className="decision-list">
                {result.decisions.map(d => (
                  <li key={d.id} className="decision-item">
                    <span className="decision-text">{escapeHtml(d.content)}</span>
                    <button
                      className="add-task-btn"
                      title="添加为待办"
                      onClick={() => addTaskToTodo({
                        id: d.id + '-dec',
                        content: d.content,
                        assignee: '待定',
                        due: '',
                      })}
                    >
                      ＋
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Tasks section */}
          {taskCount > 0 && (
            <section className="meeting-section">
              <h4>
                <span className="section-icon">🎯</span> 待办任务
                <span className="section-count">{taskCount}</span>
              </h4>
              <ul className="task-list">
                {result.tasks.map(t => (
                  <li key={t.id} className="task-item">
                    <div className="task-content">
                      <span className="task-name">{escapeHtml(t.content)}</span>
                      <div className="task-meta">
                        {t.assignee !== '待定' && (
                          <span className="task-assignee">👤 {escapeHtml(t.assignee)}</span>
                        )}
                        {t.due && t.due !== todayStr() && (
                          <span className="task-due">⏰ {formatDate(t.due)}</span>
                        )}
                        {t.due === todayStr() && (
                          <span className="task-due task-due-today">⏰ 今天</span>
                        )}
                      </div>
                    </div>
                    <button
                      className="add-task-btn"
                      title="添加为待办"
                      onClick={() => addTaskToTodo(t)}
                    >
                      ＋
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Topics section */}
          {result.topics.length > 0 && (
            <section className="meeting-section">
              <h4>
                <span className="section-icon">💬</span> 议题
                <span className="section-count">{result.topics.length}</span>
              </h4>
              <ul className="topic-list">
                {result.topics.slice(0, 10).map((t, i) => (
                  <li key={i}>{escapeHtml(t)}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Speeches section */}
          {result.speeches.length > 0 && (
            <section className="meeting-section">
              <h4>
                <span className="section-icon">🗣️</span> 发言摘要
                <span className="section-count">{result.speeches.length}</span>
              </h4>
              <dl className="speech-list">
                {result.speeches.map(s => (
                  <div key={s.id} className="speech-item">
                    <dt>{escapeHtml(s.speaker)}</dt>
                    <dd>{escapeHtml(s.content)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
