import React, { useState, useCallback, useRef } from 'react';
import { 
  FileText, 
  Play, 
  Clock, 
  Copy, 
  CheckCircle, 
  AlertCircle, 
  Bot, 
  Sparkles,
  Terminal,
  Settings,
  ArrowRight,
  StopCircle,
  Download,
  MousePointerClick
} from 'lucide-react';
import { generateMacroScript } from './utils/scriptGenerator';
import { refinePrompts } from './services/gemini';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const App: React.FC = () => {
  const [prompts, setPrompts] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [interval, setInterval] = useState<number>(1.5);
  const [isRefining, setIsRefining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'preview' | 'script'>('upload');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse MD content to find code blocks: ```text```
  const parseMarkdown = (text: string) => {
    const regex = /```([\s\S]*?)```/g;
    const found: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[1] && match[1].trim()) {
        found.push(match[1].trim());
      }
    }
    return found;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsedPrompts = parseMarkdown(content);
      setPrompts(parsedPrompts);
      if (parsedPrompts.length > 0) {
        setActiveTab('preview');
      }
    };
    reader.readAsText(file);
  };

  const handleRefine = async () => {
    setIsRefining(true);
    const refined = await refinePrompts(prompts);
    setPrompts(refined);
    setIsRefining(false);
  };

  const generatedScript = generateMacroScript(prompts, interval);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAllAsTxt = () => {
    const script = generateMacroScript(prompts, interval);
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, 'macro_all.txt');
  };

  const downloadSplitAsZip = async () => {
    const zip = new JSZip();
    
    // Group prompts by worksheet name
    const groups: Record<string, string[]> = {};
    prompts.forEach((p, i) => {
      const lines = p.trim().split('\n');
      const lastLine = lines[lines.length - 1].trim();
      
      let groupName = `Group_${i+1}`;
      
      // Try to extract worksheet name (e.g., between "输出" and "开头的工作表")
      const match = lastLine.match(/输出\s*(.*?)\s*开头的工作表/);
      if (match && match[1]) {
        groupName = match[1].trim();
      } else {
        // Try to find KYLO pattern as fallback
        const kyloMatch = lastLine.match(/(KYLO_[a-zA-Z0-9_ -]+)/);
        if (kyloMatch && kyloMatch[1]) {
            groupName = kyloMatch[1].trim();
        } else {
            // Fallback: remove row numbers to group them together
            const cleanedLine = lastLine.replace(/数值为\s*\d+\s*到\s*\d+/g, '').trim();
            groupName = cleanedLine.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100).trim() || `Group_${i+1}`;
        }
      }
      
      // Ensure valid filename
      groupName = groupName.replace(/[\\/:*?"<>|]/g, '_');

      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(p);
    });

    Object.entries(groups).forEach(([groupName, groupPrompts], index) => {
      const script = generateMacroScript(groupPrompts, interval);
      const fileName = `${groupName || 'part_' + (index + 1)}.txt`;
      zip.file(fileName, script);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'macro_split.zip');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">AutoMonitor</h1>
              <p className="text-xs text-slate-500 font-medium">NotebookLM Automation & Audit Tool</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-600">
             <span className="hidden md:flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>Interval: {interval}m</span>
             </span>
             <a 
               href="https://notebooklm.google.com/" 
               target="_blank" 
               rel="noreferrer"
               className="text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
             >
               Open NotebookLM <ArrowRight className="w-4 h-4"/>
             </a>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-8">
        
        {/* Progress Stepper */}
        <div className="mb-8 flex items-center justify-center">
           <div className="flex items-center gap-2">
             <button 
               onClick={() => setActiveTab('upload')}
               className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === 'upload' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
             >
               1. Upload MD
             </button>
             <div className="w-8 h-[2px] bg-slate-200"></div>
             <button 
               onClick={() => prompts.length > 0 && setActiveTab('preview')}
               disabled={prompts.length === 0}
               className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === 'preview' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 disabled:opacity-50'}`}
             >
               2. Review & Refine
             </button>
             <div className="w-8 h-[2px] bg-slate-200"></div>
             <button 
               onClick={() => prompts.length > 0 && setActiveTab('script')}
               disabled={prompts.length === 0}
               className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === 'script' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 disabled:opacity-50'}`}
             >
               3. Get Macro
             </button>
           </div>
        </div>

        {/* CONTENT AREA */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[500px] overflow-hidden">
          
          {/* TAB 1: UPLOAD */}
          {activeTab === 'upload' && (
            <div className="p-12 flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                <FileText className="w-10 h-10 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Upload your Prompt Script</h2>
              <p className="text-slate-500 mb-8 max-w-md">
                Select the markdown (.md) file containing your medical review prompts. 
                Prompts must be enclosed in triple backticks (```).
              </p>
              
              <input 
                type="file" 
                accept=".md,.txt" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden"
              />
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-xl font-semibold shadow-lg shadow-slate-200 transition-all transform hover:-translate-y-1 flex items-center gap-2"
              >
                <FileText className="w-5 h-5" />
                Select Markdown File
              </button>
              
              <p className="mt-8 text-xs text-slate-400">
                Compatible with standard Markdown editors.
              </p>
            </div>
          )}

          {/* TAB 2: PREVIEW */}
          {activeTab === 'preview' && (
            <div className="p-8 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                   <h2 className="text-xl font-bold text-slate-800">Detected Prompts ({prompts.length})</h2>
                   <p className="text-sm text-slate-500">From file: {fileName}</p>
                </div>
                <div className="flex gap-2">
                   <button 
                     onClick={handleRefine}
                     disabled={isRefining}
                     className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                   >
                     {isRefining ? (
                       <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                     ) : (
                       <Sparkles className="w-4 h-4" />
                     )}
                     Optimize with Gemini
                   </button>
                   <button 
                     onClick={() => setActiveTab('script')}
                     className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
                   >
                     Next: Generate Macro <ArrowRight className="w-4 h-4" />
                   </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 max-h-[500px]">
                {prompts.length === 0 ? (
                  <div className="text-center py-20 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    <p className="text-slate-500">No prompts found in the file.</p>
                    <p className="text-xs text-slate-400 mt-2">Ensure text is wrapped in ```code blocks```.</p>
                  </div>
                ) : (
                  prompts.map((prompt, idx) => (
                    <div key={idx} className="group relative bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-indigo-200 transition-colors">
                      <div className="absolute top-4 right-4 text-xs font-mono text-slate-400 bg-white px-2 py-1 rounded border border-slate-100">
                        #{idx + 1}
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-mono">
                        {prompt}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SCRIPT GENERATOR */}
          {activeTab === 'script' && (
            <div className="p-8 grid lg:grid-cols-2 gap-8 h-full">
              
              {/* Left: Settings & Instructions */}
              <div className="flex flex-col gap-6">
                <div>
                   <h2 className="text-xl font-bold text-slate-800 mb-2">Configure & Run</h2>
                   <p className="text-sm text-slate-500">
                     Since we cannot control the Google tab directly from here for security reasons, 
                     we generated a secure automation macro for you.
                   </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Time Interval (Minutes)
                  </label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" 
                      min="0.5" 
                      max="10" 
                      step="0.5"
                      value={interval}
                      onChange={(e) => setInterval(parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="w-16 px-3 py-1 bg-indigo-50 text-indigo-700 font-mono text-sm rounded-md text-center font-bold">
                      {interval}m
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                   <h3 className="text-sm font-bold text-slate-800">Export Options</h3>
                   <button 
                     onClick={downloadAllAsTxt}
                     className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                   >
                     <Download className="w-4 h-4" />
                     Download All as TXT (Output 1)
                   </button>
                   <button 
                     onClick={downloadSplitAsZip}
                     className="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                   >
                     <Download className="w-4 h-4" />
                     Download Split as ZIP (Output 2)
                   </button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-slate-500" />
                    How to use this macro:
                  </h3>
                  <ol className="space-y-3 text-sm text-slate-600">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">1</span>
                      <span>Click the <strong>Copy Code</strong> button on the right.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">2</span>
                      <span>Go to your open NotebookLM tab.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">3</span>
                      <span>Press <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 font-sans text-xs">F12</kbd> (Console), Paste & Enter.</span>
                    </li>
                  </ol>
                  
                  <div className="flex flex-col gap-2">
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex gap-2 items-start text-xs text-indigo-800">
                      <MousePointerClick className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        <strong>Control Panel:</strong> A control panel will appear on the top-right of the NotebookLM page.
                      </p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 items-start text-xs text-red-800">
                      <StopCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        <strong>To Stop & Save:</strong> Click the red <strong>"Stop & Save"</strong> button on the screen. <br/>
                        <span className="font-bold">Do not refresh the page</span> if you want to save the transcript.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Code Block */}
              <div className="relative group">
                <div className="absolute -top-3 left-4 bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-sm z-10 font-mono">
                  macro.js
                </div>
                <div className="bg-slate-900 rounded-xl overflow-hidden shadow-2xl h-full flex flex-col">
                  <div className="flex justify-between items-center p-2 bg-slate-800 border-b border-slate-700">
                     <div className="flex gap-1.5 px-2">
                       <div className="w-3 h-3 rounded-full bg-red-500" />
                       <div className="w-3 h-3 rounded-full bg-yellow-500" />
                       <div className="w-3 h-3 rounded-full bg-green-500" />
                     </div>
                     <button 
                      onClick={copyToClipboard}
                      className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-md transition-all"
                     >
                       {copied ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                       {copied ? "Copied!" : "Copy Code"}
                     </button>
                  </div>
                  <pre className="flex-1 p-4 text-xs font-mono text-indigo-200 overflow-auto whitespace-pre leading-relaxed custom-scrollbar">
                    <code>{generatedScript}</code>
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;