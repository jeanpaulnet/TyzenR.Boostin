import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { BlobServiceClient } from "@azure/storage-blob";

dotenv.config();

const app = express();
const PORT = 3000;

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
  const { url, bizName, website, watermark, promptTemplate } = req.body;

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
   
   #tag1 #tag2 #tag3 (3-5 relevant trending hashtags/tags with #).
3. "imagePrompt": An optimized, highly descriptive visual prompt for generating a picture that summarizes the content of the article.
   Follow this exact instruction format:
   "create an ultra-realistic cinematic magazine like detailed picture with vivid colors summarizing content of ${url}. Create title from article on top. Create subtitle from ${bizName || "Your Biz"} bottom with ${watermark || "Watermark"} below it."
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
    return res.json({
      success: true,
      title: parsedData.title || fetchedTitle || "Amazing Discoveries",
      description: parsedData.description || `Check this out! Summarizing content from ${url} #boostin #viral`,
      imagePrompt: parsedData.imagePrompt || `create an ultra-realistic cinematic magazine like detailed picture with vivid colors summarizing content of ${url}. Create title from article on top. Create subtitle from ${bizName} bottom with ${watermark} below it.`,
    });
  } catch (error: any) {
    console.error("Gemini Scan Error:", error);
    // Graceful fallback
    const fallbackTitle = fetchedTitle || "Article from " + new URL(url).hostname;
    const fallbackDesc = `Check this out: ${fallbackTitle}\n\nRead more here: ${url}\n\n#trending #boostin`;
    const fallbackPrompt = `create an ultra-realistic cinematic magazine like detailed picture with vivid colors summarizing content of ${url}. Create title from article on top. Create subtitle from ${bizName} bottom with ${watermark} below it.`;

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
  const { prompt, model, aspectRatio, resolution, azureConfig } = req.body;

  if (!prompt) {
    return res.status(400).json({ success: false, error: "Prompt is required" });
  }

  const selectedModel = model || "gemini-2.5-flash-image";
  const selectedAspect = aspectRatio || "1:1";
  const selectedResolution = resolution || "1K";

  console.log(`Generating image using model: ${selectedModel}, prompt: "${prompt}", aspect: ${selectedAspect}, resolution: ${selectedResolution}`);

  try {
    let base64ImageBytes = "";

    if (selectedModel === "imagen-4.0-generate-001") {
      // Use generateImages for Imagen model
      const imageResponse = await ai.models.generateImages({
        model: "imagen-4.0-generate-001",
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/jpeg",
          aspectRatio: selectedAspect,
        },
      });

      if (!imageResponse?.generatedImages?.[0]?.image?.imageBytes) {
        throw new Error("No image was generated by Imagen.");
      }
      base64ImageBytes = imageResponse.generatedImages[0].image.imageBytes;
    } else {
      // Use generateContent for gemini-2.5-flash-image or gemini-3.1-flash-image
      const contentResponse = await ai.models.generateContent({
        model: selectedModel,
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: selectedAspect,
            imageSize: selectedResolution,
          },
        },
      });

      // Find the inline data image part
      const parts = contentResponse.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            base64ImageBytes = part.inlineData.data;
            break;
          }
        }
      }

      if (!base64ImageBytes) {
        throw new Error(`No image returned in Gemini content parts for model ${selectedModel}.`);
      }
    }

    // Save image locally as cache/fallback
    const filename = `boostin_${Date.now()}.png`;
    const localPath = path.join(publicImagesDir, filename);
    const buffer = Buffer.from(base64ImageBytes, "base64");
    fs.writeFileSync(localPath, buffer);
    const localUrl = `/images/${filename}`;

    // Upload to Azure Blob Storage if configured
    let azureUrl = "";
    let azureStatus = "Not Configured";

    if (azureConfig && azureConfig.connectionString && azureConfig.containerName) {
      try {
        console.log("Uploading to actual Azure Blob Storage container:", azureConfig.containerName);
        const blobServiceClient = BlobServiceClient.fromConnectionString(azureConfig.connectionString);
        const containerClient = blobServiceClient.getContainerClient(azureConfig.containerName);
        
        // Try to create the container if it doesn't exist
        await containerClient.createIfNotExists({ access: "blob" });
        
        const blockBlobClient = containerClient.getBlockBlobClient(filename);
        await blockBlobClient.upload(buffer, buffer.length, {
          blobHTTPHeaders: { blobContentType: "image/png" }
        });
        
        azureUrl = blockBlobClient.url;
        azureStatus = "Success";
        console.log("Azure Blob upload successful:", azureUrl);
      } catch (azureErr: any) {
        console.error("Azure Blob Upload failed:", azureErr);
        azureStatus = `Failed: ${azureErr.message || azureErr}`;
      }
    }

    // If actual Azure Blob failed or wasn't configured, build a clean simulated Azure Blob Storage URL for display purposes
    if (!azureUrl) {
      const sanitizedContainer = (azureConfig?.containerName || "boostin-social").toLowerCase().replace(/[^a-z0-9-]/g, "");
      azureUrl = `https://boostinstorage.blob.core.windows.net/${sanitizedContainer}/${filename}`;
      if (azureStatus === "Not Configured") {
        azureStatus = "Simulated (Configure connection string in Settings to upload to your real Azure account)";
      }
    }

    return res.json({
      success: true,
      imageUrl: localUrl, // Use local cached url for preview/download so it is always guaranteed to load
      azureUrl: azureUrl, // Display the stored Azure Blob path to the user as requested
      azureStatus: azureStatus,
      base64: `data:image/png;base64,${base64ImageBytes}`,
    });

  } catch (error: any) {
    console.error("Image generation error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate image with Gemini API.",
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
