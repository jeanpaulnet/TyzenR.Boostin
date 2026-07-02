import React, { useState } from "react";
import { Link2, Sparkles, Check, Copy, Image, RotateCw } from "lucide-react";
import { Settings } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface WorkPaneProps {
  onScan: (url: string, model: string, aspectRatio: string) => Promise<void>;
  isLoading: boolean;
  loadingStep: string;
  scannedTitle: string;
  scannedDescription: string;
  scannedPrompt: string;
  onUpdateScannedFields: (fields: { title?: string; description?: string; prompt?: string }) => void;
  settings: Settings;
  model: string;
  aspectRatio: string;
  activeItemUrl?: string;
}

export default function WorkPane({
  onScan,
  isLoading,
  loadingStep,
  scannedTitle,
  scannedDescription,
  scannedPrompt,
  onUpdateScannedFields,
  settings,
  model,
  aspectRatio,
  activeItemUrl = "",
}: WorkPaneProps) {
  const [url, setUrl] = useState("");
  const [copiedDesc, setCopiedDesc] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  React.useEffect(() => {
    if (activeItemUrl) {
      setUrl(activeItemUrl);
    }
  }, [activeItemUrl]);

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!url) {
      setErrorMsg("Please enter a valid URL to scan");
      return;
    }

    try {
      new URL(url);
    } catch (_) {
      setErrorMsg("Please enter a valid absolute URL (e.g. https://example.com)");
      return;
    }

    await onScan(url, model, aspectRatio);
  };

  const copyToClipboard = (text: string, type: "desc" | "prompt") => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === "desc") {
      setCopiedDesc(true);
      setTimeout(() => setCopiedDesc(false), 2000);
    } else {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xl overflow-y-auto p-6 space-y-6">
      
      {/* Main Scan Form */}
      <form onSubmit={handleScanSubmit} className="space-y-4">
        <div>
          <label className="inline-block text-xs font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent uppercase tracking-wider mb-1.5 pb-0.5 pr-1 font-display">
            Destination URL to Scan
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Link2 className="h-4 w-4 text-slate-400" />
            </div>
            <input
              id="work-url-input"
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (errorMsg) setErrorMsg("");
              }}
              placeholder="https://techcrunch.com/article-slug"
              className={`w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border text-slate-800 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white transition-all ${
                errorMsg ? "border-red-400/50 bg-red-50/50" : "border-slate-200"
              }`}
              disabled={isLoading}
            />
          </div>
          {errorMsg && (
            <p className="text-[11px] text-red-600 mt-1 font-medium">{errorMsg}</p>
          )}
        </div>

        {/* Scan Button & Loading States */}
        <div>
          <button
            id="scan-url-btn"
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              isLoading
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                : "bg-gradient-to-r from-[#a3e635] via-[#10b981] to-[#8b5cf6] border border-white/20 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_4px_14px_rgba(163,230,53,0.2)] hover:brightness-105 active:scale-[0.98] font-bold tracking-wide"
            }`}
          >
            {isLoading ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Processing Boost...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>SCAN & BOOST</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Loading Steps Visualization */}
      {isLoading && (
        <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3 shadow-inner">
          <h4 className="text-xs font-bold text-indigo-950 font-display flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-indigo-600" />
            <span>Orchestrating Generative Pipeline</span>
          </h4>
          <div className="space-y-2">
            {[
              { key: "scrape", label: "Extracting metadata and text from target webpage" },
              { key: "copy", label: "Generating click-worthy social copy" },
              { key: "image", label: `Invoking selected AI model to generate visual asset` }
            ].map((step, idx) => {
              const activeIdx = ["scrape", "copy", "image", "azure"].indexOf(loadingStep);
              const isDone = idx < activeIdx;
              const isActive = idx === activeIdx;

              return (
                <div key={step.key} className="flex items-center gap-2.5">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border ${
                    isDone 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                      : isActive 
                        ? "bg-indigo-600 text-white border-indigo-500 animate-pulse shadow-md shadow-indigo-500/20" 
                        : "bg-slate-100 text-slate-400 border-slate-200"
                  }`}>
                    {isDone ? "✓" : idx + 1}
                  </div>
                  <span className={`text-xs ${
                    isActive 
                      ? "text-indigo-950 font-bold" 
                      : isDone 
                        ? "text-slate-500" 
                        : "text-slate-400"
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Refine Copy and Metadata */}
      {(scannedTitle || scannedDescription) && !isLoading && (
        <div className="border-t border-slate-200 pt-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-display">Refine Scanned Metadata</h3>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Ready to Share</span>
          </div>

          {/* Article Title - Moved up before description */}
          <div className="space-y-1.5">
            <label className="inline-block text-xs font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent uppercase tracking-wider font-display pb-0.5 pr-1">
              Article Title
            </label>
            <input
              id="scanned-title-input"
              type="text"
              value={scannedTitle}
              onChange={(e) => onUpdateScannedFields({ title: e.target.value })}
              placeholder="Article title will appear here after scanning..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white"
              disabled={isLoading}
            />
          </div>

          {/* Article Description & Summary - Moved below title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="inline-block text-xs font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent uppercase tracking-wider font-display pb-0.5 pr-1">
                ARTICLE DESCRIPTION
              </label>
              {scannedDescription && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(scannedDescription, "desc")}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-all font-semibold min-h-[24px]"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {copiedDesc ? (
                      <motion.span
                        key="copied"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600 font-bold">Copied!</span>
                      </motion.span>
                    ) : (
                      <motion.span
                        key="copy"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Caption</span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              )}
            </div>
            <textarea
              id="scanned-desc-textarea"
              value={scannedDescription}
              onChange={(e) => onUpdateScannedFields({ description: e.target.value })}
              placeholder="Generated 2-paragraph summary, 'More Info: url', and hashtags will appear here after scanning..."
              rows={10}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white leading-relaxed font-sans shadow-inner"
              disabled={isLoading}
            />
          </div>
        </div>
      )}

    </div>
  );
}
