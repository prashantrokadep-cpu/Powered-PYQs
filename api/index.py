from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS
import sqlite3
import os
import tempfile
import hashlib
import uuid
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))
DATABASE_URL = (
    os.getenv("DATABASE_URL")
    or os.getenv("POSTGRES_URL")
    or os.getenv("POSTGRES_PRISMA_URL")
)
USING_POSTGRES = bool(DATABASE_URL)
DB_FILE = (
    os.path.join(tempfile.gettempdir(), "pyq_database.db")
    if os.getenv("VERCEL")
    else os.path.join(os.path.dirname(os.path.dirname(__file__)), "pyq_database.db")
)
STATIC_FILES = {
    "index.html",
    "admin.html",
    "about.html",
    "contact.html",
    "privacy-policy.html",
    "terms.html",
    "style.css",
    "script.js",
    "data.js",
    "robots.txt",
    "ads.txt",
    "sitemap.xml",
    "logo.png"
}


def get_db_connection():
    if USING_POSTGRES:
        import psycopg
        from psycopg.rows import dict_row

        return psycopg.connect(DATABASE_URL, row_factory=dict_row)

    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def db_placeholder():
    return "%s" if USING_POSTGRES else "?"


def fetch_all(query, params=()):
    conn = get_db_connection()
    try:
        rows = conn.execute(query, params).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_json_payload(required_fields):
    data = request.get_json(silent=True)
    if not data:
        return None, "No data provided"

    missing_fields = [field for field in required_fields if not data.get(field)]
    if missing_fields:
        return None, f"Missing required fields: {', '.join(missing_fields)}"

    return data, None


def init_db():
    conn = get_db_connection()
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS questions (
                id TEXT PRIMARY KEY,
                subject TEXT NOT NULL,
                chapter TEXT NOT NULL,
                year TEXT NOT NULL,
                topic TEXT NOT NULL,
                question TEXT NOT NULL,
                image TEXT,
                solution TEXT NOT NULL
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS affiliates (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                url TEXT NOT NULL,
                image TEXT
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                access_until TIMESTAMP
            )
        ''')
        
        # Migration: Add access_until to users if it doesn't exist
        try:
            conn.execute('ALTER TABLE users ADD COLUMN access_until TIMESTAMP')
            conn.commit()
        except Exception:
            pass # Column likely already exists
            
        conn.execute('''
            CREATE TABLE IF NOT EXISTS user_saved_questions (
                user_id TEXT NOT NULL,
                question_id TEXT NOT NULL,
                PRIMARY KEY (user_id, question_id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (question_id) REFERENCES questions(id)
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS access_keys (
                key TEXT PRIMARY KEY,
                is_used INTEGER DEFAULT 0,
                used_by TEXT,
                used_at TIMESTAMP,
                duration_hours INTEGER DEFAULT 24
            )
        ''')
        conn.commit()
    finally:
        conn.close()

# Global flag to ensure DB is initialized only once
_db_initialized = False

def ensure_db_initialized():
    global _db_initialized
    if not _db_initialized:
        try:
            init_db()
            _db_initialized = True
        except Exception as e:
            print(f"Database Initialization Error: {e}")

@app.before_request
def before_request():
    ensure_db_initialized()

@app.errorhandler(Exception)
def handle_exception(e):
    # Pass through HTTP errors
    if hasattr(e, 'code'):
        return jsonify({"error": str(e)}), e.code
    # Handle non-HTTP errors
    print(f"Unhandled Backend Error: {e}")
    return jsonify({"error": "Internal Server Error", "details": str(e)}), 500


@app.route('/')
def serve_index():
    return send_from_directory(PROJECT_ROOT, 'index.html')


@app.route('/<path:filename>')
def serve_static_file(filename):
    if filename in STATIC_FILES:
        return send_from_directory(PROJECT_ROOT, filename)

    abort(404)


@app.route('/api/questions', methods=['GET'])
def get_questions():
    return jsonify(fetch_all('SELECT * FROM questions')), 200

@app.route('/api/questions', methods=['POST'])
def add_question():
    data, error = get_json_payload([
        'id', 'subject', 'chapter', 'year', 'topic', 'question', 'solution'
    ])
    if error:
        return jsonify({"error": error}), 400

    conn = None
    try:
        conn = get_db_connection()
        placeholder = db_placeholder()
        conn.execute(f'''
            INSERT INTO questions (id, subject, chapter, year, topic, question, image, solution)
            VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
        ''', (data['id'], data['subject'], data['chapter'], data['year'], data['topic'], data['question'], data.get('image'), data['solution']))
        conn.commit()
        return jsonify({"message": "Question added successfully!"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/questions/<question_id>', methods=['DELETE'])
def delete_question(question_id):
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.execute(f'DELETE FROM questions WHERE id = {db_placeholder()}', (question_id,))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"error": "Question not found"}), 404
        return jsonify({"message": "Question deleted successfully!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/affiliates', methods=['GET'])
def get_affiliates():
    return jsonify(fetch_all('SELECT * FROM affiliates')), 200

@app.route('/api/affiliates', methods=['POST'])
def add_affiliate():
    data, error = get_json_payload(['id', 'title', 'description', 'url'])
    if error:
        return jsonify({"error": error}), 400

    conn = None
    try:
        conn = get_db_connection()
        placeholder = db_placeholder()
        conn.execute(f'''
            INSERT INTO affiliates (id, title, description, url, image)
            VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
        ''', (data['id'], data['title'], data['description'], data['url'], data.get('image')))
        conn.commit()
        return jsonify({"message": "Affiliate added successfully!"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/affiliates/<affiliate_id>', methods=['DELETE'])
def delete_affiliate(affiliate_id):
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.execute(f'DELETE FROM affiliates WHERE id = {db_placeholder()}', (affiliate_id,))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"error": "Affiliate not found"}), 404
        return jsonify({"message": "Affiliate deleted successfully!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

# --- User Auth Endpoints ---

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

@app.route('/api/register', methods=['POST'])
def register():
    data, error = get_json_payload(['username', 'password'])
    if error:
        return jsonify({"error": error}), 400

    conn = None
    try:
        conn = get_db_connection()
        placeholder = db_placeholder()
        user_id = str(uuid.uuid4())
        password_hash = hash_password(data['password'])
        
        # Auto-grant first 24 hours
        access_until = (datetime.now() + timedelta(hours=24)).isoformat()
        
        conn.execute(f'''
            INSERT INTO users (id, username, password_hash, access_until)
            VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})
        ''', (user_id, data['username'], password_hash, access_until))
        conn.commit()
        return jsonify({
            "message": "User registered successfully!", 
            "userId": user_id,
            "accessUntil": access_until
        }), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already exists"}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data, error = get_json_payload(['username', 'password'])
    if error:
        return jsonify({"error": error}), 400

    conn = None
    try:
        conn = get_db_connection()
        placeholder = db_placeholder()
        user = conn.execute(f'''
            SELECT * FROM users WHERE username = {placeholder}
        ''', (data['username'],)).fetchone()
        
        if user and user['password_hash'] == hash_password(data['password']):
            # Auto-renew/Grant access for 24 hours if expired
            access_until = user['access_until']
            is_expired = True
            if access_until:
                expiry = datetime.fromisoformat(access_until) if isinstance(access_until, str) else access_until
                if expiry > datetime.now():
                    is_expired = False
            
            if is_expired:
                access_until = (datetime.now() + timedelta(hours=24)).isoformat()
                conn.execute(f'UPDATE users SET access_until = {placeholder} WHERE id = {placeholder}', (access_until, user['id']))
                conn.commit()

            return jsonify({
                "message": "Login successful!",
                "user": {
                    "id": user['id'],
                    "username": user['username'],
                    "accessUntil": access_until
                }
            }), 200
        else:
            return jsonify({"error": "Invalid username or password"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

# --- Saved Questions Sync Endpoints ---

@app.route('/api/user/saved', methods=['GET'])
def get_user_saved_questions():
    user_id = request.args.get('userId')
    if not user_id:
        return jsonify({"error": "Missing userId"}), 400
    
    conn = None
    try:
        conn = get_db_connection()
        placeholder = db_placeholder()
        rows = conn.execute(f'''
            SELECT question_id FROM user_saved_questions WHERE user_id = {placeholder}
        ''', (user_id,)).fetchall()
        return jsonify([row['question_id'] for row in rows]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/user/saved', methods=['POST'])
def sync_user_saved_questions():
    data, error = get_json_payload(['userId', 'savedIds'])
    if error:
        return jsonify({"error": error}), 400

    conn = None
    try:
        conn = get_db_connection()
        placeholder = db_placeholder()
        
        # Simple sync: Clear and insert
        conn.execute(f'DELETE FROM user_saved_questions WHERE user_id = {placeholder}', (data['userId'],))
        
        for q_id in data['savedIds']:
            conn.execute(f'''
                INSERT INTO user_saved_questions (user_id, question_id)
                VALUES ({placeholder}, {placeholder})
            ''', (data['userId'], q_id))
            
        conn.commit()
        return jsonify({"message": "Saved questions synced successfully!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

# --- Access Key System Endpoints ---

@app.route('/api/access/status', methods=['GET'])
def get_access_status():
    user_id = request.args.get('userId')
    if not user_id:
        return jsonify({"hasAccess": False}), 200
    
    conn = None
    try:
        conn = get_db_connection()
        placeholder = db_placeholder()
        user = conn.execute(f'SELECT access_until FROM users WHERE id = {placeholder}', (user_id,)).fetchone()
        
        if user and user['access_until']:
            expiry = datetime.fromisoformat(user['access_until']) if isinstance(user['access_until'], str) else user['access_until']
            if expiry > datetime.now():
                return jsonify({"hasAccess": True, "accessUntil": user['access_until']}), 200
                
        return jsonify({"hasAccess": False}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/access/activate', methods=['POST'])
def activate_key():
    data, error = get_json_payload(['userId', 'key'])
    if error:
        return jsonify({"error": error}), 400

    conn = None
    try:
        conn = get_db_connection()
        placeholder = db_placeholder()
        
        # Find the key
        key_data = conn.execute(f'SELECT * FROM access_keys WHERE key = {placeholder} AND is_used = 0', (data['key'],)).fetchone()
        
        if not key_data:
            return jsonify({"error": "Invalid or already used key"}), 400
            
        # Update key as used
        now = datetime.now().isoformat()
        expiry = (datetime.now() + timedelta(hours=key_data['duration_hours'])).isoformat()
        
        conn.execute(f'''
            UPDATE access_keys 
            SET is_used = 1, used_by = {placeholder}, used_at = {placeholder}
            WHERE key = {placeholder}
        ''', (data['userId'], now, data['key']))
        
        # Update user access
        conn.execute(f'UPDATE users SET access_until = {placeholder} WHERE id = {placeholder}', (expiry, data['userId']))
        
        conn.commit()
        return jsonify({"message": "Access activated successfully!", "accessUntil": expiry}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/access/claim', methods=['GET'])
def claim_access():
    user_id = request.args.get('userId')
    if not user_id:
        return "Missing userId", 400
    
    conn = None
    try:
        conn = get_db_connection()
        placeholder = db_placeholder()
        
        expiry = (datetime.now() + timedelta(hours=24)).isoformat()
        conn.execute(f'UPDATE users SET access_until = {placeholder} WHERE id = {placeholder}', (expiry, user_id))
        conn.commit()
        
        # Redirect back to the main site with a success flag
        from flask import redirect
        return redirect('/?accessClaimed=true')
    except Exception as e:
        return f"Error: {e}", 500
    finally:
        if conn:
            conn.close()

# Admin endpoint to generate keys (for your use)
@app.route('/api/admin/generate-keys', methods=['POST'])
def generate_keys():
    # In a real app, protect this with admin password
    data = request.json
    count = data.get('count', 1)
    hours = data.get('hours', 24)
    
    conn = None
    new_keys = []
    try:
        conn = get_db_connection()
        placeholder = db_placeholder()
        for _ in range(count):
            key = str(uuid.uuid4())[:8].upper()
            conn.execute(f'INSERT INTO access_keys (key, duration_hours) VALUES ({placeholder}, {placeholder})', (key, hours))
            new_keys.append(key)
        conn.commit()
        return jsonify({"keys": new_keys}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
