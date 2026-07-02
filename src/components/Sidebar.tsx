import SidebarNav from './SidebarNav';
import CategoryList from './CategoryList';
import StatsBar from './StatsBar';
import ThemeToggle from './ThemeToggle';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">&#x2726;</div>
        <h1>待办事项</h1>
      </div>
      <SidebarNav />
      <CategoryList />
      <div className="sidebar-footer">
        <StatsBar />
        <ThemeToggle />
      </div>
    </aside>
  );
}
