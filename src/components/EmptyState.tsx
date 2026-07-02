interface Props {
  view: string;
  search: string;
}

const MESSAGES: Record<string, string> = {
  all: '清单空空如也，添加一个开始吧！',
  today: '今天没有待办，享受轻松时光 ✨',
  upcoming: '还没有近期的待办事项',
  completed: '还没有已完成的事项，完成任务后这里会有记录 🎉',
};

export default function EmptyState({ view, search }: Props) {
  const msg = search ? '没有找到匹配的待办' : (MESSAGES[view] ?? MESSAGES.all);

  return (
    <div className="empty-state">
      <div className="empty-icon">&#x1F4DD;</div>
      <div className="empty-title">{msg}</div>
    </div>
  );
}
