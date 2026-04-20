from app import db
from app.models import (
    Question, QuestionBank, Resource, Topic, Project,
    DifficultyLevel, QuestionType,
)

VALID_DIFFICULTIES = {
    DifficultyLevel.BEGINNER,
    DifficultyLevel.INTERMEDIATE,
    DifficultyLevel.ADVANCED,
}

VALID_QUESTION_TYPES = {
    QuestionType.MCQ,
    QuestionType.MULTI_SELECT,
    QuestionType.SHORT_ANSWER,
    QuestionType.TRUE_FALSE,
    QuestionType.CODING,
}

def _check_difficulty(value):
    if value not in VALID_DIFFICULTIES:
        raise ValueError(f"difficulty must be one of: {sorted(VALID_DIFFICULTIES)}")

def _check_question_type(value):
    if value not in VALID_QUESTION_TYPES:
        raise ValueError(f"question_type must be one of: {sorted(VALID_QUESTION_TYPES)}")

def _validate_answer(data: dict):
    errors  = []
    qtype   = data.get("question_type", QuestionType.MCQ)
    options = data.get("options", [])
    answer  = data.get("correct_answer")

    if qtype == QuestionType.MCQ:
        if not options or len(options) < 2:
            errors.append("MCQ requires at least 2 options.")
        elif answer not in options:
            errors.append("correct_answer must be one of the provided options.")
    elif qtype == QuestionType.MULTI_SELECT:
        if not options or len(options) < 2:
            errors.append("multi_select requires at least 2 options.")
        if not isinstance(answer, list) or not answer:
            errors.append("multi_select correct_answer must be a non-empty list.")
        elif not all(a in options for a in answer):
            errors.append("All correct_answer values must appear in options.")
    elif qtype == QuestionType.TRUE_FALSE:
        if answer not in (True, False, "true", "false"):
            errors.append("true_false correct_answer must be true or false.")
    elif qtype == QuestionType.SHORT_ANSWER:
        if not isinstance(answer, str) or not answer.strip():
            errors.append("short_answer correct_answer must be a non-empty string.")

    return errors

def _get_resources(resource_ids):
    if not resource_ids:
        return []
    resources = Resource.query.filter(Resource.id.in_(resource_ids)).all()
    if len(resources) != len(resource_ids):
        raise ValueError("One or more resource_ids not found.")
    return resources

def _get_topics(topic_ids):
    if not topic_ids:
        return []
    topics = Topic.query.filter(Topic.id.in_(topic_ids)).all()
    if len(topics) != len(topic_ids):
        raise ValueError("One or more topic_ids not found.")
    return topics

# ── QuestionBank ──────────────────────────────────────────────────────────────

def create_bank(data, user_id):
    if not Project.query.get(data.get("project_id")):
        raise ValueError("project_id not found.")
    bank = QuestionBank(
        project_id       = data["project_id"],
        created_by       = user_id,
        title            = data["title"],
        description      = data.get("description"),
        min_beginner     = data.get("min_beginner", 0),
        min_intermediate = data.get("min_intermediate", 0),
        min_advanced     = data.get("min_advanced", 0),
    )
    if "topic_ids" in data:
        bank.topics = _get_topics(data["topic_ids"])
    db.session.add(bank)
    db.session.commit()
    return bank

def update_bank(bank_id, data):
    bank = QuestionBank.query.get_or_404(bank_id)
    for field in ("title", "description", "min_beginner", "min_intermediate",
                  "min_advanced", "is_active"):
        if field in data:
            setattr(bank, field, data[field])
    if "topic_ids" in data:
        bank.topics = _get_topics(data["topic_ids"])
    db.session.commit()
    return bank

def delete_bank(bank_id):
    bank = QuestionBank.query.get_or_404(bank_id)
    bank.is_active = False
    db.session.commit()

def get_banks(project_id=None, active_only=True, page=1, per_page=20):
    q = QuestionBank.query
    if active_only:
        q = q.filter_by(is_active=True)
    if project_id:
        q = q.filter_by(project_id=project_id)
    return q.order_by(QuestionBank.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

def validate_bank(bank_id):
    bank   = QuestionBank.query.get_or_404(bank_id)
    errors = bank.validate_difficulty_quotas()
    return {
        "valid":  len(errors) == 0,
        "errors": errors,
        "counts": bank.difficulty_counts(),
        "quotas": {
            "min_beginner":     bank.min_beginner,
            "min_intermediate": bank.min_intermediate,
            "min_advanced":     bank.min_advanced,
        },
    }

# ── Question ──────────────────────────────────────────────────────────────────

def create_question(data, user_id):
    _check_difficulty(data.get("difficulty", DifficultyLevel.BEGINNER))
    _check_question_type(data.get("question_type", QuestionType.MCQ))
    errors = _validate_answer(data)
    if errors:
        raise ValueError(" | ".join(errors))
    bank  = QuestionBank.query.get_or_404(data["bank_id"])
    topic = Topic.query.get_or_404(data["topic_id"])

    # Allow any topic from the same project
    if topic.project_id != bank.project_id:
        raise ValueError("topic_id does not belong to this project.")

    question = Question(
        bank_id            = data["bank_id"],
        topic_id           = data["topic_id"],
        created_by         = user_id,
        text               = data["text"],
        question_type      = data.get("question_type", QuestionType.MCQ),
        difficulty         = data.get("difficulty", DifficultyLevel.BEGINNER),
        options            = data.get("options", []),
        correct_answer     = data.get("correct_answer"),
        explanation        = data.get("explanation"),
        points             = data.get("points", 1),
        time_limit_seconds = data.get("time_limit_seconds"),
        tags               = data.get("tags", []),
    )
    if "resource_ids" in data:
        question.resources = _get_resources(data["resource_ids"])
    db.session.add(question)
    db.session.commit()
    return question

def update_question(question_id, data, user_id):
    question = Question.query.get_or_404(question_id)
    for field in ("text", "question_type", "difficulty", "options", "correct_answer",
                  "explanation", "points", "time_limit_seconds", "tags", "is_active"):
        if field in data:
            if field == "difficulty":
                _check_difficulty(data[field])
            if field == "question_type":
                _check_question_type(data[field])
            setattr(question, field, data[field])
    merged = {
        "question_type":  question.question_type,
        "options":        question.options,
        "correct_answer": question.correct_answer,
        **data,
    }
    errors = _validate_answer(merged)
    if errors:
        db.session.rollback()
        raise ValueError(" | ".join(errors))
    if "resource_ids" in data:
        question.resources = _get_resources(data["resource_ids"])
    db.session.commit()
    return question

def delete_question(question_id):
    question = Question.query.get_or_404(question_id)
    question.is_active = False
    db.session.commit()

def get_questions(bank_id=None, topic_id=None, difficulty=None,
                  question_type=None, active_only=True, page=1, per_page=20):
    q = Question.query
    if active_only:
        q = q.filter_by(is_active=True)
    if bank_id:
        q = q.filter_by(bank_id=bank_id)
    if topic_id:
        q = q.filter_by(topic_id=topic_id)
    if difficulty:
        _check_difficulty(difficulty)
        q = q.filter_by(difficulty=difficulty)
    if question_type:
        _check_question_type(question_type)
        q = q.filter_by(question_type=question_type)
    return q.order_by(Question.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )