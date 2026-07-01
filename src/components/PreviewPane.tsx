import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Download, Copy, Check, Eye, ExternalLink, AlertCircle, Sparkles, History, Loader2, RefreshCw } from "lucide-react";
import { ScannedItem, Settings } from "../types";

interface PreviewPaneProps {
  activeItem: ScannedItem | null;
  isLoading: boolean;
  isScanning?: boolean;
  model: string;
  setModel: (val: string) => void;
  aspectRatio: string;
  setAspectRatio: (val: string) => void;
  scannedPrompt: string;
  onRegenerateImage: (prompt: string, model: string, aspectRatio: string) => Promise<void>;
  onUpdateScannedFields: (fields: { 
    title?: string; 
    description?: string; 
    prompt?: string; 
    imageUrl?: string;
    imageUrl916?: string;
    imageUrl169?: string;
    imageUrl11?: string;
  }) => void;
  settings: Settings;
  imageError?: string | null;
  setImageError?: (val: string | null) => void;
  refreshingAspect?: "1:1" | "9:16" | "16:9" | null;
  onRefreshSingleImage?: (aspectRatio: "1:1" | "9:16" | "16:9") => Promise<void>;
  autoSwitchMessage?: string | null;
  onClearAutoSwitchMessage?: () => void;
}

export default function PreviewPane({
  activeItem,
  isLoading,
  isScanning = false,
  model,
  setModel,
  aspectRatio,
  setAspectRatio,
  scannedPrompt,
  onRegenerateImage,
  onUpdateScannedFields,
  settings,
  imageError = null,
  setImageError,
  refreshingAspect,
  onRefreshSingleImage,
  autoSwitchMessage = null,
  onClearAutoSwitchMessage,
}: PreviewPaneProps) {
  const [fullscreenImgUrl, setFullscreenImgUrl] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [historyAspect, setHistoryAspect] = useState<"1:1" | "16:9" | "9:16" | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyImageToClipboard = async (imgUrl: string) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");
      ctx.drawImage(img, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) => 
        canvas.toBlob((b) => resolve(b), "image/png")
      );

      if (!blob) throw new Error("Canvas toBlob failed");

      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      return true;
    } catch (err) {
      console.error("Failed to copy image to clipboard via canvas:", err);
      try {
        const response = await fetch(imgUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ]);
        return true;
      } catch (directErr) {
        console.error("Direct write also failed:", directErr);
        return false;
      }
    }
  };

  const handleCopyImage = async (url: string, id: string) => {
    const success = await copyImageToClipboard(url);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };



  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") {
        setFullscreenImgUrl(null);
      }
    };
    if (fullscreenImgUrl) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [fullscreenImgUrl]);

  const pastUrlsList = activeItem
    ? historyAspect === "1:1"
      ? (activeItem.pastImageUrls11 && activeItem.pastImageUrls11.length > 0
        ? activeItem.pastImageUrls11
        : activeItem.imageUrl11
          ? [activeItem.imageUrl11]
          : activeItem.imageUrl
            ? [activeItem.imageUrl]
            : [])
      : historyAspect === "16:9"
        ? (activeItem.pastImageUrls169 && activeItem.pastImageUrls169.length > 0
          ? activeItem.pastImageUrls169
          : activeItem.imageUrl169
            ? [activeItem.imageUrl169]
            : [])
        : historyAspect === "9:16"
          ? (activeItem.pastImageUrls916 && activeItem.pastImageUrls916.length > 0
            ? activeItem.pastImageUrls916
            : activeItem.imageUrl916
              ? [activeItem.imageUrl916]
              : [])
          : []
    : [];

  const hasMultipleImages = !!(activeItem && (activeItem.imageUrl916 || activeItem.imageUrl169));

  const handleDownload = () => {
    if (!activeItem) return;

    const urlsToDownload: string[] = [];
    if (activeItem.imageUrl916) urlsToDownload.push(activeItem.imageUrl916);
    if (activeItem.imageUrl169) urlsToDownload.push(activeItem.imageUrl169);

    // If none of the specific ones exist but the general imageUrl exists, use it
    if (urlsToDownload.length === 0 && activeItem.imageUrl) {
      urlsToDownload.push(activeItem.imageUrl);
    }

    if (urlsToDownload.length === 0) return;

    // Sanitize business name (remove spaces & special chars)
    const bizNameClean = (settings?.bizName || "Biz").replace(/[^a-zA-Z0-9]/g, "");
    
    // Create clean datetime string (remove spaces & special chars, keeping it alphanumeric)
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const datetimeClean = `${yyyy}${mm}${dd}${hh}${min}${ss}`;

    urlsToDownload.forEach((url) => {
      let suffix = "";
      if (url === activeItem.imageUrl916) suffix = "-9_16";
      else if (url === activeItem.imageUrl169) suffix = "-16_9";
      
      const filename = `Boostin-${bizNameClean}-${datetimeClean}${suffix}.png`;

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  const handleDownloadSpecific = (url: string, suffix: string) => {
    if (!activeItem) return;
    const bizNameClean = (settings?.bizName || "Biz").replace(/[^a-zA-Z0-9]/g, "");
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const datetimeClean = `${yyyy}${mm}${dd}${hh}${min}${ss}`;
    const filename = `Boostin-${bizNameClean}-${datetimeClean}${suffix}.png`;

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyPrompt = () => {
    if (!scannedPrompt) return;
    navigator.clipboard.writeText(scannedPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleGenClick = async () => {
    if (!scannedPrompt) return;
    await onRegenerateImage(scannedPrompt, model, aspectRatio);
  };

  // Helper to resolve Tailwind aspect ratios
  const getAspectRatioClass = (ratio: string) => {
    switch (ratio) {
      case "9:16":
        return "w-[240px] aspect-[9/16]";
      case "16:9":
        return "w-full max-w-[360px] aspect-[16/9]";
      case "4:3":
        return "w-full max-w-[340px] aspect-[4/3]";
      case "3:4":
        return "w-[270px] aspect-[3/4]";
      case "1:1":
      default:
        return "w-full max-w-[300px] aspect-square";
    }
  };

  // Helper to resolve dynamic container heights based on selected ratio
  const getContainerHeightClass = (ratio: string) => {
    switch (ratio) {
      case "9:16":
        return "h-[480px]";
      case "3:4":
        return "h-[410px]";
      case "1:1":
      default:
        return "h-[340px]";
      case "4:3":
        return "h-[300px]";
      case "16:9":
        return "h-[250px]";
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xl overflow-y-auto p-6 space-y-4">
      
      {/* Pane Heading */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 font-display">Creative Preview</h2>
          </div>
        </div>
      </div>

      {/* Action Buttons Row at the TOP */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
        {/* Gen Button & Model Select on Left */}
        <div className="flex items-center gap-3">
          <button
            id="gen-visual-btn"
            type="button"
            disabled={isLoading || isScanning || !scannedPrompt}
            onClick={handleGenClick}
            className={`px-5 py-2.5 bg-gradient-to-r from-[#a3e635] via-[#10b981] to-[#8b5cf6] border border-white/20 text-white text-xs font-bold rounded-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_4px_14px_rgba(163,230,53,0.15)] hover:brightness-105 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 ${
              isLoading || isScanning || !scannedPrompt ? "opacity-50 cursor-not-allowed" : ""
            }`}
            title="Generate or update visual asset"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                <span>Generating...</span>
              </>
            ) : isScanning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                <span>Gen</span>
              </>
            )}
          </button>

          {/* Model selection horizontal switches with gradient bg */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">
              Model
            </span>
            <div className="flex bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60 shadow-sm">
              <button
                type="button"
                onClick={() => setModel("gpt")}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 ${
                  model === "gpt"
                    ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-sm shadow-indigo-500/10 scale-100"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                }`}
              >
                GPT
              </button>
              <button
                type="button"
                onClick={() => setModel("gemini")}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 ${
                  model === "gemini"
                    ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-sm shadow-indigo-500/10 scale-100"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                }`}
              >
                Gemini
              </button>
            </div>
          </div>
        </div>


      </div>



      {/* Main Image Visual Container */}
      <div className={`flex flex-col items-center justify-start bg-slate-50/50 rounded-2xl border border-slate-200/60 p-4 relative transition-all duration-300 ${hasMultipleImages ? "h-[620px] overflow-y-auto w-full" : getContainerHeightClass(aspectRatio) + " overflow-hidden"}`}>
        {historyAspect && (
          <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm z-30 flex flex-col p-4 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-black uppercase tracking-wider font-display text-slate-200">{historyAspect} Picture History ({pastUrlsList.length})</h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryAspect(null)}
                className="w-6 h-6 flex items-center justify-center hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all text-xs font-bold font-mono"
                title="Close"
              >
                ✕
              </button>
            </div>
            
            {pastUrlsList.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <History className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
                <p className="text-xs text-slate-400">No past generated pictures for {historyAspect} yet.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar text-left">
                {pastUrlsList.map((url, index) => {
                  const isActive = historyAspect === "1:1"
                    ? (activeItem?.imageUrl11 === url || activeItem?.imageUrl === url)
                    : historyAspect === "16:9"
                      ? activeItem?.imageUrl169 === url
                      : activeItem?.imageUrl916 === url;
                  return (
                    <div
                      key={index}
                      onClick={() => {
                        if (historyAspect === "1:1") {
                          onUpdateScannedFields({
                            imageUrl: url,
                            imageUrl11: url,
                          });
                        } else if (historyAspect === "16:9") {
                          onUpdateScannedFields({
                            imageUrl169: url,
                          });
                        } else if (historyAspect === "9:16") {
                          onUpdateScannedFields({
                            imageUrl916: url,
                          });
                        }
                        setHistoryAspect(null);
                      }}
                      className={`flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer ${
                        isActive
                          ? "bg-indigo-600/20 border-indigo-500 text-indigo-200"
                          : "bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/30 text-slate-300"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-700/50 overflow-hidden flex-shrink-0 relative">
                        <img
                          src={url}
                          alt={`Past gen ${index + 1}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        {isActive && (
                          <div className="absolute inset-0 bg-indigo-600/40 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-mono font-bold">Picture #{index + 1}</span>
                          {isActive && (
                            <span className="text-[8px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-medium text-slate-300 truncate pr-4" title={url}>
                          {url}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(url);
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all"
                          title="Copy URL"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {imageError ? (
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-3.5 max-w-[340px]">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shadow-sm animate-bounce">
              <AlertCircle className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <p className="text-xs font-black text-rose-950 uppercase tracking-wider font-display">Creative Generation Failed</p>
              <div className="mt-2 text-[10px] text-rose-700 bg-rose-50/60 p-2.5 rounded-lg border border-rose-100/50 break-words leading-relaxed max-h-[100px] overflow-y-auto font-mono text-left">
                {imageError}
              </div>
            </div>
            {(imageError.toLowerCase().includes("not found") || imageError.toLowerCase().includes("v1beta") || imageError.toLowerCase().includes("supported")) ? (
              <p className="text-[10px] text-slate-500 leading-normal">
                <span className="font-semibold text-slate-700">Billing Required:</span> Google Gemini image models require a billing-enabled, paid API key. We have requested AI Studio to open your <strong>Billing & Upgrade</strong> panel. Please complete setup in AI Studio to proceed.
              </p>
            ) : (
              <p className="text-[10px] text-slate-500 leading-normal">
                Please double check your API key credentials and prompt, or switch the generator model.
              </p>
            )}
            <div className="flex gap-2 w-full pt-1">
              <button
                type="button"
                onClick={() => {
                  if (setImageError) setImageError(null);
                }}
                className="w-full py-1.5 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-all active:scale-95"
              >
                Clear Error
              </button>
            </div>
          </div>
        ) : activeItem ? (
          (activeItem.imageUrl || activeItem.imageUrl169 || isLoading || refreshingAspect) ? (
            <div className="w-full flex flex-col items-center space-y-6">
              {autoSwitchMessage && (
                <div className="w-full max-w-[360px] bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 shadow-sm relative animate-fade-in text-left">
                  <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1 pr-4">
                    <p className="text-[11px] font-semibold text-amber-900 leading-snug">
                      {autoSwitchMessage}
                    </p>
                    <p className="text-[9px] text-amber-600/80 mt-0.5">
                      Retried automatically using the alternative provider.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClearAutoSwitchMessage}
                    className="absolute top-2.5 right-2.5 text-amber-400 hover:text-amber-600 font-bold text-xs p-1 hover:scale-110 transition-transform cursor-pointer"
                    title="Dismiss"
                  >
                    ×
                  </button>
                </div>
              )}
              {/* 1:1 Square Image Display */}
              <div className="w-full flex flex-col items-center space-y-2 animate-fade-in pb-2">
                <div className="flex items-center justify-between w-full max-w-[300px] px-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono">
                    1:1 Square
                  </span>
                  <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold font-mono">
                    Square
                  </span>
                </div>
                <div className="flex items-center gap-3 w-full justify-center">
                  {/* Container for 1:1 image or loader */}
                  {(isLoading || refreshingAspect === "1:1") ? (
                    activeItem.imageUrl ? (
                      <div className="relative overflow-hidden rounded-xl shadow-xl border border-slate-200 bg-slate-950 w-full max-w-[300px] aspect-square">
                        <img
                          src={activeItem.imageUrl}
                          alt={`${activeItem.title || "Branded Visual"} - 1:1`}
                          className="w-full h-full object-contain opacity-50"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center text-center p-4">
                          <RefreshCw className="w-8 h-8 text-red-400 animate-spin mb-2" />
                          <span className="text-[10px] font-bold text-white uppercase tracking-wider">Refreshing 1:1...</span>
                        </div>
                      </div>
                    ) : (
                      <div className="relative overflow-hidden rounded-xl shadow-xl border border-slate-200 bg-slate-50 w-full max-w-[300px] aspect-square flex flex-col items-center justify-center text-center p-4 animate-pulse">
                        <div className="relative w-12 h-12 rounded-full bg-red-50 flex items-center justify-center border border-red-100 shadow-md mb-2">
                          <RefreshCw className="w-6 h-6 text-red-500 animate-spin" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-700 font-display">Generating 1:1 Image...</span>
                        <span className="text-[9px] text-slate-400 mt-0.5 font-mono">Tyzenr API Request</span>
                      </div>
                    )
                  ) : activeItem.imageUrl ? (
                    <div 
                      className="relative overflow-hidden rounded-xl shadow-xl border border-slate-200 bg-slate-950 transition-all duration-300 cursor-pointer hover:border-indigo-400 w-full max-w-[300px] aspect-square"
                      onClick={() => setFullscreenImgUrl(activeItem.imageUrl)}
                      title="Click to view fullscreen"
                    >
                      <img
                        src={activeItem.imageUrl}
                        alt={`${activeItem.title || "Branded Visual"} - 1:1`}
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50/50 w-full max-w-[300px] aspect-square flex flex-col items-center justify-center text-center p-4">
                      <Sparkles className="w-8 h-8 text-slate-300 mb-2" />
                      <span className="text-[11px] font-medium text-slate-400">1:1 Picture Not Generated</span>
                    </div>
                  )}

                  {/* Actions for 1:1 */}
                  {activeItem.imageUrl && (
                    <div className="flex flex-col gap-1.5 p-1 bg-slate-50 rounded-lg border border-slate-200 self-center">
                      <button
                        type="button"
                        onClick={() => setFullscreenImgUrl(activeItem.imageUrl)}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
                        title="View Fullscreen"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRefreshSingleImage?.("1:1")}
                        disabled={refreshingAspect === "1:1" || isLoading}
                        className="p-1.5 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Generate Again / Refresh (Gen)"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshingAspect === "1:1" ? "animate-spin text-red-500" : ""}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyImage(activeItem.imageUrl, "1:1")}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-600 hover:text-emerald-600 transition-colors cursor-pointer"
                        title="Copy to Clipboard"
                      >
                        {copiedId === "1:1" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryAspect(prev => prev === "1:1" ? null : "1:1")}
                        className={`p-1.5 rounded transition-colors cursor-pointer ${
                          historyAspect === "1:1"
                            ? "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
                            : "hover:bg-slate-200 text-slate-600 hover:text-indigo-600"
                        }`}
                        title="View Picture History"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadSpecific(activeItem.imageUrl, "-1_1")}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
                        title="Download Picture"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 16:9 Landscape Image Display */}
              <div className="w-full flex flex-col items-center space-y-2 animate-fade-in pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between w-full max-w-[360px] px-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono">
                    16:9 Landscape
                  </span>
                  <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold font-mono">
                    Landscape
                  </span>
                </div>
                <div className="flex items-center gap-3 w-full justify-center">
                  {/* Container for 16:9 image or loader */}
                  {(isLoading || refreshingAspect === "16:9") ? (
                    activeItem.imageUrl169 ? (
                      <div className="relative overflow-hidden rounded-xl shadow-xl border border-slate-200 bg-slate-950 w-full max-w-[360px] aspect-[16/9]">
                        <img
                          src={activeItem.imageUrl169}
                          alt={`${activeItem.title || "Branded Visual"} - 16:9`}
                          className="w-full h-full object-contain opacity-50"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center text-center p-4">
                          <RefreshCw className="w-8 h-8 text-red-400 animate-spin mb-2" />
                          <span className="text-[10px] font-bold text-white uppercase tracking-wider">Refreshing 16:9...</span>
                        </div>
                      </div>
                    ) : (
                      <div className="relative overflow-hidden rounded-xl shadow-xl border border-slate-200 bg-slate-50 w-full max-w-[360px] aspect-[16/9] flex flex-col items-center justify-center text-center p-4 animate-pulse">
                        <div className="relative w-12 h-12 rounded-full bg-red-50 flex items-center justify-center border border-red-100 shadow-md mb-2">
                          <RefreshCw className="w-6 h-6 text-red-500 animate-spin" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-700 font-display">Generating 16:9 Image...</span>
                        <span className="text-[9px] text-slate-400 mt-0.5 font-mono">Tyzenr API Request</span>
                      </div>
                    )
                  ) : activeItem.imageUrl169 ? (
                    <div 
                      className="relative overflow-hidden rounded-xl shadow-xl border border-slate-200 bg-slate-950 transition-all duration-300 cursor-pointer hover:border-indigo-400 w-full max-w-[360px] aspect-[16/9]"
                      onClick={() => setFullscreenImgUrl(activeItem.imageUrl169 || null)}
                      title="Click to view fullscreen"
                    >
                      <img
                        src={activeItem.imageUrl169}
                        alt={`${activeItem.title || "Branded Visual"} - 16:9`}
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50/50 w-full max-w-[360px] aspect-[16/9] flex flex-col items-center justify-center text-center p-4">
                      <Sparkles className="w-8 h-8 text-slate-300 mb-2" />
                      <span className="text-[11px] font-medium text-slate-400">16:9 Picture Not Generated</span>
                    </div>
                  )}

                  {/* Actions for 16:9 */}
                  {activeItem.imageUrl169 && (
                    <div className="flex flex-col gap-1.5 p-1 bg-slate-50 rounded-lg border border-slate-200 self-center">
                      <button
                        type="button"
                        onClick={() => setFullscreenImgUrl(activeItem.imageUrl169 || null)}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
                        title="View Fullscreen"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRefreshSingleImage?.("16:9")}
                        disabled={refreshingAspect === "16:9" || isLoading}
                        className="p-1.5 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Generate Again / Refresh (Gen)"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshingAspect === "16:9" ? "animate-spin text-red-500" : ""}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyImage(activeItem.imageUrl169!, "16:9")}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-600 hover:text-emerald-600 transition-colors cursor-pointer"
                        title="Copy to Clipboard"
                      >
                        {copiedId === "16:9" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryAspect(prev => prev === "16:9" ? null : "16:9")}
                        className={`p-1.5 rounded transition-colors cursor-pointer ${
                          historyAspect === "16:9"
                            ? "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
                            : "hover:bg-slate-200 text-slate-600 hover:text-indigo-600"
                        }`}
                        title="View Picture History"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadSpecific(activeItem.imageUrl169!, "-16_9")}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
                        title="Download Picture"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-6 flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-3 border border-indigo-100 shadow-md">
                <Sparkles className="w-6 h-6 stroke-[1.5] animate-pulse" />
              </div>
              <p className="text-xs font-bold text-slate-700 font-display">Metadata & Copy Scanned</p>
              <p className="text-[10px] text-slate-500 max-w-[220px] mt-1 leading-relaxed">
                The article has been successfully scanned. Click the <span className="font-bold text-indigo-600">"Gen"</span> button at the top to generate its custom-branded pictures (1:1 and 16:9).
              </p>
            </div>
          )
        ) : (
          <div className="text-center p-6 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3 border border-slate-200/40">
              <Eye className="w-6 h-6 stroke-[1.5]" />
            </div>
            <p className="text-xs font-bold text-slate-700 font-display">Awaiting URL Injection</p>
            <p className="text-[10px] text-slate-400 max-w-[220px] mt-1 leading-relaxed">
              Scan an article URL in the Work Center. Your branded creative visual can be generated right here.
            </p>
          </div>
        )}
      </div>



      {/* Parameters are hidden by default (always using 1:1 Aspect Ratio and 1K Resolution) */}


      {/* Fullscreen View Modal */}
      {fullscreenImgUrl && createPortal(
        <div 
          id="fullscreen-overlay" 
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setFullscreenImgUrl(null)}
        >
          {/* Close button top right of the screen */}
          <button
            id="close-fullscreen-btn"
            onClick={() => setFullscreenImgUrl(null)}
            className="absolute top-6 right-6 p-3 bg-slate-900/80 hover:bg-slate-900 text-white/80 hover:text-white rounded-full transition-all cursor-pointer z-[10000] flex items-center justify-center active:scale-90 border border-white/10 shadow-lg"
            title="Close Fullscreen (Esc)"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Image Container spanning full possible viewport */}
          <div 
            className="max-w-[95vw] max-h-[95vh] flex items-center justify-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={fullscreenImgUrl}
              alt={activeItem?.title || "Branded Visual"}
              className="max-w-[95vw] max-h-[95vh] object-contain rounded-xl shadow-2xl border border-white/5"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
