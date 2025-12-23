import os
import shutil
import math
import json
from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
import database as db
from MultiAgent import agent
from engine import engine



app = FastAPI(title="DataFlow Studio Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "backend/temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)



# --- MODELS ---
class AuthRequest(BaseModel):
    username: str
    password: str

class FlowSaveRequest(BaseModel):
    user_id: int
    name: str
    flow_id: Optional[int] = None # Added flow_id for updates
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]

class WorkflowRequest(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
# Updated Context Model to be explicit
class AIContext(BaseModel):
    columns: List[str] = []
    selectedNodes: List[Dict[str, Any]] = []
class AIChatRequest(BaseModel):
    message: str
    user_id: int
    flow_id: Optional[int] = None
    context: Optional[Dict[str, Any]] = None

# --- HELPER: RECURSIVE JSON SANITIZER ---
def sanitize_for_json(obj):
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj): return None
        return obj
    elif isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    elif isinstance(obj, (np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.float64, np.float32)):
        return None if np.isnan(obj) or np.isinf(obj) else float(obj)
    return obj
def format_error_log(context: str, error: Exception):
    return f"❌ [{context}] Error: {str(error)}"
# --- ROUTES ---
@app.get("/")
def health_check():
    return {"status": "active", "message": "System Online"}

@app.post("/api/signup")
def signup(creds: AuthRequest):
    success = db.create_user(creds.username, creds.password)
    if not success:
        raise HTTPException(status_code=400, detail="Username already exists")
    return {"status": "success", "message": "User created"}

@app.post("/api/login")
def login(creds: AuthRequest):
    user_id = db.verify_user(creds.username, creds.password)
    if user_id:
        return {"status": "success", "token": "session-token", "user_id": user_id, "username": creds.username}
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.post("/api/flows/save")
def save_flow(flow: FlowSaveRequest):
    # db.save_flow(flow.user_id, flow.name, flow.nodes, flow.edges)
    fid = db.save_flow(flow.user_id, flow.name, flow.nodes, flow.edges, flow.flow_id)
    return {"status": "success", "message": "Flow saved successfully","flow_id": fid}

@app.get("/api/flows/{user_id}")
def get_flows(user_id: int):
    flows = db.get_user_flows(user_id)
    return {"status": "success", "flows": sanitize_for_json(flows)}

@app.delete("/api/flows/{user_id}/{flow_id}")
def delete_flow(user_id: int, flow_id: int):
    if db.delete_flow(flow_id, user_id): return {"status": "success"}
    raise HTTPException(404, "Flow not found")
# --- NEW: LIST AVAILABLE FILES ---
# --- LIST FILES FOR SPECIFIC USER ---
@app.get("/api/files/{user_id}")
def list_user_files(user_id: int):
    files = db.get_files_by_user(user_id)
    return {"status": "success", "files": files}

# --- UPLOAD WITH USER ID ---
@app.post("/api/upload")
async def upload_files(
    user_id: int = Form(...),
    files: List[UploadFile] = File(...)
):
    metadata_list = []
    try:
        for file in files:
            path = f"{UPLOAD_DIR}/{file.filename}"
            with open(path, "wb") as buffer: 
                shutil.copyfileobj(file.file, buffer)
            
            file_size = os.path.getsize(path)
            db.save_file_record(user_id, file.filename, path, file_size)
            
            meta = {"name": file.filename, "path": path, "type": "csv", "sheets": [], "columns": []}
            try:
                if file.filename.endswith('.csv'):
                    df_preview = pd.read_csv(path, nrows=0)
                    meta["columns"] = list(df_preview.columns)
                elif file.filename.endswith(('.xlsx', '.xls')):
                    xls = pd.ExcelFile(path)
                    meta["sheets"] = xls.sheet_names
                    meta["type"] = "excel"
                    if meta["sheets"]:
                        df_preview = pd.read_excel(path, sheet_name=meta["sheets"][0], nrows=0)
                        meta["columns"] = list(df_preview.columns)
            except: pass
            metadata_list.append(meta)
            
        return {"status": "success", "files": metadata_list}
    except Exception as e:
        print(f"Upload Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/execute")
async def execute_workflow(workflow: WorkflowRequest):
    try:
        
        raw_result = await engine.execute_flow(workflow.nodes, workflow.edges)
        return sanitize_for_json(raw_result)
    except Exception as e:
        print(f"Execution Error: {e}")
        return {
            "status": "error", 
            "message": str(e), 
            "logs": [f"🔥 Critical Backend Error: {str(e)}"]
        }



@app.post("/api/ai-chat")
async def ai_chat(req: AIChatRequest):
    print("🤖 AI Agent Activated")
    # print( " Reuest : " ,request)
    logs = []
    try:
        # 1. Save User Message
        db.save_chat_message(req.user_id, req.flow_id, "user", req.message)
        
        # 2. Get History
        history = db.get_chat_history(req.user_id, req.flow_id)
        # 3. GET LATEST FILE (Context Injection)
        # This fixes the "Read Data" node being empty
        user_files = db.get_files_by_user(req.user_id)
        latest_file = user_files[0] if user_files else None
        
        ctx = req.context or {}
        # Inject the file info into the context
        if latest_file:
            ctx['latestFile'] = latest_file
        
        result = agent.generate_flow_from_prompt(req.message, ctx, history)
        
        if result.get("logs"): logs.extend(result["logs"])
        # 4. DETERMINE RESPONSE TEXT (Crucial Fix)
        # If the Agent returned a specific message (from GUIDE or CHAT), use it.
        # Otherwise, if nodes were generated, use a success message.
        if result.get("message"):
            ai_text = result["message"]
        elif result.get("nodes") and len(result["nodes"]) > 0:
            filename = latest_file['name'] if latest_file else "your file"
            ai_text = f"I've created a workflow using **{filename}**. I've added the Read Data node automatically."
        else:
            # Fallback if Agent returned nothing
            ai_text = "I couldn't understand that request. Please try again."
        
        # 5. Save AI Response
        db.save_chat_message(req.user_id, req.flow_id, "assistant", ai_text)
        
        return {
            "type": "flow_suggestion" if result.get("nodes") else "text",
            "message": ai_text,
            "flow": result,
            "history": history + [{"role": "assistant", "content": ai_text}]
        }
    except Exception as e:
        error_log = format_error_log("AI Chat", e)
        print(error_log)
        return {"type": "text", "message": "System Error. Check logs.", "logs": [error_log]}
    #     # --- ENHANCEMENT: Log context size for debugging ---
    #     cols = context_dict.get('columns', [])
    #     stats = context_dict.get('dataStats', {})
    #     preview = context_dict.get('dataPreview', {})
        
    #     if not preview:
    #         print("preview : ",preview)
    #         return {
    #             "type": "text",
    #             "message": """I couldn't generate a valid flow. Please ensure data is loaded.
    #             📝 Configuration Instructions:
    #             Click the Edit button located on the top right of the interface.
    #             Select the Preview Node within the workspace or diagram.
    #             Add the preview element or functionality to the selected node.
    #             """
    #             } 
        
    #     else:
    #         print(f"Context: {len(cols)} columns, Stats available: {bool(stats)}")
    #         # Call the Enhanced Multi-Agent System
    #         flow_structure = agent.generate_flow_from_prompt(request.message, context_dict)
            
    #         if flow_structure and len(flow_structure.get('nodes', [])) > 0:
    #             count = len(flow_structure['nodes'])
    #             return {
    #                 "type": "flow_suggestion",
    #                 "message": f"I've analyzed the data and designed a {count}-step dashboard report. It handles cleaning, aggregation, and generates {count} charts/KPIs.",
    #                 "flow": flow_structure
    #             }
    #         else:
    #             return {"type": "text", "message": "I couldn't generate a valid flow. Please ensure data is loaded."}
    # except Exception as e:
    #     print(f"Server AI Error: {str(e)}")
    #     return {"type": "text", "message": f"AI System Error: {str(e)}"}
@app.get("/api/chat/history/{user_id}/{flow_id}")
def get_history(user_id: int, flow_id: int):
    try:
        return {"status": "success", "history": db.get_chat_history(user_id, flow_id)}
    except Exception as e:
        return {"status": "error", "logs": [format_error_log("Get History", e)]}
@app.post("/api/report")
async def generate_report(workflow: WorkflowRequest):
    
    return {"status": "success", "summary": "Report Ready"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)