"""Production WSGI entry for Gunicorn / Render."""
from app import create_app

application = create_app()
