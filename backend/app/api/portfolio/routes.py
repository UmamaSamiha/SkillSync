"""
SkillSync — Portfolio API
==========================
Student portfolio: skills, featured projects, contribution stats.
"""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from app import db
from app.models import Portfolio, PortfolioProject, Certificate, User, Role
from app.utils.helpers import success, error, get_current_user, validate_required

portfolio_bp = Blueprint("portfolio", __name__)


# ── GET /api/portfolio/<user_id> — Public, no login needed ───────────────────
@portfolio_bp.route("/<user_id>", methods=["GET"])
def get_portfolio(user_id):
    user = User.query.get(user_id)
    if not user or user.role != Role.STUDENT:
        return error("Student not found", 404)

    p = Portfolio.query.filter_by(user_id=user_id).first()
    if not p:
        p = Portfolio(user_id=user_id, skills=[])
        db.session.add(p)
        db.session.commit()

    data = p.to_dict()
    data["projects"]     = [proj.to_dict() for proj in p.projects.all()]
    data["certificates"] = [c.to_dict() for c in user.certificates.all()]
    data["student"] = {
        "id":         user.id,
        "full_name":  user.full_name,
        "avatar_url": user.avatar_url,
    }
    return success(data)


# ── PUT /api/portfolio/<user_id> — Update bio/skills/links ───────────────────
@portfolio_bp.route("/<user_id>", methods=["PUT"])
@jwt_required()
def update_portfolio(user_id):
    current = get_current_user()
    if current.id != user_id and current.role != "admin":
        return error("Forbidden", 403)

    data = request.get_json(silent=True) or {}
    p = Portfolio.query.filter_by(user_id=user_id).first()
    if not p:
        p = Portfolio(user_id=user_id, skills=[])
        db.session.add(p)

    if "bio"          in data: p.bio          = data["bio"]
    if "github_url"   in data: p.github_url   = data["github_url"]
    if "linkedin_url" in data: p.linkedin_url = data["linkedin_url"]
    if "skills"       in data: p.skills       = data["skills"]

    db.session.commit()
    return success(p.to_dict(), "Portfolio updated")


# ── POST /api/portfolio/<user_id>/projects — Add a project ───────────────────
@portfolio_bp.route("/<user_id>/projects", methods=["POST"])
@jwt_required()
def add_portfolio_project(user_id):
    current = get_current_user()
    if current.id != user_id:
        return error("Forbidden", 403)

    p = Portfolio.query.filter_by(user_id=user_id).first()
    if not p:
        p = Portfolio(user_id=user_id, skills=[])
        db.session.add(p)
        db.session.flush()

    data = request.get_json(silent=True) or {}
    missing = validate_required(data, ["title"])
    if missing:
        return error("Title is required", 400)

    proj = PortfolioProject(
        portfolio_id = p.id,
        project_id   = data.get("project_id"),
        title        = data["title"],
        description  = data.get("description", ""),
        role         = data.get("role", ""),
        is_featured  = bool(data.get("is_featured", False)),
    )
    db.session.add(proj)
    db.session.commit()
    return success(proj.to_dict(), "Project added", 201)


# ── PUT /api/portfolio/<user_id>/projects/<project_id> — Edit a project ──────
@portfolio_bp.route("/<user_id>/projects/<project_id>", methods=["PUT"])
@jwt_required()
def update_portfolio_project(user_id, project_id):
    current = get_current_user()
    if current.id != user_id:
        return error("Forbidden", 403)

    p = Portfolio.query.filter_by(user_id=user_id).first()
    if not p:
        return error("Portfolio not found", 404)

    proj = PortfolioProject.query.filter_by(
        id=project_id, portfolio_id=p.id
    ).first()
    if not proj:
        return error("Project not found", 404)

    data = request.get_json(silent=True) or {}
    if "title"       in data: proj.title       = data["title"]
    if "description" in data: proj.description = data["description"]
    if "role"        in data: proj.role        = data["role"]
    if "is_featured" in data: proj.is_featured = bool(data["is_featured"])

    db.session.commit()
    return success(proj.to_dict(), "Project updated")


# ── DELETE /api/portfolio/<user_id>/projects/<project_id> — Delete a project ─
@portfolio_bp.route("/<user_id>/projects/<project_id>", methods=["DELETE"])
@jwt_required()
def delete_portfolio_project(user_id, project_id):
    current = get_current_user()
    if current.id != user_id:
        return error("Forbidden", 403)

    p = Portfolio.query.filter_by(user_id=user_id).first()
    if not p:
        return error("Portfolio not found", 404)

    proj = PortfolioProject.query.filter_by(
        id=project_id, portfolio_id=p.id
    ).first()
    if not proj:
        return error("Project not found", 404)

    db.session.delete(proj)
    db.session.commit()
    return success(None, "Project deleted")