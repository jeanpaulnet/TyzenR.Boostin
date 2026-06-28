import React, { useState } from "react";
import { X, Save, Shield, HelpCircle, Check, Database } from "lucide-react";
import { Settings } from "../types";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
}

export default function SettingsDialog({
  isOpen,
  onClose,
  settings,
  onSave,
}: SettingsDialogProps) {
  const [bizName, setBizName] = useState(settings.bizName);
  const [website, setWebsite] = useState(settings.website);
  const [watermark, setWatermark] = useState(settings.watermark);
  const [commonTags, setCommonTags] = useState(settings.commonTags || "#trending #news");
  const [promptTemplate, setPromptTemplate] = useState(settings.promptTemplate);
  const [isSaved, setIsSaved] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      bizName,
      website,
      watermark,
      promptTemplate,
      commonTags: commonTags.toLowerCase(),
    });
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1000);
  };

  const resetToDefault = () => {
    setBizName("Your Biz");
    setWebsite("www.yourbiz.org");
    setWatermark("Watermark");
    setCommonTags("#trending #news");
    setPromptTemplate("create an ultra-realistic corporate financial like detailed picture with vivid colors summarizing content of {url}. Create title from article on top. Create subtitle '{settings.business.name}' on bottom with watermark '{settings.watermark}' below it. ");
  };

  return (
    <div id="settings-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all duration-300">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200/80 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 font-display">Business Settings</h2>
              <p className="text-xs text-slate-500">Configure global metadata and image prompt templates</p>
            </div>
          </div>
          <button
            id="close-settings-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-700">
          
          {/* Brand Panel */}
          <div className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="inline-block text-xs font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent pb-0.5 pr-1 mb-1">Business Name</label>
                <input
                  id="setting-biz-name"
                  type="text"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white transition-all"
                  required
                />
              </div>

              <div>
                <label className="inline-block text-xs font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent pb-0.5 pr-1 mb-1">Website URL</label>
                <input
                  id="setting-website"
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="inline-block text-xs font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent pb-0.5 pr-1 mb-1">Watermark Text</label>
                <input
                  id="setting-watermark"
                  type="text"
                  value={watermark}
                  onChange={(e) => setWatermark(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white transition-all"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">Sits at the very bottom below your website URL subtitle</p>
              </div>

              <div>
                <label className="inline-block text-xs font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent pb-0.5 pr-1 mb-1">Common Suffix</label>
                <textarea
                  id="setting-common-tags"
                  value={commonTags}
                  onChange={(e) => setCommonTags(e.target.value.toLowerCase())}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white transition-all resize-none"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">Automatically appended to the generated social media post description</p>
              </div>
            </div>
          </div>

          <hr className="border-slate-200/60" />

          {/* Prompt Template Panel */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="inline-block text-xs font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent uppercase tracking-wider font-display pb-0.5 pr-1">Picture Prompt Template</label>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-all font-semibold"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Show Placeholders</span>
              </button>
            </div>

            {showHelp && (
              <div className="p-3 bg-indigo-50/50 rounded-xl text-xs text-slate-600 border border-indigo-100 space-y-1 shadow-inner">
                <p className="font-semibold text-indigo-950">Supported Template Placeholders:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                  <li><code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-indigo-600 font-bold">{"{url}"}</code>: The article URL specified in the Work pane</li>
                  <li><code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-indigo-600 font-bold">{"{settings.business.name}"}</code>: Business Name</li>
                  <li><code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-indigo-600 font-bold">{"{settings.watermark}"}</code>: Watermark string defined above</li>
                </ul>
              </div>
            )}

            <textarea
              id="setting-prompt-template"
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white transition-all"
              required
            ></textarea>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50/80 flex items-center justify-between">
          <button
            type="button"
            onClick={resetToDefault}
            className="px-4 py-2 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
          >
            Reset to Defaults
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              id="save-settings-btn"
              onClick={handleSave}
              className={`px-5 py-2 text-sm font-bold rounded-xl text-white flex items-center gap-1.5 transition-all shadow-lg ${
                isSaved ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/10" : "bg-gradient-to-r from-[#a3e635] via-[#10b981] to-[#8b5cf6] border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_4px_14px_rgba(163,230,53,0.15)] hover:brightness-105 active:scale-[0.98]"
              }`}
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Config</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
