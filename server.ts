import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

  // CORS and CSP Headers for SaaS Iframe integration
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Content-Security-Policy", "frame-ancestors *");

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    next();
  });

  // SaaS Proxy Helper
  const proxyRequest = async (req: express.Request, res: express.Response, targetPath: string) => {
    const targetUrl = `http://aibigtree.com${targetPath}`;
    try {
      const response = await axios({
        method: req.method,
        url: targetUrl,
        data: req.body,
        headers: { 'Content-Type': 'application/json' }
      });
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error(`Proxy error for ${targetPath}:`, error.message);
      res.status(error.response?.status || 500).json({ error: "SaaS Proxy failure", details: error.message });
    }
  };

  // SaaS Integration Routes
  app.post("/api/tool/launch", (req, res) => proxyRequest(req, res, "/api/tool/launch"));
  app.post("/api/tool/verify", (req, res) => proxyRequest(req, res, "/api/tool/verify"));
  app.post("/api/tool/consume", (req, res) => proxyRequest(req, res, "/api/tool/consume"));

  // SaaS Image Routes
  app.post("/api/upload/image", (req, res) => proxyRequest(req, res, "/api/upload/image"));
  app.get("/api/upload/image", (req, res) => proxyRequest(req, res, "/api/upload/image"));
  app.delete("/api/upload/image", (req, res) => proxyRequest(req, res, "/api/upload/image"));
  app.post("/api/upload/direct-token", (req, res) => proxyRequest(req, res, "/api/upload/direct-token"));
  app.post("/api/upload/commit", (req, res) => proxyRequest(req, res, "/api/upload/commit"));

  // Real Image Analysis Route
  app.post("/api/analyze-image", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured" });

      const { image, type } = req.body; // base64 image data
      if (!image) return res.status(400).json({ error: "No image provided" });

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = type === 'villa' 
        ? "作为一个建筑设计专家，请简要分析这张场景图的建筑风格、光影特征和空间构图（30字以内）。"
        : "作为一个工业设计专家，请简要分析这张产品的型材结构、材质特征和工艺细节（30字以内）。";

      const [mimePart, base64Part] = image.split('base64,');
      const mimeType = mimePart.split(':')[1].split(';')[0];

      const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
          { text: prompt },
          {
            inlineData: {
              data: base64Part,
              mimeType: mimeType
            }
          }
        ]
      });

      res.json({ analysis: result.text });
    } catch (error: any) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generic Gemini API Proxy Route
  app.post("/api/gemini", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
      }

      const { model, payload } = req.body;
      const ai = new GoogleGenAI({ apiKey });

      // Handle Image Generation/Editing (Nano Banana Models)
      // Detect based on model name substrings (flash-image, flash, etc.)
      const isImageRequest = model.includes("image") || model.includes("flash") || model.includes("banana");
      
      if (isImageRequest) {
        const { prompt, images, aspectRatio = "1:1", imageSize = "1K" } = payload;
        
        const contents: any[] = [];
        
        // Add text prompt
        contents.push({ text: prompt });
        
        // Add images if present (for editing/in-painting style tasks)
        if (images && Array.isArray(images)) {
          for (const img of images) {
            const dataUrl = typeof img === 'string' ? img : img.image_url;
            if (dataUrl && dataUrl.includes('base64,')) {
              const [mimePart, base64Part] = dataUrl.split('base64,');
              const mimeType = mimePart.split(':')[1].split(';')[0];
              contents.push({
                inlineData: {
                  data: base64Part,
                  mimeType: mimeType
                }
              });
            }
          }
        }

        const response = await ai.models.generateContent({
          model: model, // Use requested model (e.g. gemini-2.5-flash-image)
          contents: { parts: contents },
          config: {
            imageConfig: {
              aspectRatio,
              imageSize
            }
          }
        });

        // Find the image in parts
        let base64Image = null;
        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              base64Image = part.inlineData.data;
              break;
            }
          }
        }

        if (base64Image) {
          return res.json({
            success: true,
            data: [{ b64_json: base64Image }]
          });
        } else {
          return res.status(500).json({ error: "No image generated", debug: response });
        }
      }

      // Handle standard text generation (fallback)
      const response = await ai.models.generateContent({
        model: model,
        contents: payload.prompt || payload.contents || "Hello",
      });

      res.json({
        success: true,
        text: response.text
      });

    } catch (error: any) {
      console.error("Gemini route error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route for Image Generation/Editing (Legacy/Compatible)
  app.post("/api/images/edit", async (req, res) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "OPENAI_API_KEY is not configured" });
      }

      const { prompt, images, model = "gpt-image-1.5", size = "1024x1024", quality = "auto" } = req.body;

      const response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          images, // Array of { image_url: "data:image/png;base64,..." }
          size,
          quality,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      res.json(data);
    } catch (error: any) {
      console.error("Server error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // For "Detail View" using Generations if only 1 image or specifically prompt based
  app.post("/api/images/generate", async (req, res) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "OPENAI_API_KEY is not configured" });
      }

      const { prompt, images, model = "gpt-image-1.5", size = "1024x1024", quality = "auto" } = req.body;

      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          images,
          size,
          quality,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      res.json(data);
    } catch (error: any) {
      console.error("Server error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
