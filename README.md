
# 🌊 DataFlow Studio

### *The Agentic AI-Powered No-Code Data Engineering Platform*

**DataFlow Studio** is a visual, no-code platform that empowers users to build complex data pipelines and analytical dashboards simply by dragging nodes or chatting with an AI Agent.

Unlike standard chatbots, DataFlow Studio uses a **Multi-Agent AI Architecture** (Manager, Planner, Executor, Validator) to physically build, connect, and configure executable workflows on a canvas.

---

## 🚀 Key Features

* **🤖 Agentic AI Co-Pilot:** Chat with the AI to automatically generate entire data workflows (e.g., "Analyze sales trends from this file").
* **🎨 Visual Workflow Builder:** Drag-and-drop interface for cleaning, transforming, and visualizing data.
* **🛡️ Self-Healing Logic:** A dedicated Validator Agent detects logical errors (e.g., missing edges, wrong columns) and fixes them automatically.
* **☁️ Enterprise Connectors:** Secure integration with **Google Drive** (via Service Accounts) and local file uploads.
* **🧠 Hybrid AI Engine:** Powered by **Google Gemini (Vertex AI)** with an automatic fallback to **OpenAI GPT-4o** for maximum reliability.
* **📊 Dynamic Dashboards:** Generate interactive charts (Bar, Line, Pie, Scatter, Heatmaps) and KPI cards instantly.

---

## 🛠️ Tech Stack

### **Frontend**

* **Framework:** React (Vite)
* **Language:** TypeScript
* **UI Library:** Tailwind CSS
* **Visual Graph:** React Flow
* **Icons:** Lucide React

### **Backend**

* **Framework:** Python (FastAPI / Flask)
* **Data Processing:** Pandas, NumPy
* **Graph Logic:** NetworkX
* **AI Integration:** `google-generativeai`, `google-cloud-aiplatform`, `openai`

### **Infrastructure (GCP)**

* **Compute:** Google Cloud Run (Recommended)
* **AI:** Vertex AI / Gemini API
* **Storage:** Cloud Storage & Drive API
* **Auth:** Service Accounts & OAuth 2.0

---

## ⚙️ Installation & Setup

### **Prerequisites**

* Node.js (v18+)
* Python (v3.9+)
* Google Cloud Platform Account

### **1. Backend Setup**

1. Navigate to the backend folder:
```bash
cd App_Backend

```


2. Create and activate a virtual environment:
```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

```


3. Install dependencies:
```bash
pip install -r requirements.txt

```


*(Ensure `google-cloud-aiplatform`, `google-generativeai`, `openai`, `pandas`, `networkx`, `python-dotenv` are in requirements.txt)*
4. **Configuration:**
* Create a `.env` file:
```env
GOOGLE_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key  # Optional (Fallback)

```


* **Google Drive Setup:**
* Generate a **Service Account Key** from GCP Console.
* Rename it to `service_account.json` and place it in the `App_Backend/` root.




5. Run the server:
```bash
python server.py
# or
uvicorn server:app --reload

```



### **2. Frontend Setup**

1. Navigate to the frontend folder:
```bash
cd frontend

```


2. Install dependencies:
```bash
npm install

```


3. Start the development server:
```bash
npm run dev

```


4. Open `http://localhost:5173` in your browser.

---

## ☁️ Google Cloud Configuration

To enable the AI and Google Drive features, you must enable the following APIs in your GCP Project:

1. **Vertex AI API** (`aiplatform.googleapis.com`)
2. **Google Drive API** (`drive.googleapis.com`)
3. **Generative Language API** (`generativelanguage.googleapis.com`)

**Terminal Command:**

```bash
gcloud services enable aiplatform.googleapis.com drive.googleapis.com generativelanguage.googleapis.com

```

---

## 📖 Usage Guide

### **1. Building a Flow Manually**

* Open the sidebar and drag a **"Read Data"** node.
* Select a file from the server list.
* Drag a **"Filter Rows"** node and connect it. Configure the logic (e.g., `City == 'New York'`).
* Drag a **"Bar Chart"** node and connect it. Select X and Y axes.
* Click **"Run Workflow"** to see results.

### **2. Using the AI Agent**

* Click the **"AI Assistant"** button.
* Type a request: *"Load the sales data, remove empty rows, and show me a pie chart of sales by region."*
* The AI will:
1. **Plan** the steps.
2. **Generate** the nodes on the canvas.
3. **Validate** connections.
4. **Execute** the flow automatically.



### **3. Connecting Google Drive**

* Drag the **"Google Drive"** node.
* Share your target file with the **Service Account Email** (found inside `service_account.json`).
* Copy the **File ID** from the Drive link and paste it into the node configuration.

---

## 📂 Project Structure

```text
DataFlowStudio/
├── App_Backend/
│   ├── Ai_Agent2.py          # Core Multi-Agent Logic (Manager, Planner, Executor)
│   ├── engine.py             # Data Processing Engine (Pandas logic)
│   ├── server.py             # API Entry Point
│   ├── service_account.json  # GCP Credentials (DO NOT COMMIT THIS)
│   └── requirements.txt      # Python Dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ConfigPanel.tsx   # Node Configuration Sidebar
│   │   │   ├── ActionSidebar.tsx # Draggable Tools List
│   │   │   └── ...
│   │   ├── utils/
│   │   │   └── api.ts            # Backend API Calls
│   │   └── App.tsx               # Main Canvas Layout
│   └── package.json
└── README.md

```

---

## 🛡️ License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Developed for Enterprise Data Engineering Automation.**

- Backend: http://localhost:8000 (GET `/hello`)
- Frontend: http://localhost:5173

Enjoy! ✅
