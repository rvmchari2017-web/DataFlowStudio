import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { workflowAPI } from './utils/api';
import { 
  PlusCircle, Activity, LogOut, Clock, Play, Edit, Trash2, 
  LayoutGrid, FileText
} from 'lucide-react';
import WorkflowBuilderWrapper from './components/WorkflowBuider';
import LoginPage from './components/LoginPage';
import ReportPage from './components/ReportPage'; // Ensure this matches your file name

// --- COMPONENT: GALLERY (The "Home" Dashboard) ---
const Gallery = () => {
  const navigate = useNavigate();
  const [flows, setFlows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = localStorage.getItem('userId');
  const username = localStorage.getItem('username');

  useEffect(() => {
    if (userId) {
        workflowAPI.getFlows(parseInt(userId)).then(data => {
            setFlows(data.flows || []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }
  }, [userId]);

  const handleRun = (flow: any) => navigate('/builder', { state: { flowToLoad: flow, autoRun: true } });
  const handleEdit = (flow: any) => navigate('/builder', { state: { flowToLoad: flow } });
  
  // New: Direct Report Access
  const handleViewReport = (flow: any) => {
      // We pass the flow data. Note: If executionResult is empty, ReportPage will ask to run it.
      navigate('/report', { state: { flowData: { name: flow.name, nodes: flow.nodes, executionResult: flow.executionResult } } });
  };

  const handleDelete = async (flowId: number) => { 
      if (window.confirm("Are you sure you want to delete this flow?")) { 
          if (userId) {
              await workflowAPI.deleteFlow(parseInt(userId), flowId); 
              setFlows(prev => prev.filter(f => f.id !== flowId));
          }
      } 
  };

  const handleLogout = () => { localStorage.clear(); window.location.href = '/'; };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-10 font-sans">
      <header className="flex justify-between items-center mb-10 border-b border-gray-800 pb-6">
        <div>
            <h1 className="text-2xl font-bold flex items-center gap-3 text-blue-500">
                <LayoutGrid className="w-8 h-8" /> DataFlow Studio
            </h1>
            <p className="text-gray-400 text-sm mt-1">Welcome back, {username}</p>
        </div>
        <button onClick={handleLogout} className="text-red-400 hover:text-red-300 text-sm flex items-center gap-2 border border-red-900/50 bg-red-900/10 px-4 py-2 rounded-lg transition-colors">
            <LogOut size={16} /> Logout
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {/* New Flow Card */}
        <div onClick={() => navigate('/builder')} className="bg-[#1e293b]/50 border-2 border-dashed border-gray-700 rounded-xl h-56 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-[#1e293b] transition-all group">
          <div className="bg-blue-600/20 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
              <PlusCircle className="w-8 h-8 text-blue-500" />
          </div>
          <span className="font-bold text-gray-300 group-hover:text-white">Create New Flow</span>
        </div>

        {/* Saved Flows */}
        {loading ? <div className="text-gray-500 col-span-3">Loading your projects...</div> : flows.map((flow) => (
            <div key={flow.id} className="bg-[#1e293b] border border-gray-700 rounded-xl p-5 flex flex-col justify-between hover:border-gray-500 transition-all hover:shadow-xl h-56 group relative">
                <div>
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-mono bg-blue-900/30 text-blue-400 px-2 py-1 rounded border border-blue-900/50">ID: {flow.id}</span>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                            <Clock size={10} />
                            <span>{new Date(flow.updated_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <h3 className="font-bold text-lg text-gray-100 mb-1 truncate" title={flow.name}>{flow.name}</h3>
                    <p className="text-xs text-gray-500">{flow.nodes.length} Steps Configured</p>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-700/50">
                    <button onClick={() => handleRun(flow)} className="col-span-1 bg-green-600/10 hover:bg-green-600/20 text-green-400 py-2 rounded-lg flex justify-center items-center transition-colors" title="Run">
                        <Play size={16} />
                    </button>
                    <button onClick={() => handleEdit(flow)} className="col-span-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 py-2 rounded-lg flex justify-center items-center transition-colors" title="Edit">
                        <Edit size={16} />
                    </button>
                    <button onClick={() => handleViewReport(flow)} className="col-span-1 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 py-2 rounded-lg flex justify-center items-center transition-colors" title="View Report">
                        <FileText size={16} />
                    </button>
                    <button onClick={() => handleDelete(flow.id)} className="col-span-1 bg-red-600/10 hover:bg-red-600/20 text-red-400 py-2 rounded-lg flex justify-center items-center transition-colors" title="Delete">
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

// --- ROUTE GUARDS ---
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const auth = localStorage.getItem('isAuthenticated') === 'true';
  return auth ? <>{children}</> : <Navigate to="/" replace />;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const auth = localStorage.getItem('isAuthenticated') === 'true';
  return auth ? <Navigate to="/dashboard" replace /> : <>{children}</>;
};

// --- MAIN APP COMPONENT ---
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
        
        {/* THE GALLERY (Your "Home" Dashboard) */}
        <Route path="/dashboard" element={<ProtectedRoute><Gallery /></ProtectedRoute>} />
        
        {/* THE BUILDER (Where you drag & drop nodes) */}
        <Route path="/builder" element={<ProtectedRoute><WorkflowBuilderWrapper /></ProtectedRoute>} />
        
        {/* THE ANALYTICS REPORT (The clean dashboard with charts/tables) */}
        <Route path="/report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;