"""
Database configuration utility for PostgreSQL and SQLite fallback.
Supports both Vercel Postgres and Supabase PostgreSQL.
"""
import os
from urllib.parse import urlparse, parse_qs

def get_database_url():
    """
    Get database URL from environment variables.
    Supports:
    - DATABASE_URL (PostgreSQL connection string)
    - POSTGRES_URL (Vercel Postgres)
    - POSTGRES_PRISMA_URL (Vercel Postgres Prisma format)
    - SUPABASE_DB_URL (Supabase)
    
    Returns None if no PostgreSQL URL is found (falls back to SQLite).
    """
    postgres_url = (
        os.environ.get("DATABASE_URL") or
        os.environ.get("POSTGRES_URL") or
        os.environ.get("POSTGRES_PRISMA_URL") or
        os.environ.get("SUPABASE_DB_URL")
    )
    
    if postgres_url:
        # Vercel Postgres URLs sometimes need SSL mode adjustment
        if "vercel" in postgres_url.lower() or "neon" in postgres_url.lower():
            parsed = urlparse(postgres_url)
            query_params = parse_qs(parsed.query)
            if 'sslmode' not in query_params:
                if parsed.query:
                    postgres_url += "&sslmode=require"
                else:
                    postgres_url += "?sslmode=require"
        
        return postgres_url
    
    return None

def get_sqlalchemy_uri():
    """
    Get SQLAlchemy database URI.
    Returns PostgreSQL URI if available, otherwise SQLite for local dev.
    """
    postgres_url = get_database_url()
    
    if postgres_url:
        # Convert postgres:// to postgresql:// for SQLAlchemy 1.4+
        if postgres_url.startswith("postgres://"):
            postgres_url = postgres_url.replace("postgres://", "postgresql://", 1)
        return postgres_url
    
    # SQLite fallback for local development
    is_vercel = os.environ.get('VERCEL') == '1'
    if is_vercel:
        # On Vercel without PostgreSQL, use /tmp (ephemeral but functional)
        return "sqlite:////tmp/dw_tool.db"
    else:
        # Local development - use file-based SQLite
        db_path = os.path.join(os.path.dirname(__file__), "instance", "katana_outreach.db")
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        return f"sqlite:///{db_path}"

def is_postgres():
    """Check if using PostgreSQL"""
    return get_database_url() is not None

def get_kyi_db_path():
    """Get KYI database path (for SQLite fallback)"""
    if is_postgres():
        return None
    
    is_vercel = os.environ.get('VERCEL') == '1'
    if is_vercel:
        return os.path.join("/tmp", "kyi.db")
    else:
        return os.path.join(os.path.dirname(__file__), "kyi", "kyi.db")

def get_outreach_db_path():
    """Get Outreach database path (for SQLite fallback)"""
    if is_postgres():
        return None
    
    is_vercel = os.environ.get('VERCEL') == '1'
    if is_vercel:
        return os.path.join("/tmp", "katana_outreach.db")
    else:
        return os.path.join(os.path.dirname(__file__), "instance", "katana_outreach.db")
