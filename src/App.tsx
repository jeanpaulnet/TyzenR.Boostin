import React, { useState, useEffect } from "react";
import { Settings as SettingsIcon, Sparkles, Database, HelpCircle, Compass, History, BookOpen, Layers, Send, Check } from "lucide-react";
import { ScannedItem, Settings } from "./types";
import LibraryPane from "./components/LibraryPane";
import WorkPane from "./components/WorkPane";
import PreviewPane from "./components/PreviewPane";
import SettingsDialog from "./components/SettingsDialog";
import versionInfo from "./version.json";

function isVersionGreaterOrEqual(v1: string, v2: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(x => parseInt(x, 10) || 0);
  const p1 = parse(v1);
  const p2 = parse(v2);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return true;
    if (num1 < num2) return false;
  }
  return true;
}

const DEFAULT_SETTINGS: Settings = {
  bizName: "Your Biz",
  website: "www.yourbiz.org",
  watermark: "Watermark",
  promptTemplate: "Create a concise mobile-first summary image prompt. Use fewer visual sections. Focus on the article title, 3–5 key takeaways, vivid growth visuals, stock chart, product/business visuals, and rich cinematic depth.",
  detailedPromptTemplate: "Create a highly detailed corporate financial image prompt. Use an ultra-realistic premium investor research cover style. Show business model, products, financial growth, market opportunity, risks, valuation outlook, competitive positioning, and multibagger theme. Use vivid corporate colors, financial dashboards, stock charts, upward arrows, growth lines, product visuals, industry background, and rich cinematic depth.",
  commonTags: "#trending #news",
  fbPageId: "",
  fbAccessToken: "",
  igAccountId: "",
  igAccessToken: "",
  ytChannelId: "",
  ytApiKey: "",
  wpUrl: "",
  wpUsername: "",
  wpAppPassword: "",
};

export default function App() {
  // Persistence States
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [version, setVersion] = useState(() => {
    try {
      const saved = localStorage.getItem("boostin_version");
      if (saved && isVersionGreaterOrEqual(saved, versionInfo.version)) {
        return saved;
      }
      localStorage.setItem("boostin_version", versionInfo.version);
      return versionInfo.version;
    } catch (_) {
      return versionInfo.version;
    }
  });
  
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

  // Loading Pipeline States
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [loadingStep, setLoadingStep] = useState<"scrape" | "copy" | "image" | "azure">("scrape");
  const [imageError, setImageError] = useState<string | null>(null);
  const [refreshingAspect, setRefreshingAspect] = useState<"1:1" | "9:16" | "16:9" | null>(null);
  const [autoSwitchMessage, setAutoSwitchMessage] = useState<string | null>(null);
  const [showPublishToast, setShowPublishToast] = useState(false);
  const [publishedVersion, setPublishedVersion] = useState("");

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
        }
      }
    } catch (e) {
      console.error("Failed loading persistent items", e);
    }

    try {
      const savedSettings = localStorage.getItem("boostin_settings");
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
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
  const handleSaveSettings = async (newSettings: Settings) => {
    setSettings(newSettings);
    localStorage.setItem("boostin_settings", JSON.stringify(newSettings));

    // If an item is selected, call the prompt-regeneration endpoint
    // to dynamically derive a new prompt using the updated settings
    if (selectedId) {
      const activeItem = items.find((item) => item.id === selectedId);
      if (activeItem) {
        try {
          const res = await fetch("/api/regenerate-prompt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: activeItem.url,
              title: activeItem.title,
              description: activeItem.description,
              bizName: newSettings.bizName,
              watermark: newSettings.watermark,
              promptTemplate: newSettings.promptTemplate,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.imagePrompt) {
              setScannedPrompt(data.imagePrompt);
              const updated = items.map((item) => {
                if (item.id === selectedId) {
                  return {
                    ...item,
                    imagePrompt: data.imagePrompt,
                  };
                }
                return item;
              });
              saveItems(updated);
            }
          }
        } catch (err) {
          console.error("Failed to dynamically update image prompt with new settings:", err);
        }
      }
    }
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

  // Publish / Version increaser
  const handlePublish = (): string => {
    let latestVersion = "2.0.4";
    try {
      const saved = localStorage.getItem("boostin_version");
      if (saved) {
        latestVersion = saved;
      } else {
        latestVersion = version || "2.0.4";
      }
    } catch (_) {
      latestVersion = version || "2.0.4";
    }

    if (latestVersion.startsWith("v")) {
      latestVersion = latestVersion.substring(1);
    }

    const parts = latestVersion.split(".");
    let newVersion = "";
    if (parts.length === 3) {
      const major = parts[0];
      const minor = parseInt(parts[1], 10) + 1;
      const patch = "0"; // Reset patch to 0 on minor version increment
      newVersion = `${major}.${minor}.${patch}`;
    } else {
      newVersion = "2.1.0";
    }

    setVersion(newVersion);
    try {
      localStorage.setItem("boostin_version", newVersion);
    } catch (_) {}
    return newVersion;
  };

  // Updating active fields
  const handleUpdateScannedFields = (fields: { 
    title?: string; 
    description?: string; 
    prompt?: string; 
    imageUrl?: string;
    imageUrl916?: string;
    imageUrl169?: string;
    imageUrl11?: string;
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
            imageUrl11: fields.imageUrl11 !== undefined ? fields.imageUrl11 : item.imageUrl11,
          };
        }
        return item;
      });
      saveItems(updated);
    }
  };

  // The Primary Scan Trigger
  const handleScan = async (url: string, model: string, aspectRatio: string) => {
    setIsLoading(true);
    setLoadingStep("scrape");
    setImageError(null);

    try {
      // Step 1: Scrape & Copywrite via webapi.tyzenr.com
      setLoadingStep("scrape");
      let scanResponse;
      let scanData: any = null;
      let apiSucceeded = false;

      // Try POST first
      try {
        scanResponse = await fetch("https://webapi.tyzenr.com/ai/summary/url", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            model: "gemini",
            url: url,
            tags: settings.commonTags || "",
          }),
        });

        if (scanResponse.ok) {
          scanData = await scanResponse.json();
          apiSucceeded = !!(scanData && (scanData.title || scanData.description));
        }
      } catch (postErr) {
        console.warn("POST to webapi.tyzenr.com failed, trying GET fallback:", postErr);
      }

      // Try GET fallback if POST didn't succeed
      if (!apiSucceeded) {
        try {
          const queryParams = new URLSearchParams({
            model: "gemini",
            url: url,
            tags: settings.commonTags || "",
          });
          scanResponse = await fetch(`https://webapi.tyzenr.com/ai/summary/url?${queryParams.toString()}`, {
            headers: { "Accept": "application/json" },
          });

          if (scanResponse.ok) {
            scanData = await scanResponse.json();
            apiSucceeded = !!(scanData && (scanData.title || scanData.description));
          }
        } catch (getErr: any) {
          throw new Error(`Failed to fetch summary from API: ${getErr.message || getErr}`);
        }
      }

      if (!apiSucceeded || !scanData) {
        throw new Error("Failed to retrieve summary (title and description) from the Tyzenr API. Please ensure the target URL is accessible.");
      }

      const template = settings.promptTemplate || "create an ultra-realistic corporate financial like detailed picture with vivid colors summarizing content of {url}. Create title from article on top. Create subtitle '{settings.business.name}' on bottom with watermark '{settings.watermark}' below it.";
      const compiledImagePrompt = template
        .replace(/{url}/g, url || "")
        .replace(/{settings\.business\.name}/g, settings.bizName || "Your Biz")
        .replace(/{settings\.watermark}/g, settings.watermark || "Watermark")
        .replace(/{company\.name}/g, settings.bizName || "Your Biz")
        .replace(/{watermark}/g, settings.watermark || "Watermark");

      setLoadingStep("copy");
      setScannedTitle(scanData.title || "");
      setScannedDescription(cleanDescription(scanData.description || ""));
      setScannedPrompt(compiledImagePrompt);

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
          timestamp: Date.now(),
          pastImageUrls: [],
          pastImageUrls11: [],
          pastImageUrls169: [],
          pastImageUrls916: [],
        };
        updated = [newItem, ...items];
        targetId = newItem.id;
      }

      saveItems(updated);
      setSelectedId(targetId);
      handlePublish();

    } catch (err: any) {
      console.error(err);
      alert(err.message || "An unexpected error occurred in the generative pipeline.");
    } finally {
      setIsLoading(false);
    }
  };

  // Re-run Image Generation only (if they modified the custom prompt or settings)
  const handleRegenerateImage = async (prompt: string, initialModel: string, aspectRatio: string) => {
    if (!selectedId) return;

    if (!settings.promptTemplate || !settings.promptTemplate.trim() || !settings.detailedPromptTemplate || !settings.detailedPromptTemplate.trim()) {
      setImageError("User Prompt invalid.  Go to Settings & Save.");
      alert("User Prompt invalid.  Go to Settings & Save.");
      return;
    }

    setIsGeneratingImage(true);
    setLoadingStep("image");
    setImageError(null);
    setAutoSwitchMessage(null);

    try {
      const activeItem = items.find((item) => item.id === selectedId);
      if (!activeItem) throw new Error("No active URL item selected to regenerate image for");

      const generateSingleAspect = async (aspect: "1:1" | "16:9") => {
        let currentModel = initialModel;
        const promptToUse = aspect === "16:9" ? settings.detailedPromptTemplate : settings.promptTemplate;
        let imageResponse = await fetch("/ai/picture/url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userPrompt: promptToUse,
            url: activeItem.url,
            model: currentModel,
            aspectRatio: aspect,
            subtitle: settings.bizName,
            watermark: settings.watermark,
          }),
        });

        if (imageResponse.status === 500) {
          const fallbackModel = currentModel === "gpt" ? "gemini" : "gpt";
          console.warn(`[Auto-Switch] Status 500. Retrying ${aspect} generation with fallback model: ${fallbackModel}`);
          setModel(fallbackModel);
          setAutoSwitchMessage(`Auto-switched from ${currentModel === "gpt" ? "DALL-E 3 (GPT)" : "Gemini"} to ${fallbackModel === "gpt" ? "DALL-E 3 (GPT)" : "Gemini"} due to generation failure.`);
          currentModel = fallbackModel;

          imageResponse = await fetch("/ai/picture/url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userPrompt: promptToUse,
              url: activeItem.url,
              model: currentModel,
              aspectRatio: aspect,
              subtitle: settings.bizName,
              watermark: settings.watermark,
            }),
          });
        }

        if (!imageResponse.ok) {
          const errorData = await imageResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `${aspect} image generation pipeline failed`);
        }

        const imageData = await imageResponse.json();
        if (!imageData.success) {
          throw new Error(imageData.error || `${aspect} Image asset creation pipeline error`);
        }

        return imageData;
      };

      // Launch 1:1 immediately
      const promise11 = generateSingleAspect("1:1");

      // Delay by 1 second before launching 16:9, but let them execute in parallel
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const promise169 = delay(1000).then(() => generateSingleAspect("16:9"));

      // Let them run in parallel. Catch individual failures gracefully to allow one to succeed even if the other fails.
      const [res11, res169] = await Promise.all([
        promise11.catch((err) => {
          console.error("1:1 Generation failed:", err);
          setImageError((prev) => prev ? `${prev} | 1:1 failed: ${err.message}` : `1:1 failed: ${err.message}`);
          return null;
        }),
        promise169.catch((err) => {
          console.error("16:9 Generation failed:", err);
          setImageError((prev) => prev ? `${prev} | 16:9 failed: ${err.message}` : `16:9 failed: ${err.message}`);
          return null;
        }),
      ]);

      // Safely update the list using functional state modifier to prevent race conditions
      setItems((prevItems) => {
        const updated = prevItems.map((item) => {
          if (item.id === selectedId) {
            const newPast = [...(item.pastImageUrls || [])];
            const newPast11 = [...(item.pastImageUrls11 || [])];
            const newPast169 = [...(item.pastImageUrls169 || [])];
            const newPast916 = [...(item.pastImageUrls916 || [])];

            let imageUrl = item.imageUrl;
            let azureUrl = item.azureUrl;
            let azureStatus = item.azureStatus;
            let imageUrl11 = item.imageUrl11;
            let azureUrl11 = item.azureUrl11;
            let azureStatus11 = item.azureStatus11;
            let imageUrl169 = item.imageUrl169;
            let azureUrl169 = item.azureUrl169;
            let azureStatus169 = item.azureStatus169;

            if (res11) {
              imageUrl = res11.base64 || res11.imageUrl;
              azureUrl = res11.azureUrl;
              azureStatus = res11.azureStatus || "Success";
              imageUrl11 = res11.base64 || res11.imageUrl;
              azureUrl11 = res11.azureUrl;
              azureStatus11 = res11.azureStatus || "Success";

              if (item.imageUrl11 && !newPast11.includes(item.imageUrl11)) {
                newPast11.push(item.imageUrl11);
              }
              if (item.imageUrl && !newPast.includes(item.imageUrl)) {
                newPast.push(item.imageUrl);
              }

              if (imageUrl) {
                if (!newPast.includes(imageUrl)) {
                  newPast.push(imageUrl);
                }
                if (!newPast11.includes(imageUrl)) {
                  newPast11.push(imageUrl);
                }
              }
            }

            if (res169) {
              imageUrl169 = res169.base64 || res169.imageUrl;
              azureUrl169 = res169.azureUrl;
              azureStatus169 = res169.azureStatus || "Success";

              if (item.imageUrl169 && !newPast169.includes(item.imageUrl169)) {
                newPast169.push(item.imageUrl169);
              }

              if (imageUrl169 && !newPast169.includes(imageUrl169)) {
                newPast169.push(imageUrl169);
              }
            }

            return {
              ...item,
              imagePrompt: prompt,
              imageUrl,
              azureUrl,
              azureStatus,
              imageUrl11,
              azureUrl11,
              azureStatus11,
              imageUrl169,
              azureUrl169,
              azureStatus169,
              model: initialModel,
              pastImageUrls: newPast,
              pastImageUrls11: newPast11,
              pastImageUrls169: newPast169,
              pastImageUrls916: newPast916,
            };
          }
          return item;
        });

        localStorage.setItem("boostin_items", JSON.stringify(updated));
        return updated;
      });
      handlePublish();

    } catch (err: any) {
      console.error(err);
      setImageError(err.message || "Failed to regenerate image assets.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleRefreshSingleImage = async (aspectRatio: "1:1" | "9:16" | "16:9") => {
    if (!selectedId) return;

    const promptTemplate = aspectRatio === "16:9" ? settings.detailedPromptTemplate : settings.promptTemplate;
    if (!promptTemplate || !promptTemplate.trim()) {
      setImageError("User Prompt invalid.  Go to Settings & Save.");
      alert("User Prompt invalid.  Go to Settings & Save.");
      return;
    }

    setRefreshingAspect(aspectRatio);
    setImageError(null);
    setAutoSwitchMessage(null);

    try {
      const activeItem = items.find((item) => item.id === selectedId);
      if (!activeItem) throw new Error("No active URL item selected to regenerate image for");

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
        setAutoSwitchMessage(`Auto-switched from ${currentModel === "gpt" ? "DALL-E 3 (GPT)" : "Gemini"} to ${fallbackModel === "gpt" ? "DALL-E 3 (GPT)" : "Gemini"} due to generation failure.`);
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

      const imageUrl = imageData.base64 || imageData.imageUrl;
      const azureUrl = imageData.azureUrl;
      const azureStatus = imageData.azureStatus || "Success";

      const updated = items.map((item) => {
        if (item.id === selectedId) {
          const newPast = [...(item.pastImageUrls || [])];
          const newPast11 = [...(item.pastImageUrls11 || [])];
          const newPast169 = [...(item.pastImageUrls169 || [])];
          const newPast916 = [...(item.pastImageUrls916 || [])];

          // Ensure pre-existing active images are preserved in history before overwriting
          if (item.imageUrl && !newPast.includes(item.imageUrl)) {
            newPast.push(item.imageUrl);
          }
          if (item.imageUrl11 && !newPast11.includes(item.imageUrl11)) {
            newPast11.push(item.imageUrl11);
          }
          if (item.imageUrl169 && !newPast169.includes(item.imageUrl169)) {
            newPast169.push(item.imageUrl169);
          }
          if (item.imageUrl916 && !newPast916.includes(item.imageUrl916)) {
            newPast916.push(item.imageUrl916);
          }

          if (imageUrl) {
            if (aspectRatio === "1:1") {
              if (!newPast.includes(imageUrl)) newPast.push(imageUrl);
              if (!newPast11.includes(imageUrl)) newPast11.push(imageUrl);
            } else if (aspectRatio === "16:9") {
              if (!newPast169.includes(imageUrl)) newPast169.push(imageUrl);
            } else if (aspectRatio === "9:16") {
              if (!newPast916.includes(imageUrl)) newPast916.push(imageUrl);
            }
          }

          return {
            ...item,
            imageUrl: aspectRatio === "1:1" ? (imageUrl || item.imageUrl) : item.imageUrl,
            azureUrl: aspectRatio === "1:1" ? (azureUrl || item.azureUrl) : item.azureUrl,
            azureStatus: aspectRatio === "1:1" ? azureStatus : item.azureStatus,
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
            pastImageUrls11: newPast11,
            pastImageUrls169: newPast169,
            pastImageUrls916: newPast916,
          };
        }
        return item;
      });

      saveItems(updated);
      handlePublish();
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

  const handlePublishClick = () => {
    if (!getActiveItem()) return;
    const newVer = handlePublish();
    setPublishedVersion(newVer);
    setShowPublishToast(true);
    setTimeout(() => setShowPublishToast(false), 4000);
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
              <span className="text-xs text-slate-500 font-mono font-normal ml-1.5">v{version}</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Generate high-converting social creatives from raw URLs</p>
          </div>
        </div>

        {/* Global Action / Settings Trigger */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Active Profile</span>
            <span className="text-xs font-semibold text-cyan-400">{settings.bizName}</span>
          </div>

          {/* Settings button */}
          <button
            id="settings-trigger-btn"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-200 rounded-xl border border-white/10 text-xs font-semibold transition-all active:scale-[0.98] shadow-sm cursor-pointer"
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
              scannedPrompt={scannedPrompt}
              onRegenerateImage={handleRegenerateImage}
              onUpdateScannedFields={handleUpdateScannedFields}
              settings={settings}
              imageError={imageError}
              setImageError={setImageError}
              refreshingAspect={refreshingAspect}
              onRefreshSingleImage={handleRefreshSingleImage}
              autoSwitchMessage={autoSwitchMessage}
              onClearAutoSwitchMessage={() => setAutoSwitchMessage(null)}
              onPublish={handlePublish}
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
          Boostin AI Engine v{version} - Cloud AI Accelerated
        </div>
      </footer>

      {/* Brand Settings Overlay */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      {/* Dynamic Publish Success Toast */}
      {showPublishToast && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/80 p-4.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-start gap-3.5 max-w-sm animate-fade-in">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-emerald-500/20">
            <Check className="w-4.5 h-4.5 stroke-[2.5]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-emerald-950 uppercase tracking-wider font-display text-left">Creative Published Successfully</p>
            <p className="text-[10px] text-emerald-800 font-medium mt-1 leading-relaxed text-left">
              Engine version bumped to <span className="font-bold">v{publishedVersion}</span>. Your active assets and scanned metadata are stored to production!
            </p>
          </div>
          <button 
            onClick={() => setShowPublishToast(false)} 
            className="text-emerald-500 hover:text-emerald-700 text-sm font-bold p-1 hover:scale-110 transition-transform cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

    </div>
  );
}
