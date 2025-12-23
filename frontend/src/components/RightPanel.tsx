import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, FileOutput, Send, CheckCircle, Play, ScrollText,
  AlertTriangle, ChevronDown, BarChart3, Table as TableIcon, 
  Filter, Loader2, X, List, CheckSquare, Square
} from 'lucide-react';
import { workflowAPI } from '../utils/api';

interface RightPanelProps {
executionResult: any;
onApplyFlow?: (nodes: any[], edges: any[]) => void;
selectedNodeId?: string | null; 
allNodes?: any[];
onNodeSelect?: (nodeId: string) => void;
flowId?: number; // Passed from Builder
userId?: number; // Passed from Builder
}

// --- CONFIG: STRICT DISPLAY LIST ---
const DISPLAY_ALLOWLIST = [
    'Bar Chart', 'Line Chart', 'Pie/Donut Chart', 'Scatter Plot', 
    'Histogram', 'Heatmap', 'Area Chart', 'KPI Card', 
    'Preview Data', 'Pivot Table', 'Describe Stats', 'Rank', 
    'Correlation', 'Clustering', 'Value Counts', 'Sentiment Analysis', 'Get Data Types',
    'N-Grams', 'Word Count'
];
// --- MINI CHART WIDGET (Compact Version of Report Widget) ---
// --- MINI CHART WIDGET ---
const MiniChartWidget = ({ nodeData }: any) => {
    const { type, config, preview } = nodeData;
    const validData = Array.isArray(preview) ? preview.slice(0, 40) : [];
    if (validData.length === 0) return <div className="p-4 text-center text-xs text-gray-500">No Data</div>;

    const keys = Object.keys(validData[0]);
    const xKey = config.column || keys[0];
    const yKey = config.yAxis || keys.find(k => typeof validData[0][k] === 'number') || keys[1];

    const dataPoints = validData.map((d: any) => ({ x: d[xKey], y: Number(d[yKey]) || 0, label: String(d[xKey]) }));
    const maxVal = Math.max(...dataPoints.map((d:any) => d.y)) || 1;
    const minVal = Math.min(...dataPoints.map((d:any) => d.y)) || 0;

    // PIE
    if (type.includes('Pie') || type.includes('Donut')) {
        const total = dataPoints.reduce((acc:any, curr:any) => acc + curr.y, 0);
        let cumulative = 0;
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
        return (
            <div className="h-40 flex items-center justify-center gap-4">
                <svg viewBox="-1 -1 2 2" className="w-24 h-24" style={{ transform: 'rotate(-90deg)' }}>
                    {dataPoints.map((d:any, i:number) => {
                        if(d.y===0) return null;
                        const start = cumulative;
                        const slice = d.y/total;
                        cumulative += slice;
                        const x1 = Math.cos(2*Math.PI*start), y1 = Math.sin(2*Math.PI*start);
                        const x2 = Math.cos(2*Math.PI*cumulative), y2 = Math.sin(2*Math.PI*cumulative);
                        const large = slice > 0.5 ? 1 : 0;
                        return <path key={i} d={`M 0 0 L ${x1} ${y1} A 1 1 0 ${large} 1 ${x2} ${y2} Z`} fill={colors[i%4]} stroke="#0f172a" strokeWidth="0.05"/>;
                    })}
                    {type.includes('Donut') && <circle cx="0" cy="0" r="0.6" fill="#0f172a" />}
                </svg>
                <div className="text-[10px] space-y-1">
                    {dataPoints.slice(0,4).map((d:any,i:number)=>(
                        <div key={i} className="flex gap-2"><span className="w-2 h-2 rounded-full" style={{background:colors[i%4]}}></span>{d.label.substring(0,8)}</div>
                    ))}
                </div>
            </div>
        );
    }

    // BARS / LINES
    const count = dataPoints.length;
    const points = dataPoints.map((d:any, i:number) => ({
        x: (i/(count-1))*100 || 0.5,
        y: 100 - ((d.y-minVal)/(maxVal-minVal||1))*100
    }));
    const poly = points.map((p:any)=>`${p.x},${p.y}`).join(' ');

    return (
        <div className="h-40 w-full relative pt-2 px-2">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                {(type.includes('Line') || type.includes('Area')) && <polyline points={poly} fill="none" stroke="#3b82f6" strokeWidth="2" />}
                {(type.includes('Bar') || type.includes('Histogram')) && points.map((p:any, i:number) => (
                    <rect key={i} x={p.x - ((100/count)*0.4)} y={p.y} width={(100/count)*0.8} height={100-p.y} fill="#3b82f6" />
                ))}
                {type.includes('Scatter') && points.map((p:any, i:number) => (
                    <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fbbf24" />
                ))}
            </svg>
        </div>
    );
};
const NodeOutputCard = ({ nodeData, startExpanded = false }: { nodeData: any, startExpanded?: boolean }) => {
    const [isExpanded, setIsExpanded] = useState(startExpanded);
    const isChart = nodeData.type.includes('Chart') || nodeData.type.includes('Plot');
    const displayTitle = nodeData.config?.title || nodeData.type;

    const renderCell = (val: any) => {
        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
        return String(val);
    };

    if (!nodeData) return null;

    return (
        <div className="border-b border-gray-800 last:border-0 bg-[#0f172a]">
            <button onClick={() => setIsExpanded(!isExpanded)} className={`w-full flex items-center justify-between p-3 transition-colors text-left ${isExpanded ? 'bg-gray-800/50' : 'hover:bg-gray-800/30'}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded ${isChart ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {isChart ? <BarChart3 size={14}/> : <TableIcon size={14}/>}
                    </div>
                    <div>
                        <div className="text-xs font-bold text-gray-200 uppercase tracking-wide">{displayTitle}</div>
                        <div className="text-[9px] text-gray-500 font-mono">Step {nodeData.id.split('_')[1] || '?'} • {nodeData.type}</div>
                    </div>
                </div>
                <ChevronDown size={14} className={`text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            
            {isExpanded && (
                <div className="p-3 pt-0 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex gap-4 mb-3 text-[10px] text-gray-400 font-medium bg-black/20 p-2 rounded border border-gray-800/50">
                        <span>Rows: <span className="text-white">{nodeData.rows}</span></span>
                        <span>Cols: <span className="text-white">{nodeData.columns?.length || 0}</span></span>
                    </div>
                    {/* --- ADDED: WORD CLOUD SUPPORT --- */}
                    {nodeData.type === 'Word Cloud' ? (
                         nodeData.image ? (
                            <div className="p-4 flex justify-center">
                                <img src={nodeData.image} alt="Word Cloud" className="rounded shadow-sm max-h-[200px]" />
                            </div>
                         ) : <div className="text-xs text-center p-4 text-gray-500">Image Generation Failed</div>
                    ) : isChart ? (
                        <MiniChartWidget nodeData={nodeData} />
                    ) : (
                         // ... Table logic (same as before) ...
                         <div className="overflow-x-auto border border-gray-800 rounded bg-[#020617] max-h-[250px] custom-scrollbar w-full">
                            {/* ... table ... */}
                         </div>
                    )}
                    {isChart ? (
                        <div className="text-gray-500 text-xs text-center p-4 border border-gray-800 rounded bg-[#020617] flex flex-col items-center gap-2">
                            <BarChart3 size={24} className="opacity-50"/>
                            <span>Chart Visualization Ready</span>
                            <span className="text-[10px] opacity-60">(View full chart in Report)</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-gray-800 rounded bg-[#020617] max-h-[300px] custom-scrollbar">
                            <table className="w-full text-xs text-left text-gray-400 whitespace-nowrap">
                                <thead className="bg-gray-800 text-gray-300 sticky top-0">
                                    <tr>
                                        {nodeData.columns.map((c:any) => (
                                            <th key={c} className="p-2 border-b border-gray-700 font-semibold">{c}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(nodeData.preview || []).map((row:any, i:number) => (
                                        <tr key={i} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                                            {nodeData.columns.map((c:any) => (
                                                <td key={c} className="p-2 truncate max-w-[150px] border-r border-gray-800/50 last:border-0">
                                                    {renderCell(row[c])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ... (Rest of RightPanel containing NodeSelectModal and Main Logic - Same as previously provided)
// For space, I assume you can retain the previous NodeSelectModal/Main logic. 
// Just ensure getFilteredOutputs uses DISPLAY_ALLOWLIST defined above.

const NodeSelectModal = ({ isOpen, onClose, nodes, selectedIds, onToggle }: any) => {
    if (!isOpen) return null;
    const safeNodes = Array.isArray(nodes) ? nodes : [];
    return (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#1e293b] border border-gray-700 w-full max-w-sm rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center shrink-0">
                    <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">Select Context Nodes</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded-full transition-colors"><X size={16} className="text-gray-400 hover:text-white"/></button>
                </div>
                <div className="overflow-y-auto custom-scrollbar p-2 space-y-1 flex-1">
                    {safeNodes.length === 0 && <div className="text-center text-gray-500 text-xs py-8">No nodes available.</div>}
                    {safeNodes.map((n: any) => {
                        const isSelected = selectedIds.includes(n.id);
                        return (
                            <button key={n.id} onClick={() => onToggle(n.id)} className={`w-full text-left p-3 border rounded-lg transition-all group flex items-center gap-3 ${isSelected ? 'bg-blue-600/20 border-blue-500/50' : 'bg-transparent border-transparent hover:bg-gray-800'}`}>
                                {isSelected ? <CheckSquare size={16} className="text-blue-400 shrink-0"/> : <Square size={16} className="text-gray-600 shrink-0"/>}
                                <div className="flex flex-col overflow-hidden">
                                    <div className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>{n.data?.typeLabel || n.type}</div>
                                    <div className="text-[10px] text-gray-500 font-mono opacity-70 truncate">{n.id}</div>
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="p-3 border-t border-gray-700 bg-[#0f172a]">
                    <button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg text-xs transition-colors">Done ({selectedIds.length} Selected)</button>
                </div>
            </div>
        </div>
    );
};

const RightPanel = ({ executionResult, onApplyFlow, selectedNodeId, allNodes = [],flowId, userId, onNodeSelect }: RightPanelProps) => {
const [activeTab, setActiveTab] = useState<'ai' | 'outputs' | 'logs'>('ai');
const [aiInput, setAiInput] = useState('');
const [aiMessages, setAiMessages] = useState<any[]>([
    { role: 'assistant', content: "Hi! Select nodes to analyze. I can combine data from multiple steps to build insights." }
]);
const [isAiProcessing, setIsAiProcessing] = useState(false);
const [showNodeModal, setShowNodeModal] = useState(false);

const messagesEndRef = useRef<HTMLDivElement>(null);
// Track context strictly
const [contextNodeIds, setContextNodeIds] = useState<string[]>([]);
const [contextDetails, setContextDetails] = useState<{rows: number, cols: number} | null>(null);

// Load History on Mount (if flow exists)
useEffect(() => {
    if (userId && flowId) {
        workflowAPI.getChatHistory(userId, flowId).then(res => {
            if (res.history && res.history.length > 0) {
                setAiMessages(res.history);
            } else {
                setAiMessages([{ role: 'assistant', content: "Welcome to DataFlow Studio! ." }]);
            }
        });
    } else {
        setAiMessages([{ role: 'assistant', content: "Welcome to DataFlow Studio! ." }]);
    }
}, [flowId, userId]);

useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [aiMessages, isAiProcessing]);
// 1. SYNC SELECTION FROM CANVAS TO AI
useEffect(() => {
    if (selectedNodeId) {
        setContextNodeIds([selectedNodeId]);
        // Calculate context details immediately for UI feedback
        const out = executionResult?.node_outputs?.[selectedNodeId];
        if (out) {
            setContextDetails({ rows: out.rows || 0, cols: out.columns?.length || 0 });
        } else {
            setContextDetails(null); // Node selected but no data run yet
        }
    }
}, [selectedNodeId, executionResult]);


useEffect(() => { if (executionResult?.status === 'success') setActiveTab('outputs'); }, [executionResult]);

const toggleNodeSelection = (id: string) => setContextNodeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

const getContextSummary = () => {
    if (contextNodeIds.length === 0) return null;
    if (contextNodeIds.length === 1) {
        const n = allNodes.find(node => node.id === contextNodeIds[0]);
        return n?.data?.typeLabel || "Unknown Node";
    }
    return `${contextNodeIds.length} Nodes Selected`;
};


const handleSendMessage = async () => {
    if (!aiInput.trim()) return;
    // 1. Optimistic Update
    setAiMessages(prev => [...prev, { role: 'user', content: aiInput }]);
    const currentInput = aiInput;
    setAiInput(''); 
    setIsAiProcessing(true);

    // 2. Gather Data Context
    let contextCols: string[] = [];
    let contextPreview: any[] = [];
    let contextStats: any = {};
    const primaryNodeId = contextNodeIds.length > 0 ? contextNodeIds[0] : null;

    if (primaryNodeId) {
        const output = executionResult?.node_outputs?.[primaryNodeId];
        if (output) {
            contextCols = output.columns || [];
            contextPreview = output.preview || [];
            contextStats = output.stats || {};
        } else {
            const n = allNodes?.find(x => x.id === primaryNodeId);
            if (n?.data.config?.uploadedFiles?.[0]?.columns) {
                contextCols = n.data.config.uploadedFiles[0].columns;
            }
        }
    }

    // 3. Send to API with User ID (Fixes 422 Error)
    try {
        const payload = {
            message: currentInput,
            user_id: userId || 0, // Fallback if 0 (Guest)
            flow_id: flowId || null,
            context: {
                columns: contextCols,
                dataPreview: contextPreview,
                dataStats: contextStats,
                selectedNode: primaryNodeId ? { id: primaryNodeId } : null,
                currentNodes: allNodes // Important for Modification
            }
        };

        const response = await workflowAPI.aiChat(payload);
        
        if (response.type === 'flow_suggestion' && onApplyFlow) {
            setAiMessages(prev => [...prev, { 
                role: 'assistant', 
                content: response.message, 
                action: { label: 'Apply Changes', data: response.flow } 
            }]);
        } else {
            setAiMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
        }
    } catch (err) {
        console.error(err);
        setAiMessages(prev => [...prev, { role: 'assistant', content: "Connection Error (Check Backend)." }]);
    } finally {
        setIsAiProcessing(false);
    }
  };

  const visibleOutputs = executionResult?.node_outputs 
      ? Object.values(executionResult.node_outputs).filter((n:any) => DISPLAY_ALLOWLIST.some(t => n.type.includes(t)))
      : [];
  return (
    <div className="w-96 bg-[#0f172a] border-l border-gray-800 flex flex-col h-full relative shadow-2xl z-40">
      <div className="flex border-b border-gray-800 bg-[#0f172a]">
        {['ai', 'outputs', 'logs'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as any)}
              className={`flex-1 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${activeTab === tab ? 'border-blue-500 text-blue-400 bg-blue-500/5' : 'border-transparent text-gray-400 hover:text-gray-300'}`}>
              {tab === 'ai' ? <span className="flex items-center justify-center gap-2"><Sparkles size={14}/> AI Analyst</span> : tab}
            </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto bg-[#0f172a] relative">
       {activeTab === 'outputs' && (
            <div className="h-full flex flex-col">
                {visibleOutputs.length > 0 ? (
                    visibleOutputs.map((node: any) => <NodeOutputCard key={node.id} nodeData={node} />)
                ) : (
                    <div className="text-center mt-20 text-gray-500 p-8"><Filter size={32} className="mx-auto mb-2 opacity-20"/><p className="text-xs">No results.</p></div>
                )}
            </div>
        )}
        {/*
        {activeTab === 'ai' && (
           <div className="flex flex-col h-full">
             
             {contextNodeIds.length > 0 ? (
                <div className="p-2 bg-blue-900/20 border-b border-blue-800/30 flex items-center justify-between sticky top-0 backdrop-blur-md z-10">
                    <div className="flex items-center gap-2 truncate max-w-[220px]">
                        <CheckCircle size={12} className="text-green-400 shrink-0"/>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide truncate">Analyzing: <span className="text-white">{getContextSummary()}</span></span>
                    </div>
                    <button onClick={() => setShowNodeModal(true)} className="text-[10px] text-blue-400 hover:text-blue-300 underline shrink-0 cursor-pointer">Edit</button>
                </div>
            ) : (
                <button onClick={() => setShowNodeModal(true)} className="w-full text-left p-2 bg-yellow-900/20 border-b border-yellow-800/30 flex items-center justify-between hover:bg-yellow-900/30 transition-colors sticky top-0 backdrop-blur-md z-10 cursor-pointer">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={12} className="text-yellow-400"/>
                        <span className="text-[10px] font-bold text-yellow-200 uppercase tracking-wide">No Node Selected</span>
                    </div>
                    <span className="text-[10px] text-yellow-400 flex items-center gap-1">Select <List size={10}/></span>
                </button>
            )}
             

             <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
                {aiMessages.map((m, i) => (
                    <div key={i} className={`p-3 rounded-lg text-sm ${m.role === 'user' ? 'bg-blue-600 ml-10 text-white' : 'bg-gray-800 mr-10 text-gray-200'}`}>
                        {m.content}
                        {m.action && (
                            <button onClick={() => onApplyFlow && onApplyFlow(m.action.data.nodes, m.action.data.edges)} className="mt-2 w-full bg-green-600 text-white text-xs py-1 rounded font-bold flex justify-center items-center gap-1 hover:bg-green-500">
                                <Play size={10} /> Apply Flow
                            </button>
                        )}
                    </div>
                ))}
                {isAiProcessing && <div className="ml-4"><Loader2 className="animate-spin text-blue-400" size={16}/></div>}
                <div ref={messagesEndRef} />
             </div>
             <div className="p-3 border-t border-gray-800"><input className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none" value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>e.key==='Enter' && handleSendMessage()} placeholder="Ask AI..." /></div>
           </div>
        )}
           */}
        {/* Rest of AI Tab Logic (Same as before) */}
        
        {activeTab === 'ai' && (
           <div className="flex flex-col h-full relative">
             {contextNodeIds.length > 0 ? (
                <div className="p-2 bg-blue-900/20 border-b border-blue-800/30 flex items-center justify-between sticky top-0 backdrop-blur-md z-10">
                    <div className="flex items-center gap-2 truncate max-w-[220px]">
                        <CheckCircle size={12} className="text-green-400 shrink-0"/>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide truncate">Analyzing: <span className="text-white">{getContextSummary()}</span></span>
                    </div>
                    <button onClick={() => setShowNodeModal(true)} className="text-[10px] text-blue-400 hover:text-blue-300 underline shrink-0 cursor-pointer">Edit</button>
                </div>
            ) : (
                <button onClick={() => setShowNodeModal(true)} className="w-full text-left p-2 bg-yellow-900/20 border-b border-yellow-800/30 flex items-center justify-between hover:bg-yellow-900/30 transition-colors sticky top-0 backdrop-blur-md z-10 cursor-pointer">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={12} className="text-yellow-400"/>
                        <span className="text-[10px] font-bold text-yellow-200 uppercase tracking-wide">No Node Selected</span>
                    </div>
                    <span className="text-[10px] text-yellow-400 flex items-center gap-1">Select <List size={10}/></span>
                </button>
            )}

            <div className="flex-1 space-y-4 overflow-y-auto p-4 custom-scrollbar">
              {aiMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-bl-none'}`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.action && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                            <button onClick={() => onApplyFlow && onApplyFlow(msg.action.data.nodes, msg.action.data.edges)} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-xs font-bold w-full flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg"><Play size={12} fill="currentColor" /> {msg.action.label}</button>
                        </div>
                    )}
                  </div>
                </div>
              ))}
              {isAiProcessing && (
                  <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="bg-gray-800 rounded-2xl px-4 py-3 border border-gray-700 rounded-bl-none flex items-center gap-3">
                          <span className="text-xs text-gray-400 font-bold">AI is thinking</span>
                          <Loader2 size={12} className="animate-spin text-blue-400"/>
                      </div>
                  </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-gray-800 bg-[#0f172a]">
                <div className="relative">
                    <input type="text" disabled={isAiProcessing} className={`w-full bg-gray-800 border border-gray-700 rounded-xl pl-4 pr-10 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all placeholder:text-gray-500 ${isAiProcessing ? 'opacity-50 cursor-not-allowed' : ''}`} placeholder={contextNodeIds.length > 0 ? "Ask about this data..." : "Select a node first..."} value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} />
                    <button onClick={handleSendMessage} disabled={isAiProcessing || !aiInput.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-blue-500 hover:text-white hover:bg-blue-600 rounded-lg transition-all disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed">{isAiProcessing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
                </div>
            </div>
            <NodeSelectModal isOpen={showNodeModal} onClose={() => setShowNodeModal(false)} nodes={allNodes} selectedIds={contextNodeIds} onToggle={toggleNodeSelection} />
           </div>
        )}
        

        {activeTab === 'logs' && (
            <div className="font-mono text-[10px] p-4 space-y-1 text-gray-400">
                {executionResult?.logs?.length > 0 ? executionResult.logs.map((l:string, i:number) => <div key={i} className={`py-1 border-b border-gray-800/50 break-words ${l.includes('Error') ? 'text-red-400' : ''}`}><span className="opacity-50 mr-2">[{i+1}]</span>{l}</div>) : <div className="text-center mt-10 opacity-30">No logs available.</div>}
            </div>
        )}
      </div>
    </div>
  );
};

export default RightPanel;