import express from "express";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(express.json({ limit: '20mb' }));

// CORS 和 CSP 配置，支持 SaaS 平台 Iframe 嵌入
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

// SaaS 接口转发助手
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
    console.error(`SaaS Proxy Error (${targetPath}):`, error.message);
    res.status(error.response?.status || 500).json({ 
      error: "SaaS Proxy failure", 
      details: error.message 
    });
  }
};

// SaaS 业务路由
app.post("/api/tool/launch", (req, res) => proxyRequest(req, res, "/api/tool/launch"));
app.post("/api/tool/verify", (req, res) => proxyRequest(req, res, "/api/tool/verify"));
app.post("/api/tool/consume", (req, res) => proxyRequest(req, res, "/api/tool/consume"));

// SaaS 图片管理接口 (/api/upload/*)
app.post("/api/upload/image", (req, res) => proxyRequest(req, res, "/api/upload/image"));
app.get("/api/upload/image", (req, res) => proxyRequest(req, res, "/api/upload/image"));
app.delete("/api/upload/image", (req, res) => proxyRequest(req, res, "/api/upload/image"));
app.post("/api/upload/direct-token", (req, res) => proxyRequest(req, res, "/api/upload/direct-token"));
app.post("/api/upload/commit", (req, res) => proxyRequest(req, res, "/api/upload/commit"));

// Gemini AI 生成路由
app.post("/api/gemini", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured in Vercel environment" });
    }

    const { model, payload } = req.body;
    const ai = new GoogleGenAI({ apiKey });

    // 默认使用 Gemini 3.1 Flash Image Preview 或根据请求指定
    const modelId = model || "gemini-3.1-flash-image-preview";
    
    // 提取图像数据（如果存在）
    const { prompt, images, aspectRatio = "1:1", imageSize = "1K" } = payload;
    const contents: any[] = [{ text: prompt }];

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
      model: modelId,
      contents: { parts: contents },
      config: {
        imageConfig: {
          aspectRatio,
          imageSize
        }
      }
    });

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
      res.json({
        success: true,
        data: [{ b64_json: base64Image }]
      });
    } else {
      // 如果没有生成图片，尝试返回文本
      res.json({
        success: true,
        text: response.text
      });
    }

  } catch (error: any) {
    console.error("Gemini Lambda Error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default app;
