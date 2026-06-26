import React, { useState, useEffect } from "react";
import { Link2, Sparkles, Check, Copy, Sliders, Image, Eye, RotateCw, Monitor, Compass } from "lucide-react";
import { Settings } from "../types";

interface WorkPaneProps {
  onScan: (url: string, model: string, aspectRatio: string, resolution: string) => Promise<void>;
  onRegenerateImage: (prompt: string, model: string, aspectRatio: string, resolution: string) => Promise<void>;
  isLoading: boolean;
  loadingStep: string;
  scannedTitle: string;
  scannedDescription: string;
  scannedPrompt: string;
  onUpdateScannedFields: (fields: { title?: string; description?: string; prompt?: string }) => void;
  settings: Settings;
}

export default function WorkPane({
  onScan,
  onRegenerateImage,
  isLoading,
  loadingStep,
  scannedTitle,
  scannedDescription,
  scannedPrompt,
  onUpdateScannedFields,
  settings,
}: WorkPaneProps) {
  const [url, setUrl] = useState("");
  const [model, setModel] = useState("gemini-2.5-flash-image");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [resolution, setResolution] = useState("1K");
  const [copiedDesc, setCopiedDesc] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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

    await onScan(url, model, aspectRatio, resolution);
  };

  const handleRegenerate = async () => {
    if (!scannedPrompt) return;
    await onRegenerateImage(scannedPrompt, model, aspectRatio, resolution);
  };

  const copyToClipboard = (text: string, type: "desc" | "prompt") => {
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
    <div className="flex flex-col h-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-y-auto p-6 space-y-6">
      
      {/* Pane Heading */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-indigo-500/10 rounded-lg text-cyan-400">
          <Compass className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-100 font-display">Work Center</h2>
          <p className="text-xs text-slate-400">Scan URLs and customize AI parameters</p>
        </div>
      </div>

      {/* Main Scan Form */}
      <form onSubmit={handleScanSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
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
              className={`w-full pl-10 pr-4 py-2.5 text-sm bg-black/40 border text-white placeholder-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all ${
                errorMsg ? "border-red-400/50 bg-red-950/20" : "border-white/10"
              }`}
              disabled={isLoading}
            />
          </div>
          {errorMsg && (
            <p className="text-[11px] text-red-400 mt-1 font-medium">{errorMsg}</p>
          )}
        </div>

        {/* Scan Button & Loading States */}
        <div>
          <button
            id="scan-url-btn"
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              isLoading
                ? "bg-white/5 text-slate-500 cursor-not-allowed border border-white/10"
                : "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white hover:opacity-90 shadow-lg shadow-cyan-500/20 active:scale-[0.98]"
            }`}
          >
            {isLoading ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Processing Boost...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Scan URL & Generate Boost</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Loading Steps Visualization */}
      {isLoading && (
        <div className="p-4 bg-indigo-950/40 rounded-2xl border border-indigo-500/20 space-y-3 shadow-inner">
          <h4 className="text-xs font-bold text-cyan-300 font-display flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
            <span>Orchestrating Generative Pipeline</span>
          </h4>
          <div className="space-y-2">
            {[
              { key: "scrape", label: "Extracting metadata and text from target webpage" },
              { key: "copy", label: "Engaging Gemini to write click-worthy social copy" },
              { key: "image", label: `Invoking selected AI model to generate visual asset` },
              { key: "azure", label: `Uploading brand-ready file directly to Azure Storage` }
            ].map((step, idx) => {
              const activeIdx = ["scrape", "copy", "image", "azure"].indexOf(loadingStep);
              const isDone = idx < activeIdx;
              const isActive = idx === activeIdx;

              return (
                <div key={step.key} className="flex items-center gap-2.5">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border ${
                    isDone 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                      : isActive 
                        ? "bg-cyan-500 text-white border-cyan-400 animate-pulse shadow-md shadow-cyan-500/30" 
                        : "bg-white/5 text-slate-500 border-white/5"
                  }`}>
                    {isDone ? "✓" : idx + 1}
                  </div>
                  <span className={`text-xs ${
                    isActive 
                      ? "text-cyan-200 font-semibold" 
                      : isDone 
                        ? "text-slate-400" 
                        : "text-slate-600"
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Parameter Sliders & Settings */}
      <div className="border-t border-white/5 pt-5 space-y-4">
        <div className="flex items-center gap-1.5">
          <Sliders className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-display">Generation parameters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Model Selector */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Image Model</label>
            <select
              id="model-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full text-xs bg-black/40 border border-white/10 text-slate-200 rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 [&_option]:bg-slate-900 [&_option]:text-white"
              disabled={isLoading}
            >
              <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
              <option value="gemini-3.1-flash-image">Gemini 3.1 Flash (High Q)</option>
              <option value="imagen-4.0-generate-001">Imagen 4.0 Pro</option>
            </select>
          </div>

          {/* Aspect Ratio Selector */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Aspect Ratio</label>
            <select
              id="aspect-ratio-select"
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className="w-full text-xs bg-black/40 border border-white/10 text-slate-200 rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 [&_option]:bg-slate-900 [&_option]:text-white"
              disabled={isLoading}
            >
              <option value="1:1">1:1 (Square - Feed)</option>
              <option value="9:16">9:16 (Portrait - Stories)</option>
              <option value="16:9">16:9 (Landscape - Video)</option>
              <option value="4:3">4:3 (Traditional Tablet)</option>
              <option value="3:4">3:4 (Vertical Poster)</option>
            </select>
          </div>

          {/* Resolution Selector */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Resolution / Size</label>
            <select
              id="resolution-select"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="w-full text-xs bg-black/40 border border-white/10 text-slate-200 rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 [&_option]:bg-slate-900 [&_option]:text-white"
              disabled={isLoading}
            >
              <option value="512px">512px (Fast draft)</option>
              <option value="1K">1K (Standard High-Res)</option>
              <option value="2K">2K (Full HD)</option>
              <option value="4K">4K (Ultra HD)</option>
            </select>
          </div>

        </div>
      </div>

      {/* Generated Outputs Summary/Editor (Show only if scannedTitle or scannedDescription has content) */}
      {(scannedTitle || scannedDescription) && !isLoading && (
        <div className="border-t border-white/5 pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-display">Refine Copy & Prompt</h3>
            <span className="text-[10px] bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Ready to Share</span>
          </div>

          {/* Editable Title */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Article Title</label>
            <input
              id="scanned-title-input"
              type="text"
              value={scannedTitle}
              onChange={(e) => onUpdateScannedFields({ title: e.target.value })}
              className="w-full px-3 py-1.5 bg-black/30 border border-white/10 text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          {/* Social Caption Textbox */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-slate-400">Social Media Caption</label>
              <button
                type="button"
                onClick={() => copyToClipboard(scannedDescription, "desc")}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-all"
              >
                {copiedDesc ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Post Text</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              id="scanned-desc-textarea"
              value={scannedDescription}
              onChange={(e) => onUpdateScannedFields({ description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 bg-black/30 border border-white/10 text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50 leading-relaxed"
            ></textarea>
          </div>

          {/* Image Generation Prompt Box */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Image className="w-3.5 h-3.5 text-slate-500" />
                <span>Custom Image Prompt</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(scannedPrompt, "prompt")}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-all"
                >
                  {copiedPrompt ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>Copy Prompt</span>
                </button>
              </div>
            </div>
            <textarea
              id="scanned-prompt-textarea"
              value={scannedPrompt}
              onChange={(e) => onUpdateScannedFields({ prompt: e.target.value })}
              rows={3}
              className="w-full px-3 py-1.5 bg-black/40 border border-white/10 text-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            ></textarea>

            <button
              id="regenerate-image-btn"
              type="button"
              onClick={handleRegenerate}
              className="mt-2 w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold rounded-xl border border-white/10 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md shadow-black/10"
            >
              <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Regenerate Image with Revised Prompt</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
