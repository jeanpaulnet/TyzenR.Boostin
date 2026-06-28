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
    
    // Normalize newlines and replace any consecutive newlines (double newlines) with a single newline
    finalDescription = finalDescription.replace(/\r\n/g, "\n").replace(/\n\n+/g, "\n");

    if (commonTags) {
      const tagsArray = commonTags.split(/\s+/).filter(Boolean);
      const missingTags = tagsArray.filter(tag => !finalDescription.toLowerCase().includes(tag.toLowerCase()));
      if (missingTags.length > 0) {
        finalDescription += " " + missingTags.join(" ");
      }
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
    let fallbackDesc = `Check this out: ${fallbackTitle}\nRead more here: ${url}\n#trending #boostin`;
    if (commonTags) {
      const tagsArray = commonTags.split(/\s+/).filter(Boolean);
      const missingTags = tagsArray.filter(tag => !fallbackDesc.toLowerCase().includes(tag.toLowerCase()));
      if (missingTags.length > 0) {
        fallbackDesc += " " + missingTags.join(" ");
      }
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

// Endpoint to generate image
app.post("/api/generate-image", async (req, res) => {
  const { 
    prompt, 
    model, 
    aspectRatio, 
    resolution, 
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

  console.log(`[Tyzenr] Processing request. Replaced Prompt: "${replacedPrompt}"`);

  try {
    let retrievedUrl = "";
    let base64ImageBytes = "";

    // Invoke the Tyzenr API as requested
    console.log(`[Tyzenr] Invoking POST https://webapi.tyzenr.com/picture/create with aspect: ${aspectRatio || "1:1"}, res: ${resolution || "1K"}, model: ${model || null}, title: ${title || ""}, subtitle: ${bizName || ""}`);
    
    const tyzenrResponse = await fetch("https://webapi.tyzenr.com/picture/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: replacedPrompt,
        aspectRatio: aspectRatio || "1:1",
        resolution: resolution || "1K",
        model: model || null,
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
          const possibleUrl = data.url || data.imageUrl || data.blobUrl || data.sasUrl || data.sasBlobUrl || data.link || (data.data && (data.data.url || data.data.imageUrl || data.data.blobUrl || data.data.sasUrl));
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

// Serve API check/status
app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    hasApiKey: !!process.env.GEMINI_API_KEY,
  });
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
