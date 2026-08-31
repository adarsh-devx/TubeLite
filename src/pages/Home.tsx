import { useState, useCallback } from "react";
import AppHeader from "../components/AppHeader";
import UrlInput from "../components/UrlInput";
import AnalyzeButton from "../components/AnalyzeButton";

interface HomeProps {
  onAnalyze: (url: string) => void;
}

const Home = ({ onAnalyze }: HomeProps) => {
  const [url, setUrl] = useState("");

  const handleClear = useCallback(() => {
    setUrl("");
  }, []);

  const handleAnalyze = useCallback(() => {
    if (url.trim()) {
      onAnalyze(url.trim());
    }
  }, [url, onAnalyze]);

  return (
    <div className="w-full min-h-screen flex flex-col pb-24">
      {/* App header / branding */}
      <AppHeader />

      {/* Centered hero content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-text-primary text-center leading-snug">
          Download anything from
          <br />
          YouTube
        </h2>
        <p className="text-sm text-text-secondary text-center mt-2">
          High quality video and audio instantly.
        </p>
      </div>

      {/* Action area at bottom */}
      <div className="w-full max-w-md mx-auto space-y-3 px-4 pb-6">
        <UrlInput
          value={url}
          onChange={setUrl}
          onClear={handleClear}
        />
        <AnalyzeButton onPress={handleAnalyze} />
        <p className="text-[13px] text-text-secondary text-center">
          Downloads are saved to your device.
        </p>
      </div>
    </div>
  );
};

export default Home;
