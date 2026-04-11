from datetime import timedelta

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from dotenv import load_dotenv
import os

load_dotenv()

db      = SQLAlchemy()
bcrypt  = Bcrypt()
jwt     = JWTManager()


def create_app():
    app = Flask(__name__)

    # ── Config ──────────────────────────────────────────────────────────────
    app.config["SQLALCHEMY_DATABASE_URI"]        = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/skillsync")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"]                 = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"]       = timedelta(hours=1)
    app.config["JWT_REFRESH_TOKEN_EXPIRES"]      = timedelta(days=30)

    # ── Extensions ──────────────────────────────────────────────────────────
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # ── Token blocklist ────────────────────────────────────────────────────
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        from app.models import RevokedToken
        jti = jwt_payload["jti"]
        return RevokedToken.query.filter_by(jti=jti).first() is not None

    # ── Blueprints ──────────────────────────────────────────────────────────
    from app.routes.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix="/api/auth")

    # ── Create tables ───────────────────────────────────────────────────────
    with app.app_context():
        db.create_all()
        _seed_admin()

    return app


def _seed_admin():
    """Create a default admin if none exists."""
    from app.models import User, Role
    if not User.query.filter_by(role=Role.ADMIN).first():
        pw_hash = bcrypt.generate_password_hash("admin123").decode("utf-8")
        admin = User(
            email="admin@skillsync.edu",
            password_hash=pw_hash,
            full_name="Admin User",
            role=Role.ADMIN,
        )
        db.session.add(admin)

        # Demo student
        pw_hash2 = bcrypt.generate_password_hash("password123").decode("utf-8")
        student = User(
            email="anushka@skillsync.edu",
            password_hash=pw_hash2,
            full_name="Anushka Demo",
            role=Role.STUDENT,
        )
        db.session.add(student)
        db.session.commit()
        print("✅ Seeded admin and demo student")
