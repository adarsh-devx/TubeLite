import { useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Trash2,
  Info,
} from "lucide-react";

interface SettingsProps {
  onBack: () => void;
}

const Settings = ({ onBack }: SettingsProps) => {
  const [darkTheme, setDarkTheme] = useState(true);

  return (
    <div className="w-full min-h-screen flex flex-col pb-24">
      {/* Header */}
      <header className="w-full relative flex items-center px-4 pt-5 pb-3">
        <button
          onClick={onBack}
          className="p-1 shrink-0 relative z-10"
          aria-label="Go back"
        >
          <ArrowLeft className="w-6 h-6 text-text-primary" strokeWidth={2} />
        </button>
        <h1 className="text-[20px] font-bold text-text-primary absolute left-0 right-0 text-center pointer-events-none">
          Settings
        </h1>
      </header>

      {/* Settings list */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-md mx-auto px-4 space-y-3 pb-8">
          {/* Download location */}
          <button className="w-full bg-bg-card rounded-2xl flex items-center px-4 py-4 text-left">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-text-primary">
                Download location
              </p>
              <p className="text-[13px] text-text-secondary mt-1 truncate">
                /storage/emulated/0/Download
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-text-secondary shrink-0 ml-3" strokeWidth={2} />
          </button>

          {/* Dark Theme */}
          <div className="w-full bg-bg-card rounded-2xl flex items-center px-4 py-4">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-text-primary">
                Dark Theme
              </p>
              <p className="text-[13px] text-text-secondary mt-1">
                Enable dark mode UI
              </p>
            </div>
            {/* Toggle switch */}
            <button
              onClick={() => setDarkTheme((v) => !v)}
              className={`relative w-[48px] h-[28px] rounded-full transition-colors shrink-0 ml-3 ${
                darkTheme ? "bg-accent" : "bg-[#3f3f46]"
              }`}
              role="switch"
              aria-checked={darkTheme}
              aria-label="Toggle dark theme"
            >
              <span
                className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow transition-all duration-200 ${
                  darkTheme ? "left-[23px]" : "left-[3px]"
                }`}
              />
            </button>
          </div>

          {/* Clear completed items */}
          <button className="w-full bg-bg-card rounded-2xl flex items-center px-4 py-4 text-left">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-text-primary">
                Clear completed items
              </p>
              <p className="text-[13px] text-text-secondary mt-1">
                Remove downloaded items from history
              </p>
            </div>
            <Trash2 className="w-5 h-5 text-text-secondary shrink-0 ml-3" strokeWidth={2} />
          </button>

          {/* About */}
          <button className="w-full bg-bg-card rounded-2xl flex items-center px-4 py-4 text-left">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-text-primary">
                About
              </p>
              <p className="text-[13px] text-text-secondary mt-1">
                Version 2.4.1
              </p>
            </div>
            <Info className="w-5 h-5 text-text-secondary shrink-0 ml-3" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
