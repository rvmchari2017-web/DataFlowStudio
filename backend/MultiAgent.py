import os
import json
import uuid
import time
import re
import google.generativeai as genai
from google.generativeai import caching
from dotenv import load_dotenv
from typing import List, Dict, Any

# Optional OpenAI Import
try:
    from openai import OpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False
    print("⚠️ OpenAI library not found. (pip install openai)")

# Load environment variables
load_dotenv()

# =========================================================================
# SYSTEM INSTRUCTIONS (SHARED)
# =========================================================================
# 1. MANAGER (Lightweight - Consistent and High-Context for Conversational Flow)
MANAGER_INSTRUCTIONS = """
ROLE: Senior AI Workflow Architect & Conversational Manager for DataFlow Studio.
TASK: Analyze User Input, Data Context, and Flow State to determine the most helpful next step (Conversation or Flow Action).
TONE: Senior, professional, highly knowledgeable, proactive, and concise.

### CORE KNOWLEDGE & PERSONA
- **App Name:** DataFlow Studio.
- **Mission:** Empowering users to build complex, secure data pipelines without code.
- **Core Value:** From raw data to dashboard insights in minutes using AI-driven guidance.
- **Interface:** The app uses a drag-and-drop builder with nodes (actions) that connect via wiring.
- **Data Flow Principle:** The output (a DataFrame) of any action automatically becomes the input for the next connected action.

### KNOWLEDGE BASE: APPLICATION ACTIONS & GUIDANCE
(Inject the detailed tables 2A through 2F here, e.g., 'handle_missing_values', 'filter_by_value', 'bar_chart')

### CONVERSATIONAL DIRECTIVES (FAQ & GUIDANCE)
1.  **Welcome & System Status:** Greet users warmly. If the user is logged in and data is present, acknowledge the status immediately ("Welcome back, I see your data is loaded and ready for analysis.").
2.  **Action Lookup:** When asked "What is X action?", provide the definition, *briefly* list its required inputs, and confirm its output type (always a DataFrame, unless it's a visualization or export node).
3.  **How-To/Guidance:** When asked to create a flow ("How to build X flow?"), provide a clear, numbered sequence of specific actions (nodes) the user must drag and connect.
4.  **Login/Security:** Explain mandatory login (Username/Password or SSO) is required for data security, personalization, and access control.
5.  **Execution:** Explain that running a flow requires clicking 'Execute/Run Workflow' on the builder page, and the results will display in the right-hand output panel (Table Sample and Charts).
6.  **Out-of-Scope:** Strictly adhere to the application domain. Politely refuse queries outside of data workflow, security, or DataFlow Studio features.

### INPUT ANALYSIS
1.  **Check Data Context:** Check if 'AVAILABLE_COLUMNS' or 'Current Node' is defined.
2.  **Check User Intent:** Categorize intent: `GREETING`, `FAQ_GUIDANCE`, `FLOW_ACTION` (request to build/change the flow).

### DECISION LOGIC (Strict Priority for Next Action)

**SCENARIO 1: NO DATA CONTEXT & NO CURRENT NODE** (Flow is empty or user is on Landing Page)
- **ACTION:** "GUIDE"
- **RESPONSE:** Friendly welcome to DataFlow Studio. **Proactively guide the user to the starting point:** "To begin, please navigate to the Workflow Builder and drag a **'Read Data'** or **'File Upload'** node onto the canvas." 

**SCENARIO 2: DATA IS READY BUT VAGUE INPUT** (e.g., "Hello", "What can you do?", "Help")
- **ACTION:** "CHAT"
- **RESPONSE:** Friendly greeting. **Acknowledge the data context** and **propose next logical steps.**
    - *Example:* "Hello! I see your data is ready with columns: [list 2-3 specific, interesting columns]. Would you like to start with **data cleaning (e.g., 'handle_missing_values')** or jump straight into **analysis (e.g., 'group_by_aggregate')**?"

**SCENARIO 3: HAS DATA & CLEAR FLOW_ACTION INTENT** (e.g., "Create a report showing sales trends", "I want to filter out nulls in the City column")
- **ACTION:** "GENERATE" (If starting a new flow sequence) OR "MODIFY" (If configuring an existing node).
- **RESPONSE:** **Confirm the Action Step.** Briefly state the action(s) you are preparing for the user.
    - *Example (GENERATE):* "Understood. I will prepare the required actions. We will start with a **'filter_by_value'** node to handle that. Ready to proceed?"
    - *Example (MODIFY):* "Analyzing the configuration for your current node... I am setting the **'method'** parameter to **'drop'** for the 'City' column in the **'handle_missing_values'** action."

**SCENARIO 4: TROUBLESHOOTING/ERROR** (Implicit or explicit error/confusion)
- **ACTION:** "GUIDE"
- **RESPONSE:** Reference the **TROUBLESHOOTING** section and provide a precise, actionable fix (e.g., "It looks like a connection is missing. Please ensure the output handle of the 'Read Data' node is wired to the input handle of the next action.").

### OUTPUT FORMAT (JSON ONLY)
{
    "action": "GUIDE" | "CHAT" | "GENERATE" | "MODIFY",
    "response_text": "Your conversational, actionable response to the user..."
}

"""

# 2. PLANNER (Medium Weight)
PLANNER_INSTRUCTIONS = """
ROLE:  You are the LEAD DATA ARCHITECT.
TASK: Plan the analysis logic.
### DATA CONTEXT SAMPLE
- **Columns Available:**
- **Data Sample (first 20 Unique values of each columns ):**

STRATEGIES:
1. **Single Insight**: For specific questions (Count, Top 10, Filter). Linear Flow.
2. **Full Report**: For "Analyze this", "Dashboard". Hub-and-Spoke Flow (Clean -> Parallel Branches).

---
### OPTION 1: "Single Insight" (Specific Request)
**Trigger:** "Count tickets for New York", "Show sales trend".
**Structure:** Linear Flow.
**Steps:** Filter -> Aggregate -> Visualize.

---
### OPTION 2: "Full Report" (Deep Analysis / Dashboard)
**Trigger:** "Generate report", "Analyze dataset", "Deep dive".
**Architecture:** HUB-AND-SPOKE (Base Layer -> Parallel Branches).
---

**MANDATORY REPORT STRUCTURE:**
1. **BASE LAYER (The Clean Hub):**
    - Define a cleaning sequence: `Select Columns` -> `Fill N/A` -> `Drop Duplicates`-> `Cleaned Data`.
    - This sequence creates the "Cleaned Data" node.

2. **PARALLEL ANALYSIS STEPS (The Spokes):**
    - Create 6-20 independent analysis steps that ALL branch from the "Cleaned Data" node.
    - **Step 1 (Overview):** Value Counts of main category -> Pie Chart.
    - **Step 2 (Trend):** Filter Date -> Group By (Month/Year) -> Line Chart.
    - **Step 3 (Performance):** Group By (Region/Agent) -> Rank -> Top 10 -> Bar Chart.
    - **Step 4 (Target Analysis):** Filter (e.g., Status='Closed') -> KPI Card (Target vs Actual).
    - **Step 5 (Distribution):** Histogram of numerical metric (e.g., Age, Cost).
    - **Step 6 (Deep Dive):** Filter specific segment -> Pivot Table -> Heatmap.
    - **Step 7 (AI Insight):** Sentiment Analysis or Clustering on text/numeric data -> Chart.
    - **Step 8 (Top 100 requests):** Analyse repeated issues on Descriptions/Comments -> Word Count -> Word Cloud.
    - **Step 9 (Top 10 products):** Group By Product value count of the top 10 sales on product names -> Bar Chart.


### OUTPUT FORMAT (JSON ONLY)
{{
    "category": "Full Report" OR "Single Insight",
    "reasoning": "Explanation...",
    "relevant_columns": ["Col1", "Col2"],
    "steps": [
        "Base Layer: Select relevant columns and Fill N/A to create Cleaned Data.",
        "Step 1: From Cleaned Data, aggregate [Col] and show Pie Chart.",
        "Step 2: From Cleaned Data, filter [Date] and show Trend Line.",
        "Step 3: From Cleaned Data, rank Top 10 [Entity] by [Metric]...",
        "Step 4: From Cleaned Data, filter [Condition] and show KPI...",
        "Step 5: From Cleaned Data, ...",
        "Step 6: From Cleaned Data, ...",
        "Step 7: From Cleaned Data, ..."
    ]
}}
"""

# 3. EXECUTOR (HEAVY WEIGHT - PRIMARY TARGET FOR CACHING)
EXECUTOR_INSTRUCTIONS = """
ROLE: Flow Executor.
TASK: Generate Node/Edge JSON.
You are the EXECUTOR AGENT. You build Node-based flows based on a Plan.
### INPUT CONTEXT
- **File Info**: {file_info} (Use this for 'Read Data' config!)
- **Start Node ID**: "{source_id}" (Input Node Position)
- **Plan**: {json.dumps(plan)}
- **Columns**: {columns}
- **Data Values**: {data_summary}

### CONFIG RULES (CRITICAL)
1. **Exact Matching:** When setting 'value' in Filter Rows or 'oldValue' in Replace, you MUST use the EXACT spelling and casing found in 'Data Values'. 
    - *Example:* If data has "New York", do NOT write "new york" or "NY".
    -**Column Names:** Must match the 'Columns' list exactly.
2, ****Node IDs:** Preserve existing IDs if modifying.
3. **Dashboard Layout:** - **Order:** 1, 2, 3... sequentially.
    - **Width:** 'half' for Charts, 'third' for KPIs, 'full' for Tables/Complex Charts.
4. **Start Node Id :** flow Must start with the "{source_id}"
5. **READ DATA:** If a 'Read Data' node is required, you MUST set its config to:
    {{ "selectedFile": {{ "name": "{file_name}", "path": "{file_path}" }} }}
    Do NOT leave it empty.

### AVAILABLE NODES & CONFIG SCHEMAS
**Drop Duplicates**: {{ "label": "Drop Duplicates", "typeLabel": "Drop Duplicates", "config": {{ "keep": "first", "columns": ["ID"] }} }}
**Fill N/A**: {{ "label": "Fill N/A", "typeLabel": "Fill N/A", "config": {{ "method": "value", "value": 0, "column": "Age" }} }}
**Replace Value**: {{ "label": "Replace Value", "typeLabel": "Replace Value", "config": {{ "column": "Status", "oldValue": "Pending", "newValue": "Done" }} }}
**Rename Columns**: {{ "label": "Rename Columns", "typeLabel": "Rename Columns", "config": {{ "oldName": "col_1", "newName": "CustomerID" }} }}
**Change Type**: {{ "label": "Change Data Type", "typeLabel": "Change Data Type", "config": {{ "column": "Price", "dtype": "float" }} }}
**Merge/Join**: {{ "label": "Merge Datasets", "typeLabel": "Merge/Join", "config": {{ "how": "inner", "on": "CustomerID" }} }}
**Filter Rows**: {{ "label": "Filter: Region", "typeLabel": "Filter Rows", "config": {{ "conditions": [{{ "column": "Region", "operator": "==", "value": "Americas" }}] }} }}
**Filter Date**: {{"label": "Filter Date", "typeLabel": "Filter Date", "config": {{"dateRanges": [{{ "column": "Closed At", "startDate": "2025-02-04", "endDate": "2025-12-11"}}] }} }}
**Select Columns**: {{"label": "Select Columns", "typeLabel": "Select Columns", "config": {{"columns": ["Region", "City", "TAT", "TAT Tgt."], "column": "Severity"}} }}      
**Standard Scaler**: {{ "label": "Standard Scaler", "typeLabel": "Standard Scaler", "config": {{ "columns": ["Age", "Salary"] }} }}
**One-Hot Encoding**: {{ "label": "One-Hot Encode", "typeLabel": "One-Hot Encoding", "config": {{ "column": "Category" }} }}
**Group By**: {{"label": "Group By", "typeLabel": "Group By", "config": {{"groupColumns": ["Impact", "Urgency", "Severity", "Priority", "Type", "Category"], "aggregations": [{{"column": "Severity", "func": "sum"}}] }} }}
**Pivot Table**: {{ "label": "Pivot Table", "typeLabel": "Pivot Table", "config": {{ "index": "Date", "columns": "Category", "values": "Sales", "aggFunc": "sum" }} }}
**Value Counts:** {{ "label": "Value Counts", "typeLabel": "Value Counts", "config": {{ "column": "Status" }} }}
**Sort Data**: {{ "label": "Sort Data", "typeLabel": "Sort Data", "config": {{ "column": "Date", "order": "desc" }} }}
**Rank**: {{ "label": "Rank Data", "typeLabel": "Rank", "config": {{ "column": "Score", "method": "dense", "order": "desc" }} }}
**Sentiment Analysis**: {{ "label": "Sentiment Analysis", "typeLabel": "Sentiment Analysis", "config": {{ "column": "Review_Text" }} }}
**Clustering**: {{ "label": "K-Means Clustering", "typeLabel": "Clustering", "config": {{ "columns": ["Income", "Spend_Score"], "k": 3 }} }}
**Forecast**: {{ "label": "Sales Forecast", "typeLabel": "Forecast", "config": {{ "dateColumn": "Order_Date", "periods": 30 }} }}    
**Word Count **:{{"label": "Word Count: Short Description", "typeLabel": "Word Count, "config": {{"column": "Short Description", "reportWidth": "half", "maxWords": "110", "title": "Word Cloud"}} }}
**N-Grams**: {{"label": "N-Grams: Short Description", "typeLabel": "N-Grams", "config": {{"column": "Short Description"}} }}

##. DASHBOARD / VISUALIZATION & CONFIG SCHEMAS
**Preview Data / Sample Data**: {{ "label": "Preview Data", "typeLabel": "Preview Data", "config": {{"n": "200", "mode": "random" ,"reportWidth": "half", "title": "Raw Tabled"}} }}
**KPI Card**: {{ "label": "KPI: Total Revenue", "typeLabel": "KPI Card", "config": {{ "column": "Revenue", "operation": "sum", "label": "Total Revenue", "dashboardOrder": 1, "reportWidth": "third" }} }}
**Bar Chart**: {{ "label": "Sales by Region", "typeLabel": "Bar Chart", "config": {{ "column": "Region", "yAxis": "Sales", "title": "Sales by Region", "dashboardOrder": 2, "reportWidth": "half" }} }}
**Line Chart**: {{ "label": "Growth Trend", "typeLabel": "Line Chart", "config": {{ "column": "Date", "yAxis": "Profit", "title": "Profit Over Time", "dashboardOrder": 3, "reportWidth": "full" }} }}
**Pie Chart**: {{ "label": "Market Share", "typeLabel": "Pie/Donut Chart", "config": {{ "column": "Category", "yAxis": "Count", "title": "Category Dist.", "dashboardOrder": 4, "reportWidth": "half" }} }}
**Area Chart**: {{ "label": "Volume Area", "typeLabel": "Area Chart", "config": {{ "column": "Date", "yAxis": "Volume", "title": "Volume Area", "dashboardOrder": 5, "reportWidth": "half" }} }}
**Scatter Plot**: {{ "label": "Age vs Salary", "typeLabel": "Scatter Plot", "config": {{ "column": "Age", "yAxis": "Salary", "colorBy": "Gender", "title": "Age vs Salary", "dashboardOrder": 6, "reportWidth": "half" }} }}
**Histogram**: {{ "label": "Age Dist.", "typeLabel": "Histogram", "config": {{ "column": "Age", "title": "Age Distribution", "dashboardOrder": 7, "reportWidth": "half" }} }}
**Heatmap**: {{ "label": "Activity Heatmap", "typeLabel": "Heatmap", "config": {{ "column": "Day", "yAxis": "Hour", "title": "Activity Density", "dashboardOrder": 8, "reportWidth": "full" }} }}
**Word Cloud **:{{"label": "Word Cloud: Short Description", "typeLabel": "Word Cloud", "config": {{"column": "Short Description", "reportWidth": "half", "maxWords": "110", "title": "Word Cloud"}} }}

### BRANCHING LOGIC
- If "Full Report", create a linear chain: Source -> Select -> Fill N/A -> **CLEAN_HUB**.
- Then create multiple independent chains starting from **CLEAN_HUB** ID.
- Example Edge: {{ "source": "CLEAN_HUB_ID", "target": "STEP_1_NODE_ID" }}

### MANDATORY RULES
1. **CONNECTIVITY**: 
    - The first node(Base Layer) MUST connect from source "{source_id}".
    - Every node MUST connect to another node. No isolated nodes.
2. **TERMINATION**:
    - **EVERY** flow path MUST end with a Visualization Node (KPI, Chart, or Preview, Word Cloud).
    - Do not end with 'Select Columns' or 'Filter'. Always visualize the result.
3. **VISUAL CONFIG**:
    - **reportWidth**: Use 'third' for KPIs, 'half' for Charts, 'full' for Tables/Complex Charts.
    - **dashboardOrder**: Number sequentially starting from 1.
    - **title**: Short descriptive string.

### OUTPUT FORMAT (JSON ONLY)
{{
    "nodes": [ {{ "id": "n1", "type": "custom", "data": {{...}} }} ],
    "edges": [ {{ "id": "e1", "source": "{source_id}", "target": "n1" }} ]
}}
"""

# 4.Columns instructor
COLUMN_INSTRUCTIONS ="""
ROLE: You are a strict data mapper agent.
TASK: Domain checking and columns mapper.
Your only task is to analyze Data and user's request based on both data Analyse the Domain First.
**Example** Domain is Finance, BAnking, Service, Ticketing System, Marketing, BPO Calls Service, Products, Manufacturing,Industrial...etc.....,

Based on Domain What type of Analysis we need to Do, Write the Domain Analysis report.
Next which is a list of columns (from the provided AVAILABLE_COLUMNS) necessary to fulfill the request.

Analyze the following user request and categorize it:

AVAILABLE COLUMNS: {available_columns}

**Example Output**: {{ "Domain": " its a Sales Data Marketing Domain, we need to analyse the MArketing Strategy to improvement for sales..", "required_columns": ["date", "sales_amount", "region", city", "tickets"] }}

"""
# 4. VALIDATOR (Quality Control)
VALIDATOR_INSTRUCTIONS = """
ROLE: Workflow Validator.
TASK: specific check of the Executor's JSON output.

### VALIDATION CHECKLIST
1. **JSON Syntax:** Is it valid JSON?
2. **Connections:** Does the first edge start with `SOURCE_ID`? Are all nodes connected?
3. **Columns:** Do the config columns actually exist in `AVAILABLE_COLUMNS`?

### OUTPUT
If PASS: { "status": "PASS", "corrected_flow": null }
If FAIL: { "status": "FAIL", "reason": "Edge missing", "correction_instruction": "Add edge from X to Y" }
"""
# =========================================================================
# MODEL MANAGER
# =========================================================================

INSTRUCTIONS = {
            "manager": MANAGER_INSTRUCTIONS,
            "planner": PLANNER_INSTRUCTIONS,
            "executor": EXECUTOR_INSTRUCTIONS,
            "validator": VALIDATOR_INSTRUCTIONS,
            "Column_Mapper": COLUMN_INSTRUCTIONS
        }

# =========================================================================
# MODEL MANAGER (HYBRID)
# =========================================================================
class ModelManager:
    def __init__(self):
        # 1. Setup Gemini
        self.gemini_key = os.getenv("GOOGLE_API_KEY")
        if self.gemini_key:
            genai.configure(api_key=self.gemini_key)
            self.gemini_model_name = "models/gemini-2.5-flash"
        else:
            print("⚠️ WARNING: GOOGLE_API_KEY not found.")

        # 2. Setup OpenAI (Fallback)
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.openai_client = None
        if self.openai_key and HAS_OPENAI:
            try:
                self.openai_client = OpenAI(api_key=self.openai_key)
                self.openai_model_name = "gpt-4o" 
            except Exception as e:
                print(f"⚠️ OpenAI Init Failed: {e}")
            
    def get_gemini_model(self, agent_type):
        instruction = INSTRUCTIONS.get(agent_type, "")
        return genai.GenerativeModel(
            model_name=self.gemini_model_name,
            system_instruction=instruction
        )

# =========================================================================
# MAIN AGENT
# =========================================================================

class MultiAgentWorkFlow:
    def __init__(self):
        self.manager = ModelManager()
        self.last_plan = None
        self.Domain = ""
        self.target_cols = []

    def _call_llm(self, agent_type, prompt, retries=2):
        """
        Hybrid LLM Call: Tries Gemini first -> OpenAI Fallback -> Safe Empty Return
        """
        # 1. Try Gemini
        for attempt in range(retries):
            try:
                model = self.manager.get_gemini_model(agent_type)
                full_prompt = f"{prompt}\n\nIMPORTANT: Return VALID JSON ONLY. No Markdown."
                
                res = model.generate_content(full_prompt)
                return self._parse_json(res.text)

            except Exception as e:
                error_msg = str(e).lower()
                if "429" in error_msg or "quota" in error_msg:
                    print(f"⚠️ Gemini Quota Exceeded. Switching to OpenAI...")
                    break # Break to try OpenAI
                
                print(f"⚠️ Gemini Error (Attempt {attempt+1}): {e}")
                time.sleep(1)

        # 2. Try OpenAI Fallback
        if self.manager.openai_client:
            print(f"🔄 Activating OpenAI Fallback for {agent_type}...")
            res = self._call_openai_fallback(agent_type, prompt)
            if res: return res

        # 3. Ultimate Failure (Return Empty to trigger Agent-Specific Fallbacks)
        print(f"❌ All Models Failed for {agent_type}. Using Hardcoded Fallback.")
        return {}

    def _call_openai_fallback(self, agent_type, prompt):
        try:
            system_text = INSTRUCTIONS.get(agent_type, "You are a helpful AI.")
            
            response = self.manager.openai_client.chat.completions.create(
                model=self.manager.openai_model_name,
                messages=[
                    {"role": "system", "content": system_text},
                    {"role": "user", "content": f"{prompt}\n\nReturn JSON ONLY."}
                ],
                temperature=0.2,
                response_format={ "type": "json_object" }
            )
            content = response.choices[0].message.content
            return self._parse_json(content)

        except Exception as e:
            print(f"❌ OpenAI Connection Error: {e}")
            return {}

    def _parse_json(self, text):
        try:
            text = text.strip()
            if text.startswith('```json'): text = text[7:]
            if text.endswith('```'): text = text[:-3]
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match: return json.loads(match.group(0))
            return json.loads(text)
        except: return {}

    # --- AGENT LOGIC ---

    def categorize_and_select_columns(self, available_columns: List[str]):
        cols_str = json.dumps(available_columns[:50]) 
        prompt = f"Available Columns: {cols_str}"
        return self._call_llm("Column_Mapper", prompt)

    def generate_flow_from_prompt(self, user_request, context=None, chat_history=[]):
        if not user_request or not user_request.strip():
            return {"nodes": [], "message": "I'm listening. How can I help?"}
            
        # 1. Context
        columns = context.get('columns', [])
        data_preview = context.get('dataPreview', [])
        current_nodes = context.get('currentNodes', [])
        latest_file = context.get('latestFile', None)
        
        selected_node = context.get('selectedNode', None)
        source_id = selected_node.get('id') if selected_node else None
        
        if not source_id and current_nodes:
            source_id = current_nodes[-1].get('id')
        if not source_id: source_id = "1" 

        has_context = "YES" if (columns and len(columns) > 0) else "NO"
        
        # 2. Manager Decision
        intent = self._manager_decide(user_request, has_context, columns, chat_history)
        
        # FAIL-SAFE: If Manager fails (empty dict), default to Chat
        if not intent:
            intent = {"action": "CHAT", "response_text": "I'm experiencing connection issues, but I'm trying to process your request..."}

        action = intent.get("action", "CHAT")
        response_text = intent.get("response_text", "I'm here to help.")
        
        if action in ["GUIDE", "CHAT"]:
            print(f"🤖 Manager Action: {action}")
            return {"nodes": [], "message": response_text}
        
        print(f"🤖 Manager Action: {action} -> Generating...")
        
        # 3. Data Context Prep
        data_summary = "No Data"
        self.target_cols = columns[:15] 

        if columns and data_preview:
            try:
                # Only call column mapper if we have Gemini/OpenAI working
                # We skip this if connection is flaky to save 1 call
                unique_map = {}
                cols_to_scan = columns[:10]
                for col in cols_to_scan: 
                    vals = [str(r.get(col)) for r in data_preview if r.get(col) is not None]
                    unique_map[col] = list(set(vals))[:8]
                data_summary = json.dumps(unique_map, default=str)
            except Exception as e: print(f"⚠️ Data Prep Warning: {e}")

        # 4. Planner
        request = f"{user_request}"
        plan = self._planner_agent(request, self.target_cols, data_summary, chat_history)
        
        # FAIL-SAFE: If Planner fails, create default plan
        if not plan:
            print("⚠️ Planner Failed. Using Default Plan.")
            plan = {"category": "Single Insight", "steps": ["Show Preview"]}

        # 5. Executor & Validator Loop
        node_context = json.dumps([n.get('data', {}).get('typeLabel') for n in current_nodes]) if current_nodes else "None"
        
        final_flow = self._run_executor_with_validation(plan, self.target_cols, data_summary, node_context, latest_file, source_id)
        
        # 6. Layout
        return self._apply_layout(final_flow, source_id)

    def _run_executor_with_validation(self, plan, cols, data, current_nodes, file_info, source_id):
        max_retries = 1 # Reduce retries to fail fast
        
        for attempt in range(max_retries + 1):
            print(f"⚙️ Executing Flow (Attempt {attempt+1})...")
            
            # 1. Execute
            flow = self._executor_agent(plan, cols, data, current_nodes, file_info, source_id)
            
            # 2. Validate (Skip validation if flow is empty)
            if not flow or not flow.get("nodes"):
                continue

            # Optional: Validator Agent (Can skip to save tokens if connection is bad)
            # validation = self._validator_agent(flow, source_id, cols)
            # if validation.get("status") == "PASS": return flow
            return flow # Assume success if we got nodes
        
        # 3. Fallback (Safe Mode)
        print("🔥 All AI Models Failed. Activating Safe Fallback.")
        return self._fallback_agent(source_id)

    # --- AGENT CALLS ---
    def _manager_decide(self, text, has_data, columns, history):
        col_snippet = str(columns[:5]) if columns else "None"
        hist_text = "\n".join([f"{m['role']}: {m['content']}" for m in history[-3:]])
        prompt = f"USER: {text}\nDATA_READY: {has_data}\nCOLS: {col_snippet}\nHISTORY: {hist_text}\nDECIDE."
        return self._call_llm("manager", prompt)

    def _planner_agent(self, text, cols, data, history):
        hist_text = "\n".join([f"{m['role']}: {m['content']}" for m in history[-3:]])
        prompt = f"REQ: {text}\nCOLS: {cols}\nDATA: {data}\nHIST: {hist_text}"
        return self._call_llm("planner", prompt)

    def _executor_agent(self, plan, cols, data, current_nodes, file_info, source_id):
        file_str = json.dumps(file_info) if file_info else "None"
        prompt = f"""
        PLAN: {json.dumps(plan)}
        FILE_INFO: {file_str}
        SOURCE_ID: "{source_id}"
        COLS: {cols}
        DATA: {data}
        EXISTING_NODES: {current_nodes}
        GENERATE VALID JSON.
        """
        return self._call_llm("executor", prompt)

    def _validator_agent(self, flow, source_id, cols):
        prompt = f"""
        FLOW_TO_CHECK: {json.dumps(flow)}
        REQUIRED_START_NODE: "{source_id}"
        AVAILABLE_COLUMNS: {cols}
        Check if flow starts with source_id.
        """
        return self._call_llm("validator", prompt)

    def _fallback_agent(self, source_id):
        node_id = f"node_{uuid.uuid4().hex[:6]}"
        return {
            "nodes": [{
                "id": node_id,
                "type": "custom",
                "data": { 
                    "typeLabel": "Preview Data", 
                    "label": "AI Offline - Data Preview",
                    "config": { "n": 20 }
                }
            }],
            "edges": [{
                "id": f"e_fallback",
                "source": source_id,
                "target": node_id
            }]
        }

    def _apply_layout(self, flow, source_id):
        nodes = flow.get("nodes", [])
        edges = flow.get("edges", [])
        start_x, start_y = 200, 100
        
        cleaned_nodes = []
        for n in nodes:
            if "id" not in n: n["id"] = f"node_{uuid.uuid4().hex[:6]}"
            n["width"] = 182
            n["height"] = 75
            n["type"] = "custom"
            if "data" not in n: n["data"] = {}
            if "typeLabel" not in n["data"]: 
                n["data"]["typeLabel"] = n.get("label", "Node")
            cleaned_nodes.append(n)
        
        for i, node in enumerate(cleaned_nodes):
            x = start_x + (i * 250)
            y = start_y
            node["position"] = {"x": x, "y": y}

        if len(cleaned_nodes) > 0:
            has_anchor = any(e['source'] == source_id and e['target'] == cleaned_nodes[0]['id'] for e in edges)
            if not has_anchor:
                edges.insert(0, {"id": f"e_anchor_{uuid.uuid4().hex[:4]}", "source": source_id, "target": cleaned_nodes[0]['id']})

            if len(edges) <= 1 and len(cleaned_nodes) > 1:
                for i in range(len(cleaned_nodes) - 1):
                    edges.append({
                        "id": f"e_{uuid.uuid4().hex[:6]}",
                        "source": cleaned_nodes[i]["id"],
                        "target": cleaned_nodes[i+1]["id"]
                    })

        return {"nodes": cleaned_nodes, "edges": edges}

agent = MultiAgentWorkFlow()