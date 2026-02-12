# -*- coding: utf-8 -*-
"""
Flask API Backend for DW Outreach React App
Complete CRM System with all endpoints
"""
import os
import sys

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Disable proxy settings to prevent connection issues with Microsoft APIs
os.environ.pop('HTTP_PROXY', None)
os.environ.pop('HTTPS_PROXY', None)
os.environ.pop('http_proxy', None)
os.environ.pop('https_proxy', None)
os.environ['NO_PROXY'] = '*'

# Create a requests session that ignores all proxy settings
import requests as _requests
_http_session = _requests.Session()
_http_session.trust_env = False  # Ignore environment proxy settings

from flask import Flask, jsonify, request, session
from flask_cors import CORS
from datetime import datetime, date, timedelta
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Boolean, Text, Float, func, case
from sqlalchemy.orm import sessionmaker, relationship, declarative_base
from collections import defaultdict
import json

# Add parent directories to path for db_config import
# On Vercel: db_config.py is in project root (DW_tool/)
# Locally: db_config.py may be in grandparent directory
project_root = os.path.dirname(os.path.dirname(__file__))  # DW_tool/
grandparent_dir = os.path.dirname(project_root)             # parent of DW_tool/
parent_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

for _path in [project_root, grandparent_dir, parent_dir]:
    if _path not in sys.path:
        sys.path.insert(0, _path)

app = Flask(__name__)
CORS(app, supports_credentials=True)  # Enable CORS with credentials for auth cookies
app.secret_key = os.environ.get('SECRET_KEY') or os.environ.get('DWGC_HUB_SECRET', 'dev-secret-key-change-in-production')

# Session cookie config for production (Vercel)
is_production = os.environ.get('VERCEL') == '1' or os.environ.get('PRODUCTION') == '1'
if is_production:
    app.config['SESSION_COOKIE_SECURE'] = True       # HTTPS only
    app.config['SESSION_COOKIE_HTTPONLY'] = True      # No JS access
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'    # Allow OAuth redirects
    app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 hours

# Database setup with better error handling
db_initialized = False
engine = None

def init_database():
    """Initialize database connection with fallback."""
    global engine, db_initialized
    
    # Check for PostgreSQL URL directly from environment (most reliable)
    postgres_url = (
        os.environ.get("DATABASE_URL") or
        os.environ.get("POSTGRES_URL") or
        os.environ.get("POSTGRES_PRISMA_URL") or
        os.environ.get("SUPABASE_DB_URL")
    )
    
    if postgres_url:
        # Convert to postgresql+pg8000:// for SQLAlchemy with pg8000 driver
        if postgres_url.startswith("postgres://"):
            postgres_url = postgres_url.replace("postgres://", "postgresql+pg8000://", 1)
        elif postgres_url.startswith("postgresql://"):
            postgres_url = postgres_url.replace("postgresql://", "postgresql+pg8000://", 1)
        
        print(f"DATABASE_URL found, connecting to PostgreSQL...")
        engine = create_engine(
            postgres_url,
            echo=False,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            pool_recycle=3600
        )
        print("Connected to PostgreSQL database")
    else:
        # SQLite fallback for local development
        print("No DATABASE_URL found, falling back to SQLite")
        if os.environ.get('VERCEL') == '1':
            db_path = os.path.join("/tmp", "katana_outreach.db")
        else:
            try:
                from db_config import get_outreach_db_path
                db_path = get_outreach_db_path()
            except ImportError:
                instance_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "instance")
                os.makedirs(instance_dir, exist_ok=True)
                db_path = os.path.join(instance_dir, "katana_outreach.db")
        
        engine = create_engine(f"sqlite:///{db_path}", echo=False, pool_pre_ping=True)
        print(f"Using SQLite database: {db_path}")
    
    db_initialized = True
    return engine

# Initialize database
engine = init_database()
Session = sessionmaker(bind=engine)
Base = declarative_base()

def get_session():
    """Get a fresh database session."""
    return Session()


# ===========================================
# Models (same as original outreach_app.py)
# ===========================================

class Lead(Base):
    __tablename__ = "dw_leads"
    id = Column(Integer, primary_key=True)
    # Core fields
    business_name = Column(String, nullable=False)
    industry = Column(String)
    contact_name = Column(String)
    contact_title = Column(String)  # New: Role/title
    email = Column(String)
    emails_json = Column(Text)  # New: Multiple emails [{label, email}]
    phone = Column(String)
    phones_json = Column(Text)  # New: Multiple phones [{label, phone}]
    website = Column(String)  # New: Company website
    source = Column(String)
    assigned_rep = Column(String)
    status = Column(String, default="Not Contacted")
    last_activity = Column(DateTime, default=datetime.utcnow)
    activity_count = Column(Integer, default=0)
    notes = Column(String)
    tags = Column(String)
    
    # Service category
    service_category = Column(String)  # Marketing, Consulting, Web Development, Other
    
    # Campaign/Segmentation (Phase 1)
    campaign_id = Column(Integer, ForeignKey("dw_campaigns.id"), nullable=True)
    
    # Outreach tracking (Phase 1)
    first_outreach_date = Column(DateTime)
    first_outreach_method = Column(String)  # email, linkedin, call, text
    outreach_message_id = Column(Integer, nullable=True)  # Template used
    follow_up_count = Column(Integer, default=0)
    next_follow_up_date = Column(DateTime, nullable=True)
    next_follow_up_reminder = Column(Boolean, default=False)
    
    # Response & Engagement tracking (Phase 1)
    response_status = Column(String, default="no_response")  # no_response, opened, replied, interested, not_interested
    response_date = Column(DateTime, nullable=True)
    response_summary = Column(Text)
    objections_json = Column(Text)  # JSON array of objections
    decision_timeline = Column(String)  # Text or date range
    
    # Deal tracking (Phase 1)
    deal_value = Column(Float, nullable=True)
    expected_close_date = Column(DateTime, nullable=True)
    
    # Pipeline tracking (Phase 3)
    pipeline_stage_id = Column(Integer, nullable=True)
    stage_entered_at = Column(DateTime, nullable=True)
    
    # KYI Integration
    kyi_investor_id = Column(Integer, index=True)
    kyi_firm_id = Column(Integer, index=True, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    logs = relationship("Log", backref="lead", cascade="all, delete-orphan")
    
    STATUS_OPTIONS = [
        "Not Contacted", "Attempted", "Connected", "Follow-up Needed",
        "Qualified Lead", "Proposal Sent", "Not Interested", "Converted"
    ]
    
    SERVICE_CATEGORIES = ["Marketing", "Consulting", "Web Development", "Other"]
    
    RESPONSE_STATUSES = ["no_response", "opened", "replied", "interested", "not_interested"]
    
    # Status categories for conversion funnel
    FUNNEL_STAGES = {
        "top": ["Not Contacted"],
        "middle": ["Attempted", "Connected", "Follow-up Needed"],
        "bottom": ["Qualified Lead", "Proposal Sent"],
        "closed": ["Converted", "Not Interested"]
    }
    
    def to_dict(self):
        return {
            "id": self.id,
            "business_name": self.business_name,
            "industry": self.industry,
            "contact_name": self.contact_name,
            "contact_title": self.contact_title,
            "email": self.email,
            "emails": json.loads(self.emails_json) if self.emails_json else [],
            "phone": self.phone,
            "phones": json.loads(self.phones_json) if self.phones_json else [],
            "website": self.website,
            "source": self.source,
            "assigned_rep": self.assigned_rep,
            "status": self.status,
            "last_activity": self.last_activity.isoformat() if self.last_activity else None,
            "activity_count": self.activity_count,
            "notes": self.notes,
            "tags": json.loads(self.tags) if self.tags else [],
            "service_category": self.service_category,
            "campaign_id": self.campaign_id,
            "first_outreach_date": self.first_outreach_date.isoformat() if self.first_outreach_date else None,
            "first_outreach_method": self.first_outreach_method,
            "follow_up_count": self.follow_up_count,
            "next_follow_up_date": self.next_follow_up_date.isoformat() if self.next_follow_up_date else None,
            "next_follow_up_reminder": self.next_follow_up_reminder,
            "response_status": self.response_status,
            "response_date": self.response_date.isoformat() if self.response_date else None,
            "response_summary": self.response_summary,
            "objections": json.loads(self.objections_json) if self.objections_json else [],
            "decision_timeline": self.decision_timeline,
            "deal_value": self.deal_value,
            "expected_close_date": self.expected_close_date.isoformat() if self.expected_close_date else None,
            "pipeline_stage_id": self.pipeline_stage_id,
            "kyi_investor_id": self.kyi_investor_id,
            "kyi_firm_id": self.kyi_firm_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Log(Base):
    __tablename__ = "dw_logs"
    id = Column(Integer, primary_key=True)
    lead_id = Column(Integer, ForeignKey("dw_leads.id"))
    activity_type = Column(String)
    outcome = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    notes = Column(String)
    call_duration = Column(Integer)
    call_outcome = Column(String)
    call_notes = Column(String)
    email_subject = Column(String)
    email_opened = Column(Boolean, default=False)
    email_clicked = Column(Boolean, default=False)
    
    ACTIVITY_TYPES = ["Call", "Email", "Meeting", "Note", "Task", "Other"]
    
    def to_dict(self):
        return {
            "id": self.id,
            "lead_id": self.lead_id,
            "activity_type": self.activity_type,
            "outcome": self.outcome,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "notes": self.notes,
            "call_duration": self.call_duration,
            "call_outcome": self.call_outcome,
            "call_notes": self.call_notes,
            "email_subject": self.email_subject,
            "email_opened": self.email_opened,
            "email_clicked": self.email_clicked,
        }


# ===========================================
# Campaign Model (Phase 1)
# ===========================================

class Campaign(Base):
    __tablename__ = "dw_campaigns"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="draft")  # draft, active, paused, completed
    target_industry = Column(String(100))
    target_service = Column(String(100))
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    leads_count = Column(Integer, default=0)
    emails_sent = Column(Integer, default=0)
    responses_count = Column(Integer, default=0)
    conversions_count = Column(Integer, default=0)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    STATUS_OPTIONS = ["draft", "active", "paused", "completed"]
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "status": self.status,
            "target_industry": self.target_industry,
            "target_service": self.target_service,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "leads_count": self.leads_count,
            "emails_sent": self.emails_sent,
            "responses_count": self.responses_count,
            "conversions_count": self.conversions_count,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ===========================================
# Pipeline Stage Models (Phase 1/3)
# ===========================================

class PipelineStage(Base):
    __tablename__ = "dw_pipeline_stages"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    order = Column(Integer, default=0)  # Display order
    color = Column(String(20), default="#667eea")
    service_category = Column(String(100))  # Optional: stages per service type
    is_active = Column(Boolean, default=True)
    is_won_stage = Column(Boolean, default=False)  # Is this a "won" stage
    is_lost_stage = Column(Boolean, default=False)  # Is this a "lost" stage
    sla_days = Column(Integer)  # Expected max days in this stage
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "order": self.order,
            "color": self.color,
            "service_category": self.service_category,
            "is_active": self.is_active,
            "is_won_stage": self.is_won_stage,
            "is_lost_stage": self.is_lost_stage,
            "sla_days": self.sla_days,
        }


class StageHistory(Base):
    __tablename__ = "dw_stage_history"
    id = Column(Integer, primary_key=True)
    lead_id = Column(Integer, ForeignKey("dw_leads.id"), nullable=False)
    from_stage_id = Column(Integer, ForeignKey("dw_pipeline_stages.id"), nullable=True)
    to_stage_id = Column(Integer, ForeignKey("dw_pipeline_stages.id"), nullable=False)
    changed_by = Column(String(100))
    reason = Column(Text)
    duration_seconds = Column(Integer)  # Time spent in previous stage
    changed_at = Column(DateTime, default=datetime.utcnow)
    
    lead = relationship("Lead", backref="stage_history")
    from_stage = relationship("PipelineStage", foreign_keys=[from_stage_id])
    to_stage = relationship("PipelineStage", foreign_keys=[to_stage_id])
    
    def to_dict(self):
        return {
            "id": self.id,
            "lead_id": self.lead_id,
            "from_stage_id": self.from_stage_id,
            "from_stage_name": self.from_stage.name if self.from_stage else None,
            "to_stage_id": self.to_stage_id,
            "to_stage_name": self.to_stage.name if self.to_stage else None,
            "changed_by": self.changed_by,
            "reason": self.reason,
            "duration_seconds": self.duration_seconds,
            "duration_days": round(self.duration_seconds / 86400, 1) if self.duration_seconds else None,
            "changed_at": self.changed_at.isoformat() if self.changed_at else None,
        }


# ===========================================
# New Models for Phase 0
# ===========================================

class TeamMember(Base):
    __tablename__ = "dw_team_members"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    role = Column(String(50), default="sales")  # admin, manager, sales, consultant, viewer
    avatar_url = Column(Text)
    phone = Column(String(50))
    department = Column(String(100))
    title = Column(String(100))
    bio = Column(Text)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Role permissions configuration
    ROLE_OPTIONS = ["admin", "manager", "sales", "consultant", "viewer"]
    
    ROLE_PERMISSIONS = {
        "admin": ["view_all", "edit_all", "delete_all", "manage_team", "manage_settings", "export_data", "view_reports"],
        "manager": ["view_all", "edit_own", "edit_team", "view_reports", "manage_assignments"],
        "sales": ["view_own", "edit_own", "create_leads", "log_activities"],
        "consultant": ["view_all", "edit_own", "create_proposals"],
        "viewer": ["view_own", "view_reports"],
    }
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "avatar_url": self.avatar_url,
            "phone": self.phone,
            "department": self.department,
            "title": self.title,
            "bio": self.bio,
            "is_active": self.is_active,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "permissions": self.ROLE_PERMISSIONS.get(self.role, []),
        }
    
    def has_permission(self, permission):
        """Check if team member has a specific permission."""
        permissions = self.ROLE_PERMISSIONS.get(self.role, [])
        return permission in permissions or "edit_all" in permissions


class Reminder(Base):
    __tablename__ = "dw_reminders"
    id = Column(Integer, primary_key=True)
    lead_id = Column(Integer, ForeignKey("dw_leads.id"))
    assigned_to = Column(String(100))
    type = Column(String(50))  # follow-up, callback, send-email, meeting-prep, proposal, other
    priority = Column(String(20), default="medium")  # high, medium, low
    title = Column(String(255))
    description = Column(Text)
    due_date = Column(DateTime)
    completed_at = Column(DateTime)
    snoozed_until = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    lead = relationship("Lead", backref="reminders")
    
    TYPE_OPTIONS = ["follow-up", "callback", "send-email", "meeting-prep", "proposal", "other"]
    PRIORITY_OPTIONS = ["high", "medium", "low"]
    
    def to_dict(self):
        return {
            "id": self.id,
            "lead_id": self.lead_id,
            "lead_name": self.lead.business_name if self.lead else None,
            "assigned_to": self.assigned_to,
            "type": self.type,
            "priority": self.priority,
            "title": self.title,
            "description": self.description,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "snoozed_until": self.snoozed_until.isoformat() if self.snoozed_until else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class CalendarEvent(Base):
    __tablename__ = "dw_calendar_events"
    id = Column(Integer, primary_key=True)
    lead_id = Column(Integer, ForeignKey("dw_leads.id"))
    title = Column(String(255), nullable=False)
    description = Column(Text)
    event_type = Column(String(50))  # meeting, follow-up, email, call
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    lead = relationship("Lead", backref="calendar_events")
    
    EVENT_TYPES = ["meeting", "follow-up", "email", "call"]
    
    def to_dict(self):
        return {
            "id": self.id,
            "lead_id": self.lead_id,
            "lead_name": self.lead.business_name if self.lead else None,
            "title": self.title,
            "description": self.description,
            "event_type": self.event_type,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class EmailTemplate(Base):
    __tablename__ = "dw_email_templates"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100))
    subject = Column(String(500))
    body = Column(Text)
    is_default = Column(Boolean, default=False)
    usage_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "subject": self.subject,
            "body": self.body,
            "is_default": self.is_default,
            "usage_count": self.usage_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class EmailSequence(Base):
    __tablename__ = "dw_email_sequences"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(20), default="draft")  # active, paused, draft
    leads_enrolled = Column(Integer, default=0)
    emails_sent = Column(Integer, default=0)
    open_rate = Column(Float, default=0.0)
    reply_rate = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    steps = relationship("EmailSequenceStep", backref="sequence", cascade="all, delete-orphan")
    
    STATUS_OPTIONS = ["active", "paused", "draft"]
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "status": self.status,
            "leads_enrolled": self.leads_enrolled,
            "emails_sent": self.emails_sent,
            "open_rate": self.open_rate,
            "reply_rate": self.reply_rate,
            "steps": [step.to_dict() for step in self.steps],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class EmailSequenceStep(Base):
    __tablename__ = "dw_email_sequence_steps"
    id = Column(Integer, primary_key=True)
    sequence_id = Column(Integer, ForeignKey("dw_email_sequences.id"))
    step_order = Column(Integer, nullable=False)
    template_id = Column(Integer, ForeignKey("dw_email_templates.id"))
    delay_days = Column(Integer, default=0)
    subject_override = Column(String(500))
    
    template = relationship("EmailTemplate")
    
    def to_dict(self):
        return {
            "id": self.id,
            "sequence_id": self.sequence_id,
            "step_order": self.step_order,
            "template_id": self.template_id,
            "template_name": self.template.name if self.template else None,
            "delay_days": self.delay_days,
            "subject_override": self.subject_override,
        }


class GeneratedEmail(Base):
    __tablename__ = "dw_generated_emails"
    id = Column(Integer, primary_key=True)
    lead_id = Column(Integer, ForeignKey("dw_leads.id"))
    template_id = Column(Integer, ForeignKey("dw_email_templates.id"))
    recipient_email = Column(String(255))
    subject = Column(String(500))
    body = Column(Text)
    status = Column(String(50), default="draft")  # draft, pending_review, approved, sent, rejected
    priority = Column(String(20), default="medium")
    generated_by = Column(String(100))
    reviewer = Column(String(100))
    review_notes = Column(Text)
    generated_at = Column(DateTime, default=datetime.utcnow)
    sent_at = Column(DateTime)
    # Reply tracking
    reply_status = Column(String(50), default="no_reply")  # no_reply, replied, bounced
    replied_at = Column(DateTime, nullable=True)
    reply_snippet = Column(Text, nullable=True)
    microsoft_message_id = Column(String(500), nullable=True)
    
    lead = relationship("Lead", backref="generated_emails")
    template = relationship("EmailTemplate")
    
    STATUS_OPTIONS = ["draft", "pending_review", "approved", "sent", "rejected"]
    
    def to_dict(self):
        return {
            "id": self.id,
            "lead_id": self.lead_id,
            "lead_name": self.lead.business_name if self.lead else None,
            "lead_email": self.recipient_email or (self.lead.email if self.lead else None),
            "template_id": self.template_id,
            "template_name": self.template.name if self.template else None,
            "template_category": self.template.category if self.template else None,
            "subject": self.subject,
            "body": self.body,
            "status": self.status,
            "priority": self.priority,
            "generated_by": self.generated_by,
            "reviewer": self.reviewer,
            "review_notes": self.review_notes,
            "generated_at": self.generated_at.isoformat() if self.generated_at else None,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "reply_status": self.reply_status or "no_reply",
            "replied_at": self.replied_at.isoformat() if self.replied_at else None,
            "reply_snippet": self.reply_snippet,
            "microsoft_message_id": self.microsoft_message_id,
        }


class Proposal(Base):
    __tablename__ = "dw_proposals"
    id = Column(Integer, primary_key=True)
    lead_id = Column(Integer, ForeignKey("dw_leads.id"))
    title = Column(String(255))
    configuration_json = Column(Text)
    proposal_html = Column(Text)
    total_price = Column(Float)
    discount = Column(Float, default=0)
    validity_days = Column(Integer, default=30)
    status = Column(String(50), default="draft")  # draft, sent, viewed, accepted, rejected
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    sent_at = Column(DateTime)
    viewed_at = Column(DateTime)
    notes = Column(Text)
    
    lead = relationship("Lead", backref="proposals")
    
    STATUS_OPTIONS = ["draft", "sent", "viewed", "accepted", "rejected"]
    
    def to_dict(self):
        return {
            "id": self.id,
            "lead_id": self.lead_id,
            "lead_name": self.lead.business_name if self.lead else None,
            "title": self.title,
            "configuration": json.loads(self.configuration_json) if self.configuration_json else None,
            "proposal_html": self.proposal_html,
            "total_price": self.total_price,
            "discount": self.discount,
            "validity_days": self.validity_days,
            "status": self.status,
            "version": self.version,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "viewed_at": self.viewed_at.isoformat() if self.viewed_at else None,
            "notes": self.notes,
        }


class CallScript(Base):
    __tablename__ = "dw_call_scripts"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    script_type = Column(String(50))  # intro, voicemail, follow-up, objection
    content = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    TYPE_OPTIONS = ["intro", "voicemail", "follow-up", "objection"]
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "script_type": self.script_type,
            "content": self.content,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SearchHistory(Base):
    __tablename__ = "dw_search_history"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    query = Column(String(255))
    category = Column(String(50))
    searched_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "query": self.query,
            "category": self.category,
            "searched_at": self.searched_at.isoformat() if self.searched_at else None,
        }


class NetworkClient(Base):
    __tablename__ = "dw_network_clients"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    color = Column(String(20), default="#3b82f6")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "color": self.color,
        }


class NetworkEntity(Base):
    __tablename__ = "dw_network_entities"
    id = Column(Integer, primary_key=True)
    label = Column(String(255), nullable=False)
    entity_type = Column(String(50))  # person, firm, fund
    depth = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": str(self.id),
            "label": self.label,
            "type": self.entity_type,
            "depth": self.depth,
        }


class NetworkEdge(Base):
    __tablename__ = "dw_network_edges"
    id = Column(Integer, primary_key=True)
    from_entity_id = Column(Integer, ForeignKey("dw_network_entities.id"))
    to_entity_id = Column(Integer, ForeignKey("dw_network_entities.id"))
    strength = Column(Float, default=1.0)
    client_ids = Column(Text)  # JSON array of client IDs
    created_at = Column(DateTime, default=datetime.utcnow)
    
    from_entity = relationship("NetworkEntity", foreign_keys=[from_entity_id])
    to_entity = relationship("NetworkEntity", foreign_keys=[to_entity_id])
    
    def to_dict(self):
        return {
            "from": str(self.from_entity_id),
            "to": str(self.to_entity_id),
            "strength": self.strength,
            "clients": json.loads(self.client_ids) if self.client_ids else [],
        }


# ===========================================
# Automation Rules Engine (Phase 5)
# ===========================================

class AutomationRule(Base):
    __tablename__ = "dw_automation_rules"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    trigger_type = Column(String(50), nullable=False)  # status_change, time_based, sla_breach, manual
    trigger_config = Column(Text)  # JSON config for trigger conditions
    action_type = Column(String(50), nullable=False)  # create_reminder, send_notification, update_status, assign_task
    action_config = Column(Text)  # JSON config for action
    is_active = Column(Boolean, default=True)
    execution_count = Column(Integer, default=0)
    last_executed = Column(DateTime)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    TRIGGER_TYPES = ["status_change", "time_based", "sla_breach", "manual", "field_change"]
    ACTION_TYPES = ["create_reminder", "send_notification", "update_status", "assign_task", "create_follow_up", "send_email"]
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "trigger_type": self.trigger_type,
            "trigger_config": json.loads(self.trigger_config) if self.trigger_config else {},
            "action_type": self.action_type,
            "action_config": json.loads(self.action_config) if self.action_config else {},
            "is_active": self.is_active,
            "execution_count": self.execution_count,
            "last_executed": self.last_executed.isoformat() if self.last_executed else None,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Notification(Base):
    __tablename__ = "dw_notifications"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)  # Team member ID
    user_name = Column(String(100))
    type = Column(String(50))  # info, warning, success, error, reminder, sla_breach
    title = Column(String(255))
    message = Column(Text)
    link = Column(String(500))  # Optional link to related resource
    is_read = Column(Boolean, default=False)
    related_lead_id = Column(Integer, ForeignKey("dw_leads.id"), nullable=True)
    related_rule_id = Column(Integer, ForeignKey("dw_automation_rules.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    read_at = Column(DateTime)
    
    lead = relationship("Lead", backref="notifications")
    rule = relationship("AutomationRule", backref="notifications")
    
    TYPE_OPTIONS = ["info", "warning", "success", "error", "reminder", "sla_breach"]
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": self.user_name,
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "link": self.link,
            "is_read": self.is_read,
            "related_lead_id": self.related_lead_id,
            "lead_name": self.lead.business_name if self.lead else None,
            "related_rule_id": self.related_rule_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "read_at": self.read_at.isoformat() if self.read_at else None,
        }


class SLATimer(Base):
    __tablename__ = "dw_sla_timers"
    id = Column(Integer, primary_key=True)
    lead_id = Column(Integer, ForeignKey("dw_leads.id"), nullable=False)
    timer_type = Column(String(50))  # response_time, follow_up, stage_duration, proposal_review
    start_time = Column(DateTime, default=datetime.utcnow)
    deadline = Column(DateTime, nullable=False)
    status = Column(String(20), default="active")  # active, completed, breached, cancelled
    breach_notified = Column(Boolean, default=False)
    completed_at = Column(DateTime)
    notes = Column(Text)
    
    lead = relationship("Lead", backref="sla_timers")
    
    STATUS_OPTIONS = ["active", "completed", "breached", "cancelled"]
    
    def to_dict(self):
        remaining = None
        if self.status == "active" and self.deadline:
            remaining = (self.deadline - datetime.utcnow()).total_seconds()
        
        return {
            "id": self.id,
            "lead_id": self.lead_id,
            "lead_name": self.lead.business_name if self.lead else None,
            "timer_type": self.timer_type,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "deadline": self.deadline.isoformat() if self.deadline else None,
            "status": self.status,
            "breach_notified": self.breach_notified,
            "remaining_seconds": remaining,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "notes": self.notes,
        }


# ===========================================
# Document Management (Phase 7)
# ===========================================

class Document(Base):
    __tablename__ = "dw_documents"
    id = Column(Integer, primary_key=True)
    lead_id = Column(Integer, ForeignKey("dw_leads.id"), nullable=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255))
    file_type = Column(String(50))  # pdf, doc, xlsx, etc.
    file_size = Column(Integer)  # bytes
    file_path = Column(Text)  # local path or cloud URL
    category = Column(String(50))  # proposal, contract, invoice, other
    description = Column(Text)
    uploaded_by = Column(String(100))
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    lead = relationship("Lead", backref="documents")
    
    CATEGORY_OPTIONS = ["proposal", "contract", "invoice", "presentation", "report", "other"]
    
    def to_dict(self):
        return {
            "id": self.id,
            "lead_id": self.lead_id,
            "lead_name": self.lead.business_name if self.lead else None,
            "filename": self.filename,
            "original_filename": self.original_filename,
            "file_type": self.file_type,
            "file_size": self.file_size,
            "file_size_readable": f"{self.file_size / 1024:.1f} KB" if self.file_size else None,
            "category": self.category,
            "description": self.description,
            "uploaded_by": self.uploaded_by,
            "is_archived": self.is_archived,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class AuditLog(Base):
    __tablename__ = "dw_audit_logs"
    id = Column(Integer, primary_key=True)
    entity_type = Column(String(50), nullable=False)  # lead, proposal, user, etc.
    entity_id = Column(Integer)
    action = Column(String(50), nullable=False)  # create, update, delete, view, export
    user_name = Column(String(100))
    user_id = Column(Integer)
    changes_json = Column(Text)  # JSON of field changes
    ip_address = Column(String(45))
    user_agent = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    ACTION_TYPES = ["create", "update", "delete", "view", "export", "login", "logout", "status_change"]
    
    def to_dict(self):
        return {
            "id": self.id,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "action": self.action,
            "user_name": self.user_name,
            "user_id": self.user_id,
            "changes": json.loads(self.changes_json) if self.changes_json else None,
            "ip_address": self.ip_address,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


# ===========================================
# Microsoft Integration Models
# ===========================================

from microsoft_integration import create_microsoft_models, create_microsoft_routes

try:
    MicrosoftToken, TrackedEmail, EmailSyncStatus = create_microsoft_models(Base)
except Exception as e:
    print(f"Warning: Could not create Microsoft models: {e}")
    MicrosoftToken, TrackedEmail, EmailSyncStatus = None, None, None

# Create tables (skip on Vercel since tables are managed via migrations)
if not os.environ.get('VERCEL'):
    Base.metadata.create_all(engine)

# Register Microsoft routes
if MicrosoftToken and TrackedEmail and EmailSyncStatus:
    try:
        microsoft_bp, emails_bp = create_microsoft_routes(
            app, Session, MicrosoftToken, TrackedEmail, EmailSyncStatus, Lead, TeamMember
        )
        app.register_blueprint(microsoft_bp)
        app.register_blueprint(emails_bp)
        print("Microsoft integration routes registered")
    except Exception as e:
        print(f"Warning: Could not register Microsoft routes: {e}")


# ===========================================
# Helper Functions
# ===========================================

# ===========================================
# Automated Pipeline Advancement
# ===========================================

# Pipeline order - higher index = further along
PIPELINE_ORDER = [
    "Not Contacted",
    "Attempted",
    "Connected",
    "Follow-up Needed",
    "Qualified Lead",
    "Proposal Sent",
    "Converted",
]

# Terminal statuses that should NOT be auto-advanced
TERMINAL_STATUSES = {"Not Interested", "Converted"}

def advance_lead_status(session, lead, new_status, reason=""):
    """Advance a lead's pipeline status if the new status is further along.
    Never downgrades. Never changes terminal statuses."""
    if not lead:
        return
    current = lead.status or "Not Contacted"
    
    # Don't touch terminal statuses
    if current in TERMINAL_STATUSES:
        return
    
    cur_idx = PIPELINE_ORDER.index(current) if current in PIPELINE_ORDER else -1
    new_idx = PIPELINE_ORDER.index(new_status) if new_status in PIPELINE_ORDER else -1
    
    if new_idx > cur_idx:
        old_status = lead.status
        lead.status = new_status
        print(f"Pipeline auto-advance: Lead #{lead.id} '{lead.business_name}' "
              f"{old_status} -> {new_status} ({reason})")


def get_period_boundaries():
    """Get datetime boundaries for today, this week, this month, last week, last month."""
    now = datetime.utcnow()
    today_start = datetime.combine(date.today(), datetime.min.time())
    
    # This week (Monday start)
    days_since_monday = now.weekday()
    week_start = datetime.combine((date.today() - timedelta(days=days_since_monday)), datetime.min.time())
    
    # Last week
    last_week_start = week_start - timedelta(days=7)
    last_week_end = week_start
    
    # This month
    month_start = datetime(now.year, now.month, 1)
    
    # Last month
    if now.month == 1:
        last_month_start = datetime(now.year - 1, 12, 1)
    else:
        last_month_start = datetime(now.year, now.month - 1, 1)
    last_month_end = month_start
    
    # This year
    year_start = datetime(now.year, 1, 1)
    
    return {
        "now": now,
        "today_start": today_start,
        "week_start": week_start,
        "last_week_start": last_week_start,
        "last_week_end": last_week_end,
        "month_start": month_start,
        "last_month_start": last_month_start,
        "last_month_end": last_month_end,
        "year_start": year_start,
    }


# ===========================================
# API Routes
# ===========================================

@app.route("/api/health")
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "timestamp": datetime.utcnow().isoformat()})


# --- Leads API ---

@app.route("/api/leads", methods=["GET"])
def get_leads():
    """Get leads with optional filters and pagination."""
    session = get_session()
    try:
        # Get filter params
        filter_status = request.args.get("status", "")
        filter_rep = request.args.get("rep", "")
        filter_industry = request.args.get("industry", "")
        filter_timeframe = request.args.get("timeframe", "")
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 50))
        
        # Build query
        query = session.query(Lead)
        
        if filter_status:
            query = query.filter(Lead.status == filter_status)
        if filter_rep:
            query = query.filter(Lead.assigned_rep == filter_rep)
        if filter_industry:
            query = query.filter(Lead.industry == filter_industry)
        if filter_timeframe:
            periods = get_period_boundaries()
            if filter_timeframe == "today":
                query = query.filter(Lead.last_activity >= periods["today_start"])
            elif filter_timeframe == "week":
                query = query.filter(Lead.last_activity >= periods["week_start"])
            elif filter_timeframe == "month":
                query = query.filter(Lead.last_activity >= periods["month_start"])
        
        # Get total count
        total = query.count()
        total_pages = (total + per_page - 1) // per_page if total > 0 else 1
        
        # Paginate
        leads = query.order_by(Lead.last_activity.desc()).offset((page - 1) * per_page).limit(per_page).all()
        
        return jsonify({
            "data": [lead.to_dict() for lead in leads],
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages,
        })
    finally:
        session.close()


@app.route("/api/leads/<int:lead_id>", methods=["GET"])
def get_lead(lead_id):
    """Get a single lead by ID."""
    session = get_session()
    try:
        lead = session.query(Lead).filter_by(id=lead_id).first()
        if not lead:
            return jsonify({"error": "Lead not found"}), 404
        return jsonify(lead.to_dict())
    finally:
        session.close()


@app.route("/api/leads", methods=["POST"])
def create_lead():
    """Create a new lead."""
    session = get_session()
    try:
        data = request.json
        
        # Parse tags if it's a comma-separated string or list
        tags = data.get("tags", [])
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",") if t.strip()]
        # Convert to JSON string for storage
        tags_json = json.dumps(tags) if isinstance(tags, list) else "[]"
        
        # Parse deal_value
        deal_value = data.get("deal_value")
        if isinstance(deal_value, str):
            try:
                deal_value = float(deal_value.replace(",", "").replace("$", ""))
            except (ValueError, AttributeError):
                deal_value = None
        
        lead = Lead(
            business_name=data.get("business_name", ""),
            industry=data.get("industry"),
            contact_name=data.get("contact_name"),
            contact_title=data.get("contact_title"),
            email=data.get("email"),
            phone=data.get("phone"),
            website=data.get("website"),
            source=data.get("source"),
            service_category=data.get("service_category"),
            assigned_rep=data.get("assigned_rep"),
            status=data.get("status", "Not Contacted"),
            notes=data.get("notes"),
            tags=tags_json,
            deal_value=deal_value,
        )
        session.add(lead)
        session.commit()
        return jsonify(lead.to_dict()), 201
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route("/api/leads/<int:lead_id>", methods=["PUT"])
def update_lead(lead_id):
    """Update a lead."""
    session = get_session()
    try:
        lead = session.query(Lead).filter_by(id=lead_id).first()
        if not lead:
            return jsonify({"error": "Lead not found"}), 404
        
        data = request.json
        for key in ["business_name", "industry", "contact_name", "email", "phone", 
                    "source", "assigned_rep", "status", "notes"]:
            if key in data:
                setattr(lead, key, data[key])
        
        session.commit()
        return jsonify(lead.to_dict())
    finally:
        session.close()


@app.route("/api/leads/<int:lead_id>/quick-status", methods=["POST"])
def quick_status_update(lead_id):
    """Quick status update for a lead."""
    session = get_session()
    try:
        lead = session.query(Lead).filter_by(id=lead_id).first()
        if not lead:
            return jsonify({"error": "Lead not found"}), 404
        
        data = request.json
        lead.status = data.get("status", lead.status)
        lead.last_activity = datetime.utcnow()
        session.commit()
        return jsonify(lead.to_dict())
    finally:
        session.close()


@app.route("/api/leads/<int:lead_id>", methods=["DELETE"])
def delete_lead(lead_id):
    """Delete a lead."""
    session = get_session()
    try:
        lead = session.query(Lead).filter_by(id=lead_id).first()
        if not lead:
            return jsonify({"error": "Lead not found"}), 404
        
        session.delete(lead)
        session.commit()
        return jsonify({"success": True})
    finally:
        session.close()


@app.route("/api/leads/bulk-update", methods=["POST"])
def bulk_update_leads():
    """Bulk update leads."""
    session = get_session()
    try:
        data = request.json
        lead_ids = data.get("lead_ids", [])
        status = data.get("status")
        assigned_rep = data.get("assigned_rep")
        
        if not lead_ids:
            return jsonify({"error": "No lead IDs provided"}), 400
        
        leads = session.query(Lead).filter(Lead.id.in_(lead_ids)).all()
        for lead in leads:
            if status:
                lead.status = status
            if assigned_rep:
                lead.assigned_rep = assigned_rep
            lead.last_activity = datetime.utcnow()
        
        session.commit()
        return jsonify({"success": True, "updated": len(leads)})
    finally:
        session.close()


# --- Logs API ---

@app.route("/api/leads/<int:lead_id>/logs", methods=["GET"])
def get_logs_for_lead(lead_id):
    """Get all logs for a lead."""
    session = get_session()
    try:
        logs = session.query(Log).filter_by(lead_id=lead_id).order_by(Log.timestamp.desc()).all()
        return jsonify([log.to_dict() for log in logs])
    finally:
        session.close()


@app.route("/api/leads/<int:lead_id>/quick-log", methods=["POST"])
def quick_log_activity(lead_id):
    """Quick log an activity for a lead."""
    session = get_session()
    try:
        lead = session.query(Lead).filter_by(id=lead_id).first()
        if not lead:
            return jsonify({"error": "Lead not found"}), 404
        
        data = request.json
        log = Log(
            lead_id=lead_id,
            activity_type=data.get("activity_type", "Call"),
            outcome=data.get("outcome", "Attempted"),
            notes=data.get("notes", ""),
            timestamp=datetime.utcnow(),
        )
        session.add(log)
        
        # Update lead
        lead.activity_count += 1
        lead.last_activity = datetime.utcnow()
        
        # Auto-advance pipeline based on activity type
        activity_type = data.get("activity_type", "Call")
        outcome = data.get("outcome", "")
        
        if activity_type == "Call":
            if outcome in ("Connected", "Interested"):
                advance_lead_status(session, lead, "Connected", "call connected")
            else:
                advance_lead_status(session, lead, "Attempted", "call attempted")
        elif activity_type == "Email":
            advance_lead_status(session, lead, "Attempted", "email logged")
        elif activity_type == "Meeting":
            advance_lead_status(session, lead, "Connected", "meeting logged")
        elif activity_type == "Note":
            # Notes don't advance pipeline
            pass
        
        session.commit()
        return jsonify(log.to_dict())
    finally:
        session.close()


@app.route("/api/leads/<int:lead_id>/logs", methods=["POST"])
def create_log(lead_id):
    """Create a log entry for a lead."""
    session = get_session()
    try:
        lead = session.query(Lead).filter_by(id=lead_id).first()
        if not lead:
            return jsonify({"error": "Lead not found"}), 404
        
        data = request.json
        log = Log(
            lead_id=lead_id,
            activity_type=data.get("activity_type"),
            outcome=data.get("outcome"),
            notes=data.get("notes"),
            call_duration=data.get("call_duration"),
            call_outcome=data.get("call_outcome"),
            call_notes=data.get("call_notes"),
            email_subject=data.get("email_subject"),
        )
        session.add(log)
        
        # Update lead
        lead.activity_count += 1
        lead.last_activity = datetime.utcnow()
        
        # Auto-advance pipeline based on activity type
        activity_type = data.get("activity_type", "")
        outcome = data.get("outcome", "")
        if activity_type == "Call":
            if outcome in ("Connected", "Interested"):
                advance_lead_status(session, lead, "Connected", "call connected")
            else:
                advance_lead_status(session, lead, "Attempted", "call attempted")
        elif activity_type == "Email":
            advance_lead_status(session, lead, "Attempted", "email logged")
        elif activity_type == "Meeting":
            advance_lead_status(session, lead, "Connected", "meeting logged")
        
        session.commit()
        return jsonify(log.to_dict())
    finally:
        session.close()


# --- Dashboard API ---

@app.route("/api/dashboard/stats", methods=["GET"])
def get_dashboard_stats():
    """Get comprehensive dashboard statistics."""
    session = get_session()
    try:
        periods = get_period_boundaries()
        
        # Total counts
        total_leads = session.query(Lead).count()
        total_logs = session.query(Log).count()
        
        # Period stats
        daily_completed = session.query(Log).filter(Log.timestamp >= periods["today_start"]).count()
        weekly_completed = session.query(Log).filter(Log.timestamp >= periods["week_start"]).count()
        monthly_completed = session.query(Log).filter(Log.timestamp >= periods["month_start"]).count()
        yearly_completed = session.query(Log).filter(Log.timestamp >= periods["year_start"]).count()
        
        # Previous period stats for comparison
        last_week_completed = session.query(Log).filter(
            Log.timestamp >= periods["last_week_start"],
            Log.timestamp < periods["last_week_end"]
        ).count()
        last_month_completed = session.query(Log).filter(
            Log.timestamp >= periods["last_month_start"],
            Log.timestamp < periods["last_month_end"]
        ).count()
        
        # Targets (configurable)
        total_target = 6700
        team_size = 4
        daily_target = total_target / 365
        weekly_target = total_target / 52
        monthly_target = total_target / 12
        
        # Calculate percentage changes
        def calc_change(current, previous):
            if previous == 0:
                return 100.0 if current > 0 else 0.0
            return round(((current - previous) / previous) * 100, 1)
        
        weekly_change = calc_change(weekly_completed, last_week_completed)
        monthly_change = calc_change(monthly_completed, last_month_completed)
        
        # Status distribution
        status_counts = {}
        for status in Lead.STATUS_OPTIONS:
            count = session.query(Lead).filter(Lead.status == status).count()
            status_counts[status] = count
        
        # Activity type breakdown
        activity_breakdown = {}
        for activity_type in Log.ACTIVITY_TYPES:
            count = session.query(Log).filter(
                Log.activity_type == activity_type,
                Log.timestamp >= periods["week_start"]
            ).count()
            activity_breakdown[activity_type] = count
        
        # Conversion rate (leads that reached Qualified/Proposal/Converted)
        converted_statuses = ["Qualified Lead", "Proposal Sent", "Converted"]
        converted_count = session.query(Lead).filter(Lead.status.in_(converted_statuses)).count()
        conversion_rate = round((converted_count / total_leads * 100), 1) if total_leads > 0 else 0
        
        # Unique businesses contacted
        unique_businesses = session.query(func.count(func.distinct(Log.lead_id))).scalar() or 0
        
        return jsonify({
            # Period stats
            "daily_completed": daily_completed,
            "daily_target": round(daily_target, 1),
            "weekly_completed": weekly_completed,
            "weekly_target": round(weekly_target, 1),
            "weekly_change": weekly_change,
            "monthly_completed": monthly_completed,
            "monthly_target": round(monthly_target, 1),
            "monthly_change": monthly_change,
            "yearly_completed": yearly_completed,
            "yearly_target": total_target,
            # Totals
            "total_leads": total_leads,
            "unique_businesses": unique_businesses,
            "conversion_rate": conversion_rate,
            # Breakdowns
            "status_distribution": status_counts,
            "activity_breakdown": activity_breakdown,
        })
    finally:
        session.close()


@app.route("/api/dashboard/leaderboard", methods=["GET"])
def get_leaderboard():
    """Get rep performance leaderboard."""
    session = get_session()
    try:
        periods = get_period_boundaries()
        timeframe = request.args.get("timeframe", "week")
        
        if timeframe == "today":
            start_date = periods["today_start"]
        elif timeframe == "month":
            start_date = periods["month_start"]
        else:  # week
            start_date = periods["week_start"]
        
        # Only include reps who have signed in via SSO
        sso_user_ids = []
        if MicrosoftToken:
            sso_user_ids = [t.user_id for t in session.query(MicrosoftToken).all() if t.user_id]
        sso_members = session.query(TeamMember).filter(TeamMember.id.in_(sso_user_ids)).all() if sso_user_ids else []
        sso_rep_names = set(m.name for m in sso_members)
        
        leaderboard = []
        for rep in sso_rep_names:
            # Get leads for this rep
            rep_leads = session.query(Lead).filter(Lead.assigned_rep == rep).all()
            rep_lead_ids = [lead.id for lead in rep_leads]
            
            # Count activities from Log table - on assigned leads
            log_activities = session.query(Log).filter(
                Log.lead_id.in_(rep_lead_ids),
                Log.timestamp >= start_date
            ).count() if rep_lead_ids else 0
            
            # Also count orphan logs (NULL lead_id) - these are direct actions
            orphan_activities = session.query(Log).filter(
                Log.lead_id.is_(None),
                Log.timestamp >= start_date
            ).count()
            
            # Count calls from Log table
            calls = session.query(Log).filter(
                Log.lead_id.in_(rep_lead_ids),
                Log.activity_type == "Call",
                Log.timestamp >= start_date
            ).count() if rep_lead_ids else 0
            
            # Count emails sent through the queue BY this rep
            emails_from_queue = session.query(GeneratedEmail).filter(
                GeneratedEmail.generated_by == rep,
                GeneratedEmail.status == "sent",
                GeneratedEmail.sent_at >= start_date
            ).count()
            
            # Count email logs on assigned leads
            email_logs = session.query(Log).filter(
                Log.lead_id.in_(rep_lead_ids),
                Log.activity_type == "Email",
                Log.timestamp >= start_date
            ).count() if rep_lead_ids else 0
            
            total_emails = max(emails_from_queue, email_logs)
            
            # Count conversions
            conversions = session.query(Lead).filter(
                Lead.assigned_rep == rep,
                Lead.status.in_(["Qualified Lead", "Proposal Sent", "Converted"]),
                Lead.last_activity >= start_date
            ).count()
            
            total_activities = log_activities + orphan_activities + emails_from_queue
            
            leaderboard.append({
                "rep": rep,
                "activities": total_activities,
                "calls": calls,
                "emails": total_emails,
                "conversions": conversions,
                "leads_assigned": len(rep_leads),
            })
        
        # Sort by activities descending
        leaderboard.sort(key=lambda x: x["activities"], reverse=True)
        
        # Add rank
        for i, entry in enumerate(leaderboard):
            entry["rank"] = i + 1
        
        return jsonify(leaderboard)
    finally:
        session.close()


@app.route("/api/dashboard/trends", methods=["GET"])
def get_trends():
    """Get activity trends over time (last 7 days)."""
    session = get_session()
    try:
        days = int(request.args.get("days", 7))
        
        trends = []
        for i in range(days - 1, -1, -1):
            day = date.today() - timedelta(days=i)
            day_start = datetime.combine(day, datetime.min.time())
            day_end = day_start + timedelta(days=1)
            
            # Count activities for this day
            activities = session.query(Log).filter(
                Log.timestamp >= day_start,
                Log.timestamp < day_end
            ).count()
            
            # Count by type
            calls = session.query(Log).filter(
                Log.timestamp >= day_start,
                Log.timestamp < day_end,
                Log.activity_type == "Call"
            ).count()
            
            emails = session.query(Log).filter(
                Log.timestamp >= day_start,
                Log.timestamp < day_end,
                Log.activity_type == "Email"
            ).count()
            
            trends.append({
                "date": day.isoformat(),
                "day": day.strftime("%a"),
                "activities": activities,
                "calls": calls,
                "emails": emails,
            })
        
        return jsonify(trends)
    finally:
        session.close()


@app.route("/api/dashboard/conversion-funnel", methods=["GET"])
def get_conversion_funnel():
    """Get lead conversion funnel data."""
    session = get_session()
    try:
        funnel = []
        
        # Define funnel stages in order
        stages = [
            {"name": "New Leads", "statuses": ["Not Contacted"]},
            {"name": "In Progress", "statuses": ["Attempted", "Connected", "Follow-up Needed"]},
            {"name": "Qualified", "statuses": ["Qualified Lead", "Proposal Sent"]},
            {"name": "Converted", "statuses": ["Converted"]},
            {"name": "Lost", "statuses": ["Not Interested"]},
        ]
        
        total_leads = session.query(Lead).count()
        
        for stage in stages:
            count = session.query(Lead).filter(Lead.status.in_(stage["statuses"])).count()
            percentage = round((count / total_leads * 100), 1) if total_leads > 0 else 0
            funnel.append({
                "stage": stage["name"],
                "count": count,
                "percentage": percentage,
            })
        
        return jsonify(funnel)
    finally:
        session.close()


@app.route("/api/dashboard/filter-options", methods=["GET"])
def get_filter_options():
    """Get available filter options."""
    session = get_session()
    try:
        all_leads = session.query(Lead).all()
        reps = sorted(list(set(lead.assigned_rep for lead in all_leads if lead.assigned_rep)))
        industries = sorted(list(set(lead.industry for lead in all_leads if lead.industry)))
        
        return jsonify({
            "reps": reps,
            "industries": industries,
            "statuses": Lead.STATUS_OPTIONS,
        })
    finally:
        session.close()


# ===========================================
# Team Members API
# ===========================================

@app.route("/api/team", methods=["GET"])
def get_team_members():
    """Get all team members."""
    session = get_session()
    try:
        members = session.query(TeamMember).filter_by(is_active=True).all()
        return jsonify([m.to_dict() for m in members])
    finally:
        session.close()


@app.route("/api/team/sso", methods=["GET"])
def get_sso_team_members():
    """Get team members who have signed in via SSO."""
    session = get_session()
    try:
        sso_user_ids = []
        if MicrosoftToken:
            sso_user_ids = [t.user_id for t in session.query(MicrosoftToken).all() if t.user_id]
        if not sso_user_ids:
            return jsonify([])
        members = session.query(TeamMember).filter(TeamMember.id.in_(sso_user_ids), TeamMember.is_active == True).all()
        return jsonify([m.to_dict() for m in members])
    finally:
        session.close()


@app.route("/api/team/<int:member_id>", methods=["GET"])
def get_team_member(member_id):
    """Get a single team member."""
    session = get_session()
    try:
        member = session.query(TeamMember).filter_by(id=member_id).first()
        if not member:
            return jsonify({"error": "Team member not found"}), 404
        return jsonify(member.to_dict())
    finally:
        session.close()


@app.route("/api/team", methods=["POST"])
def create_team_member():
    """Create a new team member."""
    session = get_session()
    try:
        data = request.json
        member = TeamMember(
            name=data.get("name"),
            email=data.get("email"),
            role=data.get("role", "sales"),
            avatar_url=data.get("avatar_url"),
            phone=data.get("phone"),
        )
        session.add(member)
        session.commit()
        return jsonify(member.to_dict()), 201
    finally:
        session.close()


@app.route("/api/team/<int:member_id>", methods=["PUT"])
def update_team_member(member_id):
    """Update a team member."""
    session = get_session()
    try:
        member = session.query(TeamMember).filter_by(id=member_id).first()
        if not member:
            return jsonify({"error": "Team member not found"}), 404
        
        data = request.json
        for key in ["name", "email", "role", "avatar_url", "phone", "is_active"]:
            if key in data:
                setattr(member, key, data[key])
        
        session.commit()
        return jsonify(member.to_dict())
    finally:
        session.close()


@app.route("/api/team/<int:member_id>", methods=["DELETE"])
def delete_team_member(member_id):
    """Delete a team member."""
    session = get_session()
    try:
        member = session.query(TeamMember).filter_by(id=member_id).first()
        if not member:
            return jsonify({"error": "Team member not found"}), 404

        session.delete(member)
        session.commit()
        return jsonify({"message": "Team member removed successfully"}), 200
    finally:
        session.close()


@app.route("/api/team/performance", methods=["GET"])
def get_team_performance():
    """Get team performance metrics."""
    session = get_session()
    try:
        periods = get_period_boundaries()
        timeframe = request.args.get("timeframe", "week")
        
        if timeframe == "today":
            start_date = periods["today_start"]
        elif timeframe == "month":
            start_date = periods["month_start"]
        elif timeframe == "quarter":
            start_date = periods["month_start"] - timedelta(days=90)
        else:
            start_date = periods["week_start"]
        
        # Get all team members
        members = session.query(TeamMember).filter_by(is_active=True).all()
        
        performance = []
        for member in members:
            rep_leads = session.query(Lead).filter(Lead.assigned_rep == member.name).all()
            rep_lead_ids = [lead.id for lead in rep_leads]
            
            # Count activities from logs (for leads assigned to this rep)
            log_activities = session.query(Log).filter(
                Log.lead_id.in_(rep_lead_ids),
                Log.timestamp >= start_date
            ).count() if rep_lead_ids else 0
            
            calls = session.query(Log).filter(
                Log.lead_id.in_(rep_lead_ids),
                Log.activity_type == "Call",
                Log.timestamp >= start_date
            ).count() if rep_lead_ids else 0
            
            email_logs = session.query(Log).filter(
                Log.lead_id.in_(rep_lead_ids),
                Log.activity_type == "Email",
                Log.timestamp >= start_date
            ).count() if rep_lead_ids else 0
            
            # Also count sent emails from the email queue (generated_emails table)
            # Emails sent for this rep's leads
            email_queue_for_leads = session.query(GeneratedEmail).filter(
                GeneratedEmail.lead_id.in_(rep_lead_ids),
                GeneratedEmail.status == "sent",
                GeneratedEmail.sent_at >= start_date
            ).count() if rep_lead_ids else 0
            
            # Emails composed/sent by this team member directly
            email_queue_by_member = session.query(GeneratedEmail).filter(
                GeneratedEmail.generated_by.in_([member.name, "Manual"]),
                GeneratedEmail.status == "sent",
                GeneratedEmail.sent_at >= start_date
            ).count()
            
            # Total emails = log entries + queued emails (avoid double counting)
            emails = email_logs + max(email_queue_for_leads, email_queue_by_member)
            
            meetings = session.query(Log).filter(
                Log.lead_id.in_(rep_lead_ids),
                Log.activity_type == "Meeting",
                Log.timestamp >= start_date
            ).count() if rep_lead_ids else 0
            
            proposals = session.query(Proposal).filter(
                Proposal.lead_id.in_(rep_lead_ids),
                Proposal.created_at >= start_date
            ).count() if rep_lead_ids else 0
            
            conversions = session.query(Lead).filter(
                Lead.assigned_rep == member.name,
                Lead.status == "Converted",
                Lead.last_activity >= start_date
            ).count()
            
            # Calculate revenue (sum of accepted proposals)
            revenue = session.query(func.sum(Proposal.total_price)).filter(
                Proposal.lead_id.in_(rep_lead_ids),
                Proposal.status == "accepted"
            ).scalar() or 0
            
            # Total activities includes everything
            activities = log_activities + max(email_queue_for_leads, email_queue_by_member)
            
            performance.append({
                "id": member.id,
                "name": member.name,
                "email": member.email,
                "role": member.role,
                "avatar_url": member.avatar_url,
                "activities": activities,
                "calls": calls,
                "emails": emails,
                "meetings": meetings,
                "proposals": proposals,
                "conversions": conversions,
                "revenue": float(revenue),
                "leads_assigned": len(rep_leads),
                "targets": {
                    "calls": 50,
                    "emails": 100,
                    "meetings": 10,
                    "conversions": 5,
                },
            })
        
        # Sort by activities and add rank
        performance.sort(key=lambda x: x["activities"], reverse=True)
        for i, p in enumerate(performance):
            p["rank"] = i + 1
        
        # Team totals
        team_stats = {
            "total_activities": sum(p["activities"] for p in performance),
            "total_calls": sum(p["calls"] for p in performance),
            "total_emails": sum(p["emails"] for p in performance),
            "total_meetings": sum(p["meetings"] for p in performance),
            "total_proposals": sum(p["proposals"] for p in performance),
            "total_conversions": sum(p["conversions"] for p in performance),
            "total_revenue": sum(p["revenue"] for p in performance),
        }
        
        return jsonify({
            "members": performance,
            "team_stats": team_stats,
        })
    finally:
        session.close()


@app.route("/api/my-performance", methods=["GET"])
def get_my_performance():
    """Get the current logged-in user's personal performance metrics."""
    session = get_session()
    try:
        periods = get_period_boundaries()
        timeframe = request.args.get("timeframe", "month")
        
        if timeframe == "today":
            start_date = periods["today_start"]
        elif timeframe == "month":
            start_date = periods["month_start"]
        elif timeframe == "quarter":
            start_date = periods["month_start"] - timedelta(days=90)
        elif timeframe == "all":
            start_date = datetime(2020, 1, 1)
        else:
            start_date = periods["week_start"]
        
        # Identify current user
        member = None
        if MicrosoftToken:
            token = session.query(MicrosoftToken).first()
            if token and token.user_id:
                member = session.query(TeamMember).get(token.user_id)
        if not member:
            member = session.query(TeamMember).filter_by(is_active=True).first()
        
        if not member:
            return jsonify({"error": "No user found"}), 404
        
        # Get leads assigned to this user
        rep_leads = session.query(Lead).filter(Lead.assigned_rep == member.name).all()
        rep_lead_ids = [lead.id for lead in rep_leads]
        
        # === Activity Logs (from Log table) ===
        # Logs for user's assigned leads
        log_activities = session.query(Log).filter(
            Log.lead_id.in_(rep_lead_ids),
            Log.timestamp >= start_date
        ).count() if rep_lead_ids else 0
        
        # Also count logs with NULL lead_id (direct sends, etc.)
        orphan_logs = session.query(Log).filter(
            Log.lead_id.is_(None),
            Log.timestamp >= start_date
        ).count()
        
        log_calls = session.query(Log).filter(
            Log.lead_id.in_(rep_lead_ids),
            Log.activity_type == "Call",
            Log.timestamp >= start_date
        ).count() if rep_lead_ids else 0
        
        log_emails = session.query(Log).filter(
            Log.lead_id.in_(rep_lead_ids),
            Log.activity_type == "Email",
            Log.timestamp >= start_date
        ).count() if rep_lead_ids else 0
        
        log_meetings = session.query(Log).filter(
            Log.lead_id.in_(rep_lead_ids),
            Log.activity_type == "Meeting",
            Log.timestamp >= start_date
        ).count() if rep_lead_ids else 0
        
        log_notes = session.query(Log).filter(
            Log.lead_id.in_(rep_lead_ids),
            Log.activity_type == "Note",
            Log.timestamp >= start_date
        ).count() if rep_lead_ids else 0
        
        log_tasks = session.query(Log).filter(
            Log.lead_id.in_(rep_lead_ids),
            Log.activity_type == "Task",
            Log.timestamp >= start_date
        ).count() if rep_lead_ids else 0
        
        # === Emails from GeneratedEmail table ===
        # By member name
        emails_sent = session.query(GeneratedEmail).filter(
            GeneratedEmail.status == "sent",
            GeneratedEmail.sent_at >= start_date
        ).count()
        
        emails_pending = session.query(GeneratedEmail).filter(
            GeneratedEmail.status == "pending_review"
        ).count()
        
        emails_approved = session.query(GeneratedEmail).filter(
            GeneratedEmail.status == "approved"
        ).count()
        
        emails_rejected = session.query(GeneratedEmail).filter(
            GeneratedEmail.status == "rejected"
        ).count()
        
        emails_total = session.query(GeneratedEmail).filter(
            GeneratedEmail.generated_at >= start_date
        ).count()
        
        # === Proposals ===
        proposals = session.query(Proposal).filter(
            Proposal.lead_id.in_(rep_lead_ids),
            Proposal.created_at >= start_date
        ).count() if rep_lead_ids else 0
        
        # === Conversions ===
        conversions = session.query(Lead).filter(
            Lead.assigned_rep == member.name,
            Lead.status == "Converted",
            Lead.last_activity >= start_date
        ).count()
        
        # === Revenue ===
        revenue = session.query(func.sum(Proposal.total_price)).filter(
            Proposal.lead_id.in_(rep_lead_ids),
            Proposal.status == "accepted"
        ).scalar() or 0 if rep_lead_ids else 0
        
        # === Recent Activity Timeline ===
        recent_logs = session.query(Log).filter(
            Log.timestamp >= start_date
        ).order_by(Log.timestamp.desc()).limit(20).all()
        
        recent_emails_sent = session.query(GeneratedEmail).filter(
            GeneratedEmail.status == "sent",
            GeneratedEmail.sent_at >= start_date
        ).order_by(GeneratedEmail.sent_at.desc()).limit(10).all()
        
        # Build timeline
        timeline = []
        for log in recent_logs:
            lead_name = None
            if log.lead_id:
                log_lead = session.query(Lead).filter_by(id=log.lead_id).first()
                if log_lead:
                    lead_name = log_lead.contact_name or log_lead.business_name
            timeline.append({
                "type": "activity",
                "activity_type": log.activity_type,
                "outcome": log.outcome,
                "notes": log.notes,
                "lead_name": lead_name,
                "lead_id": log.lead_id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            })
        
        for em in recent_emails_sent:
            lead_name = None
            if em.lead_id:
                em_lead = session.query(Lead).filter_by(id=em.lead_id).first()
                if em_lead:
                    lead_name = em_lead.contact_name or em_lead.business_name
            timeline.append({
                "type": "email_sent",
                "activity_type": "Email",
                "outcome": "Sent",
                "notes": f"Subject: {em.subject} | To: {em.recipient_email or 'Unknown'}",
                "lead_name": lead_name,
                "lead_id": em.lead_id,
                "timestamp": em.sent_at.isoformat() if em.sent_at else None,
            })
        
        # Sort timeline by timestamp descending
        timeline.sort(key=lambda x: x["timestamp"] or "", reverse=True)
        timeline = timeline[:25]
        
        # Total activities = logs + sent emails (from queue)
        total_activities = log_activities + orphan_logs + emails_sent
        total_emails = log_emails + emails_sent
        
        return jsonify({
            "user": {
                "id": member.id,
                "name": member.name,
                "email": member.email,
                "role": member.role,
                "avatar_url": member.avatar_url,
            },
            "stats": {
                "total_activities": total_activities,
                "calls": log_calls,
                "emails_sent": emails_sent,
                "emails_total": total_emails,
                "meetings": log_meetings,
                "notes": log_notes,
                "tasks": log_tasks,
                "proposals": proposals,
                "conversions": conversions,
                "revenue": float(revenue),
                "leads_assigned": len(rep_leads),
            },
            "email_pipeline": {
                "pending_review": emails_pending,
                "approved": emails_approved,
                "rejected": emails_rejected,
                "sent": emails_sent,
                "total_composed": emails_total,
            },
            "targets": {
                "calls": 50,
                "emails": 100,
                "meetings": 10,
                "conversions": 5,
            },
            "timeline": timeline,
        })
    except Exception as e:
        print(f"Error in my-performance: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


# ===========================================
# Authentication API
# ===========================================

@app.route("/api/auth/login", methods=["POST"])
def login():
    """Authenticate user and return user info."""
    session = get_session()
    try:
        data = request.json
        email = data.get("email", "").strip()
        password = data.get("password", "")
        
        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400
        
        # Find team member by email
        member = session.query(TeamMember).filter(TeamMember.email == email).first()
        
        if member:
            # In production, you would verify the password hash here
            # For now, accept any password for existing team members
            member.last_login = datetime.utcnow()
            session.commit()
            
            # Create audit log
            audit = AuditLog(
                entity_type="auth",
                action="login",
                user_name=member.name,
                user_id=member.id,
                ip_address=request.remote_addr,
            )
            session.add(audit)
            session.commit()
            
            return jsonify({
                "success": True,
                "user": {
                    "id": member.id,
                    "name": member.name,
                    "email": member.email,
                    "role": member.role,
                    "avatar_url": member.avatar_url,
                },
            })
        else:
            # Create a new team member for demo purposes
            # In production, you would return an error
            new_member = TeamMember(
                name=email.split('@')[0].replace('.', ' ').title(),
                email=email,
                role="sales",
            )
            session.add(new_member)
            session.commit()
            
            return jsonify({
                "success": True,
                "user": {
                    "id": new_member.id,
                    "name": new_member.name,
                    "email": new_member.email,
                    "role": new_member.role,
                    "avatar_url": None,
                },
            })
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({"error": "Login failed"}), 500
    finally:
        session.close()


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    """Log out user."""
    session = get_session()
    try:
        data = request.json or {}
        user_name = data.get("user_name")
        
        # Create audit log
        if user_name:
            audit = AuditLog(
                entity_type="auth",
                action="logout",
                user_name=user_name,
                ip_address=request.remote_addr,
            )
            session.add(audit)
            session.commit()
        
        return jsonify({"success": True})
    finally:
        session.close()


@app.route("/api/auth/verify", methods=["GET"])
def verify_session():
    """Verify if user session is valid."""
    # In a real app, this would check session/token validity
    # For now, return success
    return jsonify({"valid": True})


@app.route("/api/user/me", methods=["GET"])
def get_current_user():
    """Get current user info from Microsoft token or first team member."""
    session = get_session()
    try:
        # Try to get user from Microsoft token
        member = None
        if MicrosoftToken:
            token = session.query(MicrosoftToken).first()
            if token and token.user_id:
                member = session.query(TeamMember).get(token.user_id)
        
        # Fallback: get first active team member
        if not member:
            member = session.query(TeamMember).filter_by(is_active=True).first()
        
        if member:
            return jsonify({
                "id": member.id,
                "name": member.name,
                "email": member.email,
                "role": member.role,
                "avatar_url": member.avatar_url,
            })
        
        return jsonify({
            "id": 1,
            "name": "Current User",
            "email": "user@dwgrowth.com",
            "role": "sales",
            "avatar_url": None,
        })
    finally:
        session.close()


@app.route("/api/user/me", methods=["PUT"])
def update_current_user():
    """Update current user info."""
    data = request.json
    # In a real app, this would update the authenticated user
    return jsonify({
        "id": 1,
        "name": data.get("name", "Current User"),
        "email": data.get("email", "user@dwgrowth.com"),
        "role": data.get("role", "sales"),
        "avatar_url": data.get("avatar_url"),
    })


@app.route("/api/team/<int:member_id>/dashboard", methods=["GET"])
def get_member_dashboard(member_id):
    """Get individual team member dashboard data."""
    session = get_session()
    try:
        member = session.query(TeamMember).get(member_id)
        if not member:
            return jsonify({"error": "Team member not found"}), 404
        
        periods = get_period_boundaries()
        timeframe = request.args.get("timeframe", "week")
        
        if timeframe == "today":
            start_date = periods["today_start"]
        elif timeframe == "month":
            start_date = periods["month_start"]
        elif timeframe == "quarter":
            start_date = periods["month_start"] - timedelta(days=90)
        else:
            start_date = periods["week_start"]
        
        # Get member's leads
        leads = session.query(Lead).filter(Lead.assigned_rep == member.name).all()
        lead_ids = [lead.id for lead in leads]
        
        # Activity metrics
        activities = session.query(Log).filter(
            Log.lead_id.in_(lead_ids),
            Log.timestamp >= start_date
        ).count() if lead_ids else 0
        
        calls = session.query(Log).filter(
            Log.lead_id.in_(lead_ids),
            Log.activity_type == "Call",
            Log.timestamp >= start_date
        ).count() if lead_ids else 0
        
        emails = session.query(Log).filter(
            Log.lead_id.in_(lead_ids),
            Log.activity_type == "Email",
            Log.timestamp >= start_date
        ).count() if lead_ids else 0
        
        meetings = session.query(Log).filter(
            Log.lead_id.in_(lead_ids),
            Log.activity_type == "Meeting",
            Log.timestamp >= start_date
        ).count() if lead_ids else 0
        
        # Pipeline metrics
        pipeline_leads = {}
        for lead in leads:
            stage_id = lead.pipeline_stage_id or "unassigned"
            if stage_id not in pipeline_leads:
                pipeline_leads[stage_id] = {"count": 0, "value": 0}
            pipeline_leads[stage_id]["count"] += 1
            pipeline_leads[stage_id]["value"] += lead.deal_value or 0
        
        # Conversion metrics
        conversions = session.query(Lead).filter(
            Lead.assigned_rep == member.name,
            Lead.status == "Converted",
            Lead.last_activity >= start_date
        ).count()
        
        total_leads = len(leads)
        conversion_rate = round((conversions / total_leads * 100) if total_leads > 0 else 0, 1)
        
        # Recent activities
        recent_logs = session.query(Log).filter(
            Log.lead_id.in_(lead_ids)
        ).order_by(Log.timestamp.desc()).limit(10).all() if lead_ids else []
        
        # Follow-up reminders
        pending_reminders = session.query(Reminder).filter(
            Reminder.assigned_to == member.name,
            Reminder.completed_at == None
        ).order_by(Reminder.due_date).limit(5).all()
        
        # Proposals
        proposals_sent = session.query(Proposal).filter(
            Proposal.lead_id.in_(lead_ids),
            Proposal.status.in_(["sent", "viewed", "accepted", "rejected"]),
            Proposal.created_at >= start_date
        ).count() if lead_ids else 0
        
        proposals_won = session.query(Proposal).filter(
            Proposal.lead_id.in_(lead_ids),
            Proposal.status == "accepted",
            Proposal.created_at >= start_date
        ).count() if lead_ids else 0
        
        # Revenue
        revenue = session.query(func.sum(Proposal.total_price)).filter(
            Proposal.lead_id.in_(lead_ids),
            Proposal.status == "accepted"
        ).scalar() or 0
        
        return jsonify({
            "member": member.to_dict(),
            "metrics": {
                "activities": activities,
                "calls": calls,
                "emails": emails,
                "meetings": meetings,
                "leads_assigned": total_leads,
                "conversions": conversions,
                "conversion_rate": conversion_rate,
                "proposals_sent": proposals_sent,
                "proposals_won": proposals_won,
                "revenue": float(revenue),
            },
            "pipeline": pipeline_leads,
            "recent_activities": [
                {
                    "id": log.id,
                    "activity_type": log.activity_type,
                    "outcome": log.outcome,
                    "timestamp": log.timestamp.isoformat(),
                    "lead_id": log.lead_id,
                }
                for log in recent_logs
            ],
            "pending_reminders": [r.to_dict() for r in pending_reminders],
            "targets": {
                "calls": 50,
                "emails": 100,
                "meetings": 10,
                "conversions": 5,
                "revenue": 50000,
            },
        })
    finally:
        session.close()


@app.route("/api/team/<int:member_id>/activity-trend", methods=["GET"])
def get_member_activity_trend(member_id):
    """Get activity trend data for a team member."""
    session = get_session()
    try:
        member = session.query(TeamMember).get(member_id)
        if not member:
            return jsonify({"error": "Team member not found"}), 404
        
        days = int(request.args.get("days", 14))
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        leads = session.query(Lead).filter(Lead.assigned_rep == member.name).all()
        lead_ids = [lead.id for lead in leads]
        
        trend_data = []
        current_date = start_date
        while current_date <= end_date:
            day_start = datetime.combine(current_date.date(), datetime.min.time())
            day_end = day_start + timedelta(days=1)
            
            activities = session.query(Log).filter(
                Log.lead_id.in_(lead_ids),
                Log.timestamp >= day_start,
                Log.timestamp < day_end
            ).count() if lead_ids else 0
            
            calls = session.query(Log).filter(
                Log.lead_id.in_(lead_ids),
                Log.activity_type == "Call",
                Log.timestamp >= day_start,
                Log.timestamp < day_end
            ).count() if lead_ids else 0
            
            emails = session.query(Log).filter(
                Log.lead_id.in_(lead_ids),
                Log.activity_type == "Email",
                Log.timestamp >= day_start,
                Log.timestamp < day_end
            ).count() if lead_ids else 0
            
            trend_data.append({
                "date": current_date.strftime("%Y-%m-%d"),
                "day": current_date.strftime("%a"),
                "activities": activities,
                "calls": calls,
                "emails": emails,
            })
            
            current_date += timedelta(days=1)
        
        return jsonify(trend_data)
    finally:
        session.close()


@app.route("/api/team/<int:member_id>/leads", methods=["GET"])
def get_member_leads(member_id):
    """Get all leads assigned to a team member."""
    session = get_session()
    try:
        member = session.query(TeamMember).get(member_id)
        if not member:
            return jsonify({"error": "Team member not found"}), 404
        
        leads = session.query(Lead).filter(Lead.assigned_rep == member.name).all()
        return jsonify([l.to_dict() for l in leads])
    finally:
        session.close()


# ===========================================
# Reminders API
# ===========================================

@app.route("/api/reminders", methods=["GET"])
def get_reminders():
    """Get all reminders with filters."""
    session = get_session()
    try:
        query = session.query(Reminder)
        
        # Filters
        priority = request.args.get("priority")
        reminder_type = request.args.get("type")
        status = request.args.get("status")
        assigned_to = request.args.get("assigned_to")
        
        if priority:
            query = query.filter(Reminder.priority == priority)
        if reminder_type:
            query = query.filter(Reminder.type == reminder_type)
        if assigned_to:
            query = query.filter(Reminder.assigned_to == assigned_to)
        if status == "active":
            query = query.filter(Reminder.completed_at.is_(None))
        elif status == "completed":
            query = query.filter(Reminder.completed_at.isnot(None))
        
        reminders = query.order_by(Reminder.due_date.asc()).all()
        return jsonify([r.to_dict() for r in reminders])
    finally:
        session.close()


@app.route("/api/reminders/<int:reminder_id>", methods=["GET"])
def get_reminder(reminder_id):
    """Get a single reminder."""
    session = get_session()
    try:
        reminder = session.query(Reminder).filter_by(id=reminder_id).first()
        if not reminder:
            return jsonify({"error": "Reminder not found"}), 404
        return jsonify(reminder.to_dict())
    finally:
        session.close()


@app.route("/api/reminders", methods=["POST"])
def create_reminder():
    """Create a new reminder."""
    session = get_session()
    try:
        data = request.json
        reminder = Reminder(
            lead_id=data.get("lead_id"),
            assigned_to=data.get("assigned_to"),
            type=data.get("type", "follow-up"),
            priority=data.get("priority", "medium"),
            title=data.get("title"),
            description=data.get("description"),
            due_date=datetime.fromisoformat(data["due_date"]) if data.get("due_date") else None,
        )
        session.add(reminder)
        session.commit()
        return jsonify(reminder.to_dict()), 201
    finally:
        session.close()


@app.route("/api/reminders/<int:reminder_id>", methods=["PUT"])
def update_reminder(reminder_id):
    """Update a reminder."""
    session = get_session()
    try:
        reminder = session.query(Reminder).filter_by(id=reminder_id).first()
        if not reminder:
            return jsonify({"error": "Reminder not found"}), 404
        
        data = request.json
        for key in ["lead_id", "assigned_to", "type", "priority", "title", "description"]:
            if key in data:
                setattr(reminder, key, data[key])
        if "due_date" in data:
            reminder.due_date = datetime.fromisoformat(data["due_date"]) if data["due_date"] else None
        
        session.commit()
        return jsonify(reminder.to_dict())
    finally:
        session.close()


@app.route("/api/reminders/<int:reminder_id>", methods=["DELETE"])
def delete_reminder(reminder_id):
    """Delete a reminder."""
    session = get_session()
    try:
        reminder = session.query(Reminder).filter_by(id=reminder_id).first()
        if not reminder:
            return jsonify({"error": "Reminder not found"}), 404
        
        session.delete(reminder)
        session.commit()
        return jsonify({"success": True})
    finally:
        session.close()


@app.route("/api/reminders/<int:reminder_id>/complete", methods=["PUT"])
def complete_reminder(reminder_id):
    """Mark a reminder as complete."""
    session = get_session()
    try:
        reminder = session.query(Reminder).filter_by(id=reminder_id).first()
        if not reminder:
            return jsonify({"error": "Reminder not found"}), 404
        
        reminder.completed_at = datetime.utcnow()
        session.commit()
        return jsonify(reminder.to_dict())
    finally:
        session.close()


@app.route("/api/reminders/<int:reminder_id>/snooze", methods=["PUT"])
def snooze_reminder(reminder_id):
    """Snooze a reminder."""
    session = get_session()
    try:
        reminder = session.query(Reminder).filter_by(id=reminder_id).first()
        if not reminder:
            return jsonify({"error": "Reminder not found"}), 404
        
        data = request.json
        hours = data.get("hours", 1)
        reminder.snoozed_until = datetime.utcnow() + timedelta(hours=hours)
        session.commit()
        return jsonify(reminder.to_dict())
    finally:
        session.close()


# ===========================================
# Calendar Events API
# ===========================================

@app.route("/api/calendar/events", methods=["GET"])
def get_calendar_events():
    """Get calendar events."""
    session = get_session()
    try:
        query = session.query(CalendarEvent)
        
        start = request.args.get("start")
        end = request.args.get("end")
        
        if start:
            query = query.filter(CalendarEvent.start_time >= datetime.fromisoformat(start))
        if end:
            query = query.filter(CalendarEvent.start_time <= datetime.fromisoformat(end))
        
        events = query.order_by(CalendarEvent.start_time.asc()).all()
        return jsonify([e.to_dict() for e in events])
    finally:
        session.close()


@app.route("/api/calendar/events", methods=["POST"])
def create_calendar_event():
    """Create a calendar event."""
    session = get_session()
    try:
        data = request.json
        event = CalendarEvent(
            lead_id=data.get("lead_id"),
            title=data.get("title"),
            description=data.get("description"),
            event_type=data.get("event_type", "meeting"),
            start_time=datetime.fromisoformat(data["start_time"]) if data.get("start_time") else None,
            end_time=datetime.fromisoformat(data["end_time"]) if data.get("end_time") else None,
            created_by=data.get("created_by"),
        )
        session.add(event)
        session.commit()
        return jsonify(event.to_dict()), 201
    finally:
        session.close()


@app.route("/api/calendar/events/<int:event_id>", methods=["PUT"])
def update_calendar_event(event_id):
    """Update a calendar event."""
    session = get_session()
    try:
        event = session.query(CalendarEvent).filter_by(id=event_id).first()
        if not event:
            return jsonify({"error": "Event not found"}), 404
        
        data = request.json
        for key in ["lead_id", "title", "description", "event_type", "created_by"]:
            if key in data:
                setattr(event, key, data[key])
        if "start_time" in data:
            event.start_time = datetime.fromisoformat(data["start_time"]) if data["start_time"] else None
        if "end_time" in data:
            event.end_time = datetime.fromisoformat(data["end_time"]) if data["end_time"] else None
        
        session.commit()
        return jsonify(event.to_dict())
    finally:
        session.close()


@app.route("/api/calendar/events/<int:event_id>", methods=["DELETE"])
def delete_calendar_event(event_id):
    """Delete a calendar event."""
    session = get_session()
    try:
        event = session.query(CalendarEvent).filter_by(id=event_id).first()
        if not event:
            return jsonify({"error": "Event not found"}), 404
        
        session.delete(event)
        session.commit()
        return jsonify({"success": True})
    finally:
        session.close()


# ===========================================
# Email Templates API
# ===========================================

@app.route("/api/templates", methods=["GET"])
def get_templates():
    """Get all email templates."""
    session = get_session()
    try:
        templates = session.query(EmailTemplate).all()
        return jsonify([t.to_dict() for t in templates])
    finally:
        session.close()


@app.route("/api/templates/<int:template_id>", methods=["GET"])
def get_template(template_id):
    """Get a single template."""
    session = get_session()
    try:
        template = session.query(EmailTemplate).filter_by(id=template_id).first()
        if not template:
            return jsonify({"error": "Template not found"}), 404
        return jsonify(template.to_dict())
    finally:
        session.close()


@app.route("/api/templates", methods=["POST"])
def create_template():
    """Create a new template."""
    session = get_session()
    try:
        data = request.json
        template = EmailTemplate(
            name=data.get("name"),
            category=data.get("category"),
            subject=data.get("subject"),
            body=data.get("body"),
            is_default=data.get("is_default", False),
        )
        session.add(template)
        session.commit()
        return jsonify(template.to_dict()), 201
    finally:
        session.close()


@app.route("/api/templates/<int:template_id>", methods=["PUT"])
def update_template(template_id):
    """Update a template."""
    session = get_session()
    try:
        template = session.query(EmailTemplate).filter_by(id=template_id).first()
        if not template:
            return jsonify({"error": "Template not found"}), 404
        
        data = request.json
        for key in ["name", "category", "subject", "body", "is_default"]:
            if key in data:
                setattr(template, key, data[key])
        
        session.commit()
        return jsonify(template.to_dict())
    finally:
        session.close()


@app.route("/api/templates/<int:template_id>", methods=["DELETE"])
def delete_template(template_id):
    """Delete a template."""
    session = get_session()
    try:
        template = session.query(EmailTemplate).filter_by(id=template_id).first()
        if not template:
            return jsonify({"error": "Template not found"}), 404
        
        session.delete(template)
        session.commit()
        return jsonify({"success": True})
    finally:
        session.close()


# ===========================================
# Email Sequences API
# ===========================================

@app.route("/api/email-sequences", methods=["GET"])
def get_email_sequences():
    """Get all email sequences."""
    session = get_session()
    try:
        sequences = session.query(EmailSequence).all()
        return jsonify([s.to_dict() for s in sequences])
    finally:
        session.close()


@app.route("/api/email-sequences/<int:sequence_id>", methods=["GET"])
def get_email_sequence(sequence_id):
    """Get a single sequence."""
    session = get_session()
    try:
        sequence = session.query(EmailSequence).filter_by(id=sequence_id).first()
        if not sequence:
            return jsonify({"error": "Sequence not found"}), 404
        return jsonify(sequence.to_dict())
    finally:
        session.close()


@app.route("/api/email-sequences", methods=["POST"])
def create_email_sequence():
    """Create a new email sequence."""
    session = get_session()
    try:
        data = request.json
        sequence = EmailSequence(
            name=data.get("name"),
            description=data.get("description"),
            status=data.get("status", "draft"),
        )
        session.add(sequence)
        session.commit()
        
        # Add steps if provided
        for step_data in data.get("steps", []):
            step = EmailSequenceStep(
                sequence_id=sequence.id,
                step_order=step_data.get("step_order", 0),
                template_id=step_data.get("template_id"),
                delay_days=step_data.get("delay_days", 0),
                subject_override=step_data.get("subject_override"),
            )
            session.add(step)
        
        session.commit()
        return jsonify(sequence.to_dict()), 201
    finally:
        session.close()


@app.route("/api/email-sequences/<int:sequence_id>", methods=["PUT"])
def update_email_sequence(sequence_id):
    """Update an email sequence."""
    session = get_session()
    try:
        sequence = session.query(EmailSequence).filter_by(id=sequence_id).first()
        if not sequence:
            return jsonify({"error": "Sequence not found"}), 404
        
        data = request.json
        for key in ["name", "description", "status"]:
            if key in data:
                setattr(sequence, key, data[key])
        
        session.commit()
        return jsonify(sequence.to_dict())
    finally:
        session.close()


@app.route("/api/email-sequences/<int:sequence_id>", methods=["DELETE"])
def delete_email_sequence(sequence_id):
    """Delete an email sequence."""
    session = get_session()
    try:
        sequence = session.query(EmailSequence).filter_by(id=sequence_id).first()
        if not sequence:
            return jsonify({"error": "Sequence not found"}), 404
        
        session.delete(sequence)
        session.commit()
        return jsonify({"success": True})
    finally:
        session.close()


# ===========================================
# Pending/Generated Emails API
# ===========================================

@app.route("/api/emails/queue", methods=["POST"])
def queue_email_for_review():
    """Queue a composed email for review (pending_review status)."""
    session = get_session()
    try:
        data = request.json
        to_email = data.get("to")
        subject = data.get("subject")
        body = data.get("body")
        lead_id = data.get("lead_id")
        template_id = data.get("template_id")
        
        if not to_email or not subject or not body:
            return jsonify({"error": "Missing required fields: to, subject, body"}), 400
        
        # If lead_id not provided, try to find lead by email
        if not lead_id and to_email:
            lead = session.query(Lead).filter_by(email=to_email).first()
            if lead:
                lead_id = lead.id
        
        # Determine who is composing this email
        composer_name = data.get("generated_by", "Manual")
        if composer_name == "Manual":
            # Try to get actual user name from Microsoft token
            if MicrosoftToken:
                token = session.query(MicrosoftToken).first()
                if token and token.user_id:
                    member = session.query(TeamMember).get(token.user_id)
                    if member:
                        composer_name = member.name
        
        email = GeneratedEmail(
            lead_id=lead_id,
            template_id=template_id,
            recipient_email=to_email,
            subject=subject,
            body=body,
            status="pending_review",
            priority=data.get("priority", "medium"),
            generated_by=composer_name,
            generated_at=datetime.utcnow(),
        )
        session.add(email)
        session.commit()
        
        result = email.to_dict()
        # Include the recipient email in the response
        result["recipient_email"] = to_email
        
        return jsonify(result), 201
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route("/api/emails/pending", methods=["GET"])
def get_pending_emails():
    """Get pending emails for review."""
    session = get_session()
    try:
        status = request.args.get("status", "pending_review")
        query = session.query(GeneratedEmail)
        
        if status != "all":
            query = query.filter(GeneratedEmail.status == status)
        
        emails = query.order_by(GeneratedEmail.generated_at.desc()).all()
        return jsonify([e.to_dict() for e in emails])
    finally:
        session.close()


@app.route("/api/emails/counts", methods=["GET"])
def get_email_counts():
    """Get email counts by status."""
    session = get_session()
    try:
        pending = session.query(GeneratedEmail).filter(GeneratedEmail.status == "pending_review").count()
        approved = session.query(GeneratedEmail).filter(GeneratedEmail.status == "approved").count()
        rejected = session.query(GeneratedEmail).filter(GeneratedEmail.status == "rejected").count()
        sent = session.query(GeneratedEmail).filter(GeneratedEmail.status == "sent").count()
        return jsonify({
            "pending_review": pending,
            "approved": approved,
            "rejected": rejected,
            "sent": sent,
        })
    finally:
        session.close()


@app.route("/api/emails/<int:email_id>/approve", methods=["PUT"])
def approve_email(email_id):
    """Approve an email."""
    session = get_session()
    try:
        email = session.query(GeneratedEmail).filter_by(id=email_id).first()
        if not email:
            return jsonify({"error": "Email not found"}), 404
        
        data = request.json
        email.status = "approved"
        email.reviewer = data.get("reviewer")
        email.review_notes = data.get("notes")
        session.commit()
        return jsonify(email.to_dict())
    finally:
        session.close()


@app.route("/api/emails/<int:email_id>/reject", methods=["PUT"])
def reject_email(email_id):
    """Reject an email."""
    session = get_session()
    try:
        email = session.query(GeneratedEmail).filter_by(id=email_id).first()
        if not email:
            return jsonify({"error": "Email not found"}), 404
        
        data = request.json
        email.status = "rejected"
        email.reviewer = data.get("reviewer")
        email.review_notes = data.get("notes")
        session.commit()
        return jsonify(email.to_dict())
    finally:
        session.close()


@app.route("/api/emails/<int:email_id>/send", methods=["POST"])
def send_email(email_id):
    """Send an approved email via Microsoft Graph API."""
    global _http_session
    session = get_session()
    try:
        email = session.query(GeneratedEmail).filter_by(id=email_id).first()
        if not email:
            return jsonify({"error": "Email not found"}), 404
        
        if email.status not in ("approved", "pending_review"):
            return jsonify({"error": f"Email cannot be sent - status is '{email.status}'"}), 400
        
        # Get recipient email - check stored recipient_email first, then fall back to lead email
        to_email = email.recipient_email or (email.lead.email if email.lead else None)
        if not to_email:
            return jsonify({"error": "No recipient email found for this email"}), 400
        
        # Get Microsoft token
        if MicrosoftToken is None:
            return jsonify({"error": "Microsoft integration not configured"}), 500
        
        token = session.query(MicrosoftToken).first()
        if not token or not token.access_token:
            return jsonify({"error": "Microsoft not connected. Please sign in first."}), 401
        
        # Refresh token if expired
        if token.expires_at and token.expires_at < datetime.utcnow() and token.refresh_token:
            try:
                tenant_id = os.environ.get('MS_TENANT_ID') or os.environ.get('MS_TENANT', 'common')
                token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
                refresh_data = {
                    'client_id': os.environ.get('MS_CLIENT_ID'),
                    'client_secret': os.environ.get('MS_CLIENT_SECRET'),
                    'refresh_token': token.refresh_token,
                    'grant_type': 'refresh_token',
                    'scope': 'openid profile email User.Read Mail.Read Mail.Send offline_access'
                }
                refresh_response = _http_session.post(token_url, data=refresh_data)
                if refresh_response.ok:
                    token_data = refresh_response.json()
                    token.access_token = token_data.get('access_token')
                    token.refresh_token = token_data.get('refresh_token', token.refresh_token)
                    token.expires_at = datetime.utcnow() + timedelta(seconds=token_data.get('expires_in', 3600))
                    session.commit()
                else:
                    return jsonify({"error": "Token expired. Please sign in with Microsoft again."}), 401
            except Exception as e:
                return jsonify({"error": f"Token refresh failed: {str(e)}"}), 401
        
        # Send via Microsoft Graph
        html_body = email.body.replace('\n', '<br>') if email.body else ''
        full_html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
<div style="max-width: 600px; margin: 0 auto; padding: 20px;">{html_body}</div>
</body></html>"""
        
        graph_url = "https://graph.microsoft.com/v1.0/me/sendMail"
        headers = {
            "Authorization": f"Bearer {token.access_token}",
            "Content-Type": "application/json"
        }
        email_payload = {
            "message": {
                "subject": email.subject,
                "body": {"contentType": "HTML", "content": full_html},
                "toRecipients": [{"emailAddress": {"address": to_email}}],
                "importance": "normal",
            },
            "saveToSentItems": True
        }
        
        print(f"Sending approved email to {to_email}: {email.subject}")
        response = _http_session.post(graph_url, headers=headers, json=email_payload)
        
        if response.status_code == 202:
            email.status = "sent"
            email.sent_at = datetime.utcnow()
            email.reply_status = "no_reply"
            
            # Try to get the sent message ID for reply tracking
            try:
                import time
                time.sleep(1)  # Brief delay for message to appear in sent items
                sent_resp = _http_session.get(
                    "https://graph.microsoft.com/v1.0/me/mailFolders/SentItems/messages",
                    headers=headers,
                    params={
                        "$top": 1,
                        "$orderby": "sentDateTime desc",
                        "$select": "id,subject,internetMessageId",
                        "$filter": f"subject eq '{email.subject.replace(chr(39), chr(39)+chr(39))}'"
                    }
                )
                if sent_resp.status_code == 200:
                    msgs = sent_resp.json().get("value", [])
                    if msgs:
                        email.microsoft_message_id = msgs[0].get("internetMessageId") or msgs[0].get("id")
                        print(f"Captured message ID: {email.microsoft_message_id}")
            except Exception as msg_err:
                print(f"Could not capture message ID (non-fatal): {msg_err}")
            
            # Log activity - always create a log entry for tracking
            # If lead_id is missing, try to find the lead by recipient email
            if not email.lead_id and to_email:
                matched_lead = session.query(Lead).filter_by(email=to_email).first()
                if matched_lead:
                    email.lead_id = matched_lead.id
                    print(f"Auto-linked email to lead #{matched_lead.id} '{matched_lead.business_name}' by recipient email")
            
            if email.lead_id:
                lead = email.lead
                if lead:
                    log = Log(
                        lead_id=email.lead_id,
                        activity_type="Email",
                        outcome="Sent",
                        notes=f"Subject: {email.subject} | To: {to_email}",
                        timestamp=datetime.utcnow(),
                    )
                    session.add(log)
                    lead.last_activity = datetime.utcnow()
                    lead.activity_count = (lead.activity_count or 0) + 1
                    
                    # Auto-advance pipeline: email sent → Attempted
                    advance_lead_status(session, lead, "Attempted", "email sent")
            else:
                # Even without a lead, log the email send for performance tracking
                log = Log(
                    lead_id=None,
                    activity_type="Email",
                    outcome="Sent",
                    notes=f"Subject: {email.subject} | To: {to_email} | Direct Send",
                    timestamp=datetime.utcnow(),
                )
                session.add(log)
            
            session.commit()
            return jsonify(email.to_dict())
        else:
            error_detail = response.text
            print(f"Graph API send failed: {error_detail}")
            try:
                error_msg = response.json().get('error', {}).get('message', error_detail)
            except:
                error_msg = error_detail
            return jsonify({"error": f"Failed to send: {error_msg}"}), 500
    except Exception as e:
        session.rollback()
        print(f"Send email exception: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route("/api/emails/tracking", methods=["GET"])
def get_email_tracking():
    """Get sent emails with tracking info (reply status, template filter)."""
    session = get_session()
    try:
        query = session.query(GeneratedEmail).filter(GeneratedEmail.status == "sent")
        
        # Filter by template
        template_filter = request.args.get("template_id")
        if template_filter and template_filter != "all":
            query = query.filter(GeneratedEmail.template_id == int(template_filter))
        
        # Filter by template category
        category_filter = request.args.get("category")
        if category_filter and category_filter != "all":
            query = query.join(EmailTemplate).filter(EmailTemplate.category == category_filter)
        
        # Filter by reply status
        reply_filter = request.args.get("reply_status")
        if reply_filter and reply_filter != "all":
            query = query.filter(GeneratedEmail.reply_status == reply_filter)
        
        emails = query.order_by(GeneratedEmail.sent_at.desc()).all()
        
        # Get available templates for filter dropdown
        templates = session.query(EmailTemplate).order_by(EmailTemplate.name).all()
        
        # Stats
        all_sent = session.query(GeneratedEmail).filter(GeneratedEmail.status == "sent").all()
        total_sent = len(all_sent)
        total_replied = sum(1 for e in all_sent if e.reply_status == "replied")
        total_no_reply = sum(1 for e in all_sent if (e.reply_status or "no_reply") == "no_reply")
        total_bounced = sum(1 for e in all_sent if e.reply_status == "bounced")
        
        return jsonify({
            "emails": [e.to_dict() for e in emails],
            "templates": [{"id": t.id, "name": t.name, "category": t.category} for t in templates],
            "stats": {
                "total_sent": total_sent,
                "replied": total_replied,
                "no_reply": total_no_reply,
                "bounced": total_bounced,
                "reply_rate": round((total_replied / total_sent) * 100, 1) if total_sent > 0 else 0,
            }
        })
    except Exception as e:
        print(f"Email tracking error: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route("/api/emails/check-replies", methods=["POST"])
def check_email_replies():
    """Check Microsoft inbox for replies to sent emails."""
    global _http_session
    session = get_session()
    try:
        # Get Microsoft token
        if MicrosoftToken is None:
            return jsonify({"error": "Microsoft integration not configured"}), 500
        
        token = session.query(MicrosoftToken).first()
        if not token or not token.access_token:
            return jsonify({"error": "Microsoft not connected"}), 401
        
        # Refresh token if expired
        if token.expires_at and token.expires_at < datetime.utcnow() and token.refresh_token:
            try:
                tenant_id = os.environ.get('MS_TENANT_ID') or os.environ.get('MS_TENANT', 'common')
                token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
                refresh_data = {
                    'client_id': os.environ.get('MS_CLIENT_ID'),
                    'client_secret': os.environ.get('MS_CLIENT_SECRET'),
                    'refresh_token': token.refresh_token,
                    'grant_type': 'refresh_token',
                    'scope': 'openid profile email User.Read Mail.Read Mail.Send offline_access'
                }
                refresh_response = _http_session.post(token_url, data=refresh_data)
                if refresh_response.ok:
                    token_data = refresh_response.json()
                    token.access_token = token_data.get('access_token')
                    token.refresh_token = token_data.get('refresh_token', token.refresh_token)
                    token.expires_at = datetime.utcnow() + timedelta(seconds=token_data.get('expires_in', 3600))
                    session.commit()
                else:
                    return jsonify({"error": "Token expired. Please sign in again."}), 401
            except Exception as e:
                return jsonify({"error": f"Token refresh failed: {str(e)}"}), 401
        
        headers = {
            "Authorization": f"Bearer {token.access_token}",
            "Content-Type": "application/json"
        }
        
        # Get all sent emails that haven't been replied to yet
        sent_emails = session.query(GeneratedEmail).filter(
            GeneratedEmail.status == "sent",
            GeneratedEmail.reply_status.in_(["no_reply", None])
        ).all()
        
        if not sent_emails:
            return jsonify({"message": "No emails to check", "updated": 0})
        
        updated_count = 0
        
        # Fetch recent inbox messages to look for replies
        try:
            inbox_resp = _http_session.get(
                "https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages",
                headers=headers,
                params={
                    "$top": 100,
                    "$orderby": "receivedDateTime desc",
                    "$select": "id,subject,from,receivedDateTime,bodyPreview,conversationId",
                }
            )
            
            if inbox_resp.status_code != 200:
                print(f"Inbox fetch failed: {inbox_resp.status_code}")
                return jsonify({"error": "Failed to fetch inbox"}), 500
            
            inbox_messages = inbox_resp.json().get("value", [])
            
            for sent_email in sent_emails:
                # Check if any inbox message is a reply to this email
                # Match by: subject contains "Re:" + original subject, AND from == recipient
                for msg in inbox_messages:
                    msg_subject = msg.get("subject", "")
                    msg_from = msg.get("from", {}).get("emailAddress", {}).get("address", "").lower()
                    recipient = (sent_email.recipient_email or "").lower()
                    original_subject = (sent_email.subject or "").lower()
                    
                    # Check if this is a reply
                    is_reply = (
                        recipient and msg_from == recipient and
                        (
                            msg_subject.lower().startswith("re:") and
                            original_subject in msg_subject.lower()
                        )
                    )
                    
                    if is_reply:
                        sent_email.reply_status = "replied"
                        sent_email.replied_at = datetime.fromisoformat(
                            msg["receivedDateTime"].replace("Z", "+00:00")
                        ) if msg.get("receivedDateTime") else datetime.utcnow()
                        sent_email.reply_snippet = (msg.get("bodyPreview") or "")[:500]
                        updated_count += 1
                        print(f"Reply found for email #{sent_email.id}: {msg_subject}")
                        
                        # Auto-advance pipeline: reply received → Connected
                        # If lead_id is missing, try to find lead by recipient email
                        if not sent_email.lead_id and sent_email.recipient_email:
                            matched_lead = session.query(Lead).filter_by(email=sent_email.recipient_email).first()
                            if matched_lead:
                                sent_email.lead_id = matched_lead.id
                                print(f"Auto-linked replied email to lead #{matched_lead.id} '{matched_lead.business_name}'")
                        
                        if sent_email.lead_id:
                            reply_lead = session.query(Lead).filter_by(id=sent_email.lead_id).first()
                            advance_lead_status(session, reply_lead, "Connected", "email reply received")
                        break
            
            session.commit()
            
        except Exception as inbox_err:
            print(f"Inbox check error: {inbox_err}")
            return jsonify({"error": f"Failed to check inbox: {str(inbox_err)}"}), 500
        
        return jsonify({
            "message": f"Checked {len(sent_emails)} emails, found {updated_count} replies",
            "updated": updated_count,
            "checked": len(sent_emails),
        })
    except Exception as e:
        session.rollback()
        print(f"Check replies error: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route("/api/send-email", methods=["POST"])
def send_email_direct():
    """Send an email via Microsoft Graph API."""
    # Use the global session that ignores proxy settings
    global _http_session
    
    session = get_session()
    try:
        data = request.json
        to_email = data.get("to")
        subject = data.get("subject")
        body = data.get("body")
        lead_id = data.get("lead_id")
        
        if not to_email or not subject or not body:
            return jsonify({"error": "Missing required fields: to, subject, body"}), 400
        
        # Check if MicrosoftToken model exists
        if MicrosoftToken is None:
            return jsonify({"error": "Microsoft integration not configured"}), 500
        
        # Get Microsoft token for sending
        token = session.query(MicrosoftToken).first()
        if not token:
            return jsonify({"error": "Microsoft not connected. Please sign in with Microsoft first."}), 401
        
        if not token.access_token:
            return jsonify({"error": "No access token found. Please reconnect Microsoft account."}), 401
        
        # Check if token is expired and refresh if needed
        token_expired = False
        if token.expires_at:
            token_expired = token.expires_at < datetime.utcnow()
        
        if token_expired and token.refresh_token:
            # Token expired, try to refresh
            try:
                tenant_id = os.environ.get('MS_TENANT_ID') or os.environ.get('MS_TENANT', 'common')
                token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
                refresh_data = {
                    'client_id': os.environ.get('MS_CLIENT_ID'),
                    'client_secret': os.environ.get('MS_CLIENT_SECRET'),
                    'refresh_token': token.refresh_token,
                    'grant_type': 'refresh_token',
                    'scope': 'openid profile email User.Read Mail.Read Mail.Send offline_access'
                }
                refresh_response = _http_session.post(token_url, data=refresh_data)
                if refresh_response.ok:
                    token_data = refresh_response.json()
                    token.access_token = token_data.get('access_token')
                    token.refresh_token = token_data.get('refresh_token', token.refresh_token)
                    token.expires_at = datetime.utcnow() + timedelta(seconds=token_data.get('expires_in', 3600))
                    session.commit()
                    print(f"Token refreshed successfully")
                else:
                    print(f"Token refresh failed: {refresh_response.text}")
                    return jsonify({"error": "Token expired. Please sign in with Microsoft again."}), 401
            except Exception as e:
                print(f"Token refresh exception: {str(e)}")
                return jsonify({"error": f"Token refresh failed: {str(e)}"}), 401
        
        # Send email via Microsoft Graph API
        graph_url = "https://graph.microsoft.com/v1.0/me/sendMail"
        headers = {
            "Authorization": f"Bearer {token.access_token}",
            "Content-Type": "application/json"
        }
        
        # Convert newlines to HTML breaks and wrap in proper HTML structure
        html_body = body.replace('\n', '<br>') if body else ''
        
        # Wrap in proper HTML email structure for better deliverability
        full_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        {html_body}
    </div>
</body>
</html>"""
        
        email_payload = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML",
                    "content": full_html
                },
                "toRecipients": [
                    {"emailAddress": {"address": to_email}}
                ],
                "importance": "normal",
                "isReadReceiptRequested": False,
                "isDeliveryReceiptRequested": False
            },
            "saveToSentItems": True
        }
        
        print(f"Sending email to {to_email} with subject: {subject}")
        response = _http_session.post(graph_url, headers=headers, json=email_payload)
        
        if response.status_code == 202:
            print(f"Email sent successfully to {to_email}")
            # Log the activity if lead_id provided
            if lead_id:
                lead = session.query(Lead).filter_by(id=lead_id).first()
                if lead:
                    log = ActivityLog(
                        lead_id=lead_id,
                        activity_type="Email",
                        outcome="Sent",
                        notes=f"Subject: {subject}",
                        timestamp=datetime.utcnow()
                    )
                    session.add(log)
                    lead.last_activity = datetime.utcnow()
                    lead.activity_count = (lead.activity_count or 0) + 1
                    session.commit()
            
            return jsonify({"success": True, "message": "Email sent successfully"})
        else:
            error_detail = response.text
            print(f"Failed to send email: {error_detail}")
            try:
                error_json = response.json()
                error_msg = error_json.get('error', {}).get('message', error_detail)
                error_code = error_json.get('error', {}).get('code', '')
                if error_code == 'ErrorAccessDenied' or 'Mail.Send' in str(error_detail):
                    return jsonify({"error": "Mail.Send permission not granted. Please reconnect Microsoft with email permissions."}), 403
            except:
                error_msg = error_detail
            return jsonify({"error": f"Failed to send email: {error_msg}"}), 500
            
    except Exception as e:
        print(f"Send email exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route("/api/leads/<int:lead_id>/generate-email", methods=["POST"])
def generate_email_for_lead(lead_id):
    """Generate an email for a lead."""
    session = get_session()
    try:
        lead = session.query(Lead).filter_by(id=lead_id).first()
        if not lead:
            return jsonify({"error": "Lead not found"}), 404
        
        data = request.json
        template_id = data.get("template_id")
        template = None
        
        if template_id:
            template = session.query(EmailTemplate).filter_by(id=template_id).first()
        
        # Generate email content
        subject = template.subject if template else f"Introduction - {lead.business_name}"
        body = template.body if template else f"Hello {lead.contact_name or 'there'},\n\nI wanted to reach out..."
        
        # Replace placeholders
        replacements = {
            "{{contact_name}}": lead.contact_name or "",
            "{{business_name}}": lead.business_name or "",
            "{{industry}}": lead.industry or "",
        }
        for placeholder, value in replacements.items():
            subject = subject.replace(placeholder, value)
            body = body.replace(placeholder, value)
        
        email = GeneratedEmail(
            lead_id=lead_id,
            template_id=template_id,
            subject=subject,
            body=body,
            status="pending_review",
            priority="medium",
        )
        session.add(email)
        
        # Update template usage count
        if template:
            template.usage_count += 1
        
        session.commit()
        return jsonify(email.to_dict()), 201
    finally:
        session.close()


# ===========================================
# Activities API
# ===========================================

@app.route("/api/activities", methods=["GET"])
def get_activities():
    """Get all activities with filters."""
    session = get_session()
    try:
        query = session.query(Log).join(Lead, Log.lead_id == Lead.id)
        
        # Filters
        rep = request.args.get("rep")
        activity_type = request.args.get("type")
        date_filter = request.args.get("date")
        
        if rep:
            query = query.filter(Lead.assigned_rep == rep)
        if activity_type:
            query = query.filter(Log.activity_type == activity_type)
        if date_filter:
            periods = get_period_boundaries()
            if date_filter == "today":
                query = query.filter(Log.timestamp >= periods["today_start"])
            elif date_filter == "week":
                query = query.filter(Log.timestamp >= periods["week_start"])
            elif date_filter == "month":
                query = query.filter(Log.timestamp >= periods["month_start"])
        
        logs = query.order_by(Log.timestamp.desc()).limit(100).all()
        
        # Enrich with lead info
        results = []
        for log in logs:
            data = log.to_dict()
            data["lead_name"] = log.lead.business_name if log.lead else None
            data["lead_contact"] = log.lead.contact_name if log.lead else None
            data["assigned_rep"] = log.lead.assigned_rep if log.lead else None
            results.append(data)
        
        return jsonify(results)
    finally:
        session.close()


@app.route("/api/activities", methods=["POST"])
def create_activity():
    """Create a new activity log entry."""
    session = get_session()
    try:
        data = request.json
        lead_id = data.get("lead_id")
        
        if not lead_id:
            return jsonify({"error": "lead_id is required"}), 400
        
        lead = session.query(Lead).filter_by(id=lead_id).first()
        if not lead:
            return jsonify({"error": "Lead not found"}), 404
        
        log = Log(
            lead_id=lead_id,
            activity_type=data.get("activity_type", "Note"),
            outcome=data.get("outcome", ""),
            notes=data.get("notes", ""),
            call_duration=data.get("call_duration"),
            email_subject=data.get("email_subject"),
            timestamp=datetime.utcnow(),
        )
        session.add(log)
        
        # Update lead activity tracking
        lead.activity_count = (lead.activity_count or 0) + 1
        lead.last_activity = datetime.utcnow()
        
        session.commit()
        
        result = log.to_dict()
        result["lead_name"] = lead.business_name
        result["lead_contact"] = lead.contact_name
        result["assigned_rep"] = lead.assigned_rep
        
        return jsonify(result), 201
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route("/api/activities/<int:activity_id>", methods=["DELETE"])
def delete_activity(activity_id):
    """Delete an activity log entry."""
    session = get_session()
    try:
        log = session.query(Log).filter_by(id=activity_id).first()
        if not log:
            return jsonify({"error": "Activity not found"}), 404
        session.delete(log)
        session.commit()
        return jsonify({"message": "Activity deleted"}), 200
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


# ===========================================
# Proposals API
# ===========================================

@app.route("/api/proposals", methods=["GET"])
def get_proposals():
    """Get all proposals."""
    session = get_session()
    try:
        proposals = session.query(Proposal).order_by(Proposal.created_at.desc()).all()
        return jsonify([p.to_dict() for p in proposals])
    finally:
        session.close()


@app.route("/api/proposals/<int:proposal_id>", methods=["GET"])
def get_proposal(proposal_id):
    """Get a single proposal."""
    session = get_session()
    try:
        proposal = session.query(Proposal).filter_by(id=proposal_id).first()
        if not proposal:
            return jsonify({"error": "Proposal not found"}), 404
        return jsonify(proposal.to_dict())
    finally:
        session.close()


@app.route("/api/proposals", methods=["POST"])
def create_proposal():
    """Create a new proposal."""
    session = get_session()
    try:
        data = request.json
        proposal = Proposal(
            lead_id=data.get("lead_id"),
            title=data.get("title"),
            configuration_json=json.dumps(data.get("configuration")) if data.get("configuration") else None,
            proposal_html=data.get("proposal_html"),
            total_price=data.get("total_price"),
            discount=data.get("discount", 0),
            validity_days=data.get("validity_days", 30),
            status=data.get("status", "draft"),
            notes=data.get("notes"),
        )
        session.add(proposal)
        session.commit()
        return jsonify(proposal.to_dict()), 201
    finally:
        session.close()


@app.route("/api/proposals/<int:proposal_id>", methods=["PUT"])
def update_proposal(proposal_id):
    """Update a proposal."""
    session = get_session()
    try:
        proposal = session.query(Proposal).filter_by(id=proposal_id).first()
        if not proposal:
            return jsonify({"error": "Proposal not found"}), 404
        
        data = request.json
        for key in ["lead_id", "title", "proposal_html", "total_price", "discount", 
                    "validity_days", "status", "notes"]:
            if key in data:
                setattr(proposal, key, data[key])
        if "configuration" in data:
            proposal.configuration_json = json.dumps(data["configuration"])
        if data.get("status") == "sent" and not proposal.sent_at:
            proposal.sent_at = datetime.utcnow()
        
        session.commit()
        return jsonify(proposal.to_dict())
    finally:
        session.close()


@app.route("/api/proposals/<int:proposal_id>/queue-email", methods=["POST"])
def queue_proposal_email(proposal_id):
    """Generate HTML proposal and queue it as an email for review."""
    session = get_session()
    try:
        proposal = session.query(Proposal).filter_by(id=proposal_id).first()
        if not proposal:
            return jsonify({"error": "Proposal not found"}), 404
        
        lead = proposal.lead
        if not lead:
            return jsonify({"error": "No lead associated with this proposal"}), 400
        
        recipient_email = lead.email
        if not recipient_email:
            return jsonify({"error": "Lead has no email address"}), 400
        
        # Parse configuration
        config = json.loads(proposal.configuration_json) if proposal.configuration_json else {}
        services = config.get("services", [])
        discount_pct = config.get("discount", proposal.discount or 0)
        valid_days = config.get("validDays", proposal.validity_days or 30)
        notes = config.get("notes", proposal.notes or "")
        terms = config.get("terms", "Payment terms: 50% upfront, 50% upon completion.")
        
        # Calculate totals
        subtotal = sum(s.get("price", 0) * s.get("quantity", 1) for s in services)
        discount_amount = (subtotal * discount_pct) / 100
        total = subtotal - discount_amount
        
        # Update proposal total_price if not set
        if not proposal.total_price:
            proposal.total_price = total
        
        # Get current user name
        composer_name = "DW Growth"
        if MicrosoftToken:
            token = session.query(MicrosoftToken).first()
            if token and token.user_id:
                member = session.query(TeamMember).get(token.user_id)
                if member:
                    composer_name = member.name
        
        # Generate professional HTML proposal matching Orbit preview design
        services_rows = ""
        for s in services:
            qty = s.get("quantity", 1)
            price = s.get("price", 0)
            line_total = qty * price
            services_rows += f"""
            <tr>
                <td style="padding: 16px 12px; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #1f2937; vertical-align: top;">
                    <strong>{s.get('name', '')}</strong><br>
                    <span style="font-size: 12px; color: #6b7280;">{s.get('description', '')}</span>
                </td>
                <td style="padding: 16px 12px; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #1f2937; text-align: center;">{qty}</td>
                <td style="padding: 16px 12px; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #1f2937; text-align: right;">${price:,.0f}</td>
                <td style="padding: 16px 12px; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #1f2937; text-align: right;">${line_total:,.0f}</td>
            </tr>"""
        
        valid_until = (datetime.utcnow() + timedelta(days=valid_days)).strftime("%m/%d/%Y")
        today_str = datetime.utcnow().strftime("%m/%d/%Y")
        
        # Discount row for totals table
        discount_row = ""
        if discount_pct > 0:
            discount_row = f"""
                <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #16a34a;">Discount ({discount_pct}%)</td>
                    <td style="padding: 8px 0; font-size: 14px; color: #16a34a; text-align: right;">-${discount_amount:,.0f}</td>
                </tr>"""
        
        # Notes section
        notes_section = ""
        if notes:
            notes_section = f"""
                <h4 style="font-size: 16px; font-weight: 600; color: #1f2937; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;">Notes</h4>
                <p style="font-size: 14px; color: #4b5563; line-height: 1.6; white-space: pre-wrap;">{notes}</p>"""
        
        proposal_html = f"""
<div style="max-width: 700px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
    <!-- Header - Dark Green matching Orbit -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
            <td style="background-color: #163528; padding: 32px; border-radius: 16px 0 0 0; vertical-align: middle;">
                <span style="font-size: 32px; font-weight: 700; font-family: Georgia, serif; letter-spacing: 0.1em; color: #ffffff; display: block;">DW</span>
                <span style="font-size: 10px; letter-spacing: 0.2em; color: #cccccc; display: block;">GROWTH &amp; CAPITAL</span>
            </td>
            <td style="background-color: #163528; padding: 32px; border-radius: 0 16px 0 0; text-align: right; vertical-align: middle;">
                <span style="font-size: 24px; font-weight: 300; letter-spacing: 0.3em; color: #ffffff; background-color: #163528;">PROPOSAL</span>
            </td>
        </tr>
    </table>

    <!-- Body -->
    <div style="padding: 32px; background-color: #ffffff;">
        <!-- Client Info -->
        <div style="margin-bottom: 32px;">
            <strong style="font-size: 14px; color: #6b7280;">Prepared for:</strong>
            <div style="font-size: 24px; font-weight: 600; color: #1f2937; margin-top: 8px;">{lead.business_name}</div>
            <div style="font-size: 13px; color: #6b7280; margin-top: 8px;">Date: {today_str}</div>
            <div style="font-size: 13px; color: #6b7280;">Valid until: {valid_until}</div>
        </div>

        <!-- Proposed Services -->
        <h4 style="font-size: 16px; font-weight: 600; color: #1f2937; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;">Proposed Services</h4>
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr>
                    <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Service</th>
                    <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Qty</th>
                    <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Price</th>
                    <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Total</th>
                </tr>
            </thead>
            <tbody>
                {services_rows}
            </tbody>
        </table>

        <!-- Totals -->
        <table style="margin-top: 24px; margin-left: auto; width: 300px; border-collapse: collapse;">
            <tr>
                <td style="padding: 8px 0; font-size: 14px; color: #6b7280;">Subtotal</td>
                <td style="padding: 8px 0; font-size: 14px; color: #6b7280; text-align: right;">${subtotal:,.0f}</td>
            </tr>
            {discount_row}
            <tr>
                <td colspan="2" style="padding: 0;"><div style="border-top: 2px solid #1f2937; margin-top: 8px;"></div></td>
            </tr>
            <tr>
                <td style="padding: 12px 0 0; font-size: 18px; font-weight: 700; color: #1f2937;">Total Investment</td>
                <td style="padding: 12px 0 0; font-size: 18px; font-weight: 700; color: #1f2937; text-align: right;">${total:,.0f}</td>
            </tr>
        </table>

        {notes_section}

        <!-- Terms -->
        <h4 style="font-size: 16px; font-weight: 600; color: #1f2937; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;">Terms &amp; Conditions</h4>
        <p style="font-size: 12px; color: #6b7280; line-height: 1.6; white-space: pre-line;">{terms}</p>
    </div>
</div>"""
        
        # Store the HTML on the proposal itself
        proposal.proposal_html = proposal_html
        
        # Create the email entry in the review queue
        email_subject = f"Service Proposal - {lead.business_name} | DW Growth"
        
        email_entry = GeneratedEmail(
            lead_id=lead.id,
            template_id=None,
            recipient_email=recipient_email,
            subject=email_subject,
            body=proposal_html,
            status="pending_review",
            priority="high",
            generated_by=composer_name,
            generated_at=datetime.utcnow(),
        )
        session.add(email_entry)
        
        # Update proposal status
        proposal.status = "pending_review"
        
        # Auto-advance pipeline: proposal sent → Proposal Sent
        advance_lead_status(session, lead, "Proposal Sent", "proposal queued")
        
        session.commit()
        
        return jsonify({
            "message": f"Proposal queued for review. Check the Emails tab to approve and send.",
            "proposal": proposal.to_dict(),
            "email_id": email_entry.id,
        })
    except Exception as e:
        session.rollback()
        print(f"Queue proposal email error: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route("/api/proposals/<int:proposal_id>", methods=["DELETE"])
def delete_proposal(proposal_id):
    """Delete a proposal."""
    session = get_session()
    try:
        proposal = session.query(Proposal).filter_by(id=proposal_id).first()
        if not proposal:
            return jsonify({"error": "Proposal not found"}), 404
        
        session.delete(proposal)
        session.commit()
        return jsonify({"success": True})
    finally:
        session.close()


# ===========================================
# Call Scripts API
# ===========================================

@app.route("/api/call-scripts", methods=["GET"])
def get_call_scripts():
    """Get all call scripts."""
    session = get_session()
    try:
        scripts = session.query(CallScript).filter_by(is_active=True).all()
        return jsonify([s.to_dict() for s in scripts])
    finally:
        session.close()


@app.route("/api/call-scripts", methods=["POST"])
def create_call_script():
    """Create a new call script."""
    session = get_session()
    try:
        data = request.json
        script = CallScript(
            name=data.get("name"),
            script_type=data.get("script_type"),
            content=data.get("content"),
        )
        session.add(script)
        session.commit()
        return jsonify(script.to_dict()), 201
    finally:
        session.close()


@app.route("/api/call-scripts/<int:script_id>", methods=["PUT"])
def update_call_script(script_id):
    """Update a call script."""
    session = get_session()
    try:
        script = session.query(CallScript).filter_by(id=script_id).first()
        if not script:
            return jsonify({"error": "Script not found"}), 404
        
        data = request.json
        for key in ["name", "script_type", "content", "is_active"]:
            if key in data:
                setattr(script, key, data[key])
        
        session.commit()
        return jsonify(script.to_dict())
    finally:
        session.close()


# ===========================================
# Search API
# ===========================================

@app.route("/api/search", methods=["GET"])
def search():
    """Search across leads, activities, emails, proposals."""
    session = get_session()
    try:
        q = request.args.get("q", "").lower()
        category = request.args.get("category", "all")
        
        results = {
            "leads": [],
            "activities": [],
            "emails": [],
            "proposals": [],
        }
        
        if not q:
            return jsonify(results)
        
        if category in ["all", "leads"]:
            leads = session.query(Lead).filter(
                (Lead.business_name.ilike(f"%{q}%")) |
                (Lead.contact_name.ilike(f"%{q}%")) |
                (Lead.email.ilike(f"%{q}%"))
            ).limit(20).all()
            results["leads"] = [l.to_dict() for l in leads]
        
        if category in ["all", "activities"]:
            activities = session.query(Log).join(Lead).filter(
                (Lead.business_name.ilike(f"%{q}%")) |
                (Log.notes.ilike(f"%{q}%"))
            ).limit(20).all()
            results["activities"] = [{
                **a.to_dict(),
                "lead_name": a.lead.business_name if a.lead else None,
            } for a in activities]
        
        if category in ["all", "emails"]:
            emails = session.query(GeneratedEmail).join(Lead).filter(
                (Lead.business_name.ilike(f"%{q}%")) |
                (GeneratedEmail.subject.ilike(f"%{q}%"))
            ).limit(20).all()
            results["emails"] = [e.to_dict() for e in emails]
        
        if category in ["all", "proposals"]:
            proposals = session.query(Proposal).join(Lead).filter(
                (Lead.business_name.ilike(f"%{q}%")) |
                (Proposal.title.ilike(f"%{q}%"))
            ).limit(20).all()
            results["proposals"] = [p.to_dict() for p in proposals]
        
        return jsonify(results)
    finally:
        session.close()


@app.route("/api/search/recent", methods=["GET"])
def get_recent_searches():
    """Get recent search history."""
    session = get_session()
    try:
        searches = session.query(SearchHistory).order_by(
            SearchHistory.searched_at.desc()
        ).limit(10).all()
        return jsonify([s.query for s in searches])
    finally:
        session.close()


@app.route("/api/search/recent", methods=["POST"])
def save_search():
    """Save a search to history."""
    session = get_session()
    try:
        data = request.json
        search = SearchHistory(
            query=data.get("query"),
            category=data.get("category"),
        )
        session.add(search)
        session.commit()
        return jsonify({"success": True})
    finally:
        session.close()


# ===========================================
# Automation Rules API
# ===========================================

@app.route("/api/automation/rules", methods=["GET"])
def get_automation_rules():
    """Get all automation rules."""
    session = get_session()
    try:
        rules = session.query(AutomationRule).order_by(AutomationRule.created_at.desc()).all()
        return jsonify([r.to_dict() for r in rules])
    finally:
        session.close()


@app.route("/api/automation/rules", methods=["POST"])
def create_automation_rule():
    """Create a new automation rule."""
    session = get_session()
    try:
        data = request.json
        rule = AutomationRule(
            name=data["name"],
            description=data.get("description"),
            trigger_type=data["trigger_type"],
            trigger_config=json.dumps(data.get("trigger_config", {})),
            action_type=data["action_type"],
            action_config=json.dumps(data.get("action_config", {})),
            is_active=data.get("is_active", True),
            created_by=data.get("created_by"),
        )
        session.add(rule)
        session.commit()
        return jsonify(rule.to_dict()), 201
    finally:
        session.close()


@app.route("/api/automation/rules/<int:rule_id>", methods=["PUT"])
def update_automation_rule(rule_id):
    """Update an automation rule."""
    session = get_session()
    try:
        rule = session.query(AutomationRule).get(rule_id)
        if not rule:
            return jsonify({"error": "Rule not found"}), 404
        
        data = request.json
        for field in ["name", "description", "trigger_type", "action_type", "is_active"]:
            if field in data:
                setattr(rule, field, data[field])
        if "trigger_config" in data:
            rule.trigger_config = json.dumps(data["trigger_config"])
        if "action_config" in data:
            rule.action_config = json.dumps(data["action_config"])
        
        session.commit()
        return jsonify(rule.to_dict())
    finally:
        session.close()


@app.route("/api/automation/rules/<int:rule_id>", methods=["DELETE"])
def delete_automation_rule(rule_id):
    """Delete an automation rule."""
    session = get_session()
    try:
        rule = session.query(AutomationRule).get(rule_id)
        if not rule:
            return jsonify({"error": "Rule not found"}), 404
        session.delete(rule)
        session.commit()
        return jsonify({"success": True})
    finally:
        session.close()


@app.route("/api/automation/rules/<int:rule_id>/execute", methods=["POST"])
def execute_automation_rule(rule_id):
    """Manually execute an automation rule."""
    session = get_session()
    try:
        rule = session.query(AutomationRule).get(rule_id)
        if not rule:
            return jsonify({"error": "Rule not found"}), 404
        
        data = request.json
        lead_ids = data.get("lead_ids", [])
        results = []
        
        for lead_id in lead_ids:
            lead = session.query(Lead).get(lead_id)
            if not lead:
                continue
            
            action_config = json.loads(rule.action_config) if rule.action_config else {}
            
            if rule.action_type == "create_reminder":
                reminder = Reminder(
                    lead_id=lead_id,
                    assigned_to=lead.assigned_rep or action_config.get("assigned_to"),
                    type=action_config.get("type", "follow_up"),
                    priority=action_config.get("priority", "medium"),
                    title=action_config.get("title", f"Follow up with {lead.business_name}"),
                    due_date=datetime.utcnow() + timedelta(days=action_config.get("due_in_days", 1)),
                )
                session.add(reminder)
                results.append({"lead_id": lead_id, "action": "reminder_created"})
            
            elif rule.action_type == "send_notification":
                notification = Notification(
                    user_name=lead.assigned_rep,
                    type=action_config.get("notification_type", "info"),
                    title=action_config.get("title", "Automation triggered"),
                    message=action_config.get("message", f"Action taken for {lead.business_name}"),
                    related_lead_id=lead_id,
                    related_rule_id=rule_id,
                )
                session.add(notification)
                results.append({"lead_id": lead_id, "action": "notification_sent"})
            
            elif rule.action_type == "update_status":
                new_status = action_config.get("new_status")
                if new_status:
                    lead.status = new_status
                    lead.last_activity = datetime.utcnow()
                    results.append({"lead_id": lead_id, "action": "status_updated", "new_status": new_status})
        
        rule.execution_count += 1
        rule.last_executed = datetime.utcnow()
        session.commit()
        
        return jsonify({"rule_id": rule_id, "results": results})
    finally:
        session.close()


# ===========================================
# Notifications API
# ===========================================

@app.route("/api/notifications", methods=["GET"])
def get_notifications():
    """Get notifications for a user."""
    session = get_session()
    try:
        user_name = request.args.get("user")
        unread_only = request.args.get("unread_only", "false").lower() == "true"
        limit = int(request.args.get("limit", 50))
        
        query = session.query(Notification).order_by(Notification.created_at.desc())
        if user_name:
            query = query.filter(Notification.user_name == user_name)
        if unread_only:
            query = query.filter(Notification.is_read == False)
        
        notifications = query.limit(limit).all()
        return jsonify([n.to_dict() for n in notifications])
    finally:
        session.close()


@app.route("/api/notifications/<int:notification_id>/read", methods=["PUT"])
def mark_notification_read(notification_id):
    """Mark a notification as read."""
    session = get_session()
    try:
        notification = session.query(Notification).get(notification_id)
        if not notification:
            return jsonify({"error": "Notification not found"}), 404
        
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        session.commit()
        return jsonify(notification.to_dict())
    finally:
        session.close()


@app.route("/api/notifications/read-all", methods=["PUT"])
def mark_all_notifications_read():
    """Mark all notifications as read for a user."""
    session = get_session()
    try:
        user_name = request.args.get("user")
        query = session.query(Notification).filter(Notification.is_read == False)
        if user_name:
            query = query.filter(Notification.user_name == user_name)
        
        query.update({Notification.is_read: True, Notification.read_at: datetime.utcnow()})
        session.commit()
        return jsonify({"success": True})
    finally:
        session.close()


# ===========================================
# SLA Timers API
# ===========================================

@app.route("/api/sla-timers", methods=["GET"])
def get_sla_timers():
    """Get SLA timers."""
    session = get_session()
    try:
        status = request.args.get("status", "active")
        query = session.query(SLATimer)
        if status:
            query = query.filter(SLATimer.status == status)
        
        timers = query.order_by(SLATimer.deadline).all()
        return jsonify([t.to_dict() for t in timers])
    finally:
        session.close()


@app.route("/api/sla-timers", methods=["POST"])
def create_sla_timer():
    """Create a new SLA timer."""
    session = get_session()
    try:
        data = request.json
        hours = data.get("hours", 24)
        timer = SLATimer(
            lead_id=data["lead_id"],
            timer_type=data.get("timer_type", "response_time"),
            deadline=datetime.utcnow() + timedelta(hours=hours),
            notes=data.get("notes"),
        )
        session.add(timer)
        session.commit()
        return jsonify(timer.to_dict()), 201
    finally:
        session.close()


@app.route("/api/sla-timers/<int:timer_id>/complete", methods=["PUT"])
def complete_sla_timer(timer_id):
    """Complete an SLA timer."""
    session = get_session()
    try:
        timer = session.query(SLATimer).get(timer_id)
        if not timer:
            return jsonify({"error": "Timer not found"}), 404
        
        timer.status = "completed"
        timer.completed_at = datetime.utcnow()
        session.commit()
        return jsonify(timer.to_dict())
    finally:
        session.close()


@app.route("/api/sla-timers/check-breaches", methods=["POST"])
def check_sla_breaches():
    """Check for SLA breaches and create notifications."""
    session = get_session()
    try:
        now = datetime.utcnow()
        breached_timers = session.query(SLATimer).filter(
            SLATimer.status == "active",
            SLATimer.deadline < now,
            SLATimer.breach_notified == False
        ).all()
        
        notifications_created = 0
        for timer in breached_timers:
            timer.status = "breached"
            timer.breach_notified = True
            
            # Create notification for the lead's assigned rep
            if timer.lead:
                notification = Notification(
                    user_name=timer.lead.assigned_rep,
                    type="sla_breach",
                    title=f"SLA Breach: {timer.timer_type}",
                    message=f"SLA timer for {timer.lead.business_name} has been breached.",
                    link=f"/leads/{timer.lead_id}",
                    related_lead_id=timer.lead_id,
                )
                session.add(notification)
                notifications_created += 1
        
        session.commit()
        return jsonify({
            "breaches_found": len(breached_timers),
            "notifications_created": notifications_created,
        })
    finally:
        session.close()


@app.route("/api/leads/<int:lead_id>/create-follow-up", methods=["POST"])
def create_lead_follow_up(lead_id):
    """Create a follow-up reminder for a lead."""
    session = get_session()
    try:
        lead = session.query(Lead).get(lead_id)
        if not lead:
            return jsonify({"error": "Lead not found"}), 404
        
        data = request.json
        days = data.get("days", 1)
        
        # Create reminder
        reminder = Reminder(
            lead_id=lead_id,
            assigned_to=lead.assigned_rep or data.get("assigned_to"),
            type="follow_up",
            priority=data.get("priority", "medium"),
            title=data.get("title", f"Follow up with {lead.business_name}"),
            description=data.get("description"),
            due_date=datetime.utcnow() + timedelta(days=days),
        )
        session.add(reminder)
        
        # Update lead
        lead.next_follow_up_date = reminder.due_date
        lead.next_follow_up_reminder = True
        lead.follow_up_count = (lead.follow_up_count or 0) + 1
        
        session.commit()
        return jsonify({
            "reminder": reminder.to_dict(),
            "lead": lead.to_dict(),
        })
    finally:
        session.close()


# ===========================================
# Pipeline Stages API
# ===========================================

@app.route("/api/pipeline/stages", methods=["GET"])
def get_pipeline_stages():
    """Get all pipeline stages."""
    session = get_session()
    try:
        service_category = request.args.get("service_category")
        query = session.query(PipelineStage).filter(PipelineStage.is_active == True)
        if service_category:
            query = query.filter((PipelineStage.service_category == service_category) | (PipelineStage.service_category == None))
        stages = query.order_by(PipelineStage.order).all()
        return jsonify([s.to_dict() for s in stages])
    finally:
        session.close()


@app.route("/api/pipeline/stages", methods=["POST"])
def create_pipeline_stage():
    """Create a new pipeline stage."""
    session = get_session()
    try:
        data = request.json
        # Get max order
        max_order = session.query(func.max(PipelineStage.order)).scalar() or 0
        stage = PipelineStage(
            name=data["name"],
            description=data.get("description"),
            order=data.get("order", max_order + 1),
            color=data.get("color", "#667eea"),
            service_category=data.get("service_category"),
            is_won_stage=data.get("is_won_stage", False),
            is_lost_stage=data.get("is_lost_stage", False),
            sla_days=data.get("sla_days"),
        )
        session.add(stage)
        session.commit()
        return jsonify(stage.to_dict()), 201
    finally:
        session.close()


@app.route("/api/pipeline/stages/<int:stage_id>", methods=["PUT"])
def update_pipeline_stage(stage_id):
    """Update a pipeline stage."""
    session = get_session()
    try:
        stage = session.query(PipelineStage).get(stage_id)
        if not stage:
            return jsonify({"error": "Stage not found"}), 404
        data = request.json
        for field in ["name", "description", "order", "color", "service_category", "is_active", "is_won_stage", "is_lost_stage", "sla_days"]:
            if field in data:
                setattr(stage, field, data[field])
        session.commit()
        return jsonify(stage.to_dict())
    finally:
        session.close()


@app.route("/api/pipeline/stages/<int:stage_id>", methods=["DELETE"])
def delete_pipeline_stage(stage_id):
    """Soft delete a pipeline stage."""
    session = get_session()
    try:
        stage = session.query(PipelineStage).get(stage_id)
        if not stage:
            return jsonify({"error": "Stage not found"}), 404
        stage.is_active = False
        session.commit()
        return jsonify({"success": True})
    finally:
        session.close()


@app.route("/api/pipeline/stages/reorder", methods=["POST"])
def reorder_pipeline_stages():
    """Reorder pipeline stages."""
    session = get_session()
    try:
        data = request.json
        stage_orders = data.get("stage_orders", [])  # [{id: 1, order: 0}, {id: 2, order: 1}, ...]
        for item in stage_orders:
            stage = session.query(PipelineStage).get(item["id"])
            if stage:
                stage.order = item["order"]
        session.commit()
        return jsonify({"success": True})
    finally:
        session.close()


@app.route("/api/pipeline/leads", methods=["GET"])
def get_pipeline_leads():
    """Get leads grouped by pipeline stage."""
    session = get_session()
    try:
        # Get all active stages
        stages = session.query(PipelineStage).filter(PipelineStage.is_active == True).order_by(PipelineStage.order).all()
        
        result = {}
        for stage in stages:
            leads = session.query(Lead).filter(Lead.pipeline_stage_id == stage.id).all()
            result[stage.id] = {
                "stage": stage.to_dict(),
                "leads": [l.to_dict() for l in leads],
                "count": len(leads),
                "total_value": sum(l.deal_value or 0 for l in leads),
            }
        
        # Get leads with no stage assigned
        unassigned = session.query(Lead).filter(Lead.pipeline_stage_id == None).all()
        result["unassigned"] = {
            "stage": {"id": None, "name": "Unassigned", "color": "#9ca3af"},
            "leads": [l.to_dict() for l in unassigned],
            "count": len(unassigned),
            "total_value": sum(l.deal_value or 0 for l in unassigned),
        }
        
        return jsonify(result)
    finally:
        session.close()


@app.route("/api/pipeline/leads/<int:lead_id>/move", methods=["POST"])
def move_lead_in_pipeline(lead_id):
    """Move a lead to a different pipeline stage."""
    session = get_session()
    try:
        lead = session.query(Lead).get(lead_id)
        if not lead:
            return jsonify({"error": "Lead not found"}), 404
        
        data = request.json
        new_stage_id = data.get("stage_id")
        reason = data.get("reason", "")
        changed_by = data.get("changed_by", "System")
        
        # Calculate duration in previous stage
        duration_seconds = None
        if lead.stage_entered_at:
            duration_seconds = int((datetime.utcnow() - lead.stage_entered_at).total_seconds())
        
        # Record stage history
        history = StageHistory(
            lead_id=lead.id,
            from_stage_id=lead.pipeline_stage_id,
            to_stage_id=new_stage_id,
            changed_by=changed_by,
            reason=reason,
            duration_seconds=duration_seconds,
        )
        session.add(history)
        
        # Update lead
        lead.pipeline_stage_id = new_stage_id
        lead.stage_entered_at = datetime.utcnow()
        lead.last_activity = datetime.utcnow()
        
        session.commit()
        return jsonify({
            "lead": lead.to_dict(),
            "history": history.to_dict(),
        })
    finally:
        session.close()


@app.route("/api/pipeline/leads/<int:lead_id>/history", methods=["GET"])
def get_lead_stage_history(lead_id):
    """Get stage history for a lead."""
    session = get_session()
    try:
        history = session.query(StageHistory).filter(StageHistory.lead_id == lead_id).order_by(StageHistory.changed_at.desc()).all()
        return jsonify([h.to_dict() for h in history])
    finally:
        session.close()


@app.route("/api/pipeline/bottlenecks", methods=["GET"])
def get_pipeline_bottlenecks():
    """Identify pipeline bottlenecks based on SLA."""
    session = get_session()
    try:
        stages = session.query(PipelineStage).filter(
            PipelineStage.is_active == True,
            PipelineStage.sla_days != None
        ).all()
        
        bottlenecks = []
        for stage in stages:
            sla_seconds = stage.sla_days * 86400
            # Find leads in this stage exceeding SLA
            overdue_leads = session.query(Lead).filter(
                Lead.pipeline_stage_id == stage.id,
                Lead.stage_entered_at != None,
                (func.julianday(func.datetime("now")) - func.julianday(Lead.stage_entered_at)) * 86400 > sla_seconds
            ).all()
            
            if overdue_leads:
                bottlenecks.append({
                    "stage": stage.to_dict(),
                    "sla_days": stage.sla_days,
                    "overdue_count": len(overdue_leads),
                    "leads": [l.to_dict() for l in overdue_leads[:5]],  # Top 5 overdue
                })
        
        return jsonify(bottlenecks)
    finally:
        session.close()


@app.route("/api/pipeline/metrics", methods=["GET"])
def get_pipeline_metrics():
    """Get pipeline metrics and conversion rates."""
    session = get_session()
    try:
        stages = session.query(PipelineStage).filter(PipelineStage.is_active == True).order_by(PipelineStage.order).all()
        
        metrics = []
        for stage in stages:
            leads_count = session.query(Lead).filter(Lead.pipeline_stage_id == stage.id).count()
            total_value = session.query(func.sum(Lead.deal_value)).filter(Lead.pipeline_stage_id == stage.id).scalar() or 0
            
            # Average time in stage (from stage history)
            avg_duration = session.query(func.avg(StageHistory.duration_seconds)).filter(
                StageHistory.from_stage_id == stage.id
            ).scalar()
            
            metrics.append({
                "stage": stage.to_dict(),
                "leads_count": leads_count,
                "total_value": total_value,
                "avg_duration_days": round(avg_duration / 86400, 1) if avg_duration else None,
            })
        
        # Overall conversion rate (from first stage to won stages)
        total_leads = session.query(Lead).count()
        won_stages = session.query(PipelineStage.id).filter(PipelineStage.is_won_stage == True).all()
        won_stage_ids = [s.id for s in won_stages]
        won_leads = session.query(Lead).filter(Lead.pipeline_stage_id.in_(won_stage_ids)).count() if won_stage_ids else 0
        
        return jsonify({
            "stages": metrics,
            "total_leads": total_leads,
            "won_leads": won_leads,
            "conversion_rate": round((won_leads / total_leads * 100) if total_leads > 0 else 0, 1),
            "total_pipeline_value": sum(m["total_value"] for m in metrics),
        })
    finally:
        session.close()


# ===========================================
# Document Management API (Phase 7)
# ===========================================

@app.route("/api/documents", methods=["GET"])
def get_documents():
    """Get all documents with optional filtering."""
    session = get_session()
    try:
        lead_id = request.args.get("lead_id", type=int)
        category = request.args.get("category")
        include_archived = request.args.get("include_archived", "false").lower() == "true"
        
        query = session.query(Document)
        if lead_id:
            query = query.filter(Document.lead_id == lead_id)
        if category:
            query = query.filter(Document.category == category)
        if not include_archived:
            query = query.filter(Document.is_archived == False)
        
        documents = query.order_by(Document.created_at.desc()).all()
        return jsonify([d.to_dict() for d in documents])
    finally:
        session.close()


@app.route("/api/documents", methods=["POST"])
def upload_document():
    """Upload a document (metadata only - file handling would be added separately)."""
    session = get_session()
    try:
        data = request.json
        document = Document(
            lead_id=data.get("lead_id"),
            filename=data["filename"],
            original_filename=data.get("original_filename", data["filename"]),
            file_type=data.get("file_type"),
            file_size=data.get("file_size"),
            file_path=data.get("file_path"),
            category=data.get("category", "other"),
            description=data.get("description"),
            uploaded_by=data.get("uploaded_by"),
        )
        session.add(document)
        
        # Create audit log
        audit = AuditLog(
            entity_type="document",
            entity_id=document.id,
            action="create",
            user_name=data.get("uploaded_by"),
            changes_json=json.dumps({"filename": data["filename"]}),
        )
        session.add(audit)
        
        session.commit()
        return jsonify(document.to_dict()), 201
    finally:
        session.close()


@app.route("/api/documents/<int:doc_id>", methods=["DELETE"])
def delete_document(doc_id):
    """Archive a document (soft delete)."""
    session = get_session()
    try:
        document = session.query(Document).get(doc_id)
        if not document:
            return jsonify({"error": "Document not found"}), 404
        
        document.is_archived = True
        
        # Create audit log
        audit = AuditLog(
            entity_type="document",
            entity_id=doc_id,
            action="delete",
            changes_json=json.dumps({"archived": True}),
        )
        session.add(audit)
        
        session.commit()
        return jsonify({"success": True})
    finally:
        session.close()


@app.route("/api/leads/<int:lead_id>/documents", methods=["GET"])
def get_lead_documents(lead_id):
    """Get all documents for a specific lead."""
    session = get_session()
    try:
        documents = session.query(Document).filter(
            Document.lead_id == lead_id,
            Document.is_archived == False
        ).order_by(Document.created_at.desc()).all()
        return jsonify([d.to_dict() for d in documents])
    finally:
        session.close()


# ===========================================
# Audit Logs API (Phase 7)
# ===========================================

@app.route("/api/audit-logs", methods=["GET"])
def get_audit_logs():
    """Get audit logs with filtering."""
    session = get_session()
    try:
        entity_type = request.args.get("entity_type")
        entity_id = request.args.get("entity_id", type=int)
        action = request.args.get("action")
        user_name = request.args.get("user")
        limit = request.args.get("limit", 100, type=int)
        
        query = session.query(AuditLog)
        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)
        if entity_id:
            query = query.filter(AuditLog.entity_id == entity_id)
        if action:
            query = query.filter(AuditLog.action == action)
        if user_name:
            query = query.filter(AuditLog.user_name == user_name)
        
        logs = query.order_by(AuditLog.timestamp.desc()).limit(limit).all()
        return jsonify([l.to_dict() for l in logs])
    finally:
        session.close()


@app.route("/api/leads/<int:lead_id>/audit-log", methods=["GET"])
def get_lead_audit_log(lead_id):
    """Get complete audit trail for a lead."""
    session = get_session()
    try:
        logs = session.query(AuditLog).filter(
            AuditLog.entity_type == "lead",
            AuditLog.entity_id == lead_id
        ).order_by(AuditLog.timestamp.desc()).all()
        return jsonify([l.to_dict() for l in logs])
    finally:
        session.close()


def create_audit_log(session, entity_type, entity_id, action, user_name=None, changes=None):
    """Helper function to create audit logs."""
    audit = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        user_name=user_name,
        changes_json=json.dumps(changes) if changes else None,
        ip_address=request.remote_addr if request else None,
    )
    session.add(audit)
    return audit


# ===========================================
# Data Export API (Phase 7)
# ===========================================

@app.route("/api/export/leads", methods=["GET"])
def export_leads():
    """Export leads data as CSV or JSON."""
    session = get_session()
    try:
        format_type = request.args.get("format", "json")
        status = request.args.get("status")
        service_category = request.args.get("service_category")
        
        query = session.query(Lead)
        if status:
            query = query.filter(Lead.status == status)
        if service_category:
            query = query.filter(Lead.service_category == service_category)
        
        leads = query.all()
        
        # Create audit log for export
        audit = AuditLog(
            entity_type="leads",
            action="export",
            changes_json=json.dumps({"count": len(leads), "format": format_type}),
        )
        session.add(audit)
        session.commit()
        
        if format_type == "csv":
            # Generate CSV
            csv_data = "id,business_name,contact_name,email,phone,status,source,service_category,deal_value,assigned_rep\n"
            for lead in leads:
                csv_data += f"{lead.id},{lead.business_name or ''},{lead.contact_name or ''},{lead.email or ''},{lead.phone or ''},{lead.status or ''},{lead.source or ''},{lead.service_category or ''},{lead.deal_value or ''},{lead.assigned_rep or ''}\n"
            
            response = app.response_class(
                response=csv_data,
                status=200,
                mimetype='text/csv',
                headers={"Content-Disposition": f"attachment;filename=leads_export_{datetime.utcnow().strftime('%Y%m%d')}.csv"}
            )
            return response
        else:
            return jsonify([l.to_dict() for l in leads])
    finally:
        session.close()


@app.route("/api/export/activities", methods=["GET"])
def export_activities():
    """Export activity logs."""
    session = get_session()
    try:
        format_type = request.args.get("format", "json")
        days = request.args.get("days", 30, type=int)
        
        start_date = datetime.utcnow() - timedelta(days=days)
        logs = session.query(Log).filter(Log.timestamp >= start_date).all()
        
        # Create audit log for export
        audit = AuditLog(
            entity_type="activities",
            action="export",
            changes_json=json.dumps({"count": len(logs), "days": days}),
        )
        session.add(audit)
        session.commit()
        
        if format_type == "csv":
            csv_data = "id,lead_id,activity_type,outcome,timestamp,notes\n"
            for log in logs:
                csv_data += f"{log.id},{log.lead_id},{log.activity_type or ''},{log.outcome or ''},{log.timestamp.isoformat() if log.timestamp else ''},{(log.notes or '').replace(',', ';')}\n"
            
            response = app.response_class(
                response=csv_data,
                status=200,
                mimetype='text/csv',
                headers={"Content-Disposition": f"attachment;filename=activities_export_{datetime.utcnow().strftime('%Y%m%d')}.csv"}
            )
            return response
        else:
            return jsonify([{
                "id": l.id,
                "lead_id": l.lead_id,
                "activity_type": l.activity_type,
                "outcome": l.outcome,
                "timestamp": l.timestamp.isoformat() if l.timestamp else None,
                "notes": l.notes,
            } for l in logs])
    finally:
        session.close()


@app.route("/api/export/report", methods=["GET"])
def export_full_report():
    """Export a comprehensive report."""
    session = get_session()
    try:
        # Gather all data
        leads = session.query(Lead).all()
        activities_count = session.query(Log).count()
        proposals_count = session.query(Proposal).count()
        
        # Status breakdown
        status_breakdown = {}
        for lead in leads:
            status = lead.status or "Unknown"
            status_breakdown[status] = status_breakdown.get(status, 0) + 1
        
        # Service breakdown
        service_breakdown = {}
        for lead in leads:
            service = lead.service_category or "Not specified"
            service_breakdown[service] = service_breakdown.get(service, 0) + 1
        
        # Revenue summary
        total_pipeline = sum(l.deal_value or 0 for l in leads)
        converted_value = sum(l.deal_value or 0 for l in leads if l.status == "Converted")
        
        # Create audit log
        audit = AuditLog(
            entity_type="report",
            action="export",
            changes_json=json.dumps({"type": "full_report"}),
        )
        session.add(audit)
        session.commit()
        
        return jsonify({
            "generated_at": datetime.utcnow().isoformat(),
            "summary": {
                "total_leads": len(leads),
                "total_activities": activities_count,
                "total_proposals": proposals_count,
                "total_pipeline_value": total_pipeline,
                "converted_value": converted_value,
            },
            "status_breakdown": status_breakdown,
            "service_breakdown": service_breakdown,
            "conversion_rate": round((status_breakdown.get("Converted", 0) / len(leads) * 100) if leads else 0, 1),
        })
    finally:
        session.close()


# ===========================================
# Advanced Analytics API (Phase 6)
# ===========================================

@app.route("/api/analytics/response-rates", methods=["GET"])
def get_response_rate_analytics():
    """Get response rate analytics broken down by various dimensions."""
    session = get_session()
    try:
        timeframe = request.args.get("timeframe", "month")
        periods = get_period_boundaries()
        
        if timeframe == "week":
            start_date = periods["week_start"]
        elif timeframe == "quarter":
            start_date = periods["month_start"] - timedelta(days=90)
        else:
            start_date = periods["month_start"]
        
        # Get leads created in period
        leads = session.query(Lead).filter(Lead.created_at >= start_date).all()
        total = len(leads)
        
        if total == 0:
            return jsonify({"total": 0, "breakdown": {}})
        
        # Response status breakdown
        response_breakdown = {}
        for status in ["no_response", "opened", "replied", "interested", "not_interested"]:
            count = len([l for l in leads if l.response_status == status])
            response_breakdown[status] = {
                "count": count,
                "percentage": round((count / total) * 100, 1),
            }
        
        # By source
        by_source = {}
        for lead in leads:
            source = lead.source or "Unknown"
            if source not in by_source:
                by_source[source] = {"total": 0, "replied": 0}
            by_source[source]["total"] += 1
            if lead.response_status in ["replied", "interested"]:
                by_source[source]["replied"] += 1
        
        for source in by_source:
            total_count = by_source[source]["total"]
            by_source[source]["response_rate"] = round((by_source[source]["replied"] / total_count) * 100, 1) if total_count > 0 else 0
        
        # By service category
        by_service = {}
        for lead in leads:
            service = lead.service_category or "Not specified"
            if service not in by_service:
                by_service[service] = {"total": 0, "replied": 0}
            by_service[service]["total"] += 1
            if lead.response_status in ["replied", "interested"]:
                by_service[service]["replied"] += 1
        
        for service in by_service:
            total_count = by_service[service]["total"]
            by_service[service]["response_rate"] = round((by_service[service]["replied"] / total_count) * 100, 1) if total_count > 0 else 0
        
        # Overall response rate
        responded = len([l for l in leads if l.response_status in ["replied", "interested"]])
        overall_rate = round((responded / total) * 100, 1)
        
        return jsonify({
            "total_leads": total,
            "overall_response_rate": overall_rate,
            "response_breakdown": response_breakdown,
            "by_source": by_source,
            "by_service": by_service,
        })
    finally:
        session.close()


@app.route("/api/analytics/time-to-close", methods=["GET"])
def get_time_to_close_analytics():
    """Get time-to-close analytics."""
    session = get_session()
    try:
        # Get converted leads with timestamps
        converted = session.query(Lead).filter(Lead.status == "Converted").all()
        
        if not converted:
            return jsonify({"average_days": 0, "breakdown": []})
        
        times = []
        for lead in converted:
            if lead.created_at and lead.updated_at:
                days = (lead.updated_at - lead.created_at).days
                times.append({
                    "lead_id": lead.id,
                    "lead_name": lead.business_name,
                    "days_to_close": days,
                    "service_category": lead.service_category,
                    "source": lead.source,
                })
        
        if not times:
            return jsonify({"average_days": 0, "breakdown": []})
        
        avg_days = round(sum(t["days_to_close"] for t in times) / len(times), 1)
        
        # By service category
        by_service = {}
        for t in times:
            service = t["service_category"] or "Not specified"
            if service not in by_service:
                by_service[service] = {"total_days": 0, "count": 0}
            by_service[service]["total_days"] += t["days_to_close"]
            by_service[service]["count"] += 1
        
        for service in by_service:
            by_service[service]["average"] = round(by_service[service]["total_days"] / by_service[service]["count"], 1)
        
        # Distribution buckets
        buckets = {"0-7": 0, "8-14": 0, "15-30": 0, "31-60": 0, "60+": 0}
        for t in times:
            days = t["days_to_close"]
            if days <= 7:
                buckets["0-7"] += 1
            elif days <= 14:
                buckets["8-14"] += 1
            elif days <= 30:
                buckets["15-30"] += 1
            elif days <= 60:
                buckets["31-60"] += 1
            else:
                buckets["60+"] += 1
        
        return jsonify({
            "average_days": avg_days,
            "total_closed": len(times),
            "by_service": by_service,
            "distribution": buckets,
            "recent_closes": sorted(times, key=lambda x: x["days_to_close"])[:10],
        })
    finally:
        session.close()


@app.route("/api/analytics/revenue-pipeline", methods=["GET"])
def get_revenue_pipeline_analytics():
    """Get revenue pipeline analytics."""
    session = get_session()
    try:
        # Get all leads with deal values
        leads = session.query(Lead).filter(Lead.deal_value != None).all()
        
        # By stage
        stages = session.query(PipelineStage).filter(PipelineStage.is_active == True).order_by(PipelineStage.order).all()
        
        by_stage = []
        for stage in stages:
            stage_leads = [l for l in leads if l.pipeline_stage_id == stage.id]
            by_stage.append({
                "stage": stage.name,
                "color": stage.color,
                "count": len(stage_leads),
                "value": sum(l.deal_value or 0 for l in stage_leads),
            })
        
        # Unassigned
        unassigned = [l for l in leads if l.pipeline_stage_id is None]
        by_stage.insert(0, {
            "stage": "Unassigned",
            "color": "#9ca3af",
            "count": len(unassigned),
            "value": sum(l.deal_value or 0 for l in unassigned),
        })
        
        # By service category
        by_service = {}
        for lead in leads:
            service = lead.service_category or "Not specified"
            if service not in by_service:
                by_service[service] = {"count": 0, "value": 0}
            by_service[service]["count"] += 1
            by_service[service]["value"] += lead.deal_value or 0
        
        # By rep
        by_rep = {}
        for lead in leads:
            rep = lead.assigned_rep or "Unassigned"
            if rep not in by_rep:
                by_rep[rep] = {"count": 0, "value": 0}
            by_rep[rep]["count"] += 1
            by_rep[rep]["value"] += lead.deal_value or 0
        
        # Expected to close this month
        now = datetime.utcnow()
        month_start = datetime(now.year, now.month, 1)
        if now.month == 12:
            month_end = datetime(now.year + 1, 1, 1)
        else:
            month_end = datetime(now.year, now.month + 1, 1)
        
        expected_this_month = session.query(Lead).filter(
            Lead.expected_close_date >= month_start,
            Lead.expected_close_date < month_end,
            Lead.deal_value != None
        ).all()
        
        return jsonify({
            "total_pipeline_value": sum(l.deal_value or 0 for l in leads),
            "total_deals": len(leads),
            "by_stage": by_stage,
            "by_service": by_service,
            "by_rep": by_rep,
            "expected_this_month": {
                "count": len(expected_this_month),
                "value": sum(l.deal_value or 0 for l in expected_this_month),
            },
        })
    finally:
        session.close()


@app.route("/api/analytics/service-breakdown", methods=["GET"])
def get_service_breakdown_analytics():
    """Get service category breakdown analytics."""
    session = get_session()
    try:
        leads = session.query(Lead).all()
        
        categories = {}
        for lead in leads:
            category = lead.service_category or "Not specified"
            if category not in categories:
                categories[category] = {
                    "total": 0,
                    "by_status": {},
                    "by_response": {},
                    "total_value": 0,
                    "converted": 0,
                }
            
            categories[category]["total"] += 1
            categories[category]["total_value"] += lead.deal_value or 0
            
            # By status
            status = lead.status
            if status not in categories[category]["by_status"]:
                categories[category]["by_status"][status] = 0
            categories[category]["by_status"][status] += 1
            
            if status == "Converted":
                categories[category]["converted"] += 1
            
            # By response
            response = lead.response_status or "no_response"
            if response not in categories[category]["by_response"]:
                categories[category]["by_response"][response] = 0
            categories[category]["by_response"][response] += 1
        
        # Calculate rates
        for category in categories:
            total = categories[category]["total"]
            categories[category]["conversion_rate"] = round((categories[category]["converted"] / total) * 100, 1) if total > 0 else 0
        
        return jsonify(categories)
    finally:
        session.close()


@app.route("/api/analytics/outreach-volume", methods=["GET"])
def get_outreach_volume_analytics():
    """Get outreach volume over time."""
    session = get_session()
    try:
        days = int(request.args.get("days", 30))
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        logs = session.query(Log).filter(Log.timestamp >= start_date).all()
        
        # Group by day
        daily_data = {}
        current = start_date
        while current <= end_date:
            day_str = current.strftime("%Y-%m-%d")
            daily_data[day_str] = {
                "date": day_str,
                "calls": 0,
                "emails": 0,
                "meetings": 0,
                "total": 0,
            }
            current += timedelta(days=1)
        
        for log in logs:
            day_str = log.timestamp.strftime("%Y-%m-%d")
            if day_str in daily_data:
                daily_data[day_str]["total"] += 1
                if log.activity_type == "Call":
                    daily_data[day_str]["calls"] += 1
                elif log.activity_type == "Email":
                    daily_data[day_str]["emails"] += 1
                elif log.activity_type == "Meeting":
                    daily_data[day_str]["meetings"] += 1
        
        return jsonify({
            "period_days": days,
            "total_activities": len(logs),
            "daily_data": list(daily_data.values()),
        })
    finally:
        session.close()


# ===========================================
# Proposal Versioning API
# ===========================================

@app.route("/api/proposals/<int:proposal_id>/duplicate", methods=["POST"])
def duplicate_proposal(proposal_id):
    """Create a new version of a proposal."""
    session = get_session()
    try:
        original = session.query(Proposal).get(proposal_id)
        if not original:
            return jsonify({"error": "Proposal not found"}), 404
        
        # Get max version for this lead
        max_version = session.query(func.max(Proposal.version)).filter(
            Proposal.lead_id == original.lead_id
        ).scalar() or 0
        
        new_proposal = Proposal(
            lead_id=original.lead_id,
            title=original.title,
            configuration_json=original.configuration_json,
            proposal_html=original.proposal_html,
            total_price=original.total_price,
            discount=original.discount,
            validity_days=original.validity_days,
            status="draft",
            version=max_version + 1,
            notes=f"Duplicated from version {original.version}",
        )
        session.add(new_proposal)
        session.commit()
        return jsonify(new_proposal.to_dict()), 201
    finally:
        session.close()


@app.route("/api/leads/<int:lead_id>/proposals", methods=["GET"])
def get_lead_proposals(lead_id):
    """Get all proposal versions for a lead."""
    session = get_session()
    try:
        proposals = session.query(Proposal).filter(Proposal.lead_id == lead_id).order_by(Proposal.version.desc()).all()
        return jsonify([p.to_dict() for p in proposals])
    finally:
        session.close()


# ===========================================
# Network Graph API
# ===========================================

@app.route("/api/network/graph", methods=["GET"])
def get_network_graph():
    """Get network graph data."""
    session = get_session()
    try:
        clients = session.query(NetworkClient).all()
        entities = session.query(NetworkEntity).all()
        edges = session.query(NetworkEdge).all()
        
        return jsonify({
            "clients": [c.to_dict() for c in clients],
            "entities": [e.to_dict() for e in entities],
            "edges": [e.to_dict() for e in edges],
        })
    finally:
        session.close()


@app.route("/api/network/clients", methods=["POST"])
def create_network_client():
    """Create a network client."""
    session = get_session()
    try:
        data = request.json
        client = NetworkClient(
            name=data.get("name"),
            color=data.get("color", "#3b82f6"),
        )
        session.add(client)
        session.commit()
        return jsonify(client.to_dict()), 201
    finally:
        session.close()


@app.route("/api/network/entities", methods=["POST"])
def create_network_entity():
    """Create a network entity."""
    session = get_session()
    try:
        data = request.json
        entity = NetworkEntity(
            label=data.get("label"),
            entity_type=data.get("type", "person"),
            depth=data.get("depth", 1),
        )
        session.add(entity)
        session.commit()
        return jsonify(entity.to_dict()), 201
    finally:
        session.close()


@app.route("/api/network/edges", methods=["POST"])
def create_network_edge():
    """Create a network edge."""
    session = get_session()
    try:
        data = request.json
        edge = NetworkEdge(
            from_entity_id=data.get("from"),
            to_entity_id=data.get("to"),
            strength=data.get("strength", 1.0),
            client_ids=json.dumps(data.get("clients", [])),
        )
        session.add(edge)
        session.commit()
        return jsonify(edge.to_dict()), 201
    finally:
        session.close()


# ===========================================
# Run App
# ===========================================

if __name__ == "__main__":
    print("Starting DW Outreach API...")
    print(f"Database: {engine.url}")
    app.run(host="0.0.0.0", port=5001, debug=True)
