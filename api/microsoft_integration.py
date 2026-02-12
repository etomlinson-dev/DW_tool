# -*- coding: utf-8 -*-
"""
Microsoft 365 Email Tracking Integration
Tracks outreach emails based on subject line keywords
"""
import os
import json
import requests
from datetime import datetime, timedelta

# Create a requests session that ignores proxy settings
_http_session = requests.Session()
_http_session.trust_env = False
from functools import wraps
from flask import Blueprint, jsonify, request, redirect, session, url_for
from sqlalchemy import Column, Integer, String, DateTime, Text, Float, ForeignKey, Boolean
from sqlalchemy.orm import relationship

# Email categories based on subject line keywords
OUTREACH_CATEGORIES = {
    'introduction': [
        'introduction', 'intro', 'reaching out', 'first contact',
        'nice to meet', 'introducing myself', 'let me introduce'
    ],
    'follow_up': [
        'follow up', 'following up', 'checking in', 'just wanted to',
        'touching base', 'circling back', 'quick follow'
    ],
    'meeting_date': [
        'meeting date', 'schedule', 'calendar', 'book a time',
        'availability', 'let\'s meet', 'meeting request', 'call scheduled'
    ],
    'contract_deal': [
        'contract deal', 'proposal', 'agreement', 'pricing', 'quote',
        'contract', 'terms', 'offer', 'deal terms'
    ],
    'deal_closed': [
        'deal closed', 'welcome aboard', 'signed', 'congratulations',
        'looking forward', 'thank you for choosing', 'welcome to'
    ]
}

# Category display configuration
CATEGORY_CONFIG = {
    'introduction': {'label': 'Introduction', 'color': '#3b82f6', 'icon': '👋'},
    'follow_up': {'label': 'Follow Up', 'color': '#8b5cf6', 'icon': '🔄'},
    'meeting_date': {'label': 'Meeting Date', 'color': '#f59e0b', 'icon': '📅'},
    'contract_deal': {'label': 'Contract Deal', 'color': '#10b981', 'icon': '📄'},
    'deal_closed': {'label': 'Deal Closed', 'color': '#22c55e', 'icon': '🎉'}
}


def categorize_email(subject: str) -> str | None:
    """Categorize an email based on subject line keywords."""
    if not subject:
        return None
    
    subject_lower = subject.lower()
    
    for category, keywords in OUTREACH_CATEGORIES.items():
        for keyword in keywords:
            if keyword in subject_lower:
                return category
    
    return None


def create_microsoft_models(Base):
    """Create Microsoft-related database models."""
    
    class MicrosoftToken(Base):
        __tablename__ = "microsoft_tokens"
        id = Column(Integer, primary_key=True)
        user_id = Column(Integer, ForeignKey("team_members.id"))
        access_token = Column(Text)
        refresh_token = Column(Text)
        expires_at = Column(DateTime)
        scope = Column(Text)
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
        
        def is_expired(self):
            return datetime.utcnow() >= self.expires_at if self.expires_at else True
        
        def to_dict(self):
            return {
                "id": self.id,
                "user_id": self.user_id,
                "expires_at": self.expires_at.isoformat() if self.expires_at else None,
                "scope": self.scope,
                "created_at": self.created_at.isoformat() if self.created_at else None,
            }
    
    class TrackedEmail(Base):
        __tablename__ = "tracked_emails"
        id = Column(Integer, primary_key=True)
        user_id = Column(Integer, ForeignKey("team_members.id"))
        lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
        microsoft_message_id = Column(String(255), unique=True)
        subject = Column(String(500))
        recipient_email = Column(String(255))
        category = Column(String(50))  # introduction, follow_up, meeting_date, contract_deal, deal_closed
        sent_at = Column(DateTime)
        opened_at = Column(DateTime, nullable=True)
        clicked_at = Column(DateTime, nullable=True)
        synced_at = Column(DateTime, default=datetime.utcnow)
        
        lead = relationship("Lead", backref="tracked_emails")
        
        def to_dict(self):
            return {
                "id": self.id,
                "user_id": self.user_id,
                "lead_id": self.lead_id,
                "lead_name": self.lead.business_name if self.lead else None,
                "microsoft_message_id": self.microsoft_message_id,
                "subject": self.subject,
                "recipient_email": self.recipient_email,
                "category": self.category,
                "category_config": CATEGORY_CONFIG.get(self.category, {}),
                "sent_at": self.sent_at.isoformat() if self.sent_at else None,
                "opened_at": self.opened_at.isoformat() if self.opened_at else None,
                "clicked_at": self.clicked_at.isoformat() if self.clicked_at else None,
                "synced_at": self.synced_at.isoformat() if self.synced_at else None,
            }
    
    class EmailSyncStatus(Base):
        __tablename__ = "email_sync_status"
        id = Column(Integer, primary_key=True)
        user_id = Column(Integer, ForeignKey("team_members.id"), unique=True)
        last_sync_at = Column(DateTime)
        emails_synced = Column(Integer, default=0)
        status = Column(String(50), default="pending")  # pending, syncing, completed, error
        error_message = Column(Text, nullable=True)
        
        def to_dict(self):
            return {
                "id": self.id,
                "user_id": self.user_id,
                "last_sync_at": self.last_sync_at.isoformat() if self.last_sync_at else None,
                "emails_synced": self.emails_synced,
                "status": self.status,
                "error_message": self.error_message,
            }
    
    return MicrosoftToken, TrackedEmail, EmailSyncStatus


def create_microsoft_routes(app, session_maker, MicrosoftToken, TrackedEmail, EmailSyncStatus, Lead, TeamMember=None):
    """Create Flask routes for Microsoft integration."""
    
    microsoft_bp = Blueprint('microsoft', __name__, url_prefix='/api/auth/microsoft')
    
    # Store TeamMember reference for use in routes
    _TeamMember = TeamMember
    
    # Microsoft OAuth configuration - read fresh from env each time
    def get_ms_config():
        # Accept both MS_TENANT_ID and MS_TENANT for compatibility
        tenant_id = os.environ.get('MS_TENANT_ID') or os.environ.get('MS_TENANT', 'common')
        
        # Auto-detect frontend URL from Vercel environment
        frontend_url = os.environ.get('MS_FRONTEND_URL')
        if not frontend_url:
            vercel_url = os.environ.get('VERCEL_URL')
            if vercel_url:
                frontend_url = f'https://{vercel_url}'
            else:
                frontend_url = 'http://localhost:3000'
        
        # Auto-detect redirect URI from Vercel environment
        redirect_uri = os.environ.get('MS_REDIRECT_URI')
        if not redirect_uri:
            vercel_url = os.environ.get('VERCEL_URL')
            if vercel_url:
                redirect_uri = f'https://{vercel_url}/api/auth/microsoft/callback'
            else:
                redirect_uri = 'http://localhost:5001/api/auth/microsoft/callback'
        
        return {
            'client_id': os.environ.get('MS_CLIENT_ID', ''),
            'client_secret': os.environ.get('MS_CLIENT_SECRET', ''),
            'redirect_uri': redirect_uri,
            'frontend_url': frontend_url,
            'authority': f'https://login.microsoftonline.com/{tenant_id}',
            'tenant_id': tenant_id,
        }
    
    # Log config on startup
    config = get_ms_config()
    print(f"Microsoft OAuth Config - Client ID: {config['client_id'][:20]}..., Tenant: {config['tenant_id'][:20]}..." if config['client_id'] else "Microsoft OAuth Config - Client ID: NOT SET")
    
    MS_CLIENT_ID = config['client_id']
    MS_CLIENT_SECRET = config['client_secret']
    MS_REDIRECT_URI = config['redirect_uri']
    MS_FRONTEND_URL = config['frontend_url']
    MS_AUTHORITY = config['authority']
    MS_SCOPES = ['Mail.Read', 'Mail.ReadBasic', 'User.Read', 'offline_access']
    
    def get_session():
        return session_maker()
    
    @microsoft_bp.route('/debug-config', methods=['GET'])
    def debug_config():
        """Debug endpoint to check what config the app is using."""
        # Re-read fresh from env to compare
        fresh_config = get_ms_config()
        return jsonify({
            "redirect_uri_in_use": MS_REDIRECT_URI,
            "redirect_uri_from_env": fresh_config['redirect_uri'],
            "frontend_url_in_use": MS_FRONTEND_URL,
            "env_MS_REDIRECT_URI": os.environ.get('MS_REDIRECT_URI', 'NOT SET'),
            "env_VERCEL_URL": os.environ.get('VERCEL_URL', 'NOT SET'),
            "env_MS_TENANT_ID": os.environ.get('MS_TENANT_ID', 'NOT SET')[:8] + '...' if os.environ.get('MS_TENANT_ID') else 'NOT SET',
            "client_id_set": bool(MS_CLIENT_ID),
        })
    
    @microsoft_bp.route('/login', methods=['GET', 'POST'])
    def microsoft_login():
        """Initiate Microsoft OAuth flow for SSO."""
        if not MS_CLIENT_ID:
            return jsonify({"error": "Microsoft integration not configured"}), 500
        
        # Build authorization URL with openid for SSO
        sso_scopes = ['openid', 'profile', 'email', 'User.Read', 'Mail.Read', 'offline_access']
        auth_url = (
            f"{MS_AUTHORITY}/oauth2/v2.0/authorize?"
            f"client_id={MS_CLIENT_ID}&"
            f"response_type=code&"
            f"redirect_uri={MS_REDIRECT_URI}&"
            f"scope={' '.join(sso_scopes)}&"
            f"response_mode=query&"
            f"prompt=select_account"
        )
        
        # If GET request, redirect directly to Microsoft
        if request.method == 'GET':
            return redirect(auth_url)
        
        # If POST, return the URL for frontend to redirect
        return jsonify({"auth_url": auth_url})
    
    @microsoft_bp.route('/callback', methods=['GET'])
    def microsoft_callback():
        """Handle OAuth callback from Microsoft - authenticates user via SSO."""
        code = request.args.get('code')
        error = request.args.get('error')
        error_description = request.args.get('error_description', '')
        
        if error:
            return redirect(f"{MS_FRONTEND_URL}/login?error=microsoft_auth_failed&message={error_description}")
        
        if not code:
            return redirect(f"{MS_FRONTEND_URL}/login?error=no_code")
        
        # Exchange code for tokens
        token_url = f"{MS_AUTHORITY}/oauth2/v2.0/token"
        sso_scopes = ['openid', 'profile', 'email', 'User.Read', 'Mail.Read', 'offline_access']
        token_data = {
            'client_id': MS_CLIENT_ID,
            'client_secret': MS_CLIENT_SECRET,
            'code': code,
            'redirect_uri': MS_REDIRECT_URI,
            'grant_type': 'authorization_code',
            'scope': ' '.join(sso_scopes),
        }
        
        try:
            response = _http_session.post(token_url, data=token_data)
            token_info = response.json()
            
            if 'error' in token_info:
                error_msg = token_info.get('error_description', token_info.get('error', 'Unknown error'))
                print(f"Token exchange error: {error_msg}")
                return redirect(f"{MS_FRONTEND_URL}/login?error=token_exchange_failed&message={error_msg}")
            
            # Store tokens and user info in database
            db_session = get_session()
            try:
                # Get user info from Microsoft Graph
                user_response = _http_session.get(
                    'https://graph.microsoft.com/v1.0/me',
                    headers={'Authorization': f"Bearer {token_info['access_token']}"}
                )
                user_info = user_response.json()
                
                if 'error' in user_info:
                    return redirect(f"{MS_FRONTEND_URL}/login?error=graph_api_failed&message={user_info.get('error', {}).get('message', 'Failed to get user info')}")
                
                # Extract user details
                ms_email = user_info.get('mail') or user_info.get('userPrincipalName', '')
                ms_name = user_info.get('displayName', ms_email.split('@')[0] if ms_email else 'User')
                ms_id = user_info.get('id', '')
                
                # Find or create TeamMember
                from sqlalchemy import func
                team_member = db_session.query(_TeamMember).filter(
                    func.lower(_TeamMember.email) == ms_email.lower()
                ).first()
                
                if not team_member:
                    # Create new team member from Microsoft account
                    team_member = _TeamMember(
                        name=ms_name,
                        email=ms_email,
                        role='sales',
                    )
                    db_session.add(team_member)
                    db_session.flush()  # Get the ID
                
                # Update last login
                team_member.last_login = datetime.utcnow()
                
                # Find or create token record for this user
                token_record = db_session.query(MicrosoftToken).filter_by(user_id=team_member.id).first()
                
                if not token_record:
                    token_record = MicrosoftToken(user_id=team_member.id)
                    db_session.add(token_record)
                
                token_record.access_token = token_info['access_token']
                token_record.refresh_token = token_info.get('refresh_token')
                token_record.expires_at = datetime.utcnow() + timedelta(seconds=token_info.get('expires_in', 3600))
                token_record.scope = ' '.join(sso_scopes)
                
                db_session.commit()
                
                # Store user info in Flask session for frontend to pick up
                session['user_id'] = team_member.id
                session['user_email'] = team_member.email
                session['user_name'] = team_member.name
                session['user_role'] = team_member.role
                session['microsoft_connected'] = True
                
                # Redirect to home with success - frontend will read session
                import urllib.parse
                user_data = json.dumps({
                    'id': team_member.id,
                    'name': team_member.name,
                    'email': team_member.email,
                    'role': team_member.role,
                    'avatar_url': team_member.avatar_url if hasattr(team_member, 'avatar_url') else None,
                })
                encoded_user = urllib.parse.quote(user_data)
                return redirect(f"{MS_FRONTEND_URL}/?auth=success&user={encoded_user}")
            finally:
                db_session.close()
                
        except Exception as e:
            print(f"Microsoft OAuth error: {e}")
            import traceback
            traceback.print_exc()
            return redirect(f"{MS_FRONTEND_URL}/login?error=oauth_error&message={str(e)}")
    
    @microsoft_bp.route('/logout', methods=['POST'])
    def microsoft_logout():
        """Disconnect Microsoft account."""
        db_session = get_session()
        try:
            # Get actual user_id from session
            user_id = session.get('user_id')
            if user_id:
                token_record = db_session.query(MicrosoftToken).filter_by(user_id=user_id).first()
                if token_record:
                    db_session.delete(token_record)
                    db_session.commit()
            
            # Clear Flask session
            session.clear()
            
            return jsonify({"success": True})
        finally:
            db_session.close()
    
    @microsoft_bp.route('/status', methods=['GET'])
    def microsoft_status():
        """Check Microsoft connection status and return user info if authenticated."""
        db_session = get_session()
        try:
            # Check Flask session first
            user_id = session.get('user_id')
            
            if user_id:
                # User is authenticated via session
                team_member = db_session.query(_TeamMember).filter_by(id=user_id).first()
                token_record = db_session.query(MicrosoftToken).filter_by(user_id=user_id).first()
                
                if team_member and token_record and not token_record.is_expired():
                    return jsonify({
                        "connected": True,
                        "authenticated": True,
                        "user": {
                            "id": team_member.id,
                            "name": team_member.name,
                            "email": team_member.email,
                            "role": team_member.role,
                            "avatar_url": team_member.avatar_url if hasattr(team_member, 'avatar_url') else None,
                        },
                        "expires_at": token_record.expires_at.isoformat() if token_record.expires_at else None,
                    })
            
            # Fallback: check for any valid token (legacy support)
            token_record = db_session.query(MicrosoftToken).first()
            
            if not token_record:
                return jsonify({"connected": False, "authenticated": False})
            
            # Check if token is expired
            if token_record.is_expired():
                # Try to refresh token
                if token_record.refresh_token:
                    try:
                        refresh_response = _http_session.post(
                            f"{MS_AUTHORITY}/oauth2/v2.0/token",
                            data={
                                'client_id': MS_CLIENT_ID,
                                'client_secret': MS_CLIENT_SECRET,
                                'refresh_token': token_record.refresh_token,
                                'grant_type': 'refresh_token',
                            }
                        )
                        refresh_data = refresh_response.json()
                        
                        if 'access_token' in refresh_data:
                            token_record.access_token = refresh_data['access_token']
                            token_record.refresh_token = refresh_data.get('refresh_token', token_record.refresh_token)
                            token_record.expires_at = datetime.utcnow() + timedelta(seconds=refresh_data.get('expires_in', 3600))
                            db_session.commit()
                        else:
                            return jsonify({"connected": False, "expired": True, "authenticated": False})
                    except Exception as e:
                        print(f"Token refresh error: {e}")
                        return jsonify({"connected": False, "expired": True, "authenticated": False})
                else:
                    return jsonify({"connected": False, "expired": True, "authenticated": False})
            
            # Get user info for this token
            team_member = db_session.query(_TeamMember).filter_by(id=token_record.user_id).first()
            
            return jsonify({
                "connected": True,
                "authenticated": True,
                "user": {
                    "id": team_member.id if team_member else None,
                    "name": team_member.name if team_member else "User",
                    "email": team_member.email if team_member else "",
                    "role": team_member.role if team_member else "sales",
                    "avatar_url": team_member.avatar_url if team_member and hasattr(team_member, 'avatar_url') else None,
                } if team_member else None,
                "expires_at": token_record.expires_at.isoformat() if token_record.expires_at else None,
            })
        finally:
            db_session.close()
    
    # Email tracking routes
    emails_bp = Blueprint('tracked_emails', __name__, url_prefix='/api/emails')
    
    @emails_bp.route('/sync', methods=['POST'])
    def sync_emails():
        """Trigger email sync from Microsoft."""
        db_session = get_session()
        try:
            # Get actual user_id from session
            user_id = session.get('user_id')
            if not user_id:
                return jsonify({"error": "Not authenticated"}), 401
            
            # Get Microsoft token for this user
            token_record = db_session.query(MicrosoftToken).filter_by(user_id=user_id).first()
            
            if not token_record or token_record.is_expired():
                return jsonify({"error": "Microsoft not connected or token expired"}), 401
            
            # Update sync status
            sync_status = db_session.query(EmailSyncStatus).filter_by(user_id=user_id).first()
            if not sync_status:
                sync_status = EmailSyncStatus(user_id=user_id)
                db_session.add(sync_status)
            
            sync_status.status = "syncing"
            db_session.commit()
            
            # Fetch sent emails from Microsoft Graph
            emails_synced = 0
            try:
                response = _http_session.get(
                    'https://graph.microsoft.com/v1.0/me/mailFolders/SentItems/messages',
                    headers={'Authorization': f"Bearer {token_record.access_token}"},
                    params={
                        '$top': 100,
                        '$select': 'id,subject,toRecipients,sentDateTime',
                        '$orderby': 'sentDateTime desc'
                    }
                )
                
                if response.status_code == 200:
                    messages = response.json().get('value', [])
                    
                    for msg in messages:
                        subject = msg.get('subject', '')
                        category = categorize_email(subject)
                        
                        # Only track emails with matching categories
                        if category:
                            msg_id = msg.get('id')
                            
                            # Check if already tracked
                            existing = db_session.query(TrackedEmail).filter_by(
                                microsoft_message_id=msg_id
                            ).first()
                            
                            if not existing:
                                # Get recipient email
                                recipients = msg.get('toRecipients', [])
                                recipient_email = recipients[0]['emailAddress']['address'] if recipients else ''
                                
                                # Try to match to a lead
                                lead = None
                                if recipient_email:
                                    lead = db_session.query(Lead).filter(
                                        Lead.email.ilike(f"%{recipient_email}%")
                                    ).first()
                                
                                # Create tracked email
                                tracked = TrackedEmail(
                                    user_id=user_id,
                                    lead_id=lead.id if lead else None,
                                    microsoft_message_id=msg_id,
                                    subject=subject,
                                    recipient_email=recipient_email,
                                    category=category,
                                    sent_at=datetime.fromisoformat(msg['sentDateTime'].replace('Z', '+00:00')) if msg.get('sentDateTime') else None,
                                )
                                db_session.add(tracked)
                                emails_synced += 1
                    
                    db_session.commit()
                    
                    sync_status.last_sync_at = datetime.utcnow()
                    sync_status.emails_synced = (sync_status.emails_synced or 0) + emails_synced
                    sync_status.status = "completed"
                    db_session.commit()
                    
                    return jsonify({
                        "success": True,
                        "emails_synced": emails_synced,
                    })
                else:
                    sync_status.status = "error"
                    sync_status.error_message = f"Graph API error: {response.status_code}"
                    db_session.commit()
                    return jsonify({"error": "Failed to fetch emails"}), 500
                    
            except Exception as e:
                sync_status.status = "error"
                sync_status.error_message = str(e)
                db_session.commit()
                raise
                
        except Exception as e:
            print(f"Email sync error: {e}")
            return jsonify({"error": str(e)}), 500
        finally:
            db_session.close()
    
    @emails_bp.route('/tracked', methods=['GET'])
    def get_tracked_emails():
        """Get tracked outreach emails."""
        db_session = get_session()
        try:
            query = db_session.query(TrackedEmail)
            
            # Filters
            category = request.args.get('category')
            lead_id = request.args.get('lead_id')
            
            if category and category != 'all':
                query = query.filter(TrackedEmail.category == category)
            if lead_id:
                query = query.filter(TrackedEmail.lead_id == int(lead_id))
            
            emails = query.order_by(TrackedEmail.sent_at.desc()).limit(200).all()
            
            return jsonify([e.to_dict() for e in emails])
        finally:
            db_session.close()
    
    @emails_bp.route('/tracked/stats', methods=['GET'])
    def get_tracked_email_stats():
        """Get email statistics by category."""
        db_session = get_session()
        try:
            from sqlalchemy import func
            
            # Count by category
            category_counts = db_session.query(
                TrackedEmail.category,
                func.count(TrackedEmail.id)
            ).group_by(TrackedEmail.category).all()
            
            stats = {
                "total": 0,
                "by_category": {},
            }
            
            for category, count in category_counts:
                if category:
                    stats["by_category"][category] = {
                        "count": count,
                        **CATEGORY_CONFIG.get(category, {})
                    }
                    stats["total"] += count
            
            # Get sync status for current user
            current_user_id = session.get('user_id')
            sync_status = db_session.query(EmailSyncStatus).filter_by(user_id=current_user_id).first() if current_user_id else None
            if sync_status:
                stats["last_sync"] = sync_status.to_dict()
            
            return jsonify(stats)
        finally:
            db_session.close()
    
    @emails_bp.route('/tracked/<int:lead_id>', methods=['GET'])
    def get_lead_tracked_emails(lead_id):
        """Get tracked emails for a specific lead."""
        db_session = get_session()
        try:
            emails = db_session.query(TrackedEmail).filter_by(
                lead_id=lead_id
            ).order_by(TrackedEmail.sent_at.asc()).all()
            
            return jsonify([e.to_dict() for e in emails])
        finally:
            db_session.close()
    
    return microsoft_bp, emails_bp
