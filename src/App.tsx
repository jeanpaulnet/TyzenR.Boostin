import React, { useState, useEffect } from "react";
import { Settings as SettingsIcon, Sparkles, Database, HelpCircle, Compass, History, BookOpen, Layers } from "lucide-react";
import { ScannedItem, Settings } from "./types";
import LibraryPane from "./components/LibraryPane";
import WorkPane from "./components/WorkPane";
import PreviewPane from "./components/PreviewPane";
import SettingsDialog from "./components/SettingsDialog";

const DEFAULT_SETTINGS: Settings = {
  bizName: "Your Biz",
  website: "www.yourbiz.org",
  watermark: "Watermark",
  promptTemplate: "Create a concise mobile-first summary image prompt. Use fewer visual sections. Focus on the article title, 3–5 key takeaways, vivid growth visuals, stock chart, product/business visuals, and rich cinematic depth.",
  detailedPromptTemplate: "Create a highly detailed corporate financial image prompt. Use an ultra-realistic premium investor research cover style. Show business model, products, financial growth, market opportunity, risks, valuation outlook, competitive positioning, and multibagger theme. Use vivid corporate colors, financial dashboards, stock charts, upward arrows, growth lines, product visuals, industry background, and rich cinematic depth.",
  commonTags: "#trending #news",
};

export default function App() {
  // Persistence States
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  
  // UI Selection States
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Active / Working Fields
  const [scannedTitle, setScannedTitle] = useState("");
  const [scannedDescription, setScannedDescription] = useState("");
  const [scannedPrompt, setScannedPrompt] = useState("");

  // Model & Parameter States (Shared between components)
  const [model, setModel] = useState("gpt");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [resolution, setResolution] = useState("1K");

  // Loading Pipeline States
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [loadingStep, setLoadingStep] = useState<"scrape" | "copy" | "image" | "azure">("scrape");
  const [imageError, setImageError] = useState<string | null>(null);
  const [refreshingAspect, setRefreshingAspect] = useState<"1:1" | "9:16" | "16:9" | null>(null);

  // Load persistence from LocalStorage
  useEffect(() => {
    try {
      const savedItems = localStorage.getItem("boostin_items");
      if (savedItems) {
        const parsed = JSON.parse(savedItems);
        // Clean loaded descriptions
        const cleanedItems = parsed.map((item: any) => ({
          ...item,
          description: item.description ? item.description.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\n\n+/g, "\n\n").trim() : ""
        }));
        setItems(cleanedItems);
        if (cleanedItems.length > 0) {
          setSelectedId(cleanedItems[0].id);
          setScannedTitle(cleanedItems[0].title);
          setScannedDescription(cleanedItems[0].description);
          setScannedPrompt(parsed[0].imagePrompt);
          setModel(parsed[0].model || "gpt");
          setAspectRatio("1:1");
          setResolution("1K");
        }
      }
    } catch (e) {
      console.error("Failed loading persistent items", e);
    }

    try {
      const savedSettings = localStorage.getItem("boostin_settings");
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (e) {
      console.error("Failed loading persistent settings", e);
    }
  }, []);

  // Save items to LocalStorage
  const saveItems = (updatedItems: ScannedItem[]) => {
    setItems(updatedItems);
    localStorage.setItem("boostin_items", JSON.stringify(updatedItems));
  };

  // Save settings to LocalStorage
  const handleSaveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    localStorage.setItem("boostin_settings", JSON.stringify(newSettings));
  };

  const cleanDescription = (desc: string): string => {
    if (!desc) return "";
    return desc
      .replace(/\\n/g, "\n")
      .replace(/\r\n/g, "\n")
      .replace(/\n\n+/g, "\n\n")
      .trim();
  };

  // Selecting an item from the library
  const handleSelectItem = (item: ScannedItem) => {
    setSelectedId(item.id);
    setScannedTitle(item.title);
    setScannedDescription(cleanDescription(item.description));
    setScannedPrompt(item.imagePrompt);
    setModel(item.model || "gpt");
    setAspectRatio("1:1");
    setResolution("1K");
  };

  // Deleting an item
  const handleDeleteItem = (id: string) => {
    if (window.confirm("Are you sure you want to delete this URL history item?")) {
      const updated = items.filter((item) => item.id !== id);
      saveItems(updated);
      if (selectedId === id) {
        if (updated.length > 0) {
          handleSelectItem(updated[0]);
        } else {
          setSelectedId(null);
          setScannedTitle("");
          setScannedDescription("");
          setScannedPrompt("");
        }
      }
    }
  };

  // Clearing all history
  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to delete all URL history from your gallery?")) {
      saveItems([]);
      setSelectedId(null);
      setScannedTitle("");
      setScannedDescription("");
      setScannedPrompt("");
    }
  };

  // Updating active fields
  const handleUpdateScannedFields = (fields: { 
    title?: string; 
    description?: string; 
    prompt?: string; 
    imageUrl?: string;
    imageUrl916?: string;
    imageUrl169?: string;
  }) => {
    if (fields.title !== undefined) setScannedTitle(fields.title);
    if (fields.description !== undefined) setScannedDescription(cleanDescription(fields.description));
    if (fields.prompt !== undefined) setScannedPrompt(fields.prompt);

    // If an item is currently selected, update its state in the persistent items list as well!
    if (selectedId) {
      const updated = items.map((item) => {
        if (item.id === selectedId) {
          return {
            ...item,
            title: fields.title !== undefined ? fields.title : item.title,
            description: fields.description !== undefined ? cleanDescription(fields.description) : item.description,
            imagePrompt: fields.prompt !== undefined ? fields.prompt : item.imagePrompt,
            imageUrl: fields.imageUrl !== undefined ? fields.imageUrl : item.imageUrl,
            imageUrl916: fields.imageUrl916 !== undefined ? fields.imageUrl916 : item.imageUrl916,
            imageUrl169: fields.imageUrl169 !== undefined ? fields.imageUrl169 : item.imageUrl169,
          };
        }
        return item;
      });
      saveItems(updated);
    }
  };

  // The Primary Scan Trigger
  const handleScan = async (url: string, model: string, aspectRatio: string, resolution: string) => {
    setIsLoading(true);
    setLoadingStep("scrape");
    setImageError(null);

    try {
      // Step 1: Scrape & Copywrite via Gemini
      setLoadingStep("scrape");
      const scanResponse = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          bizName: settings.bizName,
          website: settings.website,
          watermark: settings.watermark,
          promptTemplate: settings.promptTemplate,
          commonTags: settings.commonTags,
        }),
      });

      if (!scanResponse.ok) {
        throw new Error("Target website could not be scanned. Please double-check the URL.");
      }

      const scanData = await scanResponse.json();
      if (!scanData.success) {
        throw new Error(scanData.error || "Webpage scanning returned an error.");
      }

      setLoadingStep("copy");
      setScannedTitle(scanData.title);
      setScannedDescription(cleanDescription(scanData.description));
      setScannedPrompt(scanData.imagePrompt);

      // Step 2: Update item details without auto-generating pictures.
      // Check if URL already exists in history to satisfy: "HISTORY should be created only if URL changed."
      const cleanUrl = (u: string) => {
        try {
          const parsed = new URL(u);
          return (parsed.origin + parsed.pathname.replace(/\/$/, "") + parsed.search).toLowerCase();
        } catch (_) {
          return u.trim().toLowerCase();
        }
      };

      const targetClean = cleanUrl(url);
      const existingItemIndex = items.findIndex((item) => cleanUrl(item.url) === targetClean);

      let updated: ScannedItem[] = [];
      let targetId = "";

      if (existingItemIndex > -1) {
        // Update the existing item but do not auto create pictures
        const existingItem = items[existingItemIndex];
        const updatedItem: ScannedItem = {
          ...existingItem,
          title: scanData.title,
          description: cleanDescription(scanData.description),
          imagePrompt: scanData.imagePrompt,
          model,
          aspectRatio,
          resolution,
          timestamp: Date.now(),
        };
        // Remove from current position and prepend to the top
        const filtered = items.filter((_, idx) => idx !== existingItemIndex);
        updated = [updatedItem, ...filtered];
        targetId = existingItem.id;
      } else {
        // Create new item with empty/default image fields
        const newItem: ScannedItem = {
          id: `boost_${Date.now()}`,
          url,
          title: scanData.title,
          description: cleanDescription(scanData.description),
          imagePrompt: scanData.imagePrompt,
          imageUrl: "",
          azureUrl: "",
          azureStatus: "Not Generated",
          imageUrl916: "",
          imageUrl169: "",
          imageUrl11: "",
          azureUrl916: "",
          azureUrl169: "",
          azureUrl11: "",
          azureStatus916: "Not Generated",
          azureStatus169: "Not Generated",
          azureStatus11: "Not Generated",
          model,
          aspectRatio,
          resolution,
          timestamp: Date.now(),
          pastImageUrls: [],
        };
        updated = [newItem, ...items];
        targetId = newItem.id;
      }

      saveItems(updated);
      setSelectedId(targetId);

    } catch (err: any) {
      console.error(err);
      alert(err.message || "An unexpected error occurred in the generative pipeline.");
    } finally {
      setIsLoading(false);
    }
  };

  // Re-run Image Generation only (if they modified the custom prompt or settings)
  const handleRegenerateImage = async (prompt: string, initialModel: string, aspectRatio: string, resolution: string) => {
    if (!selectedId) return;
    setIsGeneratingImage(true);
    setLoadingStep("image");
    setImageError(null);

    try {
      const activeItem = items.find((item) => item.id === selectedId);
      if (!activeItem) throw new Error("No active URL item selected to regenerate image for");

      let currentModel = initialModel;
      let imageResponse = await fetch("/ai/picture/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPrompt: prompt,
          url: activeItem.url,
          model: currentModel,
          aspectRatio: "1:1",
          subtitle: settings.bizName,
          watermark: settings.watermark,
        }),
      });

      if (imageResponse.status === 500) {
        const fallbackModel = currentModel === "gpt" ? "gemini" : "gpt";
        console.warn(`[Auto-Switch] Status 500. Retrying generation with fallback model: ${fallbackModel}`);
        setModel(fallbackModel);
        currentModel = fallbackModel;

        imageResponse = await fetch("/ai/picture/url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userPrompt: prompt,
            url: activeItem.url,
            model: currentModel,
            aspectRatio: "1:1",
            subtitle: settings.bizName,
            watermark: settings.watermark,
          }),
        });
      }

      let imageUrl = "";
      let azureUrl = "";
      let azureStatus = "Not Generated";

      if (!imageResponse.ok) {
        const errorData = await imageResponse.json().catch(() => ({}));
        console.warn("1:1 image regeneration failed:", errorData.error);
        setImageError(errorData.error || "1:1 image generation pipeline failed");
      } else {
        const imageData = await imageResponse.json();
        if (imageData.success) {
          imageUrl = imageData.imageUrl;
          azureUrl = imageData.azureUrl;
          azureStatus = imageData.azureStatus || "Success";
        } else {
          console.warn("1:1 image regeneration failed:", imageData.error);
          setImageError(imageData.error || "1:1 Image asset creation pipeline error");
        }
      }

      // Update current selected item
      const updated = items.map((item) => {
        if (item.id === selectedId) {
          const newPast = [...(item.pastImageUrls || [])];
          if (item.imageUrl && !newPast.includes(item.imageUrl)) {
            newPast.push(item.imageUrl);
          }
          if (imageUrl && !newPast.includes(imageUrl)) {
            newPast.push(imageUrl);
          }

          return {
            ...item,
            imagePrompt: prompt,
            imageUrl: imageUrl || item.imageUrl,
            azureUrl: azureUrl || item.azureUrl,
            azureStatus: azureStatus !== "Not Generated" ? azureStatus : item.azureStatus,
            imageUrl11: imageUrl || item.imageUrl11,
            azureUrl11: azureUrl || item.azureUrl11,
            azureStatus11: azureStatus !== "Not Generated" ? azureStatus : item.azureStatus11,
            // Clear other aspects if we are locked to 1:1 now
            imageUrl916: "",
            imageUrl169: "",
            model: currentModel,
            aspectRatio: "1:1",
            resolution,
            pastImageUrls: newPast,
          };
        }
        return item;
      });

      saveItems(updated);

    } catch (err: any) {
      console.error(err);
      setImageError(err.message || "Failed to regenerate image assets.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleRefreshSingleImage = async (aspectRatio: "1:1" | "9:16" | "16:9") => {
    if (!selectedId) return;
    setRefreshingAspect(aspectRatio);
    setImageError(null);

    try {
      const activeItem = items.find((item) => item.id === selectedId);
      if (!activeItem) throw new Error("No active URL item selected to regenerate image for");

      const promptTemplate = activeItem.imagePrompt || settings.promptTemplate;

      let currentModel = model;
      let response = await fetch("/ai/picture/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPrompt: promptTemplate,
          url: activeItem.url,
          model: currentModel,
          aspectRatio: aspectRatio,
          subtitle: settings.bizName,
          watermark: settings.watermark,
        }),
      });

      if (response.status === 500) {
        const fallbackModel = currentModel === "gpt" ? "gemini" : "gpt";
        console.warn(`[Auto-Switch] Status 500. Retrying generation with fallback model: ${fallbackModel}`);
        setModel(fallbackModel);
        currentModel = fallbackModel;

        response = await fetch("/ai/picture/url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userPrompt: promptTemplate,
            url: activeItem.url,
            model: currentModel,
            aspectRatio: aspectRatio,
            subtitle: settings.bizName,
            watermark: settings.watermark,
          }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `${aspectRatio} image refresh failed`);
      }

      const imageData = await response.json();
      if (!imageData.success) {
        throw new Error(imageData.error || `${aspectRatio} image refresh pipeline error`);
      }

      const imageUrl = imageData.imageUrl;
      const azureUrl = imageData.azureUrl;
      const azureStatus = imageData.azureStatus || "Success";

      const updated = items.map((item) => {
        if (item.id === selectedId) {
          const newPast = [...(item.pastImageUrls || [])];
          if (imageUrl && !newPast.includes(imageUrl)) {
            newPast.push(imageUrl);
          }

          return {
            ...item,
            imageUrl: imageUrl || item.imageUrl,
            azureUrl: azureUrl || item.azureUrl,
            azureStatus: azureStatus,
            imageUrl11: aspectRatio === "1:1" ? (imageUrl || item.imageUrl11) : item.imageUrl11,
            azureUrl11: aspectRatio === "1:1" ? (azureUrl || item.azureUrl11) : item.azureUrl11,
            azureStatus11: aspectRatio === "1:1" ? azureStatus : item.azureStatus11,
            imageUrl916: aspectRatio === "9:16" ? (imageUrl || item.imageUrl916) : item.imageUrl916,
            azureUrl916: aspectRatio === "9:16" ? (azureUrl || item.azureUrl916) : item.azureUrl916,
            azureStatus916: aspectRatio === "9:16" ? azureStatus : item.azureStatus916,
            imageUrl169: aspectRatio === "16:9" ? (imageUrl || item.imageUrl169) : item.imageUrl169,
            azureUrl169: aspectRatio === "16:9" ? (azureUrl || item.azureUrl169) : item.azureUrl169,
            azureStatus169: aspectRatio === "16:9" ? azureStatus : item.azureStatus169,
            pastImageUrls: newPast,
          };
        }
        return item;
      });

      saveItems(updated);
    } catch (err: any) {
      console.error(err);
      setImageError(err.message || `Failed to refresh ${aspectRatio} image.`);
    } finally {
      setRefreshingAspect(null);
    }
  };

  const getActiveItem = (): ScannedItem | null => {
    if (!selectedId) return null;
    return items.find((item) => item.id === selectedId) || null;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col antialiased">
      
      {/* Upper Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-lg">
        
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-[#a3e635] via-[#10b981] to-[#8b5cf6] rounded-lg flex items-center justify-center shadow-lg shadow-[rgba(163,230,53,0.2)]">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight font-display flex items-center gap-1.5 leading-none">
              <span>BOOSTIN</span>
              <span className="bg-gradient-to-r from-[#a3e635] via-[#10b981] to-[#8b5cf6] bg-clip-text text-transparent font-black tracking-wider">AI</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Generate high-converting social creatives from raw URLs</p>
          </div>
        </div>

        {/* Global Action / Settings Trigger */}
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Active Profile</span>
            <span className="text-xs font-semibold text-cyan-400">{settings.bizName}</span>
          </div>

          {/* Settings button */}
          <button
            id="settings-trigger-btn"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-200 rounded-xl border border-white/10 text-xs font-semibold transition-all active:scale-[0.98] shadow-sm"
          >
            <SettingsIcon className="w-4 h-4 text-indigo-400" />
            <span>Business Settings</span>
          </button>
        </div>

      </header>

      {/* Main Multi-Pane Workspace Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col justify-center">
        
        {/* Responsive 3-Pane grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Pane 1: Library Pane (Span 3) */}
          <div className="lg:col-span-3 flex flex-col h-[calc(100vh-220px)] lg:h-[720px]">
            <LibraryPane
              items={items}
              selectedId={selectedId}
              onSelectItem={handleSelectItem}
              onDeleteItem={handleDeleteItem}
              onClearAll={handleClearAll}
            />
          </div>

          {/* Pane 2: Work Pane (Span 5) */}
          <div className="lg:col-span-5 flex flex-col h-[calc(100vh-220px)] lg:h-[720px] overflow-y-auto">
            <WorkPane
              onScan={handleScan}
              isLoading={isLoading}
              loadingStep={loadingStep}
              scannedTitle={scannedTitle}
              scannedDescription={scannedDescription}
              scannedPrompt={scannedPrompt}
              onUpdateScannedFields={handleUpdateScannedFields}
              settings={settings}
              model={model}
              aspectRatio={aspectRatio}
              resolution={resolution}
              activeItemUrl={getActiveItem()?.url || ""}
            />
          </div>

          {/* Pane 3: Preview Pane (Span 4) */}
          <div className="lg:col-span-4 flex flex-col h-[calc(100vh-220px)] lg:h-[720px]">
            <PreviewPane
              activeItem={getActiveItem()}
              isLoading={isGeneratingImage}
              isScanning={isLoading}
              model={model}
              setModel={setModel}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              resolution={resolution}
              setResolution={setResolution}
              scannedPrompt={scannedPrompt}
              onRegenerateImage={handleRegenerateImage}
              onUpdateScannedFields={handleUpdateScannedFields}
              settings={settings}
              imageError={imageError}
              setImageError={setImageError}
              refreshingAspect={refreshingAspect}
              onRefreshSingleImage={handleRefreshSingleImage}
            />
          </div>

        </div>

      </main>

      {/* Subtle footer stats */}
      <footer className="h-10 flex items-center px-8 bg-white border-t border-slate-200/80 justify-between text-slate-500">
        <div className="flex items-center gap-4">
          <span className="text-[9px] uppercase tracking-widest">
            Status: <span className="text-emerald-600 font-bold">Connected</span>
          </span>
        </div>
        <div className="text-[9px] uppercase tracking-widest font-medium hidden sm:block">
          Boostin AI Engine v2.0.4 - Cloud AI Accelerated
        </div>
      </footer>

      {/* Brand Settings Overlay */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

    </div>
  );
}
