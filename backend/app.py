import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load environmental configs
load_dotenv()

# Initialize Flask environment and map static directory
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
app = Flask(__name__, static_folder=root_dir, static_url_path='')
CORS(app, resources={r"/*": {"origins": "*"}})

# Import and register modular Blueprints
from blueprints.auth import auth_bp
from blueprints.admin import admin_bp
from blueprints.hod import hod_bp
from blueprints.faculty import faculty_bp
from blueprints.student import student_bp

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(admin_bp, url_prefix='/api/admin')
app.register_blueprint(hod_bp, url_prefix='/api/hod')
app.register_blueprint(faculty_bp, url_prefix='/api/faculty')
app.register_blueprint(student_bp, url_prefix='/api/student')

@app.route('/', methods=['GET'])
def serve_index():
    return app.send_static_file('index.html')

# Error Handlers for unified responses
@app.errorhandler(400)
def bad_request(e):
    return jsonify({"success": False, "error": "Bad request format: check parameters."}), 400

@app.errorhandler(401)
def unauthorized(e):
    return jsonify({"success": False, "error": "Request is unauthenticated. Valid Bearer Token required."}), 401

@app.errorhandler(403)
def forbidden(e):
    return jsonify({"success": False, "error": "Access forbidden: insufficient credentials status."}), 403

@app.errorhandler(404)
def not_found(e):
    return jsonify({"success": False, "error": "Resource or endpoint not found."}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"success": False, "error": f"Internal database error or crash: {str(e)}"}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    print(f"Starting SAtendify API backend server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=debug)
