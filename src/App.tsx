/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  ChevronRight, 
  Upload, 
  Image as ImageIcon, 
  History, 
  Download, 
  RefreshCw, 
  Layout, 
  Camera, 
  Box, 
  Maximize,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Settings2,
  User,
  Coins
} from 'lucide-react';

// --- Types ---

type ViewAngle = 'default' | 'interior' | 'high' | 'detail';

interface GeneratedImage {
  id: string;
  url: string; // base64
  angle: ViewAngle;
  timestamp: number;
  prompt: string;
  size: string;
  quality: string;
}

// --- Components ---

export default function App() {
  const [step, setStep] = useState(2);
  const [angle, setAngle] = useState<ViewAngle>('default');
  const [villaImage, setVillaImage] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null);

  // --- SaaS Integration States ---
  const [userId, setUserId] = useState<string | null>(null);
  const [toolId, setToolId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [enterprise, setEnterprise] = useState<string | null>(null);
  const [userIntegral, setUserIntegral] = useState<number>(0);
  const [toolIntegral, setToolIntegral] = useState<number>(0);
  const [consumeUrl, setConsumeUrl] = useState<string | null>(null);
  const [saasContext, setSaasContext] = useState<string | null>(null);
  const [saasPrompts, setSaasPrompts] = useState<string[]>([]);

  // Filter invalid "null"/"undefined" strings from external args
  const cleanId = (id: any) => (id === "null" || id === "undefined" || !id) ? null : String(id);
  
  // Robust JSON reader to prevent "Unexpected token '<'" errors
  const readJsonResponse = async (res: Response): Promise<any> => {
    const text = await res.text();
    let data: any = { success: false, error: "", message: "" };
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { success: false, error: text.slice(0, 300), message: "解析响应失败" };
    }
    
    if (!res.ok || data.success === false) {
      throw new Error(data.error || data.message || `请求失败: ${res.status}`);
    }
    return data;
  };

  const fetchLaunchInfo = useCallback(async (uId: string, tId: string) => {
    try {
      const res = await fetch('/api/tool/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uId, toolId: tId })
      });
      const result = await readJsonResponse(res);
      if (result.success) {
        setUserName(result.data.user.name);
        setEnterprise(result.data.user.enterprise);
        setUserIntegral(result.data.user.integral);
        setToolIntegral(result.data.tool.integral);
      }
    } catch (err: any) {
      console.error("Launch fetch failed", err);
    }
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data && data.type === 'SAAS_INIT') {
        processInit(data);
      }
      if (data && data.type === 'SAAS_CONSUME_RESULT') {
        if (data.success && data.data) {
          setUserIntegral(data.data.currentIntegral);
        }
      }
    };

    const processInit = (data: any) => {
      const uId = cleanId(data.userId);
      const tId = cleanId(data.toolId);
      if (uId) setUserId(uId);
      if (tId) setToolId(tId);
      if (data.consumeUrl) setConsumeUrl(data.consumeUrl);
      if (data.context) setSaasContext(data.context);
      if (data.prompt) setSaasPrompts(Array.isArray(data.prompt) ? data.prompt : []);
      
      if (uId && tId) {
        fetchLaunchInfo(uId, tId);
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Check URL params as fallback
    const params = new URLSearchParams(window.location.search);
    const uId = cleanId(params.get('userId'));
    const tId = cleanId(params.get('toolId'));
    if (uId || tId) {
       processInit({ userId: uId, toolId: tId });
    }

    return () => window.removeEventListener('message', handleMessage);
  }, [fetchLaunchInfo]);

  // Settings
  const [resolution, setResolution] = useState('2k'); // 1k, 2k, 4k
  const [ratio, setRatio] = useState('1:1'); // 1:1, 3:4, 4:3, 16:9

  const compressImage = (dataUrl: string, maxWidth = 1600, quality = 0.85): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height *= maxWidth / width;
            width = maxWidth;
          } else {
            width *= maxWidth / height;
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = dataUrl;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'villa' | 'product') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        if (type === 'villa') setVillaImage(compressed);
        else setProductImage(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const getBase64Data = (dataUrl: string) => dataUrl.split(',')[1];
  const getMimeType = (dataUrl: string) => dataUrl.split(';')[0].split(':')[1];

  const mapResolutionToQuality = (res: string) => {
    switch (res) {
      case '1k': return 'low';
      case '2k': return 'medium';
      case '4k': return 'high';
      default: return 'auto';
    }
  };

  const mapResolutionToGeminiSize = (res: string) => {
    switch (res) {
      case '1k': return '1K';
      case '2k': return '2K';
      case '4k': return '4K';
      default: return '1K';
    }
  };

  const mapRatioToSize = (r: string) => {
    switch (r) {
      case '1:1': return '1024x1024';
      case '3:4': return '1024x1536';
      case '4:3': return '1536x1024';
      case '16:9': return '1536x1024';
      default: return 'auto';
    }
  };

  const generateImage = async () => {
    if (!productImage || (angle !== 'detail' && !villaImage)) return;

    setIsGenerating(true);
    setResultImage(null);

    try {
      // --- Step 2: Verify Integral ---
      if (userId && toolId) {
        const verifyRes = await fetch('/api/tool/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, toolId })
        });
        const verifyData = await readJsonResponse(verifyRes);
        setUserIntegral(verifyData.data.currentIntegral);
      }

      const isDetail = angle === 'detail';
      const endpoint = '/api/gemini';
      
      let prompt = "";
      if (angle === 'default') {
        prompt = "ARCHITECTURAL TRANSFORMATION: 1. Use the villa image (image 1) as the structural template. 2. Replace all windows/doors with the EXACT system window model from the product image (image 2). 3. CRITICAL: Replicate the EXACT internal mullion patterns, decorative grilles, and lattice designs from image 2. 4. Extract exact frame finish, metallic color, and hardware details. 5. If image 1 is interior, beautify walls/furniture; if exterior, upgrade facade to luxury minimalism with smooth, high-end seamless textures, STRICTLY NO TILES, no stone grids, and no porcelain cladding. 6. Final output must match the intricate window patterns of image 2 perfectly.";
      } else if (angle === 'interior') {
        prompt = "STRICT INTERIOR COMPOSITE: 1. Preserve the window silhouettes from image 1. 2. Apply the EXACT frame profiles and internal decorative grilles from the product image (image 2). 3. Replicate the specific glass texture and transparency. 4. Beautify the space with luxury wall textures and lighting while ensuring the window's internal patterns are the focal point. 5. Maintain high-end architectural rendering quality.";
      } else if (angle === 'high') {
        prompt = "REALISTIC DRONE AERIAL PHOTOGRAPHY: 1. Use the villa image (image 1) as the absolute structural template. 2. Replace all windows/doors with the EXACT system window model and patterns from image 2. 3. Ensure the final result maintains the perspective of image 1 but as a finished luxury villa with realistic landscaping, NO SWIMMING POOLS. 4. The window details must match image 2 with 100% fidelity. 5. AVOID: over-saturation, extreme HDR, over-sharpening, or artificial CG look. Aim for a natural, authentic drone shot feel.";
      } else if (angle === 'detail') {
        prompt = "MACRO PRODUCT DETAIL: Create an extreme close-up of the system window from image 1. Focus on the 'internal pattern' (局部纹路特写). 1. Show the precise joinery of the decorative grilles. 2. Highlight the surface texture (e.g., fine sand grain, wood grain). 3. Show the interaction between the patterned grilles and the glass texture. 4. Professional studio lighting on a neutral background.";
      }

      // Merge SaaS Context and Prompts
      const mergedPrompt = [
        prompt,
        saasContext ? `Background Context: ${saasContext}` : "",
        saasPrompts.length > 0 ? `Style Keywords: ${saasPrompts.join(', ')}` : ""
      ].filter(Boolean).join('. ');

      const payload: any = {
        prompt: mergedPrompt,
        aspectRatio: ratio,
        imageSize: mapResolutionToGeminiSize(resolution),
        images: isDetail ? [{ image_url: productImage }] : [{ image_url: villaImage }, { image_url: productImage }]
      };

      const aiRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-3.1-flash-image-preview",
          payload
        }),
      });

      const aiData = await readJsonResponse(aiRes);
      const b64 = aiData.data[0].b64_json;
      const finalUrl = `data:image/png;base64,${b64}`;
      setResultImage(finalUrl);

      const newHistoryItem: GeneratedImage = {
        id: Math.random().toString(36).substring(7),
        url: finalUrl,
        angle: angle!,
        timestamp: Date.now(),
        prompt: mergedPrompt,
        size: mapRatioToSize(ratio),
        quality: resolution,
      };
      setHistory(prev => [newHistoryItem, ...prev]);

      // --- Step 3: Standard Results Persistence Flow ---
      if (userId && toolId) {
        // 1. Consume Integral
        try {
          window.parent.postMessage({
            type: 'SAAS_CONSUME',
            userId,
            toolId,
            requestId: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11)
          }, '*');

          const consumeRes = await fetch('/api/tool/consume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, toolId })
          });
          const consumeData = await readJsonResponse(consumeRes);
          setUserIntegral(consumeData.data.currentIntegral);
        } catch (e) {
          console.warn("Consume failed", e);
        }

        // 2. Upload and Commit (Result Persistence)
        try {
          const fetchRes = await fetch(finalUrl);
          const blob = await fetchRes.blob();
          
          const tokenRes = await fetch('/api/upload/direct-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              toolId,
              source: 'result',
              mimeType: blob.type || 'image/png',
              fileName: `result-${Date.now()}.png`,
              fileSize: blob.size
            })
          });
          const token = await readJsonResponse(tokenRes);

          await fetch(token.uploadUrl, {
            method: token.method || 'PUT',
            headers: token.headers,
            body: blob
          });

          const commitRes = await fetch('/api/upload/commit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              toolId,
              source: 'result',
              objectKey: token.objectKey,
              fileSize: blob.size
            })
          });
          await readJsonResponse(commitRes);
          console.log("Result persisted successfully");
        } catch (e) {
          console.error("Persistence error", e);
        }
      }

    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to generate image");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetAll = () => {
    setAngle('default');
    setVillaImage(null);
    setProductImage(null);
    setResultImage(null);
  };

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={resetAll}>
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
              <Layout size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">AI Window</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Architectural Suite</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {userId && (
              <>
                {/* Desktop Account Info */}
                <div className="hidden md:flex items-center space-x-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Account</span>
                    <span className="text-xs font-bold text-slate-700">{userName || userId}</span>
                  </div>
                  <div className="w-px h-6 bg-slate-200" />
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                      <Coins size={14} />
                    </div>
                    <span className="text-sm font-bold text-amber-600">{userIntegral}</span>
                  </div>
                </div>
                {/* Mobile Integral Only */}
                <div className="flex md:hidden items-center space-x-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                  <Coins size={14} className="text-amber-600" />
                  <span className="text-xs font-bold text-amber-600">{userIntegral}</span>
                </div>
              </>
            )}
            <button 
              onClick={() => setShowHistoryPanel(!showHistoryPanel)} 
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors relative group"
            >
              <History size={20} />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center">
                {history.length}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8">
        <AnimatePresence mode="wait">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-6 items-stretch"
          >
            {/* Villa Scene block */}
            <div className="lg:col-span-5">
              {angle !== 'detail' ? (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 h-full">
                  <div className="flex items-center space-x-2 text-slate-900 font-bold border-b border-slate-100 pb-4">
                    <Camera size={20} className="text-blue-600" />
                    <span>
                      {angle === 'default' && "别墅场景图 (别墅外观)"}
                      {angle === 'interior' && "别墅场景图 (别墅室内)"}
                      {angle === 'high' && "别墅场景图 (别墅俯视)"}
                    </span>
                  </div>
                  <div className="relative aspect-video bg-white border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden group hover:border-blue-400 transition-colors">
                    {villaImage ? (
                      <>
                        <img src={villaImage} className="w-full h-full object-cover" alt="Villa" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <label className="cursor-pointer bg-white text-slate-900 px-4 py-2 rounded-full text-sm font-bold shadow-lg leading-none">
                            重新上传
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'villa')} />
                          </label>
                        </div>
                      </>
                    ) : (
                      <label className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center p-6 text-center">
                        <Upload className="mb-4 text-slate-400 group-hover:text-blue-500 transition-colors" size={48} />
                        <span className="text-slate-900 font-bold">
                          {angle === 'default' && "点击上传别墅外观图"}
                          {angle === 'interior' && "点击上传别墅室内图"}
                          {angle === 'high' && "点击上传别墅俯视图"}
                        </span>
                        <span className="text-slate-400 text-[10px] mt-2 px-4 leading-tight">支持 JPG, PNG, WebP，最大 20MB</span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'villa')} />
                      </label>
                    )}
                  </div>
                </div>
              ) : (
                <div className="aspect-video h-full bg-slate-50 border border-dashed border-slate-200 rounded-3xl flex items-center justify-center p-8 text-center">
                  <p className="text-slate-400 text-sm">细节视角模式下无需上传别墅场景图</p>
                </div>
              )}
            </div>

            {/* Unified Control Panel (Right) spans 3 logical rows to align with Info Card bottom */}
            <div className="lg:col-span-7 lg:row-span-3">
              <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-8 h-full flex flex-col">
                <div className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar">
                  {/* Viewport Selection */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 text-slate-900 font-bold border-b border-slate-100 pb-4">
                      <Layout size={20} className="text-blue-600" />
                      <span>选择视角</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'default', label: '别墅外观' },
                        { id: 'interior', label: '别墅室内' },
                        { id: 'high', label: '模拟俯拍' },
                        { id: 'detail', label: '局部细节' },
                      ].map((v) => (
                        <button
                          key={v.id}
                          onClick={() => {
                            setAngle(v.id as ViewAngle);
                            setVillaImage(null);
                            setProductImage(null);
                            setResultImage(null);
                          }}
                          className={`py-3 px-4 rounded-xl text-sm font-bold transition-all border ${
                            angle === v.id 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100' 
                              : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                          }`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Generation Configuration */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div className="flex items-center space-x-2 text-slate-900 font-bold">
                        <Settings2 size={20} className="text-blue-600" />
                        <span>生成配置</span>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-4">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">图片质量</label>
                        <div className="flex space-x-1">
                          {['1k', '2k', '4k'].map((res) => (
                            <button
                              key={res}
                              onClick={() => setResolution(res)}
                              className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
                                resolution === res ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                              }`}
                            >
                              {res.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">画面比例</label>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                          {['1:1', '3:4', '4:3', '16:9'].map((r) => (
                            <button
                              key={r}
                              onClick={() => setRatio(r)}
                              className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
                                ratio === r ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Generate Button Integrated */}
                  <div className="pt-2">
                    <button
                      disabled={isGenerating || !productImage || (angle !== 'detail' && !villaImage)}
                      onClick={generateImage}
                      className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold flex flex-col items-center justify-center space-y-1 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 active:scale-95"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="animate-spin" size={24} />
                          <span className="text-sm">正在重绘场景...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw size={24} />
                          <span className="text-sm">立即生成设计方案</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* History Section Integrated */}
                  <div className="space-y-6 pt-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center">
                        <History size={16} className="mr-2 text-blue-600" />
                        历史记录
                      </h3>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{history.length} ITEMS</span>
                    </div>
                    {history.length > 0 ? (
                      <div className="grid grid-cols-4 gap-3">
                        {history.slice(0, 4).map((item) => (
                          <div key={item.id} className="group relative aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200 cursor-pointer shadow-sm hover:shadow-md transition-all">
                            <img src={item.url} className="w-full h-full object-cover" alt="History" />
                            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center space-y-1.5 p-2 text-center text-white">
                              <button 
                                onClick={() => setPreviewImage(item)}
                                className="bg-white/20 hover:bg-white/30 backdrop-blur px-2 py-1 rounded text-[10px] font-bold w-full uppercase"
                              >
                                预览
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-center text-slate-400 text-xs">
                        暂无历史生成记录
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Product Sample block (Left, Row 2) */}
            <div className="lg:col-span-5">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 h-full">
                <div className="flex items-center space-x-2 text-slate-900 font-bold border-b border-slate-100 pb-4">
                  <ImageIcon size={20} className="text-blue-600" />
                  <span>
                    {angle === 'default' && "系统窗产品样图 (外观样式)"}
                    {angle === 'interior' && "系统窗产品样图 (室内样式)"}
                    {angle === 'high' && "系统窗产品样图 (俯瞰样式)"}
                    {angle === 'detail' && "系统窗产品样图 (细节质感)"}
                  </span>
                </div>
                <div className="relative aspect-video bg-white border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden group hover:border-blue-400 transition-colors">
                  {productImage ? (
                    <>
                      <img src={productImage} className="w-full h-full object-cover" alt="Product" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <label className="cursor-pointer bg-white text-slate-900 px-4 py-2 rounded-full text-sm font-bold shadow-lg leading-none">
                          重新上传
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'product')} />
                        </label>
                      </div>
                    </>
                  ) : (
                    <label className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center p-6 text-center">
                      <Upload className="mb-4 text-slate-400 group-hover:text-blue-500 transition-colors" size={48} />
                      <span className="text-slate-900 font-bold">
                        {angle === 'default' && "点击上传外观样式图"}
                        {angle === 'interior' && "点击上传室内样式图"}
                        {angle === 'high' && "点击上传俯瞰样式图"}
                        {angle === 'detail' && "点击上传产品细节图"}
                      </span>
                      <span className="text-slate-400 text-[10px] mt-2 px-4 leading-tight">支持 JPG, PNG, WebP，最大 20MB</span>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'product')} />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Info Card (Left, Row 3) */}
            <div className="lg:col-span-5 mb-0">
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 h-full">
                <h4 className="text-blue-900 font-bold mb-2 flex items-center">
                  <CheckCircle2 size={16} className="mr-2" />
                  操作指南
                </h4>
                <ul className="text-sm text-blue-800/80 space-y-2">
                  {angle !== 'detail' ? (
                    <>
                      <li>1. 上传您需要装修的别墅原始照片</li>
                      <li>2. 上传您心仪的系统窗产品大样图</li>
                      <li>3. AI将精准替换并统一视觉风格</li>
                    </>
                  ) : (
                    <>
                      <li>1. 上传系统窗产品高清图</li>
                      <li>2. AI将生成局部微距特写，展示材质与工艺细节</li>
                      <li>3. 支持4K超清渲染输出</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Full-Screen Preview Modal */}

      <AnimatePresence>
        {previewImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/95 z-[200] flex items-center justify-center p-4 md:p-8"
          >
            <button 
              onClick={() => setPreviewImage(null)}
              className="absolute top-6 right-6 text-white/60 hover:text-white p-2 transition-colors z-[210]"
            >
              <XCircle size={32} />
            </button>
            <div className="w-full h-full max-w-6xl flex flex-col md:flex-row gap-8 items-center justify-center">
              <div className="flex-1 relative w-full h-full flex items-center justify-center overflow-hidden">
                <motion.img 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  src={previewImage.url} 
                  className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                  alt="Full preview"
                />
              </div>
              <div className="w-full md:w-80 space-y-6 text-white self-center">
                <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/10">
                  <div className="flex items-center space-x-2 text-blue-400 font-bold uppercase tracking-wider text-xs">
                    <CheckCircle2 size={14} />
                    <span>设计参数</span>
                  </div>
                  <div className="space-y-3 pt-2">
                    <div>
                      <p className="text-white/40 text-[10px] uppercase font-bold">视角方向</p>
                      <p className="text-lg font-medium">{previewImage.angle?.toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-white/40 text-[10px] uppercase font-bold">规格尺寸</p>
                      <p className="text-lg font-medium">{previewImage.size} · {previewImage.quality}</p>
                    </div>
                    <div>
                      <p className="text-white/40 text-[10px] uppercase font-bold">生成时间</p>
                      <p className="text-sm font-medium">{new Date(previewImage.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => downloadImage(previewImage.url, `ai-window-${previewImage.id}`)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center space-x-2 transition-colors"
                  >
                    <Download size={18} />
                    <span>下载设计图</span>
                  </button>
                </div>
                <div className="p-6 bg-white/5 rounded-2xl border border-white/10 hidden md:block">
                  <p className="text-white/40 text-[10px] uppercase font-bold mb-2">生成提示词</p>
                  <p className="text-xs text-white/60 leading-relaxed italic">{previewImage.prompt}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer-like toast or status */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-3 z-[60]"
          >
            <Loader2 className="animate-spin text-blue-400" size={18} />
            <span className="text-sm font-medium">深度学习引擎正在解析空间与光影...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
