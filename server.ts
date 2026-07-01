import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { BlobServiceClient, BlobSASPermissions } from "@azure/storage-blob";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = 3000;

// Lazy initialize OpenAI client
let openaiClient: OpenAI | null = null;
function getOpenAIClient() {
  if (!openaiClient) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error("OPENAI_API_KEY environment variable is not configured. Please configure it in your Secrets or .env file.");
    }
    openaiClient = new OpenAI({ apiKey: key });
  }
  return openaiClient;
}

// Increase body parser limits for handling larger payloads/images
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// Serve static images directory
import fs from "fs";
const publicImagesDir = path.join(process.cwd(), "public", "images");
if (!fs.existsSync(publicImagesDir)) {
  fs.mkdirSync(publicImagesDir, { recursive: true });
}
app.use("/images", express.static(publicImagesDir));

// Initialize Gemini Client
const aiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: aiKey || "MOCK_KEY",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Proxy image endpoint to allow clipboard copy without CORS issues
app.get("/api/proxy-image", async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl || typeof imageUrl !== "string") {
    return res.status(400).send("URL parameter is required");
  }
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from remote: ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type") || "image/png";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error("Error proxying image:", err);
    res.status(500).send("Error proxying image: " + err.message);
  }
});

// Endpoint to scan URL
app.post("/api/scan", async (req, res) => {
  const { url, bizName, website, watermark, promptTemplate, commonTags } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, error: "URL is required" });
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch (err) {
    return res.status(400).json({ success: false, error: "Invalid URL format" });
  }

  console.log(`Scanning URL: ${url}`);
  let fetchedTitle = "";
  let fetchedMetaDesc = "";
  let pageTextSnippet = "";

  // Attempt to fetch URL contents
  try {
    const fetchResponse = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(6000), // 6 seconds timeout
    });

    if (fetchResponse.ok) {
      const html = await fetchResponse.text();

      // Extract Title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        fetchedTitle = titleMatch[1].trim();
      }

      // Extract Meta Description
      const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                             html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
      if (metaDescMatch && metaDescMatch[1]) {
        fetchedMetaDesc = metaDescMatch[1].trim();
      }

      // Extract some body paragraph snippets
      const bodyMatch = html.match(/<body[^>]*>([\s\S]+?)<\/body>/i);
      if (bodyMatch && bodyMatch[1]) {
        // Strip scripts, styles, HTML tags
        let cleanBody = bodyMatch[1]
          .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
          .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        pageTextSnippet = cleanBody.substring(0, 1500);
      }
    }
  } catch (fetchError: any) {
    console.warn(`Could not scrape URL directly: ${fetchError?.message || fetchError}`);
    // Fallback to let Gemini brainstorm based on URL
  }

  // Prepare Gemini instructions to generate Title, Description (summary with Url & Tags) ready for social media
  try {
    const template = promptTemplate || "create an ultra-realistic corporate financial like detailed picture with vivid colors summarizing content of {url}. Create title from article on top. Create subtitle '{settings.business.name}' on bottom with watermark '{settings.watermark}' below it.";
    const compiledPromptInstruction = template
      .replace(/{url}/g, url || "")
      .replace(/{settings\.business\.name}/g, bizName || "Your Biz")
      .replace(/{settings\.watermark}/g, watermark || "Watermark")
      .replace(/{company\.name}/g, bizName || "Your Biz")
      .replace(/{watermark}/g, watermark || "Watermark");

    const currentYear = new Date().getFullYear();
    const currentYearTag = `#${currentYear}`;

    const prompt = `You are a social media copywriter and marketer.
We are scanning a URL to generate a high-converting promotional post for social media platforms.

Target URL: ${url}
Scraped Title: ${fetchedTitle || "None"}
Scraped Meta Description: ${fetchedMetaDesc || "None"}
Scraped Page Content Snippet: ${pageTextSnippet || "None"}

Please analyze the URL and the content, and generate the following three outputs in a structured JSON response:
1. "title": A polished, click-worthy, engaging headline/title representing the article or page (max 80 chars).
2. "description": A highly engaging social media post containing a 2-paragraph summary of the article's core values or content.
   It MUST be formatted exactly like this:
   [Paragraph 1 of summary]
   
   [Paragraph 2 of summary]
   
   More Info: ${url}
   
   [Hashtags/Tags] (You MUST generate 3-5 highly relevant hashtags separated by spaces. Do NOT include any hashtag representing the business name "${bizName || "YourBiz"}" or its variation in the generated hashtags. Instead, the hashtags MUST include:
   - A hashtag for the industry/sector of the content (e.g. #Tech, #Healthcare, #RealEstate, #Fintech, #ECommerce, etc., inferred from the content)
   - A hashtag for the country or region associated with the article or company, or target market if applicable (e.g. #USA, #UK, #India, #Canada, #Global, etc., inferred from the content)
   - A hashtag with the current year (MUST use ${currentYearTag})
   - 1-2 other trending, highly relevant, contextual keywords or hashtags
   - These common hashtags from settings MUST also be included at the end: ${commonTags || "#trending #news"})
3. "imagePrompt": An optimized, highly descriptive visual prompt for generating a picture that summarizes the content of the article.
   Follow this exact instruction format:
   "${compiledPromptInstruction}"
   (You can add visual descriptions of the scene to summarize the content, but keep that exact frame instruction intact!)

Your output must be in valid JSON conforming to this schema:
{
  "title": "string",
  "description": "string",
  "imagePrompt": "string"
}
Do not include any other text besides the JSON.`;

    const modelName = "gemini-3.5-flash";
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Engaging headline for the scanned content" },
            description: { type: Type.STRING, description: "2-paragraph summary followed by More Info and hashtags" },
            imagePrompt: { type: Type.STRING, description: "Descriptive image prompt conforming to the template" },
          },
          required: ["title", "description", "imagePrompt"],
        },
      },
    });

    const parsedData = JSON.parse(response.text || "{}");
    let finalDescription = parsedData.description || `Check this out! Summarizing content from ${url} #boostin #viral`;
    
    // Normalize newlines and replace any consecutive newlines (double newlines) with a double newline (one empty line)
    finalDescription = finalDescription.replace(/\r\n/g, "\n").replace(/\n\n+/g, "\n\n");

    if (commonTags) {
      const tagsArray = commonTags.split(/\s+/).filter(Boolean);
      const missingTags = tagsArray.filter(tag => !finalDescription.toLowerCase().includes(tag.toLowerCase()));
      if (missingTags.length > 0) {
        finalDescription += " " + missingTags.join(" ");
      }
    }

    // Programmatically ensure the current year tag is present
    if (!finalDescription.toLowerCase().includes(currentYearTag.toLowerCase())) {
      finalDescription += " " + currentYearTag;
    }

    // Convert all hashtags inside finalDescription to lowercase
    finalDescription = finalDescription.replace(/#[a-zA-Z0-9_]+/g, (match) => match.toLowerCase());

    return res.json({
      success: true,
      title: parsedData.title || fetchedTitle || "Amazing Discoveries",
      description: finalDescription,
      imagePrompt: parsedData.imagePrompt || compiledPromptInstruction,
    });
  } catch (error: any) {
    console.error("Gemini Scan Error:", error);
    // Graceful fallback
    const fallbackTitle = fetchedTitle || "Article from " + new URL(url).hostname;
    const currentYear = new Date().getFullYear();
    const currentYearTag = `#${currentYear}`;
    let fallbackDesc = `Check this out: ${fallbackTitle}\nRead more here: ${url}\n#trending #boostin ${currentYearTag}`;
    if (commonTags) {
      const tagsArray = commonTags.split(/\s+/).filter(Boolean);
      const missingTags = tagsArray.filter(tag => !fallbackDesc.toLowerCase().includes(tag.toLowerCase()));
      if (missingTags.length > 0) {
        fallbackDesc += " " + missingTags.join(" ");
      }
    }

    if (!fallbackDesc.toLowerCase().includes(currentYearTag.toLowerCase())) {
      fallbackDesc += " " + currentYearTag;
    }

    // Convert all hashtags inside fallbackDesc to lowercase
    fallbackDesc = fallbackDesc.replace(/#[a-zA-Z0-9_]+/g, (match) => match.toLowerCase());

    const fallbackPrompt = promptTemplate 
      ? promptTemplate
          .replace(/{url}/g, url || "")
          .replace(/{settings\.business\.name}/g, bizName || "Your Biz")
          .replace(/{settings\.watermark}/g, watermark || "Watermark")
          .replace(/{company\.name}/g, bizName || "Your Biz")
          .replace(/{watermark}/g, watermark || "Watermark")
      : `create an ultra-realistic corporate financial like detailed picture with vivid colors summarizing content of ${url}. Create title from article on top. Create subtitle from ${bizName} bottom with ${watermark} below it.`;

    return res.json({
      success: true,
      title: fallbackTitle,
      description: fallbackDesc,
      imagePrompt: fallbackPrompt,
      warning: "Scraped content succeeded but social copy synthesis had a slight hiccup.",
    });
  }
});

// Endpoint to regenerate only the image prompt when settings change
app.post("/api/regenerate-prompt", async (req, res) => {
  const { url, title, description, bizName, watermark, promptTemplate } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, error: "URL is required" });
  }

  try {
    const template = promptTemplate || "create an ultra-realistic corporate financial like detailed picture with vivid colors summarizing content of {url}. Create title from article on top. Create subtitle '{settings.business.name}' on bottom with watermark '{settings.watermark}' below it.";
    const compiledPromptInstruction = template
      .replace(/{url}/g, url || "")
      .replace(/{settings\.business\.name}/g, bizName || "Your Biz")
      .replace(/{settings\.watermark}/g, watermark || "Watermark")
      .replace(/{company\.name}/g, bizName || "Your Biz")
      .replace(/{watermark}/g, watermark || "Watermark")
      .replace(/{title}/g, title || "")
      .replace(/{description}/g, description || "");

    const prompt = `You are a creative prompt engineer.
We have a scanned webpage with:
URL: ${url}
Title: ${title}
Description: ${description}

Please generate an optimized, highly descriptive image generation prompt based on these details.
Follow this exact instruction format:
"${compiledPromptInstruction}"
(You should add rich visual descriptions of the scene to summarize the content, but keep that exact frame instruction intact!)

Response format: Return a JSON object with a single key "imagePrompt". Do not include any other text besides JSON.`;

    const modelName = "gemini-3.5-flash";
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            imagePrompt: { type: Type.STRING, description: "The optimized descriptive image prompt" }
          },
          required: ["imagePrompt"]
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    return res.json({
      success: true,
      imagePrompt: parsedData.imagePrompt || compiledPromptInstruction
    });
  } catch (error: any) {
    console.error("Prompt regeneration error:", error);
    // Fallback
    const fallbackPrompt = (promptTemplate || "")
      .replace(/{url}/g, url || "")
      .replace(/{settings\.business\.name}/g, bizName || "Your Biz")
      .replace(/{settings\.watermark}/g, watermark || "Watermark")
      .replace(/{company\.name}/g, bizName || "Your Biz")
      .replace(/{watermark}/g, watermark || "Watermark")
      .replace(/{title}/g, title || "")
      .replace(/{description}/g, description || "");
    return res.json({
      success: true,
      imagePrompt: fallbackPrompt
    });
  }
});

// Endpoint to generate image
app.post("/api/generate-image", async (req, res) => {
  const { 
    prompt, 
    model, 
    aspectRatio, 
    azureConfig,
    promptTemplate,
    bizName,
    watermark,
    url,
    title,
    description
  } = req.body;

  if (!prompt) {
    return res.status(400).json({ success: false, error: "Prompt is required" });
  }

  // Reconstruct prompt from settings with parameters replaced
  let replacedPrompt = prompt;
  if (promptTemplate) {
    replacedPrompt = promptTemplate
      .replace(/{url}/g, url || "")
      .replace(/{settings\.business\.name}/g, bizName || "Your Biz")
      .replace(/{settings\.watermark}/g, watermark || "Watermark")
      .replace(/{company\.name}/g, bizName || "Your Biz")
      .replace(/{watermark}/g, watermark || "Watermark")
      .replace(/{title}/g, title || "")
      .replace(/{description}/g, description || "");
  }

  // Enforce padding for any text/headings/subheadings to prevent clipping on generated canvas edges
  if (replacedPrompt) {
    replacedPrompt += ". Ensure all visual text elements, headings, subheadings, and watermark details have generous padding and are safely away from the outer edges of the canvas to prevent any clipping or cutting off at the margins. Any watermark must be styled in a subtle light grey font color, with a small size 10 equivalent font, positioned elegantly in the lower area of the image.";
  }

  console.log(`[Tyzenr] Processing request. Replaced Prompt: "${replacedPrompt}"`);

  try {
    let retrievedUrl = "";
    let base64ImageBytes = "";

    // Invoke the Tyzenr API as requested
    console.log(`[Tyzenr] Invoking POST https://webapi.tyzenr.com/picture/create with aspect: ${aspectRatio || "1:1"}, model: ${model || "gpt"}, title: ${title || ""}, subtitle: ${bizName || ""}`);
    
    const tyzenrResponse = await fetch("https://webapi.tyzenr.com/picture/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: replacedPrompt,
        aspectRatio: aspectRatio || "1:1",
        model: model || "gpt",
        title: title || "",
        subtitle: bizName || ""
      }),
    });

    console.log(`[Tyzenr] API returned status: ${tyzenrResponse.status}`);
    
    if (!tyzenrResponse.ok) {
      const errText = await tyzenrResponse.text().catch(() => "");
      throw new Error(`Tyzenr API returned status ${tyzenrResponse.status}: ${errText}`);
    }

    const contentType = tyzenrResponse.headers.get("content-type") || "";
    if (contentType.includes("image")) {
      // If it returned raw binary image bytes
      const arrayBuffer = await tyzenrResponse.arrayBuffer();
      base64ImageBytes = Buffer.from(arrayBuffer).toString("base64");
      console.log("[Tyzenr] Successfully loaded binary image from API response!");
    } else {
      const text = await tyzenrResponse.text();
      console.log("[Tyzenr] Response text:", text.slice(0, 800));
      
      const trimmedText = text.trim();
      if (trimmedText.startsWith("http://") || trimmedText.startsWith("https://")) {
        retrievedUrl = trimmedText;
        console.log("[Tyzenr] Successfully captured raw URL response:", retrievedUrl);
      } else {
        try {
          const data = JSON.parse(text);
          const possibleUrl = data.pictureUrl || data.result || data.url || data.imageUrl || data.blobUrl || data.sasUrl || data.sasBlobUrl || data.link || (data.data && (data.data.url || data.data.imageUrl || data.data.blobUrl || data.data.sasUrl));
          const possibleBase64 = data.base64 || data.b64_json || data.imageBytes || (data.data && (data.data.base64 || data.data.b64_json));

          if (possibleUrl && typeof possibleUrl === "string") {
            retrievedUrl = possibleUrl;
            console.log("[Tyzenr] Successfully captured URL from JSON key:", retrievedUrl);
          } else if (possibleBase64) {
            base64ImageBytes = possibleBase64.replace(/^data:image\/[a-z]+;base64,/, "");
            console.log("[Tyzenr] Successfully captured base64 bytes from JSON.");
          } else {
            // Regex search for any http/https URL in the JSON string as fallback
            const match = text.match(/https?:\/\/[^\s"']+/);
            if (match) {
              retrievedUrl = match[0];
              console.log("[Tyzenr] Successfully matched URL pattern in JSON text:", retrievedUrl);
            }
          }
        } catch (jsonErr) {
          // Regex search in plain text
          const match = text.match(/https?:\/\/[^\s"']+/);
          if (match) {
            retrievedUrl = match[0];
            console.log("[Tyzenr] Successfully matched URL pattern in raw text response:", retrievedUrl);
          }
        }
      }
    }

    // If we got a direct URL/SAS URL from the API, use it!
    if (retrievedUrl) {
      return res.json({
        success: true,
        imageUrl: retrievedUrl,
        azureUrl: retrievedUrl,
        azureStatus: "Success (Linked via Tyzenr API)",
        base64: "", 
      });
    }

    // If we got binary image bytes, save locally as cache fallback
    if (base64ImageBytes) {
      const filename = `boostin_${Date.now()}.png`;
      const localPath = path.join(publicImagesDir, filename);
      const buffer = Buffer.from(base64ImageBytes, "base64");
      fs.writeFileSync(localPath, buffer);
      const localUrl = `/images/${filename}`;

      return res.json({
        success: true,
        imageUrl: localUrl,
        azureUrl: localUrl,
        azureStatus: "Success (Local Image Cached)",
        base64: `data:image/png;base64,${base64ImageBytes}`,
      });
    }

    throw new Error("Tyzenr API response did not contain a valid image URL or image bytes.");

  } catch (error: any) {
    console.error("Image generation error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate picture via Tyzenr API.",
    });
  }
});

// Endpoint to generate picture via new /ai/picture/url route
app.post("/ai/picture/url", async (req, res) => {
  const {
    userPrompt,
    url,
    model,
    aspectRatio,
    subtitle,
    watermark
  } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, error: "URL is required" });
  }

  if (!userPrompt || !userPrompt.trim()) {
    return res.status(400).json({ success: false, error: "User Prompt invalid.  Go to Settings & Save." });
  }

  // Reconstruct prompt from settings with parameters replaced
  let replacedPrompt = userPrompt || "";
  if (replacedPrompt) {
    replacedPrompt = replacedPrompt
      .replace(/{url}/g, url || "")
      .replace(/{settings\.business\.name}/g, subtitle || "Your Biz")
      .replace(/{settings\.watermark}/g, watermark || "Watermark")
      .replace(/{company\.name}/g, subtitle || "Your Biz")
      .replace(/{watermark}/g, watermark || "Watermark")
      .replace(/{title}/g, "")
      .replace(/{description}/g, "");
  }

  // Enforce padding for any text/headings/subheadings to prevent clipping on generated canvas edges
  if (replacedPrompt) {
    replacedPrompt += ". Ensure all visual text elements, headings, subheadings, and watermark details have generous padding and are safely away from the outer edges of the canvas to prevent any clipping or cutting off at the margins. Any watermark must be styled in a subtle light grey font color, with a small size 10 equivalent font, positioned elegantly in the lower area of the image.";
  }

  console.log(`[New Picture API] Processing request for ${aspectRatio}. Replaced Prompt: "${replacedPrompt}"`);

  try {
    let retrievedUrl = "";
    let base64ImageBytes = "";

    // Invoke the Tyzenr API as requested
    console.log(`[Tyzenr] Invoking POST https://webapi.tyzenr.com/ai/picture/url with aspect: ${aspectRatio || "1:1"}, model: ${model || "gpt"}, subtitle: ${subtitle || ""}`);
    
    const tyzenrResponse = await fetch("https://webapi.tyzenr.com/ai/picture/url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userPrompt: replacedPrompt,
        url: url,
        model: model || "gpt",
        aspectRatio: aspectRatio || "1:1",
        subtitle: subtitle || "",
        watermark: watermark || ""
      }),
    });

    console.log(`[Tyzenr] API returned status: ${tyzenrResponse.status}`);
    
    if (!tyzenrResponse.ok) {
      const errText = await tyzenrResponse.text().catch(() => "");
      throw new Error(`Tyzenr API returned status ${tyzenrResponse.status}: ${errText}`);
    }

    const contentType = tyzenrResponse.headers.get("content-type") || "";
    if (contentType.includes("image")) {
      const arrayBuffer = await tyzenrResponse.arrayBuffer();
      base64ImageBytes = Buffer.from(arrayBuffer).toString("base64");
      console.log("[Tyzenr] Successfully loaded binary image from API response!");
    } else {
      const text = await tyzenrResponse.text();
      console.log("[Tyzenr] Response text:", text.slice(0, 800));
      
      const trimmedText = text.trim();
      if (trimmedText.startsWith("http://") || trimmedText.startsWith("https://")) {
        retrievedUrl = trimmedText;
        console.log("[Tyzenr] Successfully captured raw URL response:", retrievedUrl);
      } else {
        try {
          const data = JSON.parse(text);
          const possibleUrl = data.pictureUrl || data.result || data.url || data.imageUrl || data.blobUrl || data.sasUrl || data.sasBlobUrl || data.link || (data.data && (data.data.url || data.data.imageUrl || data.data.blobUrl || data.data.sasUrl));
          const possibleBase64 = data.base64 || data.b64_json || data.imageBytes || (data.data && (data.data.base64 || data.data.b64_json));

          if (possibleUrl && typeof possibleUrl === "string") {
            retrievedUrl = possibleUrl;
            console.log("[Tyzenr] Successfully captured URL from JSON key:", retrievedUrl);
          } else if (possibleBase64) {
            base64ImageBytes = possibleBase64.replace(/^data:image\/[a-z]+;base64,/, "");
            console.log("[Tyzenr] Successfully captured base64 bytes from JSON.");
          } else {
            const match = text.match(/https?:\/\/[^\s"']+/);
            if (match) {
              retrievedUrl = match[0];
              console.log("[Tyzenr] Successfully matched URL pattern in JSON text:", retrievedUrl);
            }
          }
        } catch (jsonErr) {
          const match = text.match(/https?:\/\/[^\s"']+/);
          if (match) {
            retrievedUrl = match[0];
            console.log("[Tyzenr] Successfully matched URL pattern in raw text response:", retrievedUrl);
          }
        }
      }
    }

    if (retrievedUrl) {
      return res.json({
        success: true,
        imageUrl: retrievedUrl,
        azureUrl: retrievedUrl,
        azureStatus: "Success (Linked via Tyzenr API)",
        base64: "", 
      });
    }

    if (base64ImageBytes) {
      const filename = `boostin_${Date.now()}.png`;
      const localPath = path.join(publicImagesDir, filename);
      const buffer = Buffer.from(base64ImageBytes, "base64");
      fs.writeFileSync(localPath, buffer);
      const localUrl = `/images/${filename}`;

      return res.json({
        success: true,
        imageUrl: localUrl,
        azureUrl: localUrl,
        azureStatus: "Success (Local Image Cached)",
        base64: `data:image/png;base64,${base64ImageBytes}`,
      });
    }

    throw new Error("Tyzenr API response did not contain a valid image URL or image bytes.");

  } catch (error: any) {
    console.error("Image generation error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate picture via Tyzenr API.",
    });
  }
});

// Helper to automatically scan and resolve Instagram / Meta App ID and Secret from process.env
function resolveInstagramCredentials() {
  let appId: string | undefined = undefined;
  let appSecret: string | undefined = undefined;

  const envKeys = Object.keys(process.env);
  
  if (!appId) {
    const idKey = envKeys.find(key => {
      const uKey = key.toUpperCase();
      return (
        (uKey.includes("INSTAGRAM") || uKey.includes("FACEBOOK") || uKey.includes("META") || uKey.includes("IG_") || uKey.includes("FB_")) &&
        (uKey.includes("APP_ID") || uKey.includes("CLIENT_ID") || uKey === "INSTAGRAM_ID" || uKey === "FACEBOOK_ID")
      );
    });
    if (idKey) {
      appId = process.env[idKey];
      console.log(`[Auto-Detect] Automatically resolved App ID from env key: ${idKey}`);
    }
  }

  if (!appSecret) {
    const secretKey = envKeys.find(key => {
      const uKey = key.toUpperCase();
      return (
        (uKey.includes("INSTAGRAM") || uKey.includes("FACEBOOK") || uKey.includes("META") || uKey.includes("IG_") || uKey.includes("FB_")) &&
        (uKey.includes("APP_SECRET") || uKey.includes("CLIENT_SECRET") || uKey.includes("SECRET"))
      );
    });
    if (secretKey) {
      appSecret = process.env[secretKey];
      console.log(`[Auto-Detect] Automatically resolved App Secret from env key: ${secretKey}`);
    }
  }

  return { appId, appSecret };
}

// Serve API check/status
app.get("/api/status", (req, res) => {
  const { appId, appSecret } = resolveInstagramCredentials();
  res.json({
    status: "online",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    hasInstagramConfig: !!(appId && appSecret),
    instagramAppId: appId ? `${appId.slice(0, 4)}...${appId.slice(-4)}` : null,
  });
});

// Instagram integration routes
app.get("/api/auth/instagram/url", (req, res) => {
  const origin = req.query.origin || `${req.protocol}://${req.get("host")}`;
  const redirectUri = `${origin}/auth/instagram/callback`;
  
  const { appId, appSecret } = resolveInstagramCredentials();

  if (!appId) {
    return res.status(400).json({ error: "No Facebook App ID could be detected automatically. Please configure FACEBOOK_APP_ID in your Project Secrets (via Settings -> Secrets)." });
  }
  if (!appSecret) {
    return res.status(400).json({ error: "No Facebook App Secret could be detected automatically. Please configure FACEBOOK_APP_SECRET in your Project Secrets (via Settings -> Secrets)." });
  }

  // Safely bundle the appId and appSecret into the state parameter
  const statePayload = JSON.stringify({ appId, appSecret });
  const stateEncoded = Buffer.from(statePayload).toString("base64");

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,pages_manage_posts",
    state: stateEncoded,
  });

  const authUrl = `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`;
  res.json({ url: authUrl });
});

app.get("/auth/instagram/callback", async (req, res) => {
  const { code, state } = req.query;
  const origin = `${req.protocol}://${req.get("host")}`;
  const redirectUri = `${origin}/auth/instagram/callback`;

  let appId = "";
  let appSecret = "";

  if (state) {
    try {
      const decoded = Buffer.from(state as string, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded);
      appId = parsed.appId || "";
      appSecret = parsed.appSecret || "";
    } catch (e) {
      console.error("Failed to decode OAuth state:", e);
    }
  }

  if (!appId || !appSecret) {
    const creds = resolveInstagramCredentials();
    appId = appId || creds.appId || "";
    appSecret = appSecret || creds.appSecret || "";
  }

  if (!code) {
    return res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: "OAUTH_AUTH_FAILURE", error: "No code received from Meta" }, "*");
              window.close();
            } else {
              window.location.href = "/";
            }
          </script>
        </body>
      </html>
    `);
  }

  try {
    // 1. Exchange code for Facebook User Access Token
    const tokenUrl = `https://graph.facebook.com/v20.0/oauth/access_token?` + new URLSearchParams({
      client_id: appId || "",
      redirect_uri: redirectUri,
      client_secret: appSecret || "",
      code: code as string,
    });

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error.message || "Failed to exchange authorization code for access token.");
    }

    const userAccessToken = tokenData.access_token;

    // 2. Exchange for Long-lived Access Token (lasts ~60 days)
    const longLivedUrl = `https://graph.facebook.com/v20.0/oauth/access_token?` + new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId || "",
      client_secret: appSecret || "",
      fb_exchange_token: userAccessToken,
    });

    const longLivedResponse = await fetch(longLivedUrl);
    const longLivedData = await longLivedResponse.json();
    const longLivedToken = longLivedData.access_token || userAccessToken;

    // 3. Get Pages list to find a page connected to Instagram Business Account and Facebook Pages
    const pagesUrl = `https://graph.facebook.com/v20.0/me/accounts?access_token=${longLivedToken}`;
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();

    let instagramAccounts: { pageId: string; pageName: string; instagramBusinessAccountId: string; pageAccessToken: string }[] = [];
    let facebookPages: { pageId: string; pageName: string; pageAccessToken: string }[] = [];

    if (pagesData.data && Array.isArray(pagesData.data)) {
      for (const page of pagesData.data) {
        const pageId = page.id;
        const pageName = page.name;
        const pageAccessToken = page.access_token;

        facebookPages.push({
          pageId,
          pageName,
          pageAccessToken,
        });

        // Query Instagram Business Account connected to this page
        const igUrl = `https://graph.facebook.com/v20.0/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`;
        const igResponse = await fetch(igUrl);
        const igData = await igResponse.json();

        if (igData.instagram_business_account && igData.instagram_business_account.id) {
          instagramAccounts.push({
            pageId,
            pageName,
            instagramBusinessAccountId: igData.instagram_business_account.id,
            pageAccessToken,
          });
        }
      }
    }

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: "OAUTH_AUTH_SUCCESS", 
                payload: {
                  accessToken: ${JSON.stringify(longLivedToken)},
                  accounts: ${JSON.stringify(instagramAccounts)},
                  facebookPages: ${JSON.stringify(facebookPages)}
                }
              }, "*");
              window.close();
            } else {
              window.location.href = "/";
            }
          </script>
          <p>Authentication successful! You can now close this window.</p>
        </body>
      </html>
    `);

  } catch (error: any) {
    console.error("Instagram/Facebook OAuth Error:", error);
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: "OAUTH_AUTH_FAILURE", error: ${JSON.stringify(error.message)} }, "*");
              window.close();
            } else {
              window.location.href = "/";
            }
          </script>
          <p>Authentication failed: ${error.message}</p>
        </body>
      </html>
    `);
  }
});

app.post("/api/facebook/post", async (req, res) => {
  const { imageUrl, caption, pageId, pageAccessToken, origin } = req.body;

  if (!imageUrl || !caption || !pageId || !pageAccessToken) {
    return res.status(400).json({
      success: false,
      error: "Missing required parameters. Make sure image, caption, page ID, and Page Access Token are provided."
    });
  }

  // 1. Construct absolute image URL
  let finalImageUrl = imageUrl;
  if (imageUrl.startsWith("/")) {
    const baseOrigin = origin || `${req.protocol}://${req.get("host")}`;
    finalImageUrl = `${baseOrigin}${imageUrl}`;
  }

  console.log(`[Facebook Page Post] Posting image: ${finalImageUrl} to Facebook Page: ${pageId}`);

  try {
    const postPhotoUrl = `https://graph.facebook.com/v20.0/${pageId}/photos`;
    const response = await fetch(postPhotoUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: finalImageUrl,
        message: caption,
        access_token: pageAccessToken
      })
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || "Failed to post to Facebook Page.");
    }

    console.log(`[Facebook Page Post] Successfully posted to Facebook! Post ID: ${data.post_id || data.id}`);

    return res.json({
      success: true,
      postId: data.post_id || data.id,
    });

  } catch (error: any) {
    console.error("[Facebook Page Post Error]", error);
    return res.status(500).json({
      success: false,
      error: error.message || "An unexpected error occurred while posting to Facebook Page."
    });
  }
});

app.post("/api/instagram/post", async (req, res) => {
  const { imageUrl, caption, accessToken, instagramBusinessAccountId, origin } = req.body;

  if (!imageUrl || !caption || !accessToken || !instagramBusinessAccountId) {
    return res.status(400).json({
      success: false,
      error: "Missing required parameters. Make sure image, caption, access token, and Instagram Business Account ID are provided."
    });
  }

  // 1. Construct absolute image URL
  let finalImageUrl = imageUrl;
  if (imageUrl.startsWith("/")) {
    const baseOrigin = origin || `${req.protocol}://${req.get("host")}`;
    finalImageUrl = `${baseOrigin}${imageUrl}`;
  }

  console.log(`[Instagram Post] Posting image: ${finalImageUrl} to Instagram Account: ${instagramBusinessAccountId}`);

  try {
    // 2. Create Media Container
    const createContainerUrl = `https://graph.facebook.com/v20.0/${instagramBusinessAccountId}/media`;
    const createResponse = await fetch(createContainerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image_url: finalImageUrl,
        caption: caption,
        access_token: accessToken
      })
    });

    const createData = await createResponse.json();
    if (createData.error) {
      throw new Error(createData.error.message || "Failed to create media container on Instagram. Check image URL and access token permissions.");
    }

    const containerId = createData.id;
    console.log(`[Instagram Post] Media container created with ID: ${containerId}. Polling status...`);

    // 3. Poll container status (recommended by Meta to avoid publishing pending media)
    let isReady = false;
    let attempts = 0;
    while (!isReady && attempts < 15) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusResponse = await fetch(`https://graph.facebook.com/v20.0/${containerId}?fields=status_code,failure_reason&access_token=${accessToken}`);
      const statusData = await statusResponse.json();
      
      const statusCode = statusData.status_code;
      console.log(`[Instagram Post] Container status: ${statusCode} (Attempt ${attempts + 1})`);
      
      if (statusCode === "FINISHED") {
        isReady = true;
      } else if (statusCode === "ERROR") {
        throw new Error(`Media container processing failed: ${statusData.failure_reason || "unknown reason"}`);
      }
      attempts++;
    }

    // 4. Publish Media Container
    const publishUrl = `https://graph.facebook.com/v20.0/${instagramBusinessAccountId}/media_publish`;
    const publishResponse = await fetch(publishUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken
      })
    });

    const publishData = await publishResponse.json();
    if (publishData.error) {
      throw new Error(publishData.error.message || "Failed to publish media container on Instagram.");
    }

    const postId = publishData.id;
    console.log(`[Instagram Post] Successfully posted to Instagram! Post ID: ${postId}`);

    return res.json({
      success: true,
      postId: postId,
    });

  } catch (error: any) {
    console.error("[Instagram Post Error]", error);
    return res.status(500).json({
      success: false,
      error: error.message || "An unexpected error occurred while posting to Instagram."
    });
  }
});

// Vite & Static file handler
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Boostin fullstack server running on http://localhost:${PORT}`);
  });
}

startServer();
