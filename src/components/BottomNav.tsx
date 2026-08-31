import { Home, Clock, Settings } from "lucide-react";
import type { NavItem } from "../types/navigation";

interface BottomNavProps {
  active: NavItem;
  onChange: (item: NavItem) => void;
}

const navItems: { id: NavItem; label: string; Icon: typeof Home }[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "history", label: "History", Icon: Clock },
  { id: "settings", label: "Settings", Icon: Settings },
];

const BottomNav = ({ active, onChange }: BottomNavProps) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full bg-bg-nav border-t border-[#2c2c2e] pb-[env(safe-area-inset-bottom)] z-50">
      <div className="w-full max-w-md mx-auto flex items-center justify-around h-[56px] px-3">
        {navItems.map(({ id, label, Icon }) => {
          const isSelected = id === active;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="flex-1 flex flex-col items-center justify-center"
              aria-label={label}
            >
              <div
                className={`flex items-center justify-center w-[40px] h-[40px] rounded-full transition-colors ${
                  isSelected
                    ? "bg-accent-selected"
                    : "bg-transparent"
                }`}
              >
                <Icon
                  className={`w-[20px] h-[20px] ${
                    isSelected ? "text-[#1c1c1e]" : "text-text-secondary"
                  }`}
                  strokeWidth={isSelected ? 2.5 : 1.8}
                />
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
