import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { 
  CheckCircle2, AlertCircle, Database, Filter, Layers, ArrowUpDown, 
  HardDrive,Calculator, FileText,Cloud, Radio, FileSpreadsheet, PlayCircle,
  BarChart3, PieChart,ScatterChart, Activity, Map, LayoutGrid, LayoutDashboard, Box, AreaChart, Globe, Server, AlignLeft, Sigma, BrainCircuit, Wand2
} from 'lucide-react';

const CustomNode = ({ id, data, selected }: any) => {
  const stepNumber = id.split('_')[1] || '?';
  const isSource = data.typeLabel?.includes('Source') || data.typeLabel?.includes('Connect') || data.typeLabel === 'Upload File' || data.typeLabel.includes('GCP') || data.typeLabel.includes('Azure') || data.typeLabel.includes('MongoDB');
  const isConfigured = data.config && Object.keys(data.config).length > 0;

  const getIcon = () => {
    // Read Data
    if (data.typeLabel === 'Read Data') return <PlayCircle size={14} className="text-blue-500" />;

    // Sources
    if (data.typeLabel === 'Upload File') return <FileSpreadsheet size={14} className="text-green-400" />;
    if (data.typeLabel === 'SQL Database') return <Database size={14} className="text-blue-400" />;
    if (data.typeLabel === 'MongoDB') return <Database size={14} className="text-green-500" />;
    if (data.typeLabel === 'GCP BigQuery') return <Globe size={14} className="text-orange-500" />;
    if (data.typeLabel === 'Azure SQL') return <Server size={14} className="text-blue-600" />;
    if (data.typeLabel === 'Google Drive') return <HardDrive size={14} className="text-yellow-400" />;
    if (data.typeLabel === 'OneDrive') return <Cloud size={14} className="text-blue-300" />;
    if (data.typeLabel === 'Stream / Kafka') return <Radio size={14} className="text-red-400" />;
    
    // Processing
    if (data.typeLabel?.includes('Filter')) return <Filter size={14} className="text-purple-400" />;
    if (data.typeLabel?.includes('Group')) return <Layers size={14} className="text-orange-400" />;
    if (data.typeLabel?.includes('Sort')) return <ArrowUpDown size={14} className="text-green-400" />;

    if (data.typeLabel === 'N-Grams') return <AlignLeft size={14} className="text-purple-400" />;
    if (data.typeLabel === 'Word Count') return <Sigma size={14} className="text-pink-400" />;
    if (data.typeLabel === 'Sentiment Analysis') return <BrainCircuit size={14} className="text-purple-500" />;
    if (data.typeLabel === 'Forecast') return <Wand2 size={14} className="text-indigo-400" />;
    if (data.typeLabel === 'Clustering') return <LayoutGrid size={14} className="text-emerald-400" />;
    if (data.typeLabel === 'Calculated Field') return <Calculator size={14} className="text-orange-400" />;
    // Charts
    if (['Bar Chart', 'Histogram'].includes(data.typeLabel)) return <BarChart3 size={14} className="text-pink-400" />;
    if (data.typeLabel === 'Line Chart') return <Activity size={14} className="text-cyan-400" />;
    if (data.typeLabel === 'Pie/Donut Chart') return <PieChart size={14} className="text-orange-400" />;
    if (data.typeLabel === 'Area Chart') return <AreaChart size={14} className="text-indigo-400" />;
    if (data.typeLabel === 'Scatter Plot') return <ScatterChart size={14} className="text-yellow-400" />;
    if (data.typeLabel === 'Treemap') return <LayoutGrid size={14} className="text-emerald-400" />;
    if (data.typeLabel === 'KPI Card') return <LayoutDashboard size={14} className="text-white" />;
    if (data.typeLabel === 'Heatmap') return <Box size={14} className="text-red-500" />;
    if (data.typeLabel === 'Geo Map') return <Map size={14} className="text-blue-500" />;

    return <div className="w-3 h-3 rounded-full bg-gray-500" />;
  };

  return (
    <div className={`
      relative px-4 py-3 shadow-xl rounded-lg min-w-[180px] transition-all
      ${selected ? 'ring-2 ring-blue-500 bg-[#1e293b] border-transparent' : 'border border-gray-700 bg-[#1f2937] hover:border-gray-500'}
    `}>
      {/* Step Number Badge */}
      <div className="absolute -top-3 -left-3 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-[#0f172a] shadow-md z-10">
        {stepNumber}
      </div>

      {/* Node Header */}
      <div className="flex items-center gap-2 mb-2 border-b border-gray-700 pb-2">
        {getIcon()}
        <span className="text-[10px] font-bold text-gray-200 uppercase tracking-wider">
          {data.typeLabel || 'Node'}
        </span>
      </div>

      {/* Node Body */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-[10px] text-gray-400 truncate max-w-[140px]">
          {data.label && data.label !== data.typeLabel ? data.label : (isConfigured ? 'Ready' : 'Configure Me')}
        </div>
        {isConfigured ? (
          <CheckCircle2 size={12} className="text-green-500" />
        ) : (
          <AlertCircle size={12} className="text-yellow-500 animate-pulse" />
        )}
      </div>
      
      {/* Handles */}
      {!isSource && (
        <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-[#0f172a] !-left-[7px]" />
      )}
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-[#0f172a] !-right-[7px]" />
    </div>
  );
};

export default memo(CustomNode);