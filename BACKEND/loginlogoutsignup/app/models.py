from datetime import datetime, timezone
from app import db
import enum


class Role(str, enum.Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN   = "admin"


class User(db.Model):
    __tablename__ = "users"

    id            = db.Column(db.Integer, primary_key=True)
    email         = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name     = db.Column(db.String(255), nullable=False)
    role          = db.Column(db.Enum(Role), nullable=False, default=Role.STUDENT)
    is_active     = db.Column(db.Boolean, default=True, nullable=False)
    created_at    = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_active   = db.Column(db.DateTime(timezone=True), nullable=True)

    refresh_tokens = db.relationship("RefreshToken", backref="user", lazy=True, cascade="all, delete-orphan")
    activity_logs  = db.relationship("ActivityLog",  backref="user", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id":          self.id,
            "email":       self.email,
            "full_name":   self.full_name,
            "role":        self.role.value,
            "is_active":   self.is_active,
            "created_at":  self.created_at.isoformat() if self.created_at else None,
            "last_active": self.last_active.isoformat() if self.last_active else None,
        }

    def __repr__(self):
        return f"<User {self.email} ({self.role.value})>"


class RefreshToken(db.Model):
    __tablename__ = "refresh_tokens"

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    token_jti  = db.Column(db.String(255), unique=True, nullable=False)
    revoked    = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<RefreshToken user_id={self.user_id} revoked={self.revoked}>"


class RevokedToken(db.Model):
    """Stores JTIs of revoked access/refresh tokens for blocklist checking."""
    __tablename__ = "revoked_tokens"

    id         = db.Column(db.Integer, primary_key=True)
    jti        = db.Column(db.String(255), unique=True, nullable=False, index=True)
    revoked_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<RevokedToken jti={self.jti}>"


class ActivityLog(db.Model):
    __tablename__ = "activity_logs"

    id          = db.Column(db.Integer, primary_key=True)
    user_id     = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    action_type = db.Column(db.String(100), nullable=False)
    extra_data  = db.Column(db.JSON, nullable=True)
    created_at  = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id":          self.id,
            "user_id":     self.user_id,
            "action_type": self.action_type,
            "extra_data":  self.extra_data,
            "created_at":  self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<ActivityLog user_id={self.user_id} action={self.action_type}>"
