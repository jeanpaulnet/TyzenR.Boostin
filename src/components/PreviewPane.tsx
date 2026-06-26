import React, { useState } from "react";
import { Maximize2, Download, Share2, Copy, Check, Eye, ExternalLink, HelpCircle, AlertCircle, Sparkles, Sliders } from "lucide-react";
import { ScannedItem } from "../types";

interface PreviewPaneProps {
  activeItem: ScannedItem | null;
  isLoading: boolean;
  isScanning?: boolean;
  model: string;
  setModel: (val: string) => void;
  aspectRatio: string;
  setAspectRatio: (val: string) => void;
  resolution: string;
  setResolution: (val: string) => void;
  scannedPrompt: string;
  onRegenerateImage: (prompt: string, model: string, aspectRatio: string, resolution: string) => Promise<void>;
  onUpdateScannedFields: (fields: { title?: string; description?: string; prompt?: string }) => void;
}

export default function PreviewPane({
  activeItem,
  isLoading,
  isScanning = false,
  model,
  setModel,
  aspectRatio,
  setAspectRatio,
  resolution,
  setResolution,
  scannedPrompt,
  onRegenerateImage,
  onUpdateScannedFields,
}: PreviewPaneProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedAzure, setCopiedAzure] = useState(false);
  const [showShareModal, setShowShareModal] = useState<"instagram" | "facebook" | null>(null);
  const [copiedShareCaption, setCopiedShareCaption] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const handleDownload = () => {
    if (!activeItem || !activeItem.imageUrl) return;
    const link = document.createElement("a");
    link.href = activeItem.imageUrl; // Using local server cached image so it triggers immediate local download
    link.download = `boostin_${activeItem.id || "post"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyAzureUrl = () => {
    if (!activeItem?.azureUrl) return;
    navigator.clipboard.writeText(activeItem.azureUrl);
    setCopiedAzure(true);
    setTimeout(() => setCopiedAzure(false), 2000);
  };

  const copyShareCaption = () => {
    if (!activeItem?.description) return;
    navigator.clipboard.writeText(activeItem.description);
    setCopiedShareCaption(true);
    setTimeout(() => setCopiedShareCaption(false), 2000);
  };

  const copyPrompt = () => {
    if (!scannedPrompt) return;
    navigator.clipboard.writeText(scannedPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleGenClick = async () => {
    if (!scannedPrompt) return;
    await onRegenerateImage(scannedPrompt, model, aspectRatio, resolution);
  };

  // Helper to resolve Tailwind aspect ratios
  const getAspectRatioClass = (ratio: string) => {
    switch (ratio) {
      case "9:16":
        return "aspect-[9/16] max-h-[460px]";
      case "16:9":
        return "aspect-[16/9]";
      case "4:3":
        return "aspect-[4/3]";
      case "3:4":
        return "aspect-[3/4] max-h-[420px]";
      case "1:1":
      default:
        return "aspect-square";
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xl overflow-hidden p-6 space-y-4">
      
      {/* Pane Heading */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 font-display">Creative Preview</h2>
            <p className="text-xs text-slate-500">Review assets and stage publication</p>
          </div>
        </div>

        {activeItem && activeItem.imageUrl && (
          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-100 uppercase tracking-wide font-mono">
            {activeItem.azureStatus.includes("Success") ? "Azure Stored" : "Blob Generated"}
          </span>
        )}
      </div>

      {/* Action Buttons Row at the TOP */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
        {/* Gen Button on Left */}
        <div className="flex items-center">
          <button
            id="gen-visual-btn"
            type="button"
            disabled={isLoading || isScanning || !scannedPrompt}
            onClick={handleGenClick}
            className={`px-5 py-2.5 bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-500/10 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 ${
              isLoading || isScanning || !scannedPrompt ? "opacity-50 cursor-not-allowed" : ""
            }`}
            title="Generate or update visual asset"
          >
            <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
            <span>Gen</span>
          </button>
        </div>

        {/* Full Screen and Download buttons as Icons on Right */}
        <div className="flex items-center gap-2">
          <button
            id="fullscreen-action-btn"
            disabled={!activeItem || !activeItem.imageUrl}
            onClick={() => setIsFullscreen(true)}
            className={`p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-all active:scale-[0.98] flex items-center justify-center ${
              !activeItem || !activeItem.imageUrl ? "opacity-40 cursor-not-allowed" : "hover:scale-105"
            }`}
            title="Full Screen"
          >
            <Maximize2 className="w-4 h-4 text-slate-600" />
          </button>

          <button
            id="download-action-btn"
            disabled={!activeItem || !activeItem.imageUrl}
            onClick={handleDownload}
            className={`p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-all active:scale-[0.98] flex items-center justify-center ${
              !activeItem || !activeItem.imageUrl ? "opacity-40 cursor-not-allowed" : "hover:scale-105"
            }`}
            title="Download Visual"
          >
            <Download className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Main Image Visual Container */}
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border border-slate-100 p-4 min-h-[260px] relative overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-4 text-center animate-pulse">
            <div className="relative w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100 shadow-md">
              <Sparkles className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 font-display">Generating Masterpiece...</p>
              <p className="text-xs text-slate-500 max-w-[200px] mt-1">Applying style prompt & formatting branding watermark</p>
            </div>
          </div>
        ) : activeItem ? (
          activeItem.imageUrl ? (
            <div className="w-full max-w-sm flex flex-col items-center space-y-3">
              
              {/* Styled Preview Frame */}
              <div className={`relative w-full overflow-hidden rounded-xl shadow-xl border border-slate-200 bg-slate-900 transition-all duration-300 ${getAspectRatioClass(activeItem.aspectRatio)}`}>
                <img
                  src={activeItem.imageUrl}
                  alt={activeItem.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                
                {/* Floating controls on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    id="fullscreen-btn"
                    onClick={() => setIsFullscreen(true)}
                    className="p-2 bg-white/90 hover:bg-white text-slate-800 rounded-lg shadow-lg hover:scale-105 transition-all border border-slate-200/50"
                    title="Full Screen View"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button
                    id="download-hover-btn"
                    onClick={handleDownload}
                    className="p-2 bg-white/90 hover:bg-white text-slate-800 rounded-lg shadow-lg hover:scale-105 transition-all border border-slate-200/50"
                    title="Download Image"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Display metadata */}
              <div className="text-center w-full px-2">
                <h3 className="text-xs font-bold text-slate-800 truncate">{activeItem.title}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate font-mono">
                  {activeItem.model} • {activeItem.aspectRatio} • {activeItem.resolution}
                </p>
              </div>

            </div>
          ) : (
            <div className="text-center p-6 flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-3 border border-indigo-100 shadow-md">
                <Sparkles className="w-6 h-6 stroke-[1.5] animate-pulse" />
              </div>
              <p className="text-xs font-bold text-slate-700 font-display">Metadata & Copy Scanned</p>
              <p className="text-[10px] text-slate-500 max-w-[220px] mt-1 leading-relaxed">
                The article has been successfully scanned. Click the <span className="font-bold text-indigo-600">"Gen"</span> button at the top to generate its custom-branded picture.
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

      {/* Custom Image Prompt Box (Moved below image preview) */}
      {(scannedPrompt || activeItem) && (
        <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/50 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider font-display flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
              <span>Custom Image Prompt</span>
            </label>
            {scannedPrompt && (
              <button
                type="button"
                onClick={copyPrompt}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-all font-semibold font-display"
              >
                {copiedPrompt ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}
          </div>
          <textarea
            id="scanned-prompt-textarea"
            value={scannedPrompt}
            onChange={(e) => onUpdateScannedFields({ prompt: e.target.value })}
            placeholder="Image generation prompt goes here. Edit to refine the cinematic visual asset..."
            rows={3}
            className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500/50 leading-relaxed shadow-inner"
            disabled={isLoading || isScanning}
          />
        </div>
      )}

      {/* Generation Parameters section */}
      <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/50 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-slate-500" />
          <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider font-display">Generation Parameters</h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Model Selector */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1 font-display">Model</label>
            <select
              id="model-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full text-[10px] bg-white border border-slate-200 text-slate-800 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 [&_option]:bg-white [&_option]:text-slate-800"
              disabled={isLoading || isScanning}
            >
              <option value="gemini-2.5-flash-image">Gemini 2.5</option>
              <option value="gemini-3.1-flash-image">Gemini 3.1</option>
              <option value="imagen-4.0-generate-001">Imagen 4.0</option>
              <option value="dall-e-3">DALL-E 3 (OpenAI)</option>
              <option value="dall-e-2">DALL-E 2 (OpenAI)</option>
            </select>
          </div>

          {/* Aspect Ratio Selector */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1 font-display">Aspect Ratio</label>
            <select
              id="aspect-ratio-select"
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className="w-full text-[10px] bg-white border border-slate-200 text-slate-800 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 [&_option]:bg-white [&_option]:text-slate-800"
              disabled={isLoading || isScanning}
            >
              <option value="1:1">1:1 Square</option>
              <option value="9:16">9:16 Portrait</option>
              <option value="16:9">16:9 Landscape</option>
              <option value="4:3">4:3 Tablet</option>
              <option value="3:4">3:4 Poster</option>
            </select>
          </div>

          {/* Resolution Selector */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1 font-display">Resolution</label>
            <select
              id="resolution-select"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="w-full text-[10px] bg-white border border-slate-200 text-slate-800 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 [&_option]:bg-white [&_option]:text-slate-800"
              disabled={isLoading || isScanning}
            >
              <option value="512px">512px</option>
              <option value="1K">1K Std</option>
              <option value="2K">2K Full</option>
              <option value="4K">4K Ultra</option>
            </select>
          </div>
        </div>
      </div>

      {/* Azure Blob URL Banner - only when image is generated */}
      {activeItem && activeItem.imageUrl && !isLoading && (
        <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col space-y-1">
          <div className="flex items-center justify-between text-[10px] font-semibold text-indigo-950 font-display">
            <span className="flex items-center gap-1">
              <ExternalLink className="w-3 h-3 text-indigo-600" />
              <span>Azure Blob Storage Location</span>
            </span>
            <button
              type="button"
              onClick={copyAzureUrl}
              className="text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 font-semibold"
            >
              {copiedAzure ? (
                <>
                  <Check className="w-2.5 h-2.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-2.5 h-2.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <div className="text-[9px] font-mono text-slate-700 bg-white p-2 rounded-lg border border-slate-200 break-all select-all shadow-inner">
            {activeItem.azureUrl}
          </div>
          <p className="text-[9px] text-slate-500 font-medium font-mono">
            Status: <span className="text-indigo-600 font-bold">{activeItem.azureStatus}</span>
          </p>
        </div>
      )}

      {/* Share Section with Instagram & Facebook Icons - only when image is generated */}
      {activeItem && activeItem.imageUrl && !isLoading && (
        <div className="border-t border-slate-200/80 pt-3.5 space-y-2">
          <div className="flex items-center gap-1">
            <Share2 className="w-3.5 h-3.5 text-slate-500" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-display">Quick Sharing Suite</h3>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Instagram Sharing Trigger */}
            <button
              id="share-instagram-btn"
              onClick={() => {
                copyShareCaption();
                setShowShareModal("instagram");
              }}
              className="py-2.5 bg-[#e1306c]/10 hover:bg-[#e1306c]/20 text-[#e1306c] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-[#e1306c]/25 active:scale-[0.98]"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
              <span>Instagram</span>
            </button>

            {/* Facebook Sharing Trigger */}
            <button
              id="share-facebook-btn"
              onClick={() => {
                setShowShareModal("facebook");
              }}
              className="py-2.5 bg-[#1877f2]/10 hover:bg-[#1877f2]/20 text-[#1877f2] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-[#1877f2]/25 active:scale-[0.98]"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>Facebook</span>
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen View Modal */}
      {isFullscreen && activeItem && activeItem.imageUrl && (
        <div id="fullscreen-overlay" className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <button
            id="close-fullscreen-btn"
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
          >
            ✕
          </button>
          
          <div className="max-w-4xl max-h-[80vh] overflow-hidden rounded-xl shadow-2xl border border-white/10 relative">
            <img
              src={activeItem.imageUrl}
              alt={activeItem.title}
              className="w-full h-full max-h-[80vh] object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="mt-4 text-center text-white">
            <h3 className="text-sm font-bold font-display">{activeItem.title}</h3>
            <p className="text-xs text-slate-400 mt-1 font-mono">{activeItem.aspectRatio} • {activeItem.resolution} • Saved to Azure Blob</p>
            <div className="flex gap-3 justify-center mt-3">
              <button
                onClick={handleDownload}
                className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-95 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg shadow-cyan-500/10"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download High-Res</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modals */}
      {showShareModal && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-800">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2">
                {showShareModal === "instagram" ? (
                  <span className="p-1.5 bg-[#e1306c]/10 text-[#e1306c] border border-[#e1306c]/20 rounded-lg">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/>
                    </svg>
                  </span>
                ) : (
                  <span className="p-1.5 bg-[#1877f2]/10 text-[#1877f2] border border-[#1877f2]/20 rounded-lg">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </span>
                )}
                <span className="font-bold text-slate-900 font-display text-sm">
                  {showShareModal === "instagram" ? "Instagram Share Assistant" : "Facebook Share Suite"}
                </span>
              </div>
              <button
                onClick={() => setShowShareModal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4">
              
              {showShareModal === "instagram" ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5 p-3 bg-indigo-50 text-indigo-900 border border-indigo-100 rounded-xl text-xs shadow-inner">
                    <AlertCircle className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Captions copied automatically!</p>
                      <p className="text-slate-600 mt-0.5 font-display">We copied your generated social caption to your clipboard. Since browsers cannot upload directly, follow these simple steps:</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">1</div>
                      <span className="font-medium text-slate-600">Click Download visual button below to save the generated image.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">2</div>
                      <span className="font-medium text-slate-600">Open Instagram and click create post.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">3</div>
                      <span className="font-medium text-slate-600">Paste your clipboard contents into the caption field!</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Your Copied Caption</p>
                    <p className="text-xs text-slate-700 line-clamp-3 leading-relaxed">{activeItem.description}</p>
                    <button
                      onClick={copyShareCaption}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 mt-1"
                    >
                      {copiedShareCaption ? "✓ Copied again!" : "Copy Caption again"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    We will share your brand-ready asset hosted directly on your Azure Blob Storage container with Facebook.
                  </p>
                  
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Sharing URL</p>
                    <p className="text-[10px] font-mono text-indigo-600 truncate">{activeItem.azureUrl}</p>
                  </div>

                  <p className="text-xs text-slate-400">
                    Clicking the button below will open the official Facebook sharer with your Azure asset attached.
                  </p>
                </div>
              )}

            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setShowShareModal(null)}
                className="px-4 py-2 text-xs text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
              
              {showShareModal === "instagram" ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 border border-slate-200"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Download Visual</span>
                  </button>
                  <a
                    href="https://www.instagram.com"
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-[#e1306c] hover:bg-[#c1355e] text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-lg shadow-[#e1306c]/15"
                  >
                    <span>Launch Instagram</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(activeItem.azureUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2 bg-[#1877f2] hover:bg-[#1565cf] text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-lg shadow-[#1877f2]/15"
                >
                  <span>Share on Facebook</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
