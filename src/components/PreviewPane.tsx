import React, { useState } from "react";
import { Maximize2, Download, Share2, Copy, Check, Eye, ExternalLink, HelpCircle, AlertCircle, Sparkles } from "lucide-react";
import { ScannedItem } from "../types";

interface PreviewPaneProps {
  activeItem: ScannedItem | null;
  isLoading: boolean;
}

export default function PreviewPane({ activeItem, isLoading }: PreviewPaneProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedAzure, setCopiedAzure] = useState(false);
  const [showShareModal, setShowShareModal] = useState<"instagram" | "facebook" | null>(null);
  const [copiedShareCaption, setCopiedShareCaption] = useState(false);

  const handleDownload = () => {
    if (!activeItem) return;
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

  // Helper to resolve Tailwind aspect ratios
  const getAspectRatioClass = (ratio: string) => {
    switch (ratio) {
      case "9:16":
        return "aspect-[9/16] max-h-[500px]";
      case "16:9":
        return "aspect-[16/9]";
      case "4:3":
        return "aspect-[4/3]";
      case "3:4":
        return "aspect-[3/4] max-h-[460px]";
      case "1:1":
      default:
        return "aspect-square";
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden p-6 space-y-5">
      
      {/* Pane Heading */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/10 rounded-lg text-cyan-400">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 font-display">Creative Preview</h2>
            <p className="text-xs text-slate-400">Review assets and stage publication</p>
          </div>
        </div>

        {activeItem && (
          <span className="text-[10px] bg-cyan-400/10 text-cyan-400 px-2 py-0.5 rounded-full font-bold border border-cyan-400/20 uppercase tracking-wide">
            {activeItem.azureStatus.includes("Success") ? "Azure Stored" : "Blob Generated"}
          </span>
        )}
      </div>

      {/* Main Image Visual Container */}
      <div className="flex-1 flex flex-col items-center justify-center bg-black/40 rounded-2xl border border-white/10 p-4 min-h-[300px] relative overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-4 text-center animate-pulse">
            <div className="relative w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/30 shadow-lg shadow-cyan-500/20">
              <Sparkles className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
            <div>
              <p className="text-sm font-bold text-white font-display">Generating Masterpiece...</p>
              <p className="text-xs text-slate-400 max-w-[200px] mt-1">Applying style prompt & formatting branding watermark</p>
            </div>
          </div>
        ) : activeItem ? (
          <div className="w-full max-w-sm flex flex-col items-center space-y-4">
            
            {/* Styled Preview Frame */}
            <div className={`relative w-full overflow-hidden rounded-xl shadow-2xl border border-white/10 bg-slate-950 transition-all duration-300 ${getAspectRatioClass(activeItem.aspectRatio)}`}>
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
                  className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl shadow-lg hover:scale-105 transition-all border border-white/10"
                  title="Full Screen View"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  id="download-hover-btn"
                  onClick={handleDownload}
                  className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl shadow-lg hover:scale-105 transition-all border border-white/10"
                  title="Download Image"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Display metadata */}
            <div className="text-center w-full px-2">
              <h3 className="text-xs font-bold text-slate-200 truncate">{activeItem.title}</h3>
              <p className="text-[10px] text-slate-400 mt-1 truncate font-mono">
                {activeItem.model} • {activeItem.aspectRatio} • {activeItem.resolution}
              </p>
            </div>

          </div>
        ) : (
          <div className="text-center p-6 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 mb-3 border border-white/5">
              <Eye className="w-6 h-6 stroke-[1.5]" />
            </div>
            <p className="text-xs font-bold text-slate-300 font-display">Awaiting URL Injection</p>
            <p className="text-[10px] text-slate-500 max-w-[220px] mt-1 leading-relaxed">
              Scan an article URL in the Work Center. Your branded creative visual will appear right here.
            </p>
          </div>
        )}
      </div>

      {/* Azure Blob URL Banner */}
      {activeItem && !isLoading && (
        <div className="p-3.5 bg-indigo-950/40 rounded-2xl border border-indigo-500/20 flex flex-col space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-cyan-300 font-display">
            <span className="flex items-center gap-1">
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              <span>Azure Blob Storage Location</span>
            </span>
            <button
              type="button"
              onClick={copyAzureUrl}
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
            >
              {copiedAzure ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy URL</span>
                </>
              )}
            </button>
          </div>
          <div className="text-[10px] font-mono text-slate-200 bg-black/40 p-2.5 rounded-xl border border-white/10 break-all select-all shadow-inner">
            {activeItem.azureUrl}
          </div>
          <p className="text-[9px] text-slate-400 font-medium font-mono">
            Status: <span className="text-cyan-300 font-semibold">{activeItem.azureStatus}</span>
          </p>
        </div>
      )}

      {/* Primary Action Buttons (Full Screen, Download, Share) */}
      {activeItem && !isLoading && (
        <div className="grid grid-cols-2 gap-3">
          <button
            id="fullscreen-action-btn"
            onClick={() => setIsFullscreen(true)}
            className="py-2.5 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold rounded-xl border border-white/10 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-md shadow-black/15"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Full Screen</span>
          </button>
          <button
            id="download-action-btn"
            onClick={handleDownload}
            className="py-2.5 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold rounded-xl border border-white/10 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-md shadow-black/15"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      )}

      {/* Share Section with Instagram & Facebook Icons */}
      {activeItem && !isLoading && (
        <div className="border-t border-white/5 pt-4 space-y-3">
          <div className="flex items-center gap-1">
            <Share2 className="w-3.5 h-3.5 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-display">Quick sharing suite</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Instagram Sharing Trigger */}
            <button
              id="share-instagram-btn"
              onClick={() => {
                copyShareCaption();
                setShowShareModal("instagram");
              }}
              className="py-3 bg-[#e1306c]/10 hover:bg-[#e1306c]/20 text-[#ff598f] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-[#e1306c]/25 active:scale-[0.98] shadow-lg shadow-[#e1306c]/5"
            >
              {/* Instagram SVG */}
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
              <span>Instagram Share</span>
            </button>

            {/* Facebook Sharing Trigger */}
            <button
              id="share-facebook-btn"
              onClick={() => {
                setShowShareModal("facebook");
              }}
              className="py-3 bg-[#1877f2]/10 hover:bg-[#1877f2]/20 text-[#5da4ff] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-[#1877f2]/25 active:scale-[0.98] shadow-lg shadow-[#1877f2]/5"
            >
              {/* Facebook SVG */}
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>Facebook Share</span>
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen View Modal */}
      {isFullscreen && activeItem && (
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
          <div className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-100">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40">
              <div className="flex items-center gap-2">
                {showShareModal === "instagram" ? (
                  <span className="p-1.5 bg-[#e1306c]/20 text-[#ff598f] border border-[#e1306c]/30 rounded-lg">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/>
                    </svg>
                  </span>
                ) : (
                  <span className="p-1.5 bg-[#1877f2]/20 text-[#5da4ff] border border-[#1877f2]/30 rounded-lg">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </span>
                )}
                <span className="font-bold text-slate-100 font-display text-sm">
                  {showShareModal === "instagram" ? "Instagram Share Assistant" : "Facebook Share Suite"}
                </span>
              </div>
              <button
                onClick={() => setShowShareModal(null)}
                className="text-slate-400 hover:text-white text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4">
              
              {showShareModal === "instagram" ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5 p-3 bg-indigo-950/50 rounded-xl text-xs text-indigo-200 border border-indigo-500/30 shadow-inner">
                    <AlertCircle className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Captions copied automatically!</p>
                      <p className="text-slate-300 mt-0.5">We copied your generated social caption to your clipboard. Since browsers cannot upload directly, follow these simple steps:</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center font-bold text-[10px]">1</div>
                      <span className="font-medium text-slate-300">Click Download visual button below to save the generated image.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center font-bold text-[10px]">2</div>
                      <span className="font-medium text-slate-300">Open Instagram and click create post.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center font-bold text-[10px]">3</div>
                      <span className="font-medium text-slate-300">Paste your clipboard contents into the caption field!</span>
                    </div>
                  </div>

                  <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Your Copied Caption</p>
                    <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">{activeItem.description}</p>
                    <button
                      onClick={copyShareCaption}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 mt-1"
                    >
                      {copiedShareCaption ? "✓ Copied again!" : "Copy Caption again"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    We will share your brand-ready asset hosted directly on your Azure Blob Storage container with Facebook.
                  </p>
                  
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Sharing URL</p>
                    <p className="text-[10px] font-mono text-cyan-300 truncate">{activeItem.azureUrl}</p>
                  </div>

                  <p className="text-xs text-slate-400">
                    Clicking the button below will open the official Facebook sharer with your Azure asset attached.
                  </p>
                </div>
              )}

            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-black/40 border-t border-white/10 flex justify-end gap-2">
              <button
                onClick={() => setShowShareModal(null)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
              
              {showShareModal === "instagram" ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1 border border-white/10"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
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
