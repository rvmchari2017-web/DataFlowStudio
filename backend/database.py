import sqlite3
import json
from datetime import datetime

DB_NAME = "dataflow.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # Create Users Table
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    
    # Create Flows Table
    c.execute('''
        CREATE TABLE IF NOT EXISTS flows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT NOT NULL,
            nodes TEXT NOT NULL,
            edges TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    # NEW: Create User Files Table
    c.execute('''
        CREATE TABLE IF NOT EXISTS user_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            file_size INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    # NEW: Chat History Table (Context Memory)
    c.execute('''
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            flow_id INTEGER, 
            role TEXT NOT NULL, 
            message TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    conn.commit()
    conn.close()

def create_user(username, password):
    try:
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, password))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        return False # Username exists
    
# --- NEW FILE MANAGEMENT FUNCTIONS ---
def save_file_record(user_id, filename, filepath, size):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    # Check if file exists for user to avoid duplicates
    c.execute("SELECT id FROM user_files WHERE user_id = ? AND filename = ?", (user_id, filename))
    existing = c.fetchone()
    
    if not existing:
        c.execute("INSERT INTO user_files (user_id, filename, filepath, file_size) VALUES (?, ?, ?, ?)", 
                  (user_id, filename, filepath, size))
    else:
        # Update existing record (e.g. if overwritten)
        c.execute("UPDATE user_files SET filepath=?, upload_date=?, file_size=? WHERE id=?", 
                  (filepath, datetime.now(), size, existing[0]))
        
    conn.commit()
    conn.close()
    
def get_files_by_user(user_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT filename, filepath, file_size, upload_date FROM user_files WHERE user_id = ? ORDER BY upload_date DESC", (user_id,))
    rows = c.fetchall()
    conn.close()
    
    files = []
    for r in rows:
        files.append({
            "name": r[0],
            "path": r[1],
            "size": r[2],
            "date": r[3]
        })
    return files

def verify_user(username, password):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT id FROM users WHERE username = ? AND password = ?", (username, password))
    user = c.fetchone()
    conn.close()
    return user[0] if user else None

# --- MODIFIED FLOW FUNCTIONS ---
def save_flow(user_id, name, nodes, edges, flow_id=None):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    nodes_json = json.dumps(nodes)
    edges_json = json.dumps(edges)
    
    # If flow_id is provided, strictly update that flow
    if flow_id:
        c.execute("UPDATE flows SET name=?, nodes=?, edges=?, updated_at=? WHERE id=? AND user_id=?", 
                (name, nodes_json, edges_json, datetime.now(), flow_id, user_id))
        new_id = flow_id
    else:
        # Check by name fallback or create new
        c.execute("SELECT id FROM flows WHERE user_id = ? AND name = ?", (user_id, name))
        existing = c.fetchone()
        if existing:
            c.execute("UPDATE flows SET nodes=?, edges=?, updated_at=? WHERE id=?", (nodes_json, edges_json, datetime.now(), existing[0]))
            new_id = existing[0]
        else:
            c.execute("INSERT INTO flows (user_id, name, nodes, edges) VALUES (?, ?, ?, ?)", (user_id, name, nodes_json, edges_json))
            new_id = c.lastrowid
    
    conn.commit()
    conn.close()
    return new_id

def get_user_flows(user_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT id, name, updated_at, nodes, edges FROM flows WHERE user_id = ? ORDER BY updated_at DESC", (user_id,))
    rows = c.fetchall()
    conn.close()
    
    flows = []
    for r in rows:
        flows.append({
            "id": r[0],
            "name": r[1],
            "updated_at": r[2],
            "nodes": json.loads(r[3]),
            "edges": json.loads(r[4])
        })
    return flows
# NEW: Delete Flow
def delete_flow(flow_id, user_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM flows WHERE id = ? AND user_id = ?", (flow_id, user_id))
    deleted = c.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


# --- NEW: CHAT HISTORY FUNCTIONS ---
def save_chat_message(user_id, flow_id, role, message):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    # If flow_id is None (new flow not yet saved), we store -1 or handle appropriately
    f_id = flow_id if flow_id else -1 
    c.execute("INSERT INTO chat_history (user_id, flow_id, role, message) VALUES (?, ?, ?, ?)", (user_id, f_id, role, message))
    conn.commit()
    conn.close()

def get_chat_history(user_id, flow_id):
    if not flow_id: return []
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT role, message FROM chat_history WHERE user_id = ? AND flow_id = ? ORDER BY timestamp ASC", (user_id, flow_id))
    rows = c.fetchall()
    conn.close()
    return [{"role": r[0], "content": r[1]} for r in rows]

# Initialize on load
init_db()