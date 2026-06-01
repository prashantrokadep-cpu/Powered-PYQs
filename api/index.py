from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os
import tempfile
import hashlib
import uuid
from datetime import datetime

app = Flask(__name__)
CORS(app)

DATABASE_URL = (
    os.getenv("DATABASE_URL")
    or os.getenv("POSTGRES_URL")
    or os.getenv("POSTGRES_PRISMA_URL")
)
USING_POSTGRES = bool(DATABASE_URL)
DB_FILE = os.path.join(tempfile.gettempdir(), "pyq_database.db")


def get_db_connection():
    if USING_POSTGRES:
        import psycopg
        from psycopg.rows import dict_row

        return psycopg.connect(DATABASE_URL, row_factory=dict_row)

    if os.getenv("VERCEL"):
        raise RuntimeError(
            "Vercel requires a persistent DATABASE_URL. Set DATABASE_URL to your Postgres string."
        )

    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def is_unique_constraint_error(error):
    message = str(error).lower()
    return any(keyword in message for keyword in ["unique", "duplicate", "already exists"])


def db_placeholder():
    return "%s" if USING_POSTGRES else "?"


def fetch_all(query, params=()):
    conn = get_db_connection()
    try:
        rows = conn.execute(query, params).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


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
                password_hash TEXT NOT NULL
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS user_saved_questions (
                user_id TEXT NOT NULL,
                question_id TEXT NOT NULL,
                PRIMARY KEY (user_id, question_id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (question_id) REFERENCES questions(id)
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
        
        conn.execute(f'''
            INSERT INTO users (id, username, password_hash)
            VALUES ({placeholder}, {placeholder}, {placeholder})
        ''', (user_id, data['username'], password_hash))
        conn.commit()
        return jsonify({
            "message": "User registered successfully!", 
            "userId": user_id
        }), 201
    except Exception as e:
        if is_unique_constraint_error(e):
            return jsonify({"error": "Username already exists"}), 409
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
            return jsonify({
                "message": "Login successful!",
                "user": {
                    "id": user['id'],
                    "username": user['username']
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
