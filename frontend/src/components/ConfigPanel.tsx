import React, { useState, useEffect } from 'react';
import { 
  X, Save, UploadCloud, CheckCircle2, Layout, Plus, Trash2, 
  Calculator, Table as TableIcon, BarChart3, BrainCircuit, Sigma, 
  Binary, Database, Download, Loader2, AlignLeft, AlertCircle, 
  Cloud, HardDrive, FileText
} from 'lucide-react';
import { workflowAPI } from '../utils/api';

interface ConfigPanelProps {
    node: any; 
    nodes: any[]; 
    edges: any[]; 
    onSave: (nodeId: string, config: any) => void; 
    onClose: () => void; 
    columns: string[]; 
    executionResult?: any;
}

const ConfigPanel = ({ node, nodes, edges, onSave, onClose, columns: globalColumns, executionResult }: ConfigPanelProps) => {
  const [config, setConfig] = useState(node.data.config || {});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [serverFiles, setServerFiles] = useState<any[]>([]);

  const userId = localStorage.getItem('userId');

  const handleChange = (key: string, value: any) => { setConfig((prev: any) => ({ ...prev, [key]: value })); };

  // Helper: Is this a node that appears in the report?
  const isReportNode = [
      'Bar Chart', 'Line Chart', 'Pie/Donut Chart', 'Scatter Plot', 'Histogram', 
      'Heatmap', 'Area Chart', 'KPI Card', 'Preview Data', 'Pivot Table', 
      'Value Counts', 'Rank', 'Forecast', 'Describe Stats', 'Correlation', 'Clustering',
      'N-Grams', 'Word Count', 'Word Cloud'
  ].includes(node.data.typeLabel);

// useEffect(() => {
//     // Rule: Word Cloud must ALWAYS be Full Width
//     if (node.data.typeLabel === 'Word Cloud' && config.reportWidth !== 'full') {
//         handleChange('reportWidth', 'full');
//     }
// }, [node.data.typeLabel]);

// --- 1. FETCH FILES ---
useEffect(() => {
      if (node.data.typeLabel === 'Read Data' && userId) {
          workflowAPI.listFiles(userId)
            .then(data => { if(data.files) setServerFiles(data.files); })
            .catch(err => console.warn("Failed to list files:", err));
      }
  }, [node.data.typeLabel, userId]);

/// --- 2. COLUMN DETECTION ---
  useEffect(() => {
      let foundCols: string[] = [];
      const parentEdges = edges.filter((e:any) => e.target === node.id);
      
      if (node.data.config?.uploadedFiles?.[0]?.columns) {
          foundCols = node.data.config.uploadedFiles[0].columns;
      } 
      else if (parentEdges.length > 0) {
          const p1 = parentEdges[0].source;
          if (executionResult?.node_outputs?.[p1]?.columns) {
              foundCols = executionResult.node_outputs[p1].columns;
          } else {
             const findCols = (currId: string): string[] => {
                 const n = nodes.find((x:any) => x.id === currId);
                 if (n?.data.config?.uploadedFiles?.[0]?.columns) return n.data.config.uploadedFiles[0].columns;
                 const parents = edges.filter((e:any) => e.target === currId).map((e:any) => e.source);
                 for (const p of parents) {
                     const c = findCols(p);
                     if (c.length) return c;
                 }
                 return [];
             };
             foundCols = findCols(node.id);
          }
      }
      if (!foundCols || foundCols.length === 0) foundCols = globalColumns;
      setAvailableColumns(foundCols || []);
  }, [node, edges, executionResult, globalColumns, nodes]);
// --- 3. UTILS ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !userId) return;
    setIsUploading(true);
    try {
      const response = await workflowAPI.uploadFiles(userId, files);
      const newConfig = { ...config, uploadedFiles: response.files, selectedFile: response.files[0] };
      setConfig(newConfig); 
      setUploadSuccess(true);
      onSave(node.id, newConfig); 
    } catch (e) { alert("Upload failed"); } 
    finally { setIsUploading(false); }
  };

  const addListItem = (key: string, item: any) => handleChange(key, [...(config[key]||[]), item]);
  const updateListItem = (key: string, idx: number, field: string, val: any) => {
      const list = [...(config[key]||[])]; list[idx][field] = val; handleChange(key, list);
  };
  const removeListItem = (key: string, idx: number) => {
      const list = [...(config[key]||[])]; list.splice(idx, 1); handleChange(key, list);
  };

  const isChartNode = node.data.typeLabel.includes('Chart') || node.data.typeLabel.includes('Plot') || node.data.typeLabel.includes('Analysis');
return (
    <div className="absolute right-4 top-16 bottom-4 w-96 bg-[#1e293b] border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden z-50 animate-in slide-in-from-right">
    <div className="p-4 border-b border-gray-700 bg-[#0f172a] flex justify-between items-center">
    <h3 className="font-bold text-white text-sm uppercase truncate pr-4">Configure: <span className="text-blue-400">{node.data.typeLabel}</span></h3>
    <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
    </div>


    <div className="p-5 flex-1 overflow-y-auto custom-scrollbar space-y-6 text-white">
        {/* === REPORT LAYOUT SETTINGS === */}
        {isReportNode && (
            <div className="bg-purple-900/20 p-4 rounded border border-purple-500/30 mb-6">
                <div className="flex items-center gap-2 mb-3 text-purple-300 border-b border-purple-500/30 pb-2">
                    <Layout size={14}/> 
                    <span className="text-xs font-bold uppercase">Dashboard Preferences</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Order (1=Top)</label>
                        <input type="number" className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white mt-1"
                            value={config.dashboardOrder || 99} onChange={(e) => handleChange('dashboardOrder', parseInt(e.target.value))} />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Width</label>
                        <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white mt-1"
                            value={config.reportWidth || 'half'} onChange={(e) => handleChange('reportWidth', e.target.value)}>
                            <option value="half">Half</option>
                            <option value="full">Full</option>
                            <option value="third">One Third</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Custom Title</label>
                    <input type="text" placeholder="e.g. Sales Analysis" className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white mt-1"
                        value={config.title || ''} onChange={(e) => handleChange('title', e.target.value)} />
                </div>
            </div>
        )}
        {/* 1.1.1 CONNECTIONS */}
        {['SQL Database', 'MongoDB', 'Google Drive', 'OneDrive', 'Stream / Kafka'].includes(node.data.typeLabel) && (
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase">Connection Details</label>
                <input type="text" placeholder="Host / URL" className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white" value={config.host || ''} onChange={(e) => handleChange('host', e.target.value)} />
                <input type="text" placeholder="Port" className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white" value={config.port || ''} onChange={(e) => handleChange('port', e.target.value)} />
                <input type="text" placeholder="Database / Topic" className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white" value={config.database || ''} onChange={(e) => handleChange('database', e.target.value)} />
                <input type="password" placeholder="Username" className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white" value={config.username || ''} onChange={(e) => handleChange('username', e.target.value)} />
                <input type="password" placeholder="Password" className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white" value={config.password || ''} onChange={(e) => handleChange('password', e.target.value)} />
            </div>
        )}


        {/* 1.2.1 DROP DUPLICATES */}
        {node.data.typeLabel === 'Drop Duplicates' && (
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase">Keep Strategy</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('keep', e.target.value)} value={config.keep || 'first'}>
                    <option value="first">Keep First Occurrence</option>
                    <option value="last">Keep Last Occurrence</option>
                    <option value="false">Drop All Duplicates</option>
                </select>
                <label className="text-xs font-bold text-gray-400 uppercase">Subset Columns (Optional)</label>
                <select multiple className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white h-32"
                    onChange={(e) => handleChange('columns', Array.from(e.target.selectedOptions, o => o.value))}>
                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
        )}

        {node.data.typeLabel === 'Drop N/A' && (
            <div className="space-y-3">
                {/* How Option (Any/All) */}
                <label className="text-xs font-bold text-gray-400 uppercase">Drop Condition</label>
                <select 
                    className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('how', e.target.value)} 
                    value={config.how || 'any'} // Default to 'any'
                >
                    <option value="any">Drop row if ANY selected column is N/A</option>
                    <option value="all">Drop row only if ALL selected columns are N/A</option>
                </select>
                
                {/* Subset Columns Selection */}
                <label className="text-xs font-bold text-gray-400 uppercase">Columns to Check (Subset)</label>
                
                {/* NOTE: Since you are using a single select for target column in Fill N/A, 
                        I'm providing a single select here. For a proper 'subset' (multiple columns), 
                        you would need a multi-select component or a dynamic list of column inputs. 
                        If you need a dynamic list, let me know. 
                        
                        This implementation uses a single selector to check N/A only in that column. */}
                <select 
                    className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('subset', e.target.value ? [e.target.value] : [])} 
                    value={config.subset && config.subset.length > 0 ? config.subset[0] : ''} // Display current selected column
                >
                    <option value="">All Columns</option>
                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <div className="text-xs text-gray-500 pt-1">
                    *If "All Columns" is selected, the filter applies to the entire row.
                </div>
            </div>
        )}

        {/* 1.2.2 REPLACE / RENAME */}
        {(node.data.typeLabel === 'Replace Value' || node.data.typeLabel === 'Rename Columns') && (
            <div className="space-y-3">
                {node.data.typeLabel === 'Replace Value' && (
                    <>
                        <label className="text-xs font-bold text-gray-400 uppercase">Target Column</label>
                        <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                            onChange={(e) => handleChange('column', e.target.value)} value={config.column || ''}>
                            <option value="">Select Column...</option>
                            {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </>
                )}
                <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder={node.data.typeLabel === 'Rename Columns' ? "Old Name" : "Old Value"} 
                        className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                        value={node.data.typeLabel === 'Rename Columns' ? config.oldName : config.oldValue} 
                        onChange={(e) => handleChange(node.data.typeLabel === 'Rename Columns' ? 'oldName' : 'oldValue', e.target.value)} />
                    <input type="text" placeholder={node.data.typeLabel === 'Rename Columns' ? "New Name" : "New Value"} 
                        className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                        value={node.data.typeLabel === 'Rename Columns' ? config.newName : config.newValue} 
                        onChange={(e) => handleChange(node.data.typeLabel === 'Rename Columns' ? 'newName' : 'newValue', e.target.value)} />
                </div>
            </div>
        )}
        {node.data.typeLabel === 'Filter Date' && (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-gray-400 uppercase">Date Ranges</label>
                    {/* Restored Add Rule button, assuming addListItem handles the new structure */}
                    <button 
                        onClick={() => addListItem('dateRanges', { column: '', startDate: '', endDate: '' })} 
                        className="text-[10px] bg-blue-600 px-2 py-1 rounded text-white flex items-center gap-1 hover:bg-blue-500">
                        <Plus size={10}/> Add Range
                    </button>
                </div>
                
                {/* MAPPING OVER DYNAMIC LIST - This restores the core structure and idx key */}
                {(config.dateRanges || []).map((range: any, idx: number) => (
                    <div key={idx} className="p-3 bg-[#0f172a] rounded border border-gray-700 space-y-2 relative group">
                        
                        {/* Delete Button - Restored */}
                        <button 
                            onClick={() => removeListItem('dateRanges', idx)} 
                            className="absolute top-2 right-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100">
                            <Trash2 size={12}/>
                        </button>
                        
                        {/* Column Selection - Mapped and uses idx */}
                        <label className="text-xs font-medium text-gray-300 block">Date Column</label>
                        <select 
                            className="w-full bg-[#1e293b] border border-gray-600 rounded p-1.5 text-xs text-white"
                            value={range.column} 
                            onChange={(e) => updateListItem('dateRanges', idx, 'column', e.target.value)}>
                            <option value="">Select Column...</option>
                            {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        
                        {/* Date Inputs - Grouped in a flex container */}
                        <div className="flex gap-2">
                            
                            {/* Start Date Input - Replaces Operator Select */}
                            <div className="w-1/2 space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 block uppercase">From</label>
                                <input 
                                    type="date" 
                                    className="w-full bg-[#1e293b] border border-gray-600 rounded p-1.5 text-xs text-white"
                                    placeholder="Start Date" 
                                    value={range.startDate} 
                                    onChange={(e) => updateListItem('dateRanges', idx, 'startDate', e.target.value)} 
                                />
                            </div>
                            
                            {/* End Date Input - Replaces Value Input */}
                            <div className="w-1/2 space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 block uppercase">To</label>
                                <input 
                                    type="date" 
                                    className="w-full bg-[#1e293b] border border-gray-600 rounded p-1.5 text-xs text-white"
                                    placeholder="End Date" 
                                    value={range.endDate} 
                                    onChange={(e) => updateListItem('dateRanges', idx, 'endDate', e.target.value)} 
                                />
                            </div>
                            
                        </div>
                    </div>
                ))}
            </div>
        )}
        {/* 1.3 FILTER (Multi-Condition) */}
        {node.data.typeLabel === 'Filter Rows' && (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-gray-400 uppercase">Conditions</label>
                    <button onClick={() => addListItem('conditions', { column: '', operator: '==', value: '' })} className="text-[10px] bg-blue-600 px-2 py-1 rounded text-white flex items-center gap-1 hover:bg-blue-500"><Plus size={10}/> Add Rule</button>
                </div>
                {(config.conditions || []).map((cond: any, idx: number) => (
                    <div key={idx} className="p-3 bg-[#0f172a] rounded border border-gray-700 space-y-2 relative group">
                        <button onClick={() => removeListItem('conditions', idx)} className="absolute top-2 right-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={12}/></button>
                        <select className="w-full bg-[#1e293b] border border-gray-600 rounded p-1.5 text-xs text-white"
                            value={cond.column} onChange={(e) => updateListItem('conditions', idx, 'column', e.target.value)}>
                            <option value="">Select Column...</option>
                            {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <div className="flex gap-2">
                            <select className="w-1/3 bg-[#1e293b] border border-gray-600 rounded p-1.5 text-xs text-white"
                                value={cond.operator} onChange={(e) => updateListItem('conditions', idx, 'operator', e.target.value)}>
                                <option value="==">Equals</option>
                                <option value="!=">Not Equals</option>
                                <option value=">">Greater</option>
                                <option value="<">Less</option>
                                <option value="contains">Contains</option>
                            </select>
                            <input type="text" className="w-2/3 bg-[#1e293b] border border-gray-600 rounded p-1.5 text-xs text-white"
                                placeholder="Value" value={cond.value} onChange={(e) => updateListItem('conditions', idx, 'value', e.target.value)} />
                        </div>
                    </div>
                ))}
            </div>
        )}
        {/* --- WORD CLOUD CONFIG --- */}
        {node.data.typeLabel === 'Word Cloud' && (
            <div className="space-y-3">
                <div className="bg-blue-900/20 p-2 rounded text-xs text-gray-300 flex gap-2"><Cloud size={14}/> Visualizes frequent words.</div>
                <label className="text-xs font-bold text-gray-400 uppercase">Text Column</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('column', e.target.value)} value={config.column || ''}>
                    <option value="">-- Select Text Column --</option>
                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Max Words</label>
                        <input type="number" className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                            value={config.maxWords || 100} onChange={(e) => handleChange('maxWords', e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Height (px)</label>
                        <input type="number" className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                            placeholder="Default: 400"
                            value={config.height || 400} onChange={(e) => handleChange('height', e.target.value)} />
                    </div>
                </div>
            </div>
        )}
        {/* 1.4 GROUP BY (Multi Aggregation) */}
        {node.data.typeLabel === 'Group By' && (
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Group By Columns</label>
                    <select multiple className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white h-20"
                        onChange={(e) => handleChange('groupColumns', Array.from(e.target.selectedOptions, o => o.value))}>
                        {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-gray-400 uppercase">Aggregations</label>
                        <button onClick={() => addListItem('aggregations', { column: '', func: 'count' })} className="text-[10px] bg-blue-600 px-2 py-1 rounded text-white flex items-center gap-1"><Plus size={10}/> Add</button>
                    </div>
                    {(config.aggregations || []).map((agg: any, idx: number) => (
                        <div key={idx} className="flex gap-2 mb-2 relative group">
                            <select className="flex-1 bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                                value={agg.column} onChange={(e) => updateListItem('aggregations', idx, 'column', e.target.value)}>
                                <option value="">Column...</option>
                                {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select className="w-24 bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                                value={agg.func} onChange={(e) => updateListItem('aggregations', idx, 'func', e.target.value)}>
                                <option value="count">Count</option>
                                <option value="sum">Sum</option>
                                <option value="mean">Avg</option>
                                <option value="max">Max</option>
                                <option value="min">Min</option>
                            </select>
                            <button onClick={() => removeListItem('aggregations', idx)} className="text-red-400 hover:text-red-300"><Trash2 size={14}/></button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {(node.data.typeLabel === 'Preview Data' || node.data.typeLabel === 'Sample Data') && (
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase">Selection Mode</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('mode', e.target.value)} value={config.mode || 'head'}>
                    <option value="head">First N Rows (Head)</option>
                    <option value="tail">Last N Rows (Tail)</option>
                    <option value="random">Random Sample</option>
                </select>
                <label className="text-xs font-bold text-gray-400 uppercase">Number of Rows</label>
                <input type="number" className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    value={config.n || 10} onChange={(e) => handleChange('n', e.target.value)} />
            </div>
        )}

        {/* 1.6 RANKING & SORTING */}
        {(node.data.typeLabel === 'Sort Data' || node.data.typeLabel === 'Rank') && (
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase">Target Column</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('column', e.target.value)} value={config.column || ''}>
                    <option value="">Select Column...</option>
                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                        <input type="radio" name="order" checked={config.order !== 'desc'} onChange={() => handleChange('order', 'asc')} /> Ascending
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                        <input type="radio" name="order" checked={config.order === 'desc'} onChange={() => handleChange('order', 'desc')} /> Descending
                    </label>
                </div>
                {node.data.typeLabel === 'Rank' && (
                    <div className="mt-2">
                        <label className="text-xs font-bold text-gray-400 uppercase">Method</label>
                        <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white mt-1"
                            onChange={(e) => handleChange('method', e.target.value)} value={config.method || 'average'}>
                            <option value="average">Average</option>
                            <option value="min">Min</option>
                            <option value="max">Max</option>
                            <option value="dense">Dense</option>
                        </select>
                    </div>
                )}
            </div>
        )}

        {/* UPLOAD FILE */}
        {node.data.typeLabel === 'Upload File' && (
            <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 flex flex-col items-center text-center">
                    <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} />
                    {isUploading ? <div className="text-blue-400 text-xs"><Loader2 className="animate-spin inline mr-1"/> Uploading...</div> : 
                    uploadSuccess ? <div className="text-green-400 text-xs"><CheckCircle2 className="inline mr-1"/> Success</div> :
                    <><UploadCloud size={32} className="text-gray-400 mb-2"/><span className="text-xs font-bold text-gray-300">Click to Upload</span></>}
                </div>
                {config.uploadedFiles && <div className="text-[10px] text-gray-400 p-2 bg-gray-800 rounded">{config.uploadedFiles.length} files</div>}
            </div>
        )}

        {(node.data.typeLabel === 'Merge/Join' || node.data.typeLabel === 'Concatenate') && (
            <div className="space-y-3">
                <div className="text-xs text-gray-500 bg-blue-900/20 p-2 rounded">
                    Note: Ensure two separate flows connect to this node for it to work.
                </div>
                {node.data.typeLabel === 'Merge/Join' && (
                    <>
                        <label className="text-xs font-bold text-gray-400 uppercase">Join Type</label>
                        <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                            onChange={(e) => handleChange('how', e.target.value)} value={config.how || 'inner'}>
                            <option value="inner">Inner</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                            <option value="outer">Outer</option>
                        </select>
                        <label className="text-xs font-bold text-gray-400 uppercase">On Column</label>
                        <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                            onChange={(e) => handleChange('on', e.target.value)} value={config.on || ''}>
                            <option value="">Index (Default)</option>
                            {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </>
                )}
                {node.data.typeLabel === 'Concatenate' && (
                    <>
                        <label className="text-xs font-bold text-gray-400 uppercase">Axis</label>
                        <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                            onChange={(e) => handleChange('axis', e.target.value)} value={config.axis || 'rows'}>
                            <option value="rows">Rows (Stack)</option>
                            <option value="columns">Columns (Side-by-Side)</option>
                        </select>
                    </>
                )}
            </div>
        )}
        {/* CHANGE DATA TYPE */}
        {node.data.typeLabel === 'Change Data Type' && (
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase">Target Column</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('column', e.target.value)} value={config.column || ''}>
                    <option value="">Select Column...</option>
                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <label className="text-xs font-bold text-gray-400 uppercase">New Data Type</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('dtype', e.target.value)} value={config.dtype || 'str'}>
                    <option value="str">String (Text)</option>
                    <option value="int">Integer (Whole Number)</option>
                    <option value="float">Float (Decimal)</option>
                    <option value="bool">Boolean (True/False)</option>
                    <option value="datetime">Datetime</option>
                    <option value="category">Category</option>
                </select>
            </div>
        )}

        
        {node.data.typeLabel === 'Correlation' && (
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase">Method</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('method', e.target.value)} value={config.method || 'pearson'}>
                    <option value="pearson">Pearson</option>
                    <option value="spearman">Spearman</option>
                    <option value="kendall">Kendall</option>
                </select>
                <label className="text-xs font-bold text-gray-400 uppercase">Columns (Optional Subset)</label>
                <select multiple className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white h-24"
                    onChange={(e) => handleChange('columns', Array.from(e.target.selectedOptions, o => o.value))}>
                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
        )}
        {node.data.typeLabel === 'Fill N/A' && (
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase">Imputation Method</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('method', e.target.value)} value={config.method || 'value'}>
                    <option value="value">Specific Value</option>
                    <option value="mean">Mean (Average)</option>
                    <option value="median">Median</option>
                    <option value="mode">Mode (Frequent)</option>
                    <option value="min">Minimum</option>
                    <option value="max">Maximum</option>
                    <option value="ffill">Forward Fill</option>
                    <option value="bfill">Backward Fill</option>
                </select>
                {config.method === 'value' && (
                    <input type="text" placeholder="Value to fill..." className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                        value={config.value || ''} onChange={(e) => handleChange('value', e.target.value)} />
                )}
                <label className="text-xs font-bold text-gray-400 uppercase">Target Column (Optional)</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('column', e.target.value)} value={config.column || ''}>
                    <option value="">All Columns</option>
                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
        )}
        {/* COPY DATA (Simple Info) */}
        {node.data.typeLabel === 'Copy Data' && (
            <div className="text-xs text-gray-400 p-3 bg-gray-800 rounded border border-gray-700">
                <p className="mb-2">Creates a duplicate of the data stream.</p>
                {edges.find(e => e.target === node.id) ? (
                    <div className="text-green-400">Connected to: {nodes.find(n => n.id === edges.find(e => e.target === node.id)?.source)?.data.label}</div>
                ) : (
                    <div className="text-yellow-500">Not connected yet.</div>
                )}
            </div>
        )}

        {/* --- N-GRAMS --- */}
        {node.data.typeLabel === 'N-Grams' && (
            <div className="space-y-3">
                <div className="bg-blue-900/20 p-2 rounded text-xs text-gray-300 flex gap-2"><AlignLeft size={14}/> Analyze Text Patterns</div>
                <label className="text-xs font-bold text-gray-400 uppercase">Text Column</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('column', e.target.value)} value={config.column || ''}>
                    <option value="">-- Select --</option>
                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <label className="text-xs font-bold text-gray-400 uppercase">N-Value</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('n', e.target.value)} value={config.n || '2'}>
                    <option value="2">Bigrams (2 words)</option>
                    <option value="3">Trigrams (3 words)</option>
                    <option value="1">Unigrams (1 word)</option>
                </select>
            </div>
        )}

        {/* --- WORD COUNT --- */}
        {node.data.typeLabel === 'Word Count' && (
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase">Text Column</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('column', e.target.value)} value={config.column || ''}>
                    <option value="">-- Select --</option>
                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
        )}

        {/* PIVOT TABLE */}
        {node.data.typeLabel === 'Pivot Table' && (
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase">Index (Rows)</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('index', e.target.value)} value={config.index || ''}>
                    <option value="">Select Row...</option>
                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <label className="text-xs font-bold text-gray-400 uppercase">Columns (Cols)</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('columns', e.target.value)} value={config.columns || ''}>
                    <option value="">Select Col...</option>
                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <label className="text-xs font-bold text-gray-400 uppercase">Values</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('values', e.target.value)} value={config.values || ''}>
                    <option value="">Select Value...</option>
                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <label className="text-xs font-bold text-gray-400 uppercase">Aggregation</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('aggFunc', e.target.value)} value={config.aggFunc || 'sum'}>
                    <option value="sum">Sum</option>
                    <option value="mean">Mean</option>
                    <option value="count">Count</option>
                    <option value="min">Min</option>
                    <option value="max">Max</option>
                </select>
            </div>
        )}
        {/* --- VALUE COUNTS --- */}
        {node.data.typeLabel === 'Value Counts' && (
            <div className="space-y-3">
                <div className="bg-blue-900/20 p-3 rounded border border-blue-800/50 mb-2">
                    <p className="text-[10px] text-gray-300 flex items-center gap-2">
                        <Calculator size={12}/> Counts occurrences of unique values.
                    </p>
                </div>
                <label className="text-xs font-bold text-gray-400 uppercase">Target Column</label>
                {availableColumns.length > 0 ? (
                    <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white focus:border-blue-500 outline-none"
                        onChange={(e) => handleChange('column', e.target.value)} value={config.column || ''}>
                        <option value="">-- Select Column --</option>
                        {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                ) : (
                    <div className="text-xs text-red-400 p-2 border border-red-900/50 rounded bg-red-900/20 flex items-center gap-2">
                        <AlertCircle size={14} />
                        <span>No columns found. Connect to 'Read Data' first.</span>
                    </div>
                )}
            </div>
        )}
        
        {node.data.typeLabel === 'Read Data' && (
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase">Select File</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white" 
                    onChange={(e) => {
                        const fileData = serverFiles.find(f => f.name === e.target.value);
                        handleChange('selectedFile', fileData); 
                    }} 
                    value={config.selectedFile?.name || ''}>
                    <option value="">-- Choose My File --</option>
                    {serverFiles.map((f:any) => (
                        <option key={f.name} value={f.name}>{f.name} ({(f.size/1024).toFixed(1)} KB)</option>
                    ))}
                </select>
                {(!serverFiles || serverFiles.length === 0) && (
                    <div className="text-xs text-gray-500 italic">No files found. Upload one below.</div>
                )}
                {/* Sheet Name Selector (if Excel) */}
                {config.selectedFile?.sheets?.length > 0 && (
                    <>
                        <label className="text-xs font-bold text-gray-400 uppercase">Select Sheet</label>
                        <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                            onChange={(e) => handleChange('sheetName', e.target.value)} value={config.sheetName || ''}>
                            {config.selectedFile.sheets.map((s:string) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </>
                )}
            </div>
        )}
        {node.data.typeLabel === 'AI Assistant' && (
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase">Input Context</label>
                <div className="text-[10px] text-gray-500 mb-1">Select executed nodes to pass to AI as context.</div>
                {/* List executed nodes from previous run if available */}
                {executionResult?.node_outputs && Object.values(executionResult.node_outputs).map((n:any) => (
                    <label key={n.id} className="flex items-center gap-2 text-xs p-1 bg-[#0f172a] rounded border border-gray-800 mb-1">
                        <input type="checkbox" 
                            checked={config.contextNodes?.includes(n.id) || false}
                            onChange={(e) => {
                                const current = config.contextNodes || [];
                                if(e.target.checked) handleChange('contextNodes', [...current, n.id]);
                                else handleChange('contextNodes', current.filter((id:string)=>id!==n.id));
                            }}
                        />
                        {n.type} (Step {n.id.split('_')[1]})
                    </label>
                ))}
                <button className="w-full bg-blue-900/20 text-blue-400 text-xs py-1 rounded border border-blue-800/50 flex justify-center items-center gap-1">
                    <Plus size={10} /> Add Context
                </button>
            </div>
        )}
        {node.data.typeLabel === 'Calculated Field' && (
            <div className="space-y-3">
                
                {/* New Column Name Input */}
                <label className="text-xs font-bold text-gray-400 uppercase">New Column Name</label>
                <div className="text-[10px] text-gray-500 mb-1">Enter the name for the resulting column (e.g., Total).</div>
                <input 
                    type="text" 
                    placeholder="New Column Name" 
                    className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    value={config.newColumn || ''} 
                    onChange={(e) => handleChange('newColumn', e.target.value)} 
                />

                {/* Expression Input */}
                <label className="text-xs font-bold text-gray-400 uppercase">Calculation Expression</label>
                <div className="text-[10px] text-gray-500 mb-1">Use 'df' to reference the DataFrame (e.g., df['Price'] * df['Qty']).</div>
                <textarea 
                    rows={3} // Use a textarea for multi-line expressions
                    placeholder="df['Column1'] / df['Column2']" 
                    className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white resize-none"
                    value={config.expression || ''} 
                    onChange={(e) => handleChange('expression', e.target.value)} 
                />
                
                {/* Optional: Placeholder button if needed to match the structure of the AI node */}
                <button 
                    className="w-full bg-blue-900/20 text-blue-400 text-xs py-1 rounded border border-blue-800/50 flex justify-center items-center gap-1 opacity-50 cursor-default"
                    disabled
                >
                    <Plus size={10} /> Add Helper Function (Placeholder)
                </button>
                
            </div>
        )}
        {/* SELECT COLUMNS (Multi) */}
        {/* SELECT COLUMNS (Checkbox Method) */}
        {(node.data.typeLabel === 'Select Columns' || node.data.typeLabel === 'List Columns') && (
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase">Choose Columns to Keep</label>
                
                {/* Scrollable Checkbox Container */}
                <div className="w-full bg-[#0f172a] border border-gray-700 rounded-lg p-2 h-48 overflow-y-auto custom-scrollbar">
                    {availableColumns.length > 0 ? (
                        <div className="space-y-1">
                            {/* "Select All" Option (Optional Helper) */}
                            <div className="flex justify-between items-center pb-2 mb-2 border-b border-gray-800">
                                <span className="text-[10px] text-gray-500">{config.columns?.length || 0} selected</span>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleChange('columns', availableColumns)}
                                        className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline"
                                    >
                                        All
                                    </button>
                                    <button 
                                        onClick={() => handleChange('columns', [])}
                                        className="text-[10px] text-gray-500 hover:text-red-400 hover:underline"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            {/* Column List */}
                            {availableColumns.map((c) => (
                                <label key={c} className="flex items-center gap-3 p-1.5 rounded hover:bg-gray-800/50 cursor-pointer transition-colors group">
                                    <input 
                                        type="checkbox" 
                                        className="w-3.5 h-3.5 rounded bg-gray-900 border-gray-600 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                        checked={(config.columns || []).includes(c)}
                                        onChange={(e) => {
                                            const current = config.columns || [];
                                            const newCols = e.target.checked 
                                                ? [...current, c] 
                                                : current.filter((col: string) => col !== c);
                                            handleChange('columns', newCols);
                                        }}
                                    />
                                    <span className={`text-xs select-none truncate ${(config.columns || []).includes(c) ? 'text-white font-medium' : 'text-gray-400 group-hover:text-gray-300'}`}>
                                        {c}
                                    </span>
                                </label>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
                            <span className="text-xs italic">No columns found</span>
                        </div>
                    )}
                </div>
                
                <div className="text-[10px] text-gray-500 px-1">
                    * Unchecked columns will be dropped from the flow.
                </div>
            </div>
        )}
        {/* --- GOOGLE DRIVE CONFIG --- */}
        
        {/* 2. KPI CARD */}
        {node.data.typeLabel === 'KPI Card' && (
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase">Metric Column</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('column', e.target.value)} value={config.column || ''}>
                    <option value="">-- Count Rows --</option>
                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <label className="text-xs font-bold text-gray-400 uppercase">Operation</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('operation', e.target.value)} value={config.operation || 'count'}>
                    <option value="count">Count</option>
                    <option value="sum">Sum</option>
                    <option value="avg">Average</option>
                    <option value="min">Min</option>
                    <option value="max">Max</option>
                </select>
            </div>
        )}
        {/* --- CHART CONFIGURATION (Universal for all Charts) --- */}
        {isChartNode && (
            <div className="space-y-4">
                <div className="bg-blue-900/20 p-3 rounded border border-blue-800/50">
                    <label className="text-xs font-bold text-blue-300 uppercase mb-2 block">Chart Settings</label>
                    
                    {/* Title */}
                    <div className="mb-3">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Chart Title</label>
                        <input type="text" className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white mt-1"
                            placeholder="e.g. Sales by Region"
                            value={config.title || ''} onChange={(e) => handleChange('title', e.target.value)} />
                    </div>

                    {/* Axis Selection */}
                    <div className="grid grid-cols-1 gap-3">
                        {/* X-Axis / Category */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">
                                {node.data.typeLabel.includes('Pie') ? 'Category / Label' : 'X-Axis (Category)'}
                            </label>
                            <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white mt-1"
                                onChange={(e) => handleChange('column', e.target.value)} value={config.column || ''}>
                                <option value="">Select Column...</option>
                                {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* Y-Axis / Value (Not for Histogram usually, but good for Bar/Line/Pie) */}
                        {!node.data.typeLabel.includes('Histogram') && (
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase">
                                    {node.data.typeLabel.includes('Pie') ? 'Value / Size' : 'Y-Axis (Value)'}
                                </label>
                                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white mt-1"
                                    onChange={(e) => handleChange('yAxis', e.target.value)} value={config.yAxis || ''}>
                                    <option value="">Count (Default)</option>
                                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        )}

                        {/* Color/Group (Optional) */}
                        {['Scatter Plot', 'Bar Chart', 'Line Chart'].includes(node.data.typeLabel) && (
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Color By (Optional)</label>
                                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white mt-1"
                                    onChange={(e) => handleChange('colorBy', e.target.value)} value={config.colorBy || ''}>
                                    <option value="">None</option>
                                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
        {/* GENERIC FALLBACK FOR OTHER NODES */}
        {!isChartNode && node.data.typeLabel !== 'Value Counts' && node.data.typeLabel !== 'Pivot Table' && ['Sort Data', 'Rename Columns', 'Change Data Type', 'Select Columns', 'KPI Card'].includes(node.data.typeLabel) && (
             <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase">Target Column</label>
                <select className="w-full bg-[#0f172a] border border-gray-700 rounded p-2 text-xs text-white"
                    onChange={(e) => handleChange('column', e.target.value)} value={config.column || ''}>
                    <option value="">Select Column...</option>
                    {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
             </div>
        )}

    </div>

    <div className="p-4 border-t border-gray-700 bg-[#0f172a]">
    <button onClick={() => onSave(node.id, config)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
        <Save size={16} /> Save Configuration
    </button>
    </div>
    </div>
);
};

export default ConfigPanel;