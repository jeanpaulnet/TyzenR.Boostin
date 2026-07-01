import React, { useState, useEffect } from "react";
import { X, Save, Shield, HelpCircle, Check, Database, Facebook, Instagram, Youtube, Globe, Key, Lock, Link, Loader2, AlertCircle } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"business" | "credentials">("business");
  
  const [bizName, setBizName] = useState(settings.bizName);
  const [website, setWebsite] = useState(settings.website);
  const [watermark, setWatermark] = useState(settings.watermark);
  const [commonTags, setCommonTags] = useState(settings.commonTags || "#trending #news");
  const [promptTemplate, setPromptTemplate] = useState(settings.promptTemplate);
  const [detailedPromptTemplate, setDetailedPromptTemplate] = useState(
    settings.detailedPromptTemplate ||
      "Create a highly detailed corporate financial image prompt. Use an ultra-realistic premium investor research cover style. Show business model, products, financial growth, market opportunity, risks, valuation outlook, competitive positioning, and multibagger theme. Use vivid corporate colors, financial dashboards, stock charts, upward arrows, growth lines, product visuals, industry background, and rich cinematic depth."
  );

  // New platform credentials states
  const [fbPageId, setFbPageId] = useState(settings.fbPageId || "");
  const [fbAccessToken, setFbAccessToken] = useState(settings.fbAccessToken || "");
  const [igAccountId, setIgAccountId] = useState(settings.igAccountId || "");
  const [igAccessToken, setIgAccessToken] = useState(settings.igAccessToken || "");
  const [ytChannelId, setYtChannelId] = useState(settings.ytChannelId || "");
  const [ytApiKey, setYtApiKey] = useState(settings.ytApiKey || "");
  const [wpUrl, setWpUrl] = useState(settings.wpUrl || "");
  const [wpUsername, setWpUsername] = useState(settings.wpUsername || "");
  const [wpAppPassword, setWpAppPassword] = useState(settings.wpAppPassword || "");

  const [isSaved, setIsSaved] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Sync state with settings prop when modal opens/changes
  useEffect(() => {
    if (isOpen) {
      setBizName(settings.bizName);
      setWebsite(settings.website);
      setWatermark(settings.watermark);
      setCommonTags(settings.commonTags || "#trending #news");
      setPromptTemplate(settings.promptTemplate);
      setDetailedPromptTemplate(
        settings.detailedPromptTemplate ||
          "Create a highly detailed corporate financial image prompt. Use an ultra-realistic premium investor research cover style. Show business model, products, financial growth, market opportunity, risks, valuation outlook, competitive positioning, and multibagger theme. Use vivid corporate colors, financial dashboards, stock charts, upward arrows, growth lines, product visuals, industry background, and rich cinematic depth."
      );
      setFbPageId(settings.fbPageId || "");
      setFbAccessToken(settings.fbAccessToken || "");
      setIgAccountId(settings.igAccountId || "");
      setIgAccessToken(settings.igAccessToken || "");
      setYtChannelId(settings.ytChannelId || "");
      setYtApiKey(settings.ytApiKey || "");
      setWpUrl(settings.wpUrl || "");
      setWpUsername(settings.wpUsername || "");
      setWpAppPassword(settings.wpAppPassword || "");
    }
  }, [
    isOpen,
    settings,
  ]);

  // Facebook OAuth connecting state
  const [isConnectingFb, setIsConnectingFb] = useState(false);
  const [fbError, setFbError] = useState<string | null>(null);
  const [facebookPagesList, setFacebookPagesList] = useState<{ pageId: string; pageName: string; pageAccessToken: string }[]>([]);

  const handleConnectFacebook = async () => {
    setIsConnectingFb(true);
    setFbError(null);
    setFacebookPagesList([]);

    try {
      const response = await fetch(`/api/auth/instagram/url?origin=${encodeURIComponent(window.location.origin)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to initiate Facebook connection. Please ensure Facebook App credentials are set correctly.");
      }

      const { url } = await response.json();

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        url,
        "facebook_oauth_popup",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
      );

      if (!popup) {
        throw new Error("Popup blocked! Please allow popups for this site to connect your Facebook account.");
      }

      const messageListener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) {
          return;
        }

        if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
          const payload = event.data.payload;
          const pages = payload?.facebookPages || [];
          if (pages.length === 0) {
            setFbError("Successfully connected to Facebook, but no Facebook Pages were found associated with your account.");
          } else {
            setFacebookPagesList(pages);
          }
          setIsConnectingFb(false);
          window.removeEventListener("message", messageListener);
        } else if (event.data?.type === "OAUTH_AUTH_FAILURE") {
          setFbError(event.data.error || "Facebook authentication failed.");
          setIsConnectingFb(false);
          window.removeEventListener("message", messageListener);
        }
      };

      window.addEventListener("message", messageListener);

      const popupCheckInterval = setInterval(() => {
        if (popup.closed) {
          clearInterval(popupCheckInterval);
          setIsConnectingFb((prev) => {
            if (prev) {
              setTimeout(() => {
                setIsConnectingFb(false);
              }, 1000);
            }
            return prev;
          });
        }
      }, 1000);

    } catch (err: any) {
      setFbError(err.message || "An unexpected error occurred during connection.");
      setIsConnectingFb(false);
    }
  };

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      bizName,
      website,
      watermark,
      promptTemplate,
      detailedPromptTemplate,
      commonTags: commonTags.toLowerCase(),
      fbPageId,
      fbAccessToken,
      igAccountId,
      igAccessToken,
      ytChannelId,
      ytApiKey,
      wpUrl,
      wpUsername,
      wpAppPassword,
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
    setPromptTemplate("Create a concise mobile-first summary image prompt. Use fewer visual sections. Focus on the article title, 3–5 key takeaways, vivid growth visuals, stock chart, product/business visuals, and rich cinematic depth.");
    setDetailedPromptTemplate("Create a highly detailed corporate financial image prompt. Use an ultra-realistic premium investor research cover style. Show business model, products, financial growth, market opportunity, risks, valuation outlook, competitive positioning, and multibagger theme. Use vivid corporate colors, financial dashboards, stock charts, upward arrows, growth lines, product visuals, industry background, and rich cinematic depth.");
    setFbPageId("");
    setFbAccessToken("");
    setIgAccountId("");
    setIgAccessToken("");
    setYtChannelId("");
    setYtApiKey("");
    setWpUrl("");
    setWpUsername("");
    setWpAppPassword("");
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

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200/80 bg-slate-50/50 px-6">
          <button
            type="button"
            onClick={() => setActiveTab("business")}
            className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === "business"
                ? "border-indigo-600 text-indigo-600 font-extrabold"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            Business
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("credentials")}
            className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === "credentials"
                ? "border-indigo-600 text-indigo-600 font-extrabold"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            Credentials
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 text-slate-700">
          {activeTab === "business" ? (
            <div className="space-y-6">
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
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-display">Configure Templates</span>
                  <button
                    type="button"
                    onClick={() => setShowHelp(!showHelp)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-all font-semibold cursor-pointer"
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

                <div className="space-y-1.5">
                  <label className="inline-block text-xs font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent uppercase tracking-wider font-display pb-0.5 pr-1">
                    Summary Picture Prompt
                  </label>
                  <textarea
                    id="setting-prompt-template"
                    value={promptTemplate}
                    onChange={(e) => setPromptTemplate(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white transition-all"
                    required
                  ></textarea>
                </div>

                <div className="space-y-1.5">
                  <label className="inline-block text-xs font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent uppercase tracking-wider font-display pb-0.5 pr-1">
                    Detailed Picture Prompt
                  </label>
                  <textarea
                    id="setting-detailed-prompt-template"
                    value={detailedPromptTemplate}
                    onChange={(e) => setDetailedPromptTemplate(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white transition-all"
                    required
                  ></textarea>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-start gap-3">
                <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-md">
                  <Shield className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">Automated Posting Channels</h4>
                  <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                    Configure your platform API credentials below. When publishing approved creative assets, our automated posting engine will stream them directly to your connected feeds. All tokens are securely stored locally.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Facebook Card */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                        <Facebook className="w-5 h-5 fill-current" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Facebook Page Sync</h3>
                        <p className="text-[10px] text-slate-400">Automatically post images to your feed</p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleConnectFacebook}
                    disabled={isConnectingFb}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConnectingFb ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Connecting Facebook...</span>
                      </>
                    ) : (
                      <>
                        <Facebook className="w-3.5 h-3.5 fill-current" />
                        <span>Connect Facebook & Select Page</span>
                      </>
                    )}
                  </button>

                  {fbError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-[11px] leading-relaxed flex items-start gap-2 animate-pulse">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>{fbError}</span>
                    </div>
                  )}

                  {facebookPagesList.length > 0 && (
                    <div className="p-3.5 bg-indigo-50 border border-indigo-150 rounded-xl space-y-2">
                      <label className="block text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                        Select Facebook Page to Sync
                      </label>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {facebookPagesList.map((page) => (
                          <button
                            key={page.pageId}
                            type="button"
                            onClick={() => {
                              setFbPageId(page.pageId);
                              setFbAccessToken(page.pageAccessToken);
                              setFacebookPagesList([]);
                            }}
                            className={`w-full flex items-center justify-between p-2.5 text-left text-xs rounded-lg border transition-all ${
                              fbPageId === page.pageId
                                ? "bg-indigo-600 border-indigo-600 text-white font-bold"
                                : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50"
                            }`}
                          >
                            <span className="truncate pr-2 font-medium">{page.pageName}</span>
                            <span className="text-[9px] opacity-75 font-mono shrink-0">ID: {page.pageId.slice(0, 6)}...</span>
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setFacebookPagesList([])}
                        className="text-[10px] text-slate-500 hover:text-slate-800 underline font-medium block"
                      >
                        Dismiss page list
                      </button>
                    </div>
                  )}

                  <div className="space-y-3 pt-1 border-t border-slate-100">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">PAGE ID</label>
                      <input
                        id="setting-fb-page-id"
                        type="text"
                        placeholder="e.g. 10248593489240"
                        value={fbPageId}
                        onChange={(e) => setFbPageId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">PAGE ACCESS TOKEN</label>
                      <input
                        id="setting-fb-token"
                        type="password"
                        placeholder="EAAZB..."
                        value={fbAccessToken}
                        onChange={(e) => setFbAccessToken(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Instagram Card */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-pink-50 text-pink-600 rounded-xl">
                      <Instagram className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Instagram Professional</h3>
                      <p className="text-[10px] text-slate-400">Instantly share creatives on your visual feed</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">BUSINESS ACCOUNT ID</label>
                      <input
                        id="setting-ig-account-id"
                        type="text"
                        placeholder="e.g. 17841402849202"
                        value={igAccountId}
                        onChange={(e) => setIgAccountId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">ACCESS TOKEN / GRAPH KEY</label>
                      <input
                        id="setting-ig-token"
                        type="password"
                        placeholder="IGQV..."
                        value={igAccessToken}
                        onChange={(e) => setIgAccessToken(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* YouTube Card */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                      <Youtube className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">YouTube Studio</h3>
                      <p className="text-[10px] text-slate-400">Post short visual updates and community cards</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">CHANNEL ID</label>
                      <input
                        id="setting-yt-channel-id"
                        type="text"
                        placeholder="e.g. UC_x55b1urg8uKjxpG2b"
                        value={ytChannelId}
                        onChange={(e) => setYtChannelId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">API KEY / DEVELOPER SECRET</label>
                      <input
                        id="setting-yt-key"
                        type="password"
                        placeholder="AIzaSy..."
                        value={ytApiKey}
                        onChange={(e) => setYtApiKey(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* WordPress Card */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">WordPress Publisher</h3>
                      <p className="text-[10px] text-slate-400">Automatically draft and publish web blog posts</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">SITE REST URL</label>
                      <input
                        id="setting-wp-url"
                        type="url"
                        placeholder="https://yourblog.wordpress.com"
                        value={wpUrl}
                        onChange={(e) => setWpUrl(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">USERNAME</label>
                        <input
                          id="setting-wp-username"
                          type="text"
                          placeholder="admin"
                          value={wpUsername}
                          onChange={(e) => setWpUsername(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">APP PASSWORD</label>
                        <input
                          id="setting-wp-password"
                          type="password"
                          placeholder="abcd efgh ijkl mnop"
                          value={wpAppPassword}
                          onChange={(e) => setWpAppPassword(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
