import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const workflowAPI = {
  checkHealth: async () => {
    try { return (await apiClient.get('/')).data; } 
    catch { return { status: "offline" }; }
  },
  login: async (creds: any) => (await apiClient.post('/api/login', creds)).data,
  signup: async (creds: any) => (await apiClient.post('/api/signup', creds)).data,
  // NEW: Get files for specific user
  listFiles: async (userId: string | number) => (await apiClient.get(`/api/files/${userId}`)).data,

  // NEW: Upload with User ID
  uploadFiles: async (userId: string | number, files: FileList | File[]) => {
    const formData = new FormData();
    formData.append('user_id', String(userId));
    Array.from(files).forEach((file) => formData.append('files', file));
    return (await apiClient.post('/api/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
  },

  executeWorkflow: async (nodes: any[], edges: any[]) => (await apiClient.post('/api/execute', { nodes, edges })).data,
 // UPDATED: Save Flow returns flow_id
  saveFlow: async (uid: number, name: string, nodes: any[], edges: any[], flowId?: number) => 
    (await apiClient.post('/api/flows/save', { user_id: uid, name, nodes, edges, flow_id: flowId })).data,
  
  getFlows: async (uid: number) => (await apiClient.get(`/api/flows/${uid}`)).data,
  
  // NEW: Delete Flow
  deleteFlow: async (uid: number, flowId: number) => (await apiClient.delete(`/api/flows/${uid}/${flowId}`)).data,

// Now accepts a full payload object to match server's Pydantic model
  aiChat: async (payload: { message: string, user_id: number, flow_id?: number, context: any }) => 
    (await apiClient.post('/api/ai-chat', payload)).data,

  getChatHistory: async (uid: number, fid: number) => (await apiClient.get(`/api/chat/history/${uid}/${fid}`)).data,
  generateReport: async (nodes: any[], edges: any[]) => (await apiClient.post('/api/report', { nodes, edges })).data
};