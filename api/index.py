import os
import sys

# Add the backend directory to sys.path so that imports like `from blueprints...` work
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, backend_dir)

# Import the Flask app object from backend/app.py
from app import app
