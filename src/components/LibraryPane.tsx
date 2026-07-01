import React, { useState } from "react";
import { Search, Trash2, Calendar, Link2, FolderHeart, Sparkles } from "lucide-react";
import { ScannedItem } from "../types";

interface LibraryPaneProps {
  items: ScannedItem[];
  selectedId: string | null;
  onSelectItem: (item: ScannedItem) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
}

export default function LibraryPane({
  items,
  selectedId,
  onSelectItem,
  onDeleteItem,
  onClearAll,
}: LibraryPaneProps) {
  const [search, setSearch] = useState("");
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({});

  const filteredItems = items.filter((item) => {
    const s = search.toLowerCase();
    return (
      item.url.toLowerCase().includes(s) ||
      item.title.toLowerCase().includes(s) ||
      item.description.toLowerCase().includes(s)
    );
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDomain = (urlStr: string) => {
    try {
      return new URL(urlStr).hostname.replace("www.", "");
    } catch (_) {
      return urlStr;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xl overflow-hidden">
      
      {/* Pane Header */}
      <div className="p-4 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
            <FolderHeart className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-800 font-display text-sm tracking-tight">URL Gallery History</span>
        </div>
        
        {items.length > 0 && (
          <button
            id="clear-all-btn"
            onClick={onClearAll}
            className="text-[11px] font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-all"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Search Header */}
      <div className="p-3 border-b border-slate-100 bg-transparent">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="library-search-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search history..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4 py-8">
            <div className="p-3 bg-slate-50 rounded-full text-slate-400 mb-2 border border-slate-100">
              <Link2 className="w-6 h-6 stroke-[1.5] text-slate-400" />
            </div>
            <p className="text-xs font-semibold text-slate-600 font-display">No scanned URLs yet</p>
            <p className="text-[10px] text-slate-400 mt-1 max-w-[180px]">
              {search ? "No matches for your search query." : "Enter a URL in the Work pane & click Scan to start your library."}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isSelected = item.id === selectedId;
            return (
              <div
                id={`library-item-${item.id}`}
                key={item.id}
                onClick={() => onSelectItem(item)}
                className={`group relative flex items-start gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all border ${
                  isSelected
                    ? "bg-indigo-50/50 border-indigo-200 shadow-sm ring-1 ring-indigo-50"
                    : "border-transparent hover:bg-slate-50/80"
                }`}
              >
                {/* Micro Thumbnail */}
                <div className="relative w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                  {(item.imageUrl916 || item.imageUrl169 || item.imageUrl) && !failedUrls[item.imageUrl916 || item.imageUrl169 || item.imageUrl || ""] ? (
                    <img
                      src={item.imageUrl916 || item.imageUrl169 || item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => {
                        const targetUrl = item.imageUrl916 || item.imageUrl169 || item.imageUrl || "";
                        if (targetUrl) {
                          setFailedUrls((prev) => ({ ...prev, [targetUrl]: true }));
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50 text-indigo-500">
                      <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                  )}
                  {/* Aspect tag */}
                  <span className="absolute bottom-0 right-0 bg-black/60 text-[8px] text-white px-1.5 font-mono scale-90 origin-bottom-right rounded">
                    {(item.imageUrl916 && item.imageUrl169) ? "9:16 + 16:9" : item.aspectRatio}
                  </span>
                </div>

                {/* Text Metadata */}
                <div className="flex-1 min-w-0 pr-6">
                  <h4 className="text-xs font-semibold text-slate-900 truncate leading-tight">
                    {item.title || "Scanned Article"}
                  </h4>
                  <p className="text-[10px] text-slate-500 truncate mt-1 font-mono flex items-center gap-1">
                    <Link2 className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
                    <span>{getDomain(item.url)}</span>
                  </p>
                  <p className="text-[9px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                    <Calendar className="w-2.5 h-2.5 flex-shrink-0" />
                    <span>{formatDate(item.timestamp)}</span>
                  </p>
                </div>

                {/* Delete Button */}
                <button
                  id={`delete-item-btn-${item.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteItem(item.id);
                  }}
                  className="absolute right-2 top-2 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-60 hover:opacity-100 transition-all"
                  title="Remove from Gallery"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Pane Footer Stats */}
      {items.length > 0 && (
        <div className="p-3 bg-slate-50/80 border-t border-slate-200/60 text-center">
          <p className="text-[10px] text-slate-500 font-medium">
            Gallery: {items.length} URL{items.length > 1 ? "s" : ""} recorded
          </p>
        </div>
      )}

    </div>
  );
}
