import React, { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Download, ChevronLeft, LayoutDashboard, Edit,
  BarChart3, Table as TableIcon, 
  Activity, Layers, AlertCircle, PieChart, Cloud, ImageOff
} from 'lucide-react';

const REPORT_ALLOWLIST = [
    'KPI Card', 
    'Bar Chart', 'Line Chart', 'Pie/Donut Chart', 'Scatter Plot', 
    'Histogram', 'Heatmap', 'Area Chart', 'Forecast',
    'Preview Data', 'Pivot Table','Rank', 'Describe Stats', 'Correlation', 'Clustering',
    'N-Grams', 'Word Count', 'Word Cloud'
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const ReportPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { flowData } = location.state || {};
  const reportRef = useRef<HTMLDivElement>(null);

  if (!flowData) return <div className="text-white p-10 bg-[#0f172a] h-screen">No Data. Run Flow first.</div>;

  const { name, executionResult } = flowData;
  const allOutputs = executionResult?.node_outputs ? Object.values(executionResult.node_outputs) : [];

  const reportItems = allOutputs
      .filter((node: any) => REPORT_ALLOWLIST.some(t => node.type.includes(t)))
      // EXTRA SAFETY: Explicitly remove non-visual nodes if they slipped through
      .filter((node: any) => !['Read Data', 'Filter Rows', 'Select Columns', 'Sort Data', 'Upload File'].includes(node.type))
      .sort((a: any, b: any) => {
          const orderA = a.config?.dashboardOrder !== undefined ? a.config.dashboardOrder : 99;
          const orderB = b.config?.dashboardOrder !== undefined ? b.config.dashboardOrder : 99;
          return orderA - orderB;
      });

  const handleExport = () => window.print();
  const handleModify = () => navigate('/builder', { state: { flowToLoad: flowData } });

  // --- KPI CARD ---
  const KPICard = ({ data, config }: any) => {
      let value = "0";
      let label = config.title || config.label || "Metric";
      if (data && data.length > 0) {
          const row = data[0];
          let keyToUse = config.column;
          const keys = Object.keys(row);
          if (!keyToUse || row[keyToUse] === undefined) keyToUse = keys.find(k => typeof row[k] === 'number') || keys[0];
          value = String(row[keyToUse]);
          const num = parseFloat(value);
          if (!isNaN(num)) value = num.toLocaleString(undefined, { maximumFractionDigits: 2 });
          if (!config.label && !config.title) label = keyToUse.replace(/_/g, ' ');
      }
      return (
          <div className="bg-[#1e293b] border border-gray-700 p-6 rounded-xl shadow-lg flex flex-col justify-between h-36 relative overflow-hidden group hover:border-blue-500 transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Activity size={100} className="text-white" />
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2 relative z-10">
                  <Layers size={14}/> {label}
              </div>
              <div className="text-4xl font-extrabold text-white tracking-tight relative z-10 mt-2 truncate" title={value}>
                  {value}
              </div>
          </div>
      );
  };

  // --- CHART WIDGET ---
  const ChartWidget = ({ node }: any) => {
      const { type, config, preview } = node;
      const validData = Array.isArray(preview) ? preview.slice(0, 50) : [];
      if (validData.length === 0) return <div className="h-full flex items-center justify-center text-gray-500"><AlertCircle className="mr-2"/>No Data</div>;

      const keys = Object.keys(validData[0]);
      const xKey = config.column || keys[0];
      const yKey = config.yAxis || keys.find(k => typeof validData[0][k] === 'number') || keys[1];

      const dataPoints = validData.map((d: any) => ({ x: d[xKey], y: Number(d[yKey]) || 0, label: String(d[xKey]) }));
      const maxVal = Math.max(...dataPoints.map((d:any) => d.y)) || 1;

      // PIE / DONUT
      if (type.includes('Pie') || type.includes('Donut')) {
          const total = dataPoints.reduce((acc:any, curr:any) => acc + curr.y, 0);
          let cumulativePercent = 0;
          const isDonut = type.includes('Donut');

          return (
              <div className="h-full w-full flex items-center justify-center gap-6 px-4">
                  <div className="relative w-48 h-48 shrink-0">
                      <svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }} className="w-full h-full">
                          {dataPoints.map((d:any, i:number) => {
                              if (d.y === 0) return null;
                              const start = cumulativePercent;
                              const slicePercent = d.y / total;
                              cumulativePercent += slicePercent;
                              const end = cumulativePercent;
                              
                              const x1 = Math.cos(2 * Math.PI * start);
                              const y1 = Math.sin(2 * Math.PI * start);
                              const x2 = Math.cos(2 * Math.PI * end);
                              const y2 = Math.sin(2 * Math.PI * end);
                              const largeArc = slicePercent > 0.5 ? 1 : 0;
                              return <path key={i} d={`M 0 0 L ${x1} ${y1} A 1 1 0 ${largeArc} 1 ${x2} ${y2} Z`} fill={COLORS[i % COLORS.length]} stroke="#1e293b" strokeWidth="0.05" className="hover:opacity-80 transition-opacity cursor-pointer"/>;
                          })}
                          {isDonut && <circle cx="0" cy="0" r="0.6" fill="#1e293b" />}
                      </svg>
                      {isDonut && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-2xl font-bold text-white">{total.toLocaleString()}</span>
                              <span className="text-[10px] text-gray-400 uppercase">Total</span>
                          </div>
                      )}
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[220px] custom-scrollbar space-y-2 pr-2">
                      {dataPoints.map((d:any, i:number) => (
                          <div key={i} className="flex items-center justify-between text-xs p-2 bg-gray-800/50 rounded border border-gray-700/50">
                              <div className="flex items-center gap-2 overflow-hidden">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }}></div>
                                  <span className="text-gray-300 truncate" title={d.label}>{d.label}</span>
                              </div>
                              <span className="font-mono font-bold text-white">{Math.round((d.y/total)*100)}%</span>
                          </div>
                      ))}
                  </div>
              </div>
          );
      }

      // CARTESIAN
      const count = dataPoints.length;
      const paddingX = 10; 
      const paddingY = 10; 
      
      const points = dataPoints.map((d:any, i:number) => {
          const x = (i / (count - 1 || 1)) * (100 - (paddingX*2)) + paddingX; 
          const y = (100 - paddingY) - ((d.y / maxVal) * (100 - (paddingY*2))); 
          return { ...d, svgX: x, svgY: y };
      });

      const polylinePoints = points.map((p:any) => `${p.svgX},${p.svgY}`).join(' ');
      const areaPoints = `${paddingX},100 ${polylinePoints} ${100-paddingX},100`;

      return (
          <div className="h-full w-full relative p-4 flex flex-col">
              <div className="flex-1 relative">
                  <div className="absolute inset-0 flex flex-col justify-between text-[9px] text-gray-600 font-mono pointer-events-none">
                      <div className="border-b border-gray-700/50 w-full h-0 flex items-center"><span className="-mt-4">{maxVal}</span></div>
                      <div className="border-b border-gray-700/30 w-full h-0 flex items-center"><span className="-mt-4">{Math.round(maxVal/2)}</span></div>
                      <div className="border-b border-gray-700/50 w-full h-0 flex items-center"><span className="-mt-4">0</span></div>
                  </div>

                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                      {type.includes('Area') && <polygon points={areaPoints} fill="url(#blueGradient)" stroke="none" opacity="0.3" />}
                      <defs>
                        <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5"/>
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
                        </linearGradient>
                      </defs>
                      {(type.includes('Line') || type.includes('Area') || type.includes('Forecast')) && <polyline points={polylinePoints} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
                      {type.includes('Scatter') && points.map((p:any, i:number) => <circle key={i} cx={p.svgX + "%"} cy={p.svgY + "%"} r="4" fill="#f59e0b" className="hover:scale-150 transition-transform cursor-pointer"><title>{p.label}: {p.y}</title></circle>)}
                      {(type.includes('Bar') || type.includes('Histogram')) && points.map((p:any, i:number) => {
                          const barWidth = Math.min(80 / count, 10); 
                          const barHeight = 100 - p.svgY - paddingY; 
                          return <rect key={i} x={`${p.svgX - (barWidth/2)}%`} y={`${p.svgY}%`} width={`${barWidth}%`} height={`${barHeight}%`} fill="#3b82f6" rx="2" className="hover:fill-blue-400 transition-colors"><title>{p.label}: {p.y}</title></rect>;
                      })}
                  </svg>
              </div>
              <div className="h-6 mt-2 flex justify-between items-center text-[9px] text-gray-400 font-mono uppercase px-2 border-t border-gray-700 pt-1">
                  <span>{dataPoints[0].label.substring(0,12)}</span>
                  <span>{dataPoints[count-1].label.substring(0,12)}</span>
              </div>
          </div>
      );
  };

  const ReportWidgetContainer = ({ node }: any) => {
      const { type, rows, columns, image } = node;
      const widthClass = node.config?.reportWidth === 'full' ? 'col-span-12' : node.config?.reportWidth === 'third' ? 'col-span-12 md:col-span-4' : 'col-span-12 md:col-span-6';
      
      const isKPI = type === 'KPI Card';
      const isChart = type.includes('Chart') || type.includes('Plot') || type.includes('gram') || type.includes('Forecast') || type.includes('Map');
      const isWordCloud = type === 'Word Cloud';
      const isTable = !isKPI && !isChart && !isWordCloud;

      if (isKPI) return <div className="col-span-12 md:col-span-3"><KPICard data={node.preview} config={node.config} /></div>;

      return (
          <div className={`${widthClass} bg-[#1e293b] border border-gray-700 rounded-xl shadow-xl flex flex-col overflow-hidden h-[350px]`}>
              <div className="px-5 py-3 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center shrink-0">
                  <h3 className="font-bold text-gray-200 text-sm flex items-center gap-2">
                      {isChart ? <BarChart3 size={16} className="text-blue-400"/> : isWordCloud ? <Cloud size={16} className="text-purple-400"/> : <TableIcon size={16} className="text-emerald-400"/>} 
                      {node.config?.title || type}
                  </h3>
                  {isTable && <span className="text-[10px] font-mono bg-black/40 text-gray-400 px-2 py-1 rounded border border-gray-700">{rows} Rows</span>}
              </div>
              <div className="flex-1 p-0 overflow-hidden relative bg-[#1e293b]">
                  
                  {/* WORD CLOUD */}
                  {isWordCloud ? (
                      node.image ? (
                          <div className="w-full h-full flex items-center justify-center p-4">
                              <img src={node.image} alt="Word Cloud" className="max-w-full max-h-full object-contain" />
                          </div>
                      ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-2">
                              <ImageOff size={24} />
                              <span className="text-xs">Image Generation Failed</span>
                              <span className="text-[9px] text-gray-600">No text data available</span>
                          </div>
                      )
                  ) : isChart ? (
                      <ChartWidget node={node} />
                  ) : (
                      // TABLE
                      <div className="w-full h-full overflow-auto custom-scrollbar">
                          <table className="w-full text-xs text-left border-collapse min-w-max">
                              <thead className="bg-[#0f172a] text-gray-300 sticky top-0 z-10 shadow-sm">
                                  <tr>{columns.map((c:string)=><th key={c} className="p-3 font-semibold border-b border-gray-700 whitespace-nowrap">{c}</th>)}</tr>
                              </thead>
                              <tbody className="divide-y divide-gray-800">
                                  {node.preview.slice(0, 100).map((row:any, i:number) => (
                                      <tr key={i} className="hover:bg-blue-500/5 transition-colors group">
                                          {columns.map((c:string)=><td key={c} className="p-3 text-gray-400 border-r border-gray-800/30 whitespace-nowrap max-w-[200px] truncate group-hover:text-gray-200">{String(row[c])}</td>)}
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  )}
              </div>
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col font-sans">
        {/* CSS FOR DARK SCROLLBARS */}
        <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
            @media print { 
                body { background-color: #fff !important; color: #000 !important; } 
                .bg-\\[\\#1e293b\\], .bg-\\[\\#0f172a\\] { background-color: #fff !important; border: 1px solid #ddd !important; } 
                .text-white { color: #000 !important; } 
                nav, button { display: none !important; } 
            }
        `}</style>

      <nav className="h-16 border-b border-gray-800 bg-[#0f172a] flex items-center justify-between px-6 sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/builder')} className="text-gray-400 hover:text-white flex items-center gap-2 text-sm font-bold transition-colors"><ChevronLeft size={18} /> Builder</button>
            <div className="h-6 w-px bg-gray-800"></div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <LayoutDashboard size={18} className="text-blue-500"/> Analytics Report
            </h1>
        </div>
        <div className="flex gap-3">
            <button onClick={handleModify} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border border-gray-700 transition-all shadow-md"><Edit size={14} /> Modify Flow</button>
            <button onClick={handleExport} className="bg-white text-black hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-md"><Download size={16} /> PDF</button>
        </div>
      </nav>

      <div className="flex-1 p-6 lg:p-10 overflow-y-auto" ref={reportRef}>
        <div className="max-w-[1600px] mx-auto">
            <div className="mb-8 border-b border-gray-800 pb-6 flex justify-between items-end">
                <div><h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight mb-2">{name || "Untitled Report"}</h2><p className="text-gray-400 text-sm">Generated on {new Date().toLocaleDateString()}</p></div>
                <div className="text-xs bg-gray-900 text-gray-500 px-3 py-1 rounded border border-gray-800 flex items-center gap-2"><Layers size={12}/> {reportItems.length} Widgets</div>
            </div>
            <div className="grid grid-cols-12 gap-6 pb-20">
                {reportItems.length > 0 ? reportItems.map((node: any) => <ReportWidgetContainer key={node.id} node={node} />) : <div className="col-span-12 text-center py-20 text-gray-500 border border-dashed border-gray-800 rounded-xl bg-[#1e293b]/30"><LayoutDashboard className="mx-auto mb-4 opacity-20" size={48}/><p>Dashboard Empty</p></div>}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;