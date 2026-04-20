from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from . import service

question_bank_bp = Blueprint("question_bank", __name__, url_prefix="/api/question-bank")

def _paginated(pagination, fn):
    return jsonify({
        "items":    [fn(item) for item in pagination.items],
        "total":    pagination.total,
        "page":     pagination.page,
        "pages":    pagination.pages,
        "per_page": pagination.per_page,
    })

def _err(msg, code=400):
    return jsonify({"error": msg}), code


# ── Question Banks ─────────────────────────────────────────────────────────────

@question_bank_bp.route("/banks", methods=["GET"])
@jwt_required()
def list_banks():
    pagination = service.get_banks(
        project_id = request.args.get("project_id"),
        page       = int(request.args.get("page", 1)),
        per_page   = int(request.args.get("per_page", 20)),
    )
    return _paginated(pagination, lambda b: b.to_dict())

@question_bank_bp.route("/banks/<bank_id>", methods=["GET"])
@jwt_required()
def get_bank(bank_id):
    from app.models import QuestionBank
    bank = QuestionBank.query.get_or_404(bank_id)
    include_q = request.args.get("include_questions", "false").lower() == "true"
    return jsonify(bank.to_dict(include_questions=include_q))

@question_bank_bp.route("/banks", methods=["POST"])
@jwt_required()
def create_bank():
    data = request.get_json(silent=True)
    if not data:
        return _err("JSON body required.")
    if not data.get("title"):
        return _err("'title' is required.")
    if not data.get("project_id"):
        return _err("'project_id' is required.")
    try:
        bank = service.create_bank(data, user_id=get_jwt_identity())
    except ValueError as e:
        return _err(str(e))
    return jsonify(bank.to_dict()), 201

@question_bank_bp.route("/banks/<bank_id>", methods=["PUT"])
@jwt_required()
def update_bank(bank_id):
    data = request.get_json(silent=True) or {}
    try:
        bank = service.update_bank(bank_id, data)
    except ValueError as e:
        return _err(str(e))
    return jsonify(bank.to_dict())

@question_bank_bp.route("/banks/<bank_id>", methods=["DELETE"])
@jwt_required()
def delete_bank(bank_id):
    service.delete_bank(bank_id)
    return jsonify({"message": "Question bank deactivated."}), 200

@question_bank_bp.route("/banks/<bank_id>/validate", methods=["GET"])
@jwt_required()
def validate_bank(bank_id):
    result = service.validate_bank(bank_id)
    return jsonify(result), (200 if result["valid"] else 422)


# ── Questions ──────────────────────────────────────────────────────────────────

@question_bank_bp.route("/questions", methods=["GET"])
@jwt_required()
def list_questions():
    try:
        pagination = service.get_questions(
            bank_id       = request.args.get("bank_id"),
            topic_id      = request.args.get("topic_id"),
            difficulty    = request.args.get("difficulty"),
            question_type = request.args.get("question_type"),
            page          = int(request.args.get("page", 1)),
            per_page      = int(request.args.get("per_page", 20)),
        )
    except ValueError as e:
        return _err(str(e))
    return _paginated(pagination, lambda q: q.to_dict())

@question_bank_bp.route("/questions/<question_id>", methods=["GET"])
@jwt_required()
def get_question(question_id):
    from app.models import Question
    question = Question.query.get_or_404(question_id)
    include_answer = request.args.get("include_answer", "false").lower() == "true"
    return jsonify(question.to_dict(include_answer=include_answer))

@question_bank_bp.route("/questions", methods=["POST"])
@jwt_required()
def create_question():
    data = request.get_json(silent=True)
    if not data:
        return _err("JSON body required.")
    for field in ("bank_id", "topic_id", "text"):
        if not data.get(field):
            return _err(f"'{field}' is required.")
    try:
        question = service.create_question(data, user_id=get_jwt_identity())
    except ValueError as e:
        return _err(str(e))
    return jsonify(question.to_dict(include_answer=True)), 201

@question_bank_bp.route("/questions/<question_id>", methods=["PUT"])
@jwt_required()
def update_question(question_id):
    data = request.get_json(silent=True) or {}
    try:
        question = service.update_question(question_id, data, user_id=get_jwt_identity())
    except ValueError as e:
        return _err(str(e))
    return jsonify(question.to_dict(include_answer=True))

@question_bank_bp.route("/questions/<question_id>", methods=["DELETE"])
@jwt_required()
def delete_question(question_id):
    service.delete_question(question_id)
    return jsonify({"message": "Question deactivated."}), 200