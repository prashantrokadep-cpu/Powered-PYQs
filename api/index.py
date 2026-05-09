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

# Lazy database initialization
def get_db_connection():
    if USING_POSTGRES:
        import psycopg
        conn = psycopg.connect(DATABASE_URL, row_factory=psycopg.rows.dict_row)
        return conn
    else:
        DB_FILE = (
            os.path.join(tempfile.gettempdir(), "pyq_database.db")
            if os.getenv("VERCEL")
            else os.path.join(os.path.dirname(os.path.dirname(__file__)), "pyq_database.db")
        )
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
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    except Exception as e:
        print(f"Database Error: {e}")
        return []
    finally:
        if conn:
            conn.close()

def ensure_db_initialized():
    conn = None
    try:
        conn = get_db_connection()
        if USING_POSTGRES:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS questions (
                    id TEXT PRIMARY KEY,
                    subject TEXT,
                    chapter TEXT,
                    year TEXT,
                    topic TEXT,
                    question TEXT,
                    image TEXT,
                    solution TEXT
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS affiliates (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    description TEXT,
                    url TEXT,
                    image TEXT
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE,
                    password_hash TEXT,
                    access_until TEXT
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS user_saved_questions (
                    user_id TEXT,
                    question_id TEXT,
                    PRIMARY KEY (user_id, question_id)
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS access_keys (
                    key TEXT PRIMARY KEY,
                    duration_hours INTEGER DEFAULT 24,
                    is_used INTEGER DEFAULT 0,
                    used_by TEXT,
                    used_at TEXT
                )
            ''')
        else:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS questions (
                    id TEXT PRIMARY KEY,
                    subject TEXT,
                    chapter TEXT,
                    year TEXT,
                    topic TEXT,
                    question TEXT,
                    image TEXT,
                    solution TEXT
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS affiliates (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    description TEXT,
                    url TEXT,
                    image TEXT
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE,
                    password_hash TEXT,
                    access_until TEXT
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS user_saved_questions (
                    user_id TEXT,
                    question_id TEXT,
                    PRIMARY KEY (user_id, question_id)
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS access_keys (
                    key TEXT PRIMARY KEY,
                    duration_hours INTEGER DEFAULT 24,
                    is_used INTEGER DEFAULT 0,
                    used_by TEXT,
                    used_at TEXT
                )
            ''')
        conn.commit()
    except Exception as e:
        print(f"Init Error: {e}")
    finally:
        if conn:
            conn.close()

@app.before_request
def before_request():
    ensure_db_initialized()

def get_json_payload(required_fields):
    data = request.json
    if not data:
        return None, "Missing JSON payload"
    for field in required_fields:
        if field not in data:
            return None, f"Missing required field: {field}"
    return data, None

# --- Global Error Shield ---
@app.errorhandler(Exception)
def handle_exception(e):
    if hasattr(e, 'code'):
        return jsonify({"error": str(e)}), e.code
    print(f"Unhandled Backend Error: {e}")
    return jsonify({"error": "Internal Server Error", "details": str(e)}), 500

# --- API Routes ---

@app.route('/api', methods=['GET'])
@app.route('/api/', methods=['GET'])
def api_home():
    return jsonify({"message": "API is active", "endpoints": ["/api/questions", "/api/login", "/api/debug"]}), 200

@app.route('/api/debug')
@app.route('/debug')
def debug_server():
    return jsonify({
        "status": "online",
        "environment": "vercel" if os.getenv("VERCEL") else "local",
        "database": "postgres" if USING_POSTGRES else "sqlite"
    }), 200

@app.route('/api/questions', methods=['GET'])
@app.route('/questions', methods=['GET'])
def get_questions():
    return jsonify(fetch_all('SELECT * FROM questions')), 200

@app.route('/api/questions', methods=['POST'])
@app.route('/questions', methods=['POST'])
def add_question():
    data, error = get_json_payload(['id', 'subject', 'chapter', 'year', 'topic', 'question', 'solution'])
    if error: return jsonify({"error": error}), 400
    conn = None
    try:
        conn = get_db_connection()
        p = db_placeholder()
        conn.execute(f'INSERT INTO questions (id, subject, chapter, year, topic, question, image, solution) VALUES ({p},{p},{p},{p},{p},{p},{p},{p})', 
                    (data['id'], data['subject'], data['chapter'], data['year'], data['topic'], data['question'], data.get('image'), data['solution']))
        conn.commit()
        return jsonify({"message": "Question added"}), 201
    except Exception as e: return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

@app.route('/api/register', methods=['POST'])
@app.route('/register', methods=['POST'])
def register():
    data, error = get_json_payload(['username', 'password'])
    if error: return jsonify({"error": error}), 400
    conn = None
    try:
        conn = get_db_connection()
        p = db_placeholder()
        user_id = str(uuid.uuid4())
        pw_hash = hashlib.sha256(data['password'].encode()).hexdigest()
        access_until = (datetime.now() + timedelta(hours=24)).isoformat()
        conn.execute(f'INSERT INTO users (id, username, password_hash, access_until) VALUES ({p},{p},{p},{p})', (user_id, data['username'], pw_hash, access_until))
        conn.commit()
        return jsonify({"userId": user_id, "accessUntil": access_until}), 201
    except Exception as e: return jsonify({"error": "User already exists or DB error"}), 409
    finally:
        if conn: conn.close()

@app.route('/api/login', methods=['POST'])
@app.route('/login', methods=['POST'])
def login():
    data, error = get_json_payload(['username', 'password'])
    if error: return jsonify({"error": error}), 400
    conn = None
    try:
        conn = get_db_connection()
        p = db_placeholder()
        user = conn.execute(f'SELECT * FROM users WHERE username = {p}', (data['username'],)).fetchone()
        pw_hash = hashlib.sha256(data['password'].encode()).hexdigest()
        if user and user['password_hash'] == pw_hash:
            return jsonify({"user": {"id": user['id'], "username": user['username'], "accessUntil": user['access_until']}}), 200
        return jsonify({"error": "Invalid credentials"}), 401
    finally:
        if conn: conn.close()

@app.route('/api/access/status', methods=['GET'])
@app.route('/access/status', methods=['GET'])
def get_access_status():
    user_id = request.args.get('userId')
    if not user_id: return jsonify({"hasAccess": False}), 200
    conn = None
    try:
        conn = get_db_connection()
        p = db_placeholder()
        user = conn.execute(f'SELECT access_until FROM users WHERE id = {p}', (user_id,)).fetchone()
        if user and user['access_until']:
            expiry = datetime.fromisoformat(user['access_until'])
            if expiry > datetime.now():
                return jsonify({"hasAccess": True, "accessUntil": user['access_until']}), 200
        return jsonify({"hasAccess": False}), 200
    finally:
        if conn: conn.close()

@app.route('/api/access/claim', methods=['GET'])
@app.route('/access/claim', methods=['GET'])
def claim_access():
    user_id = request.args.get('userId')
    if not user_id: return "Missing userId", 400
    conn = None
    try:
        conn = get_db_connection()
        p = db_placeholder()
        expiry = (datetime.now() + timedelta(hours=24)).isoformat()
        conn.execute(f'UPDATE users SET access_until = {p} WHERE id = {p}', (expiry, user_id))
        conn.commit()
        return redirect('/?accessClaimed=true')
    except Exception as e: return str(e), 500
    finally:
        if conn: conn.close()

@app.route('/api/<path:path>')
def api_catch_all(path):
    return jsonify({
        "error": "API route not found",
        "path_received": f"/api/{path}",
        "available_routes": ["/api/questions", "/api/login", "/api/register", "/api/access/status"]
    }), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
