# config.py
import os
from dotenv import load_dotenv

# Find the absolute path of the directory containing this file
basedir = os.path.abspath(os.path.dirname(__file__))
# Load the .env file from the project root
load_dotenv(os.path.join(basedir, '.env'))

class Config:
    # Use environment variable for production, default to local PostgreSQL
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')

    SQLALCHEMY_TRACK_MODIFICATIONS = False # Suppresses a warning, good practice
    SECRET_KEY = os.environ.get('SECRET_KEY')