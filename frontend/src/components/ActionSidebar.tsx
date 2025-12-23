import React, { useState } from 'react';
import { 
  ChevronDown, ChevronRight, Table, FileText, List, Type, LayoutGrid, Hash, FileBarChart, 
  Filter, Trash2, MoveHorizontal, Calculator, BarChart3, BrainCircuit, Download, Database,
  HardDrive, Cloud, Radio, FileSpreadsheet, Replace, ArrowUpDown, Wand2, PieChart,
  Sigma, Binary, Mail, Activity, Map, Box, AreaChart, ScatterChart, LayoutDashboard,
  PlayCircle,ShieldCheck, AlertTriangle, Copy, Sparkles,Link, Layers,TextSelect, AlignLeft
} from 'lucide-react';



const CATEGORIES = [
  {
    id: 'io',
    title: 'INPUT/OUTPUT',
    items: [
      // NEW: Read Data Action (Must be used after connection)
      { type: 'readData', label: 'Read Data', icon: PlayCircle, desc: 'Load data from source' },
      { type: 'sourceFile', label: 'Upload File', icon: FileSpreadsheet, desc: 'CSV or Excel' },
      { type: 'googleDrive', label: 'Google Drive', icon: HardDrive, desc: 'Import from Drive' },
      { type: 'sourceDB', label: 'SQL Database', icon: Database, desc: 'Postgres, MySQL, Oracle' },
      { type: 'sourceMongo', label: 'MongoDB', icon: Database, desc: 'Local or Atlas' },
      { type: 'sourceOneDrive', label: 'OneDrive', icon: Cloud, desc: 'Connect OneDrive' },
      { type: 'sourceStream', label: 'Stream / Kafka', icon: Radio, desc: 'Real-time Topics' },
      { type: 'exportCsv', label: 'Export CSV', icon: Download, desc: 'Save data to file' }
    ]
  },
  {
    id: 'exploration',
    title: '1. DATA UNDERSTANDING & EXPLORATION',
    items: [
      
      { type: 'preview', label: 'Preview Data', icon: Table, desc: 'Display sample data' },
      { type: 'sample', label: 'Sample Data', icon: Hash, desc: 'Random subset' },
      { type: 'dtypes', label: 'Get Data Types', icon: Type, desc: 'Show column types' },
      { type: 'shape', label: 'Get Shape', icon: LayoutGrid, desc: 'Row/Column count' },    
      { type: 'correlation', label: 'Correlation', icon: Table, desc: 'Correlation Matrix' }
    ]
  },
  {
    id: 'cleaning',
    title: '2. DATA CLEANING / PREPARATION',
    items: [
      { type: 'copy', label: 'Copy Data', icon: Copy, desc: 'Duplicate Branch' },
      { type: 'drop_duplicates', label: 'Drop Duplicates', icon: Trash2, desc: 'Remove duplicate rows' },
      { type: 'fill_na', label: 'Fill N/A', icon: MoveHorizontal, desc: 'Replace missing values' },
      { type: 'Drop Nulls',label: 'DROP NULLS', icon: MoveHorizontal, desc: 'Remove rows with missing values' },
      { type: 'replace', label: 'Replace Value', icon: Replace, desc: 'Find and replace' },
      { type: 'rename', label: 'Rename Columns', icon: Type, desc: 'Change column names' },
      { type: 'change_type', label: 'Change Type', icon: Type, desc: 'Convert data types' },
      { type: 'merge', label: 'Merge/Join', icon: Link, desc: 'Join Datasets' },
      { type: 'concat', label: 'Concatenate', icon: Layers, desc: 'Stack Datasets' },
    ]
  },
  {
    id: 'filtering',
    title: '3. FILTERING & SUBSETTING',
    items: [
      { type: 'filter', label: 'Filter Rows', icon: Filter, desc: 'Select rows by condition' },
      { type: 'Date filter', label: 'Filter Date', icon: Filter, desc: 'Select rows by date range' },
      { type: 'select_cols', label: 'Select Columns', icon: LayoutGrid, desc: 'Keep specific columns' },
      { type: 'value_counts', label: 'Value Counts', icon: Hash, desc: 'Count unique values' },
    ]
  },
  {
    id: 'grouping',
    title: '4. GROUPING & AGGREGATION',
    items: [
      { type: 'groupby', label: 'Group By', icon: Calculator, desc: 'Group and aggregate' },
      { type: 'pivot', label: 'Pivot Table', icon: Table, desc: 'Reshape data' }
    ]
  },
  {
    id: 'transformation',
    title: '5. TRANSFORMATION / FEATURE ENG.',
    items: [
      { type: 'scaler', label: 'Standard Scaler', icon: Sigma, desc: 'Normalize features' },
      { type: 'onehot', label: 'One-Hot Encoding', icon: Binary, desc: 'Categorical to numeric' },
      { type: 'calc_field', label: 'Calculated Field', icon: Calculator, desc: 'Create new column' }
    ]
  },
  {
    id: 'sorting',
    title: '6. SORTING & RANKING',
    items: [
      { type: 'sort', label: 'Sort Data', icon: ArrowUpDown, desc: 'Ascending/Descending' },
      { type: 'rank', label: 'Rank', icon: List, desc: 'Compute numerical rank' }
    ]
  },
  {
    id: 'visualization',
    title: '7. VISUALIZATION',
    items: [
      { type: 'kpi', label: 'KPI Card', icon: LayoutDashboard, desc: 'Single Metric' },
      { type: 'chart_bar', label: 'Bar Chart', icon: BarChart3, desc: 'Compare categories' },
      { type: 'chart_line', label: 'Line Chart', icon: Activity, desc: 'Trends over time' },
      { type: 'chart_pie', label: 'Pie/Donut Chart', icon: PieChart, desc: 'Part-to-whole' },
      { type: 'chart_area', label: 'Area Chart', icon: AreaChart, desc: 'Volume trends' },
      { type: 'chart_scatter', label: 'Scatter Plot', icon: ScatterChart, desc: 'Correlation' },
      { type: 'chart_histogram', label: 'Histogram', icon: BarChart3, desc: 'Distribution' },
      { type: 'chart_heatmap', label: 'Heatmap', icon: Box, desc: 'Matrix intensity' },
    ]
  },
  {
    id: 'advanced',
    title: '8. ADVANCED ANALYTICS (AI)',
    items: [
      { type: 'sentiment', label: 'Sentiment Analysis', icon: BrainCircuit, desc: 'Text positivity' },
      { type: 'ngram', label: 'N-Grams', icon: AlignLeft, desc: 'Bi-grams / Tri-grams' },
      { type: 'word_cloud', label: 'Word Cloud', icon: Cloud, desc: 'Generate Word Cloud Image' },
      { type: 'word_count', label: 'Word Count', icon: Sigma, desc: 'Count words in text' },
      { type: 'forecast', label: 'Time Forecast', icon: Wand2, desc: 'Predict future values' },
      { type: 'clustering', label: 'Clustering', icon: LayoutGrid, desc: 'K-Means Grouping' }
    ]
  },
  {
    id: 'reporting',
    title: '9. EXPORT / REPORTING',
    items: [
      { type: 'report_pdf', label: 'Generate PDF', icon: FileText, desc: 'Create summary report' },
      { type: 'email_report', label: 'Email Report', icon: Mail, desc: 'Send findings' }
    ]
  }
];
const ActionSidebar = () => {
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    'io': false,
    'exploration': true,
    'cleaning': false,
    'filtering': false,
    'grouping': false,
    'transformation': false,
    'sorting': false,
    'advanced': false,
    'reporting': false, 
    'visualization': false
  });

  const toggleCategory = (id: string) => {
    setOpenCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const onDragStart = (event: React.DragEvent, nodeType: string, nodeLabel: string) => {
    // CRITICAL FIX: Always set type to 'custom' so ReactFlow knows how to render it.
    // We pass the specific label (e.g. "N-Grams") as metadata.
    event.dataTransfer.setData('application/reactflow', 'custom');
    event.dataTransfer.setData('application/label', nodeLabel);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 bg-[#0f172a] border-r border-gray-800 flex flex-col h-full overflow-hidden select-none">
      <div className="p-4 border-b border-gray-800 bg-[#0f172a]">
        <h2 className="text-sm font-bold text-white tracking-wider">ACTIONS LIBRARY</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {CATEGORIES.map((cat) => (
          <div key={cat.id} className="mb-1">
            <button 
              onClick={() => toggleCategory(cat.id)}
              className="w-full flex items-center justify-between p-2 text-[10px] font-bold text-gray-500 hover:text-blue-400 uppercase transition-colors border-b border-gray-800/50"
            >
              <span>{cat.title}</span>
              {openCategories[cat.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {openCategories[cat.id] && (
              <div className="space-y-1 pl-2 pr-1 mt-1 mb-2">
                {cat.items.map((item) => (
                  <div 
                    key={item.type}
                    className="group flex items-center gap-3 p-2 bg-[#1e293b] border border-gray-800 rounded-md cursor-grab hover:border-blue-500/50 hover:bg-gray-800 transition-all active:cursor-grabbing"
                    draggable
                    onDragStart={(e) => onDragStart(e, item.type, item.label)}
                  >
                    <item.icon size={14} className="text-gray-400 group-hover:text-blue-400 shrink-0" />
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-xs font-medium text-gray-300 group-hover:text-white truncate">{item.label}</span>
                      <span className="text-[9px] text-gray-600 group-hover:text-gray-500 truncate">{item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActionSidebar;