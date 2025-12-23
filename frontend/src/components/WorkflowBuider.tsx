import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  MiniMap, 
  useNodesState, 
  useEdgesState, 
  Connection, 
  ReactFlowProvider,
  Node,
  Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Play, Save, LayoutGrid, LogOut, FileText, ChevronLeft, Loader2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { workflowAPI } from '../utils/api';
import ConfigPanel from './ConfigPanel';
import ActionSidebar from './ActionSidebar';
import RightPanel from './RightPanel';
import CustomNode from './CustomNode';

const WorkflowBuilder = () => {
const navigate = useNavigate();
const location = useLocation(); 
const reactFlowWrapper = useRef<HTMLDivElement>(null);

const [nodes, setNodes, onNodesChange] = useNodesState([]);
const [edges, setEdges, onEdgesChange] = useEdgesState([]);
const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

const [fileColumns, setFileColumns] = useState<string[]>([]);
const [selectedNode, setSelectedNode] = useState<any>(null);
const [executionResult, setExecutionResult] = useState<any>(null);
const [isExecuting, setIsExecuting] = useState(false);
const [flowName, setFlowName] = useState("Untitled Flow");

// NEW: Track Flow ID for AI Memory
const [currentFlowId, setCurrentFlowId] = useState<number | undefined>(undefined);
const userId = parseInt(localStorage.getItem('userId') || '0');

  // --- 1. LOAD FLOW ---
  useEffect(() => {
      if (location.state?.flowToLoad) {
          const flow = location.state.flowToLoad;
          setNodes(flow.nodes || []);
          setEdges(flow.edges || []);
          setFlowName(flow.name || "Untitled Flow");
          setCurrentFlowId(flow.id);
          if (flow.executionResult) {
              setExecutionResult(flow.executionResult);
              if (flow.executionResult.final_output?.columns) setFileColumns(flow.executionResult.final_output.columns);
          }
      }
  }, [location.state, setNodes, setEdges]);

  // --- 2. GLOBAL COLUMN SYNC ---
  useEffect(() => {
      // Always try to keep fileColumns populated from the latest execution or upload
      if (executionResult?.node_outputs) {
          // Find the last executed node's columns
          const outputKeys = Object.keys(executionResult.node_outputs);
          if (outputKeys.length > 0) {
              const lastNode = executionResult.node_outputs[outputKeys[outputKeys.length - 1]];
              if (lastNode.columns) setFileColumns(lastNode.columns);
          }
      } else {
          // Fallback to upload config
          const source = nodes.find(n => n.data.config?.uploadedFiles?.[0]?.columns);
          if (source) setFileColumns(source.data.config.uploadedFiles[0].columns);
      }
  }, [executionResult, nodes]);

  // --- 3. HANDLERS ---
  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);
  const onDragOver = useCallback((event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }, []);
  
  const onDrop = useCallback((event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/label');
      if (!type || !reactFlowInstance ) return;

      const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const newNode = {
        id: `node_${nodes.length + 1}_${Date.now()}`,
        type: 'custom',
        position,
        data: { label: label, typeLabel: label, config: {} },
      };

      setNodes((nds) => nds.concat(newNode));
      setSelectedNode(newNode);
  }, [reactFlowInstance, nodes, setNodes]);

  const onNodeClick = (_: React.MouseEvent, node: any) => { setSelectedNode(node); };

  // --- 4. EXECUTION ENGINE ---
  const runFlow = async (currentNodes: Node[], currentEdges: Edge[]) => {
      setIsExecuting(true);
      try {
          // Pass the CURRENT state of nodes/edges to backend
          const result = await workflowAPI.executeWorkflow(currentNodes, currentEdges);
          setExecutionResult(result);
          return result;
      } catch (error) {
          console.error("Auto-Run Failed:", error);
      } finally {
          setIsExecuting(false);
      }
  };

  // --- 5. SAVE CONFIG & AUTO-RUN ---
  const handleSaveConfig = async (nodeId: string, newConfig: any) => {
    // 1. Update the Node State first
    const updatedNodes = nodes.map((node) => {
        if (node.id === nodeId) {
          let summary = node.data.typeLabel;
          // Dynamic Labeling for better UX
          if (newConfig.fileName) summary = newConfig.fileName;
          else if (newConfig.column) summary = `${node.data.typeLabel}: ${newConfig.column}`;
          
          return { ...node, data: { ...node.data, config: newConfig, label: summary } };
        }
        return node;
    });

    setNodes(updatedNodes);
    setSelectedNode(null); // Close panel
    // Auto-Run logic
    setIsExecuting(true);
    try {
      const result = await workflowAPI.executeWorkflow(updatedNodes, edges);
      setExecutionResult(result);
    } catch (e) { console.error(e); } finally { setIsExecuting(false); }
    // 2. AUTO-EXECUTE to pass data to next node
    // This satisfies: "click on bottom of save config then automatically run"
    await runFlow(updatedNodes, edges);
  };

  // Manual Execute Button (Bottom Bar)
  const handleManualExecute = () => runFlow(nodes, edges);

  const handleSaveFlow = async () => {
      // const userId = localStorage.getItem('userId');
      if (!userId) { alert("Please login."); return; }
      const name = prompt("Enter flow name:", flowName);
      if (!name) return;
      setFlowName(name);
      // try { await workflowAPI.saveFlow(parseInt(userId), name, nodes, edges); alert("Saved!"); } 
      // catch (e) { alert("Save failed."); }
      try { 
          // Capture new ID after save
          const res = await workflowAPI.saveFlow(userId, name, nodes, edges, currentFlowId); 
          if(res.flow_id) setCurrentFlowId(res.flow_id);
          alert("Saved!"); 
      } 
      catch (e) { alert("Save failed."); }
  };

  const handleGenerateReport = () => {
      navigate('/report', { state: { flowData: { name: flowName, nodes, edges, executionResult } } });
  };

  const applyAIFlow = (newNodes: any[], newEdges: any[]) => {
      const mergedNodes = [...nodes, ...newNodes];
      const mergedEdges = [...edges, ...newEdges];
      setNodes(mergedNodes);
      setEdges(mergedEdges);
      // Auto-run AI suggestions too
      runFlow(mergedNodes, mergedEdges);
  };

  const handleLogout = () => { localStorage.clear(); window.location.href = '/'; };

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] text-white overflow-hidden">
      <div className="h-14 bg-[#0f172a] border-b border-gray-800 flex items-center justify-between px-4 z-20 shrink-0">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white flex items-center gap-1 text-xs font-bold uppercase"><ChevronLeft size={14} /> Gallery</button>
            <div className="h-4 w-px bg-gray-800"></div>
            <h1 className="text-sm font-bold text-blue-500 flex items-center gap-2"><LayoutGrid size={18} /> DataFlow Studio</h1>
        </div>
        <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">User: {localStorage.getItem('username')}</span>
            <button onClick={handleLogout} className="text-red-400 text-xs flex items-center gap-1 hover:text-red-300"><LogOut size={14} /> Logout</button>
        </div>
      </div>

      <div className="h-12 bg-[#1e293b] border-b border-gray-800 flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-bold uppercase">Current Flow:</span>
            <span className="text-sm font-bold text-white">{flowName}</span>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={handleSaveFlow} className="flex items-center gap-2 bg-[#0f172a] border border-gray-700 hover:bg-gray-800 text-gray-300 px-3 py-1.5 rounded text-xs"><Save size={14} /> Save</button>
            <button onClick={handleGenerateReport} className="flex items-center gap-2 bg-[#0f172a] border border-gray-700 hover:bg-gray-800 text-gray-300 px-3 py-1.5 rounded text-xs"><FileText size={14} /> Report</button>
            <div className="h-6 w-px bg-gray-700 mx-2"></div>
            <button onClick={handleManualExecute} disabled={isExecuting} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded text-xs font-bold disabled:opacity-50 shadow-lg">
                {isExecuting ? <Loader2 className="animate-spin" size={14}/> : <Play size={14} fill="currentColor" />}
                {isExecuting ? 'Processing...' : 'Execute'}
            </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <ActionSidebar />
        <div className="flex-1 relative h-full bg-[#020617]" ref={reactFlowWrapper}>
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onInit={setReactFlowInstance} onDrop={onDrop} onDragOver={onDragOver} onNodeClick={onNodeClick} fitView>
                <Background color="#1e293b" gap={20} size={1} />
                <Controls className="bg-gray-800 border-gray-700 fill-white" />
                <MiniMap className="bg-gray-800 border-gray-700" />
            </ReactFlow>
        </div>
        {/* --- PASSING IDs TO RIGHT PANEL --- */}
        <RightPanel 
            executionResult={executionResult} 
            onApplyFlow={applyAIFlow} 
            selectedNodeId={selectedNode?.id} 
            allNodes={nodes}
            userId={userId} 
            flowId={currentFlowId}
        />
      </div>
      {selectedNode && (
        <ConfigPanel 
            key={selectedNode.id} 
            node={selectedNode} 
            nodes={nodes} 
            edges={edges} 
            onSave={handleSaveConfig} 
            onClose={() => setSelectedNode(null)} 
            columns={fileColumns} 
            executionResult={executionResult}
        />
      )}
    </div>
  );
};

const WorkflowBuilderWrapper = () => <ReactFlowProvider><WorkflowBuilder /></ReactFlowProvider>;
export default WorkflowBuilderWrapper;