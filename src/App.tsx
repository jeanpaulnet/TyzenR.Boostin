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
  promptTemplate: "create an ultra-realistic cinematic magazine like detailed picture with vivid colors summarizing content of {url}. Create title from article on top. Create subtitle '{settings.business.name}' on bottom with watermark '{settings.watermark}' below it.",
  azureConnectionString: "",
  azureContainerName: "boostin-social",
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
  const [model, setModel] = useState("dall-e-3");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [resolution, setResolution] = useState("1K");

  // Loading Pipeline States
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [loadingStep, setLoadingStep] = useState<"scrape" | "copy" | "image" | "azure">("scrape");

  // Load persistence from LocalStorage
  useEffect(() => {
    try {
      const savedItems = localStorage.getItem("boostin_items");
      if (savedItems) {
        const parsed = JSON.parse(savedItems);
        setItems(parsed);
        if (parsed.length > 0) {
          setSelectedId(parsed[0].id);
          setScannedTitle(parsed[0].title);
          setScannedDescription(parsed[0].description);
          setScannedPrompt(parsed[0].imagePrompt);
          setModel(parsed[0].model || "dall-e-3");
          setAspectRatio(parsed[0].aspectRatio || "1:1");
          setResolution(parsed[0].resolution || "1K");
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

  // Selecting an item from the library
  const handleSelectItem = (item: ScannedItem) => {
    setSelectedId(item.id);
    setScannedTitle(item.title);
    setScannedDescription(item.description);
    setScannedPrompt(item.imagePrompt);
    setModel(item.model || "dall-e-3");
    setAspectRatio(item.aspectRatio || "1:1");
    setResolution(item.resolution || "1K");
  };

  // Deleting an item
  const handleDeleteItem = (id: string) => {
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
  const handleUpdateScannedFields = (fields: { title?: string; description?: string; prompt?: string }) => {
    if (fields.title !== undefined) setScannedTitle(fields.title);
    if (fields.description !== undefined) setScannedDescription(fields.description);
    if (fields.prompt !== undefined) setScannedPrompt(fields.prompt);

    // If an item is currently selected, update its state in the persistent items list as well!
    if (selectedId) {
      const updated = items.map((item) => {
        if (item.id === selectedId) {
          return {
            ...item,
            title: fields.title !== undefined ? fields.title : item.title,
            description: fields.description !== undefined ? fields.description : item.description,
            imagePrompt: fields.prompt !== undefined ? fields.prompt : item.imagePrompt,
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
      setScannedDescription(scanData.description);
      setScannedPrompt(scanData.imagePrompt);

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
        // Update the existing item
        const existingItem = items[existingItemIndex];
        const updatedItem: ScannedItem = {
          ...existingItem,
          title: scanData.title,
          description: scanData.description,
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
        // Create new item
        const newItem: ScannedItem = {
          id: `boost_${Date.now()}`,
          url,
          title: scanData.title,
          description: scanData.description,
          imagePrompt: scanData.imagePrompt,
          imageUrl: "", // empty because not generated yet
          azureUrl: "", // empty because not generated yet
          azureStatus: "Not Generated",
          model,
          aspectRatio,
          resolution,
          timestamp: Date.now(),
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
  const handleRegenerateImage = async (prompt: string, model: string, aspectRatio: string, resolution: string) => {
    if (!selectedId) return;
    setIsGeneratingImage(true);
    setLoadingStep("image");

    try {
      const activeItem = items.find((item) => item.id === selectedId);
      if (!activeItem) throw new Error("No active URL item selected to regenerate image for");

      const imageResponse = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model,
          aspectRatio,
          resolution,
          azureConfig: {
            connectionString: settings.azureConnectionString,
            containerName: settings.azureContainerName,
          },
        }),
      });

      if (!imageResponse.ok) {
        const errorData = await imageResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Image generation pipeline failed");
      }

      setLoadingStep("azure");
      const imageData = await imageResponse.json();
      if (!imageData.success) {
        throw new Error(imageData.error || "Image asset creation pipeline error");
      }

      // Update current selected item
      const updated = items.map((item) => {
        if (item.id === selectedId) {
          return {
            ...item,
            imagePrompt: prompt,
            imageUrl: imageData.imageUrl,
            azureUrl: imageData.azureUrl,
            azureStatus: imageData.azureStatus,
            model,
            aspectRatio,
            resolution,
          };
        }
        return item;
      });

      saveItems(updated);

    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to regenerate image assets.");
    } finally {
      setIsGeneratingImage(false);
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
          <div className="w-9 h-9 bg-gradient-to-tr from-purple-600 via-pink-500 to-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight font-display flex items-center gap-1.5 leading-none">
              <span>BOOSTIN</span>
              <span className="bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 bg-clip-text text-transparent font-black tracking-wider">AI</span>
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
            <span>Brand & Templates</span>
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
          <span className="text-[9px] uppercase tracking-widest">
            Azure Storage: <span className="text-indigo-600 font-semibold">{settings.azureConnectionString ? "Armed" : "Simulated"}</span>
          </span>
        </div>
        <div className="text-[9px] uppercase tracking-widest font-medium hidden sm:block">
          Boostin Engine v2.0.4 - Cloud AI Accelerated
        </div>
      </footer>

      {/* Brand & Azure Integration Settings Overlay */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

    </div>
  );
}
