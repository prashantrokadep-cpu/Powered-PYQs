from flask import Flask, request, jsonify, send_from_directory, abort, redirect
from flask_cors import CORS
import sqlite3
import os
import tempfile
import hashlib
import uuid
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)
app.url_map.strict_slashes = False

# --- Configuration & Database Setup ---
DATABASE_URL = os.getenv("DATABASE_URL")
USING_POSTGRES = DATABASE_URL is not None

def get_db_connection():
    if USING_POSTGRES:
        import psycopg
        return psycopg.connect(DATABASE_URL, row_factory=psycopg.rows.dict_row)
    else:
        DB_FILE = os.path.join(tempfile.gettempdir(), "pyq_database.db") if os.getenv("VERCEL") else os.path.join(os.path.dirname(os.path.dirname(__file__)), "pyq_database.db")
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        return conn

def db_placeholder():
    return "%s" if USING_POSTGRES else "?"

def fetch_all(query, params=()):
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        print(f"DB Error: {e}")
        return []
    finally:
        if conn: conn.close()

def ensure_db_initialized():
    conn = None
    try:
        conn = get_db_connection()
        p = db_placeholder()
        queries = [
            '''CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, subject TEXT, chapter TEXT, year TEXT, topic TEXT, question TEXT, image TEXT, solution TEXT)''',
            '''CREATE TABLE IF NOT EXISTS affiliates (id TEXT PRIMARY KEY, title TEXT, description TEXT, url TEXT, image TEXT)''',
            '''CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, access_until TEXT)''',
            '''CREATE TABLE IF NOT EXISTS user_saved_questions (user_id TEXT, question_id TEXT, PRIMARY KEY (user_id, question_id))''',
            '''CREATE TABLE IF NOT EXISTS access_keys (key TEXT PRIMARY KEY, duration_hours INTEGER DEFAULT 24, is_used INTEGER DEFAULT 0, used_by TEXT, used_at TEXT)'''
        ]
        for q in queries: conn.execute(q)
        conn.commit()
    except Exception as e: print(f"Init Error: {e}")
    finally:
        if conn: conn.close()

@app.before_request
def before_request():
    ensure_db_initialized()

# --- Global Error Shield ---
@app.errorhandler(404)
def handle_404(e):
    return jsonify({
        "error": "Not Found",
        "path": request.path,
        "msg": "The API is running but this specific link is wrong.",
        "try_these": ["/api/questions", "/api/debug", "/api/login"]
    }), 404

@app.errorhandler(Exception)
def handle_exception(e):
    if hasattr(e, 'code') and e.code == 404: return handle_404(e)
    return jsonify({"error": "Server Error", "details": str(e)}), 500

# --- Routes (Responding to both /api/x and /x) ---

@app.route('/api', methods=['GET'])
@app.route('/', methods=['GET'])
def api_home():
    return jsonify({"status": "active", "info": "Powered PYQs Backend"}), 200

@app.route('/api/debug', methods=['GET'])
@app.route('/debug', methods=['GET'])
def debug_server():
    return jsonify({"env": "vercel" if os.getenv("VERCEL") else "local", "db": "postgres" if USING_POSTGRES else "sqlite"}), 200

@app.route('/api/questions', methods=['GET'])
@app.route('/questions', methods=['GET'])
def get_questions():
    return jsonify(fetch_all('SELECT * FROM questions')), 200

@app.route('/api/login', methods=['POST'])
@app.route('/login', methods=['POST'])
def login():
    data = request.json
    pw_hash = hashlib.sha256(data['password'].encode()).hexdigest()
    conn = get_db_connection()
    user = conn.execute(f'SELECT * FROM users WHERE username = {db_placeholder()}', (data['username'],)).fetchone()
    conn.close()
    if user and user['password_hash'] == pw_hash:
        return jsonify({"user": {"id": user['id'], "username": user['username'], "accessUntil": user['access_until']}}), 200
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/register', methods=['POST'])
@app.route('/register', methods=['POST'])
def register():
    data = request.json
    user_id = str(uuid.uuid4())
    pw_hash = hashlib.sha256(data['password'].encode()).hexdigest()
    expiry = (datetime.now() + timedelta(hours=24)).isoformat()
    conn = get_db_connection()
    try:
        conn.execute(f'INSERT INTO users (id, username, password_hash, access_until) VALUES ({db_placeholder()},{db_placeholder()},{db_placeholder()},{db_placeholder()})', (user_id, data['username'], pw_hash, expiry))
        conn.commit()
        return jsonify({"userId": user_id, "accessUntil": expiry}), 201
    except: return jsonify({"error": "Exists"}), 409
    finally: conn.close()

@app.route('/api/access/status', methods=['GET'])
@app.route('/access/status', methods=['GET'])
def get_access_status():
    user_id = request.args.get('userId')
    if not user_id: return jsonify({"hasAccess": False}), 200
    conn = get_db_connection()
    user = conn.execute(f'SELECT access_until FROM users WHERE id = {db_placeholder()}', (user_id,)).fetchone()
    conn.close()
    if user and user['access_until'] and datetime.fromisoformat(user['access_until']) > datetime.now():
        return jsonify({"hasAccess": True, "accessUntil": user['access_until']}), 200
    return jsonify({"hasAccess": False}), 200

@app.route('/api/access/claim', methods=['GET'])
@app.route('/access/claim', methods=['GET'])
def claim_access():
    user_id = request.args.get('userId')
    expiry = (datetime.now() + timedelta(hours=24)).isoformat()
    conn = get_db_connection()
    conn.execute(f'UPDATE users SET access_until = {db_placeholder()} WHERE id = {db_placeholder()}', (expiry, user_id))
    conn.commit()
    conn.close()
    return redirect('/?accessClaimed=true')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
