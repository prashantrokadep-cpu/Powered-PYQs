from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS
import sqlite3
import os
import tempfile

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
        conn.commit()
    finally:
        conn.close()

init_db()


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

if __name__ == '__main__':
    app.run(port=5000)
