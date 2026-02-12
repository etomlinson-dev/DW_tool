"""
Vercel serverless function entry point for DW_tool.
Wraps the Flask app from app.py for Vercel's Python runtime.
"""
import os
import sys

# Set Vercel environment flag
os.environ['VERCEL'] = '1'

# Ensure the api directory and project root are in the Python path
api_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(api_dir)

for path in [api_dir, project_root]:
    if path not in sys.path:
        sys.path.insert(0, path)

# Import the Flask app from app.py
try:
    from app import app
except Exception as e:
    # Fallback: create a minimal app that shows the error
    from flask import Flask
    app = Flask(__name__)
    app.secret_key = os.environ.get('SECRET_KEY', 'fallback-secret')
    error_msg = str(e)

    @app.route('/')
    @app.route('/<path:path>')
    def error_handler(path=''):
        return {
            'error': 'Application failed to start',
            'details': error_msg
        }, 500
