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

  // --- Sidebar States ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
        prompt = "ARCHITECTURAL TRANSFORMATION: 1. STRICTLY PRESERVE the exact number, placement, and layout of windows from image 1. 2. REPLACE all windows with the EXACT model from image 2. 3. VISUAL FIDELITY: Replicate the EXACT frame color, metallic finish, and internal mullion/grille patterns from image 2. Do not add any decorative elements not present in image 2. 4. Enhance the building facade to a high-end luxury finish while maintaining its original structure. 5. Final output must look like a high-quality architectural photograph.";
      } else if (angle === 'interior') {
        prompt = "ARCHITECTURAL INTERIOR RE-DESIGN: 1. PRESERVE the exact window boundaries and counts from image 1. 2. APPLY the EXACT window system from image 2, matching its frame thickness, metallic texture, and specific grille patterns (vertical, horizontal, or decorative). 3. MATCH the glass transparency and hardware details from image 2. 4. Transform the interior into a luxury space with high-end furniture and materials that complement the window style. 5. Maintain professional lighting and photorealistic quality.";
      } else if (angle === 'high') {
        prompt = "DRONE PERSPECTIVE TRANSFORMATION: 1. PRESERVE the villa's original structural layout from image 1. 2. REPLACE all windows with the EXACT system shown in image 2. 3. CLONE the specific frame color, patterns, and material properties from image 2. 4. Upgrade the surrounding environment and building facade to a premium finish. 5. Ensure the result is a realistic drone-shot photo with perfect architectural integration.";
      } else if (angle === 'detail') {
        prompt = "MACRO PRODUCT RENDERING: 1. Create a high-fidelity macro close-up of the product from image 1. 2. Replicate the EXACT textures, joinery details, and material finish. 3. Focus on the craftsmanship and structural precision. 4. Professional studio lighting on a clean, high-end background.";
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
      setPreviewImage(newHistoryItem);

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
    <div className="min-h-screen bg-[#f8fbfa] flex flex-col md:flex-row text-slate-900 font-sans">
      {/* Left Sidebar Section */}
      <aside className={`w-full ${isSidebarCollapsed ? 'md:w-16' : 'md:w-64'} bg-white border-b md:border-b-0 md:border-r border-slate-100 ${isSidebarCollapsed ? 'p-3' : 'p-5'} flex flex-col justify-between shrink-0 md:h-screen md:sticky md:top-0 transition-all duration-300 z-45`}>
        <div className="space-y-6">
          {/* Logo & Brand */}
          <div className={`flex ${isSidebarCollapsed ? 'flex-col space-y-4 items-center' : 'items-center justify-between'} w-full`}>
            <div className="flex items-center space-x-2 cursor-pointer" onClick={resetAll}>
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-100 shrink-0">
                <Layout size={18} className="stroke-[2.5]" />
              </div>
              {!isSidebarCollapsed && (
                <div className="flex flex-col">
                  <h1 className="text-sm font-black tracking-tight text-slate-900 leading-none">AI Window</h1>
                  <p className="text-[8px] text-slate-400 uppercase tracking-widest font-black">Architectural Suite</p>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-850 rounded-lg transition-all border border-slate-100 hidden md:inline-flex items-center justify-center"
              title={isSidebarCollapsed ? "展开菜单" : "收起菜单"}
            >
              <ChevronRight size={14} className={`transform transition-transform duration-300 ${isSidebarCollapsed ? '' : 'rotate-180'}`} />
            </button>
          </div>

          {/* Navigation Menu Header */}
          <div className="space-y-2">
            {!isSidebarCollapsed && (
              <div className="px-1 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center md:text-left">
                导航菜单
              </div>
            )}
            
            {/* View selectors styled as navigation tabs */}
            <div className="flex flex-col space-y-1">
              {[
                { id: 'default', label: '室外默认场景', sub: '替换原有建筑面窗户', icon: <Layout size={16} /> },
                { id: 'interior', label: '室内场景', sub: '阳光房与室内全景重塑', icon: <Home size={16} /> },
                { id: 'high', label: '高空俯拍视角', sub: '无人机高视角融合', icon: <Maximize size={16} /> },
                { id: 'detail', label: '产品局部细节', sub: '型材剖面与特写超分', icon: <Box size={16} /> },
              ].map((v) => {
                const isActive = angle === v.id;
                return (
                  <button
                    key={v.id}
                    title={v.label}
                    onClick={() => {
                      setAngle(v.id as ViewAngle);
                      setVillaImage(null);
                      setProductImage(null);
                      setResultImage(null);
                    }}
                    className={`w-full transition-all duration-200 group flex ${
                      isSidebarCollapsed 
                        ? 'items-center justify-center p-2.5 rounded-lg' 
                        : 'flex-col space-y-0.5 p-2.5 rounded-xl text-center md:text-left'
                    } ${
                      isActive 
                        ? 'bg-[#f4f7f6] text-blue-600 border border-slate-100 shadow-sm' 
                        : 'bg-transparent text-slate-500 hover:text-slate-850 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2 w-full justify-center md:justify-start">
                      <span className={`${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                        {v.icon}
                      </span>
                      {!isSidebarCollapsed && (
                        <span className={`text-xs font-bold leading-none ${isActive ? 'text-blue-650 font-black' : 'text-slate-700'}`}>
                          {v.label}
                        </span>
                      )}
                    </div>
                    {!isSidebarCollapsed && (
                      <span className="text-[9px] text-slate-400 font-medium pl-0 md:pl-6 block truncate w-full text-center md:text-left mt-0.5 md:mt-0">
                        {v.sub}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Info Card block (Operation Guide) */}
          {!isSidebarCollapsed && (
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-50 space-y-2.5">
              <h4 className="text-blue-900 font-bold flex items-center border-b border-blue-100/20 pb-1.5 text-[11px]">
                <CheckCircle2 size={12} className="mr-1 text-blue-600" />
                <span>操作指南</span>
              </h4>
              <ul className="text-[10px] text-blue-950/80 space-y-1.5 leading-relaxed">
                {angle !== 'detail' ? (
                  <>
                    <li className="flex items-start gap-1">
                      <span className="flex items-center justify-center w-3 h-3 rounded-full bg-blue-100 text-blue-600 text-[8px] font-bold shrink-0 mt-0.5">1</span>
                      <span>上传别墅原始照片</span>
                    </li>
                    <li className="flex items-start gap-1">
                      <span className="flex items-center justify-center w-3 h-3 rounded-full bg-blue-100 text-blue-600 text-[8px] font-bold shrink-0 mt-0.5">2</span>
                      <span>上传系统窗产品样图</span>
                    </li>
                    <li className="flex items-start gap-1">
                      <span className="flex items-center justify-center w-3 h-3 rounded-full bg-blue-100 text-blue-600 text-[8px] font-bold shrink-0 mt-0.5">3</span>
                      <span>AI智能完美融合替换</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start gap-1">
                      <span className="flex items-center justify-center w-3 h-3 rounded-full bg-blue-100 text-blue-600 text-[8px] font-bold shrink-0 mt-0.5">1</span>
                      <span>上传材料/型材切角特写</span>
                    </li>
                    <li className="flex items-start gap-1">
                      <span className="flex items-center justify-center w-3 h-3 rounded-full bg-blue-100 text-blue-600 text-[8px] font-bold shrink-0 mt-0.5">2</span>
                      <span>AI渲染高保真材质重绘</span>
                    </li>
                  </>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* User Card at the very bottom */}
        {userId && (
          <div className={`mt-6 ${isSidebarCollapsed ? 'p-1.5 flex flex-col items-center justify-center space-y-2' : 'p-3.5 space-y-2.5 bg-[#f8fcfb] rounded-xl border border-slate-50'} transition-all`}>
            {isSidebarCollapsed ? (
              <div className="flex flex-col items-center space-y-1.5" title={`${userName || userId}: ${userIntegral} 积分`}>
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-50 shrink-0">
                  <User size={14} />
                </div>
                <div className="flex items-center space-x-0.5 text-amber-600 text-[10px] font-bold">
                  <span>{userIntegral}分</span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-50 shrink-0">
                    <User size={14} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-800 truncate">{userName || userId}</span>
                    <span className="text-[9px] text-slate-400 font-medium">体验用户</span>
                  </div>
                </div>
                
                <div className="h-px bg-slate-50" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-amber-600">
                    <Coins size={13} />
                    <span className="text-[11px] font-bold">{userIntegral} 积分</span>
                  </div>
                  <span className="text-[8px] text-slate-400 font-medium">10分/次</span>
                </div>
              </>
            )}
          </div>
        )}
      </aside>

      {/* Main Workspace content */}
      <main className="flex-1 overflow-y-auto px-6 py-10 lg:px-12">
        <div className="max-w-[1300px] mx-auto w-full">
          {/* Workspace Header */}
          <div className="mb-8 space-y-2">
            <h2 className="text-3xl font-black tracking-tight text-slate-900">
              {angle === 'default' && "构图分析与产品无缝融合替换"}
              {angle === 'interior' && "风格直接融合生成"}
              {angle === 'high' && "模拟俯拍与产品融合"}
              {angle === 'detail' && "型材剖面与产品局部细节重绘"}
            </h2>
            <p className="text-sm text-slate-500 max-w-3xl leading-relaxed">
              {angle === 'detail' 
                ? "上传系统窗或型材切面特写大图，自动极佳生成局部纹理特写。无需上传别墅场景图。" 
                : "上传一张参考构图图片，自动识别要保留的背景与环境元素，并把您的新产品无缝替换融合进去。"}
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-6 items-stretch w-full"
            >
              {/* Column 2: Middle Pane (Upload original scene and product sample in a compact side-by-side layout) */}
              <div className={`lg:col-span-8 flex flex-col justify-start gap-4 ${angle === 'detail' ? 'max-w-xl mx-auto w-full' : ''}`}>
                {angle !== 'detail' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch w-full">
                    {/* Step 1: Villa Scene block */}
                    <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/50 shadow-sm flex flex-col justify-between space-y-3">
                      <div className="flex items-center space-x-2 text-slate-800 font-bold border-b border-slate-50 pb-2.5">
                        <Camera size={16} className="text-blue-600 shrink-0" />
                        <span className="text-xs md:text-sm">
                          步骤 1: 上传场景图 (环境光影参考)
                        </span>
                      </div>
                      <div className="relative aspect-[4/3] bg-slate-50 border-2 border-dashed border-slate-200/60 rounded-xl overflow-hidden group hover:border-blue-500 transition-colors flex-1 flex items-center justify-center">
                        {villaImage ? (
                          <>
                            <img src={villaImage} className="w-full h-full object-cover" alt="Villa" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <label className="cursor-pointer bg-white text-slate-950 px-4 py-2 rounded-full text-xs font-bold shadow-lg leading-none">
                                重新上传
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'villa')} />
                              </label>
                            </div>
                          </>
                        ) : (
                          <label className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center p-4 text-center">
                            <Upload className="mb-2 text-slate-400 group-hover:text-blue-500 transition-colors" size={30} />
                            <span className="text-slate-900 font-bold text-xs">
                              点击或拖拽上传
                            </span>
                            <span className="text-slate-400 text-[10px] mt-1 px-4 leading-tight">支持 JPG, PNG, WebP，最大 20MB</span>
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'villa')} />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Step 2: Product Sample block */}
                    <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/50 shadow-sm flex flex-col justify-between space-y-3">
                      <div className="flex items-center space-x-2 text-slate-800 font-bold border-b border-slate-50 pb-2.5">
                        <ImageIcon size={16} className="text-blue-600 shrink-0" />
                        <span className="text-xs md:text-sm">
                          步骤 2: 上传您的产品图
                        </span>
                      </div>
                      <div className="relative aspect-[4/3] bg-slate-50 border-2 border-dashed border-slate-200/60 rounded-xl overflow-hidden group hover:border-blue-500 transition-colors flex-1 flex items-center justify-center">
                        {productImage ? (
                          <>
                            <img src={productImage} className="w-full h-full object-cover" alt="Product" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <label className="cursor-pointer bg-white text-slate-950 px-4 py-2 rounded-full text-xs font-bold shadow-lg leading-none">
                                重新上传
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'product')} />
                              </label>
                            </div>
                          </>
                        ) : (
                          <label className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center p-4 text-center">
                            <Upload className="mb-2 text-slate-400 group-hover:text-blue-500 transition-colors" size={30} />
                            <span className="text-slate-900 font-bold text-xs font-black">
                              点击或拖拽上传
                            </span>
                            <span className="text-slate-400 text-[10px] mt-1 px-4 leading-tight">支持 JPG, PNG, WebP，最大 20MB</span>
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'product')} />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* angle === 'detail' -> Single Step 2 block, beautifully centered and not stretched */
                  <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/50 shadow-sm space-y-3 max-w-xl mx-auto w-full">
                    <div className="flex items-center space-x-2 text-slate-800 font-bold border-b border-slate-50 pb-2.5">
                      <ImageIcon size={16} className="text-blue-600 shrink-0" />
                      <span className="text-xs md:text-sm">
                        上传您的产品图 (细节质感)
                      </span>
                    </div>
                    <div className="relative aspect-video bg-slate-50 border-2 border-dashed border-slate-200/60 rounded-xl overflow-hidden group hover:border-blue-500 transition-colors">
                      {productImage ? (
                        <>
                          <img src={productImage} className="w-full h-full object-cover" alt="Product" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <label className="cursor-pointer bg-white text-slate-950 px-4 py-2 rounded-full text-xs font-bold shadow-lg leading-none">
                              重新上传
                              <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'product')} />
                            </label>
                          </div>
                        </>
                      ) : (
                        <label className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center p-4 text-center">
                          <Upload className="mb-2 text-slate-400 group-hover:text-blue-500 transition-colors" size={30} />
                          <span className="text-slate-900 font-bold text-xs font-black">
                            点击或拖拽上传
                          </span>
                          <span className="text-slate-400 text-[10px] mt-1 px-4 leading-tight">支持 JPG, PNG, WebP，最大 20MB</span>
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'product')} />
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Column 3: Right Sidebar Pane (Configuration Parameters & Generate Button) */}
              <div className="lg:col-span-4 space-y-4">
                {/* Generation Configuration & Generate Button */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center space-x-2 text-slate-900 font-bold">
                      <Settings2 size={16} className="text-blue-600 shrink-0" />
                      <span className="text-xs font-black">配置中心 / 设置参数</span>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">画面分辨率</label>
                      <div className="flex space-x-1 p-1 bg-slate-50 rounded-xl">
                        {['1k', '2k', '4k'].map((res) => (
                          <button
                            key={res}
                            onClick={() => setResolution(res)}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all ${
                              resolution === res 
                                ? 'bg-slate-900 text-white shadow-md' 
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <span translate="no" className="notranslate">{res.toUpperCase()}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">画面比例</label>
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl">
                        {['1:1', '3:4', '4:3', '16:9'].map((r) => (
                          <button
                            key={r}
                            onClick={() => setRatio(r)}
                            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center ${
                              ratio === r 
                                ? 'bg-slate-900 text-white shadow-md' 
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Generate Button */}
                  <div className="pt-2">
                    <button
                      disabled={isGenerating || !productImage || (angle !== 'detail' && !villaImage)}
                      onClick={generateImage}
                      className="w-full py-4.5 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl font-bold flex flex-col items-center justify-center space-y-0.5 transition-all shadow-xl shadow-blue-100 active:scale-[0.98]"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="animate-spin" size={20} />
                          <span className="text-xs">正在重绘场景...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw size={20} />
                          <span className="text-xs">立即生成设计方案</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

            {/* History Section directly underneath at full width spanning 12 columns */}
            <div className="lg:col-span-12 mt-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center">
                  <History size={16} className="mr-2 text-blue-600" />
                  生成历史
                </h3>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-100 px-2.5 py-0.5 rounded-full">{history.length}</span>
              </div>
              {history.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {history.slice(0, 16).map((item) => (
                    <div key={item.id} className="group relative aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200 cursor-pointer shadow-sm hover:shadow-md transition-all">
                      <img src={item.url} className="w-full h-full object-cover" alt="History" />
                      <div className="absolute inset-0 bg-slate-900/65 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center text-white">
                        <button 
                          onClick={() => setPreviewImage(item)}
                          className="bg-white text-slate-900 hover:bg-slate-100 px-2 py-1 rounded text-[10px] font-bold w-full uppercase shadow text-center"
                        >
                          预览
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-center text-slate-400 text-sm">
                  暂无历史生成记录
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
        </div>
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
