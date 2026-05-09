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

const StepIndicator = ({ currentStep }: { currentStep: number }) => {
  const steps = ['选择视角', '上传素材', 'AI 生成'];
  return (
    <div className="flex items-center justify-center space-x-4 mb-8">
      {steps.map((step, idx) => (
        <React.Fragment key={step}>
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              currentStep >= idx + 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {idx + 1}
            </div>
            <span className={`text-sm font-medium ${currentStep >= idx + 1 ? 'text-slate-900' : 'text-slate-400'}`}>
              {step}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`w-12 h-px ${currentStep > idx + 1 ? 'bg-blue-600' : 'bg-slate-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default function App() {
  const [step, setStep] = useState(1);
  const [angle, setAngle] = useState<ViewAngle | null>(null);
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

  const fetchLaunchInfo = useCallback(async (uId: string, tId: string) => {
    try {
      const res = await fetch('/api/tool/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uId, toolId: tId })
      });
      const result = await res.json();
      if (result.success) {
        setUserName(result.data.user.name);
        setEnterprise(result.data.user.enterprise);
        setUserIntegral(result.data.user.integral);
        setToolIntegral(result.data.tool.integral);
      }
    } catch (err) {
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
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          throw new Error(verifyData.message || "积分不足");
        }
        setUserIntegral(verifyData.data.currentIntegral);
      }

      const isDetail = angle === 'detail';
      const endpoint = '/api/gemini';
      
      let prompt = "";
      if (angle === 'default') {
        prompt = "ARCHITECTURAL TRANSFORMATION: 1. Use the villa image (image 1) as the structural template. 2. Replace all windows/doors with the EXACT system window model from the product image (image 2). 3. CRITICAL: Replicate the EXACT internal mullion patterns, decorative grilles (如新中式格条), and lattice designs from image 2. 4. Extract exact frame finish, metallic color, and hardware details. 5. If image 1 is interior, beautify walls/furniture; if exterior, upgrade facade to premium stone. 6. Final output must match the intricate window patterns of image 2 perfectly.";
      } else if (angle === 'interior') {
        prompt = "STRICT INTERIOR COMPOSITE: 1. Preserve the window silhouettes from image 1. 2. Apply the EXACT frame profiles and internal decorative grilles (窗棂纹路) from the product image (image 2). 3. Replicate the specific glass texture and transparency. 4. Beautify the space with luxury wall textures and lighting while ensuring the window's internal patterns are the focal point. 5. Maintain high-end architectural rendering quality.";
      } else if (angle === 'high') {
        prompt = "AERIAL BIRD'S-EYE VIEW RENDERING: 1. Use the villa image (image 1) as the absolute structural template for a HIGH-ANGLE (aerial) perspective. 2. Replace all windows/doors with the EXACT system window model and intricate internal patterns (like New Chinese Style lattice) from image 2. 3. Ensure the final result maintains the perspective of image 1 but as a fully finished luxury villa with high-end landscaping (gardens, pools) seen from above. 4. The window frame colors, textures, and decorative grilles must match image 2 with 100% fidelity. 5. High-end promotional architectural visualization quality.";
      } else if (angle === 'detail') {
        prompt = "MACRO PRODUCT DETAIL: Create an extreme close-up of the system window from image 1. Focus on the 'internal pattern' (局部纹路特写). 1. Show the precise joinery of the decorative grilles (格条工艺). 2. Highlight the surface texture (e.g., fine sand grain, wood grain). 3. Show the interaction between the patterned grilles and the glass texture. 4. Professional studio lighting on a neutral background.";
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

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          payload
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || 'Failed to generate image');
      }

      const b64 = data.data[0].b64_json;
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

      // --- Step 3: Consume Integral ---
      if (userId && toolId) {
        // Option B: postMessage to Parent for consumption as per recommendation
        window.parent.postMessage({
          type: 'SAAS_CONSUME',
          userId,
          toolId,
          requestId: crypto.randomUUID()
        }, '*');

        // Also update locally to keep UI consistent if direct API is preferred or as fallback if parent doesn't reply
        try {
          const consumeRes = await fetch('/api/tool/consume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, toolId })
          });
          const consumeData = await consumeRes.json();
          if (consumeData.success) {
            setUserIntegral(consumeData.data.currentIntegral);
          }
        } catch (e) {
          console.warn("Direct consume call failed, relying on postMessage");
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
    setStep(1);
    setAngle(null);
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
        <StepIndicator currentStep={step} />

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {[
                { id: 'default', label: '默认图', desc: '美化毛胚房', icon: Home, img: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=400' },
                { id: 'interior', label: '屋内视角', desc: '高真实细节展示', icon: Camera, img: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=400' },
                { id: 'high', label: '高视角图', desc: '模拟俯拍别墅', icon: Box, img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=400' },
                { id: 'detail', label: '细节图', desc: '系统窗细节光泽', icon: Maximize, img: 'https://images.unsplash.com/photo-1503708928676-1cb796a0891e?auto=format&fit=crop&q=80&w=400' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setAngle(item.id as ViewAngle);
                    setStep(2);
                  }}
                  className="group relative overflow-hidden bg-white rounded-2xl border border-slate-200 hover:border-blue-500 transition-all text-left shadow-sm hover:shadow-md"
                >
                  <div className="aspect-[4/3] overflow-hidden">
                    <img 
                      src={item.img} 
                      alt={item.label} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                    <item.icon className="mb-2 opacity-80" size={20} />
                    <h3 className="text-lg font-bold">{item.label}</h3>
                    <p className="text-white/60 text-sm">{item.desc}</p>
                  </div>
                </button>
              ))}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Controls Column */}
              <div className="lg:col-span-4 space-y-6">
                <button 
                  onClick={() => setStep(1)}
                  className="flex items-center text-slate-500 hover:text-slate-900 transition-colors mb-4"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  返回视角选择
                </button>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                  <div className="flex items-center space-x-2 text-slate-900 font-bold border-b border-slate-100 pb-4">
                    <Settings2 size={20} />
                    <span>生成配置</span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">规格 (Quality)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['1k', '2k', '4k'].map((res) => (
                        <button
                          key={res}
                          onClick={() => setResolution(res)}
                          className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                            resolution === res ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">尺寸 (Aspect Ratio)</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['1:1', '3:4', '4:3', '16:9'].map((r) => (
                        <button
                          key={r}
                          onClick={() => setRatio(r)}
                          className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                            ratio === r ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    disabled={isGenerating || !productImage || (angle !== 'detail' && !villaImage)}
                    onClick={generateImage}
                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center space-x-2 disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="animate-spin" size={20} />
                        <span>AI 生成中...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw size={20} />
                        <span>开始生成</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Info Card */}
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
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

              {/* Uploads Column */}
              <div className="lg:col-span-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {angle !== 'detail' && (
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-900 flex items-center">
                        <Camera size={18} className="mr-2 text-blue-600" />
                        别墅场景图 (别墅外观/室内)
                      </label>
                      <div className="relative aspect-square bg-white border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden group hover:border-blue-400 transition-colors">
                        {villaImage ? (
                          <>
                            <img src={villaImage} className="w-full h-full object-cover" alt="Villa" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <label className="cursor-pointer bg-white text-slate-900 px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                                重新上传
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'villa')} />
                              </label>
                            </div>
                          </>
                        ) : (
                          <label className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center p-6 text-center">
                            <Upload className="mb-4 text-slate-400 group-hover:text-blue-500 transition-colors" size={48} />
                            <span className="text-slate-900 font-bold">点击上传</span>
                            <span className="text-slate-400 text-[10px] mt-2 px-4 leading-tight">支持常见图片格式（如 JPG, PNG, WebP），最大支持 20MB（通过前端压缩上传）</span>
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'villa')} />
                          </label>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-900 flex items-center">
                      <ImageIcon size={18} className="mr-2 text-blue-600" />
                      产品样式图 (系统窗)
                    </label>
                    <div className="relative aspect-square bg-white border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden group hover:border-blue-400 transition-colors">
                      {productImage ? (
                        <>
                          <img src={productImage} className="w-full h-full object-cover" alt="Product" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <label className="cursor-pointer bg-white text-slate-900 px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                              重新上传
                              <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'product')} />
                            </label>
                          </div>
                        </>
                      ) : (
                        <label className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center p-6 text-center">
                          <Upload className="mb-4 text-slate-400 group-hover:text-blue-500 transition-colors" size={48} />
                          <span className="text-slate-900 font-bold">点击上传</span>
                          <span className="text-slate-400 text-[10px] mt-2 px-4 leading-tight">支持常见图片格式（如 JPG, PNG, WebP），最大支持 20MB（通过前端压缩上传）</span>
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'product')} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {/* Result Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center">
                    <RefreshCw size={20} className="mr-2 text-blue-600" />
                    生成结果
                  </h3>
                  <div className="relative aspect-[16/9] bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 flex items-center justify-center">
                    {isGenerating ? (
                      <div className="flex flex-col items-center space-y-4">
                        <Loader2 className="animate-spin text-blue-600" size={48} />
                        <div className="text-center">
                          <p className="text-slate-900 font-bold">AI 正在深度重绘...</p>
                          <p className="text-slate-500 text-sm">正在优化材质细节与光效</p>
                        </div>
                      </div>
                    ) : resultImage ? (
                      <div className="relative w-full h-full group">
                        <img src={resultImage} alt="Result" className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-4">
                          <button 
                            onClick={() => downloadImage(resultImage, `ai-window-${Date.now()}`)}
                            className="bg-white text-slate-900 p-3 rounded-full hover:scale-110 transition-transform shadow-xl"
                          >
                            <Download size={24} />
                          </button>
                        </div>
                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-blue-600">
                          {resolution} - {angle?.toUpperCase()}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-8">
                        <ImageIcon className="mx-auto mb-4 text-slate-300" size={64} />
                        <p className="text-slate-500 max-w-xs mx-auto">
                          配置好参数并完成素材上传后，点击“开始生成”按钮预览结果
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global History (Bottom) */}
        {history.length > 0 && (
          <div className="mt-16 pt-12 border-t border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center">
                <History size={20} className="mr-2 text-blue-600" />
                最近生成记录
              </h3>
              <button 
                onClick={() => setHistory([])}
                className="text-sm text-slate-400 hover:text-red-500 transition-colors"
              >
                清空所有历史
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {history.map((item) => (
                <div key={item.id} className="group relative aspect-square bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm transition-all hover:shadow-md">
                  <img src={item.url} className="w-full h-full object-cover" alt="History Item" />
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center space-y-2">
                    <button 
                      onClick={() => setPreviewImage(item)}
                      className="text-white text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full backdrop-blur-sm flex items-center"
                    >
                      <Maximize size={12} className="mr-1" />
                      预览
                    </button>
                    <button 
                      onClick={() => downloadImage(item.url, `ai-window-${item.id}`)}
                      className="text-white p-2 rounded-full hover:bg-white/20 transition-colors"
                    >
                      <Download size={20} />
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-[10px] text-white/80 font-medium truncate">{new Date(item.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* History Side Panel */}
      <AnimatePresence>
        {showHistoryPanel && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistoryPanel(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-[101] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <History size={20} className="text-blue-600" />
                  <h3 className="font-bold text-lg">生成历史</h3>
                </div>
                <button onClick={() => setShowHistoryPanel(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <XCircle size={20} className="text-slate-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                    <ImageIcon size={48} className="opacity-20" />
                    <p>暂无生成记录</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div key={item.id} className="relative aspect-video rounded-xl overflow-hidden border border-slate-100 group">
                      <img src={item.url} className="w-full h-full object-cover" alt="History thumbnail" />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-3">
                        <button 
                          onClick={() => {
                            setPreviewImage(item);
                            setShowHistoryPanel(false);
                          }}
                          className="bg-white p-2 rounded-full hover:scale-110 transition-transform shadow-lg"
                        >
                          <Maximize size={18} className="text-slate-900" />
                        </button>
                        <button 
                          onClick={() => downloadImage(item.url, `ai-window-${item.id}`)}
                          className="bg-white p-2 rounded-full hover:scale-110 transition-transform shadow-lg"
                        >
                          <Download size={18} className="text-slate-900" />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-xs text-white/90 font-medium">{new Date(item.timestamp).toLocaleString()}</p>
                        <p className="text-[10px] text-white/60">{item.angle?.toUpperCase()} · {item.size}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
