# config.py
import os

class Config:
    # Use environment variable for production, default to local PostgreSQL
    # For PostgreSQL:
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'postgresql://production_app_user:Cyliue84!@localhost:5432/my_production_app_db'
    # IMPORTANT: Replace 'your_user', 'your_password', 'your_database_name' with your actual PostgreSQL credentials.
    # You'll need to have PostgreSQL installed and a database created.

    # For SQLite (simpler for initial local testing, no separate server needed):
    # SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
    #    'sqlite:///site.db' # This will create a file named site.db in your project folder

    SQLALCHEMY_TRACK_MODIFICATIONS = False # Suppresses a warning, good practice
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'a_super_secret_random_key_that_you_must_change_in_production_!!!'