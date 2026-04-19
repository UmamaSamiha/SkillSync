"""
SkillSync — Assignments API
============================
CRUD for assignments, submissions with file upload,
edit history tracking for AI paste detection,
and topic prerequisite enforcement.
"""

from datetime import datetime, timezone
from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required

from app import db
from app.models import (
    Assignment, Submission, SubmissionStatus,
    EditHistory, Topic, ActivityLog, Notification
)
from app.utils.helpers import (
    success, error, paginate, get_current_user,
    teacher_or_admin, allowed_file, save_upload, validate_required
)
from app.services.ai_detection import check_ai_similarity

assignments_bp = Blueprint("assignments", __name__)


# ── GET /api/assignments ──────────────────────────────────────────────────────

@assignments_bp.route("/", methods=["GET"])
@jwt_required()
def list_assignments():
    """List assignments. Filter by ?project_id= or ?topic_id="""
    query      = Assignment.query
    project_id = request.args.get("project_id")
    topic_id   = request.args.get("topic_id")

    if project_id:
        query = query.filter_by(project_id=project_id)
    if topic_id:
        query = query.filter_by(topic_id=topic_id)

    result = paginate(
        query.order_by(Assignment.due_date.asc()),
        lambda a: a.to_dict()
    )
    return success(result)


# ── POST /api/assignments ─────────────────────────────────────────────────────

@assignments_bp.route("/", methods=["POST"])
@jwt_required()
@teacher_or_admin
def create_assignment():
    """Create a new assignment (teacher/admin only)."""
    data    = request.get_json(silent=True) or {}
    missing = validate_required(data, ["project_id", "title"])
    if missing:
        return error(f"Missing: {', '.join(missing)}", 400)

    user = get_current_user()
    due_date = None
    if data.get("due_date"):
        try:
            due_date = datetime.fromisoformat(data["due_date"])
        except ValueError:
            return error("Invalid due_date format. Use ISO 8601.", 400)

    assignment = Assignment(
        project_id  = data["project_id"],
        topic_id    = data.get("topic_id"),
        created_by  = user.id,
        title       = data["title"].strip(),
        description = data.get("description", ""),
        due_date    = due_date,
        max_score   = float(data.get("max_score", 100)),
        difficulty  = data.get("difficulty", "intermediate"),
        allow_late  = bool(data.get("allow_late", False)),
    )
    db.session.add(assignment)
    db.session.commit()

    # Notify all project members
    _notify_project_members(
        assignment.project_id,
        title   = f"New assignment: {assignment.title}",
        message = f"A new assignment has been posted: {assignment.title}",
        type    = "deadline",
        entity_type = "assignment",
        entity_id   = assignment.id,
    )

    return success(assignment.to_dict(), "Assignment created", 201)


# ── GET /api/assignments/<id> ─────────────────────────────────────────────────

@assignments_bp.route("/<assignment_id>", methods=["GET"])
@jwt_required()
def get_assignment(assignment_id):
    a = Assignment.query.get_or_404(assignment_id)
    data = a.to_dict()
    data["submission_count"] = a.submissions.count()
    return success(data)


# ── PUT /api/assignments/<id> ─────────────────────────────────────────────────

@assignments_bp.route("/<assignment_id>", methods=["PUT"])
@jwt_required()
@teacher_or_admin
def update_assignment(assignment_id):
    a    = Assignment.query.get_or_404(assignment_id)
    data = request.get_json(silent=True) or {}

    if "title"       in data: a.title       = data["title"].strip()
    if "description" in data: a.description = data["description"]
    if "max_score"   in data: a.max_score   = float(data["max_score"])
    if "difficulty"  in data: a.difficulty  = data["difficulty"]
    if "allow_late"  in data: a.allow_late  = bool(data["allow_late"])
    if "due_date"    in data:
        a.due_date = datetime.fromisoformat(data["due_date"]) if data["due_date"] else None

    db.session.commit()
    return success(a.to_dict(), "Assignment updated")


# ── DELETE /api/assignments/<id> ──────────────────────────────────────────────

@assignments_bp.route("/<assignment_id>", methods=["DELETE"])
@jwt_required()
@teacher_or_admin
def delete_assignment(assignment_id):
    a = Assignment.query.get_or_404(assignment_id)
    db.session.delete(a)
    db.session.commit()
    return success(None, "Assignment deleted")


# ═══════════════════════════════════════════════════════
# SUBMISSIONS
# ═══════════════════════════════════════════════════════

# ── GET /api/assignments/<id>/submissions ─────────────────────────────────────

@assignments_bp.route("/<assignment_id>/submissions", methods=["GET"])
@jwt_required()
def list_submissions(assignment_id):
    """List all submissions for an assignment (teacher/admin sees all; students see own)."""
    user = get_current_user()
    query = Submission.query.filter_by(assignment_id=assignment_id)

    if user.role == "student":
        query = query.filter_by(student_id=user.id)

    result = paginate(query, lambda s: {
        **s.to_dict(),
        "student": s.student.to_dict() if user.role != "student" else None,
    })
    return success(result)


# ── POST /api/assignments/<id>/submissions ────────────────────────────────────

@assignments_bp.route("/<assignment_id>/submissions", methods=["POST"])
@jwt_required()
def submit_assignment(assignment_id):
    """
    Submit or update a draft submission.
    Supports JSON body (content) or multipart form (file upload).
    Enforces topic prerequisites before allowing submission.
    """
    user       = get_current_user()
    assignment = Assignment.query.get_or_404(assignment_id)
    now        = datetime.now(timezone.utc)

    # ── Prerequisite check ─────────────────────────────────────────────────
    if assignment.topic_id:
        topic = Topic.query.get(assignment.topic_id)
        if topic and topic.prerequisite_id:
            _check_prerequisite(user.id, topic.prerequisite_id, assignment.project_id)

    # ── Find or create submission ──────────────────────────────────────────
    submission = Submission.query.filter_by(
        assignment_id=assignment_id,
        student_id=user.id
    ).first()

    if not submission:
        submission = Submission(
            assignment_id=assignment_id,
            student_id=user.id,
            status=SubmissionStatus.DRAFT
        )
        db.session.add(submission)
        db.session.flush()

    # ── Handle file upload (multipart) ─────────────────────────────────────
    file_path = None
    if request.files.get("file"):
        file = request.files["file"]
        if not allowed_file(file.filename):
            return error("File type not allowed", 400)
        file_path = save_upload(file, subfolder=f"submissions/{assignment_id}/{user.id}")
        submission.file_path = f"/uploads/{file_path}"
        submission.file_name = file.filename

    # ── Handle JSON content ────────────────────────────────────────────────
    data = request.form.to_dict() if request.files else (request.get_json(silent=True) or {})
    new_content = data.get("content", submission.content or "")

    # ── Edit history & paste detection ─────────────────────────────────────
    if new_content and new_content != submission.content:
        old_len     = len(submission.content or "")
        new_len     = len(new_content)
        char_delta  = new_len - old_len
        large_paste = char_delta > current_app.config["AI_LARGE_PASTE_THRESHOLD"]

        version = submission.edit_history.count() + 1
        hist = EditHistory(
            submission_id    = submission.id,
            user_id          = user.id,
            content_snapshot = new_content,
            char_delta       = char_delta,
            is_large_paste   = large_paste,
            version_number   = version,
        )
        db.session.add(hist)
        submission.content = new_content

        if large_paste:
            # Flag submission and notify admin
            submission.flagged = True

    # ── Final submit (not just save) ───────────────────────────────────────
    if data.get("submit") in [True, "true", "1"]:
        is_late = assignment.due_date and now > assignment.due_date
        submission.status       = SubmissionStatus.SUBMITTED
        submission.submitted_at = now
        submission.is_late      = is_late

        # Run AI detection in background (simplified synchronous here)
        if submission.content:
            ai_score = check_ai_similarity(submission.content)
            submission.ai_score = ai_score
            if ai_score > current_app.config["AI_SIMILARITY_THRESHOLD"]:
                submission.flagged = True

        # Log activity
        log = ActivityLog(
            user_id=user.id, project_id=assignment.project_id,
            action_type="submission", entity_type="assignment",
            entity_id=assignment_id,
        )
        db.session.add(log)

    db.session.commit()
    return success(submission.to_dict(), "Submission saved", 200)


# ── GET /api/assignments/submissions/<id>/history ────────────────────────────

@assignments_bp.route("/submissions/<submission_id>/history", methods=["GET"])
@jwt_required()
def edit_history(submission_id):
    """
    Return the full edit timeline for a submission.
    Admin/teacher can compare versions; student can view own.
    """
    user       = get_current_user()
    submission = Submission.query.get_or_404(submission_id)

    if user.role == "student" and submission.student_id != user.id:
        return error("Forbidden", 403)

    history = submission.edit_history.order_by(EditHistory.version_number).all()
    return success([h.to_dict() for h in history])


# ── GET /api/assignments/submissions/<id>/diff ───────────────────────────────

@assignments_bp.route("/submissions/<submission_id>/diff", methods=["GET"])
@jwt_required()
@teacher_or_admin
def version_diff(submission_id):
    """
    Compare two versions of a submission.
    Query: ?v1=1&v2=2
    """
    import difflib
    v1_num = request.args.get("v1", type=int)
    v2_num = request.args.get("v2", type=int)

    submission = Submission.query.get_or_404(submission_id)
    hist = {h.version_number: h for h in submission.edit_history.all()}

    if v1_num not in hist or v2_num not in hist:
        return error("Version not found", 404)

    text1 = hist[v1_num].content_snapshot.splitlines(keepends=True)
    text2 = hist[v2_num].content_snapshot.splitlines(keepends=True)
    diff  = list(difflib.unified_diff(text1, text2, fromfile=f"v{v1_num}", tofile=f"v{v2_num}"))

    return success({
        "v1": hist[v1_num].to_dict(),
        "v2": hist[v2_num].to_dict(),
        "diff": "".join(diff),
    })


# ── PUT /api/assignments/submissions/<id>/grade ───────────────────────────────

@assignments_bp.route("/submissions/<submission_id>/grade", methods=["PUT"])
@jwt_required()
@teacher_or_admin
def grade_submission(submission_id):
    """Grade a submission and add feedback."""
    user       = get_current_user()
    submission = Submission.query.get_or_404(submission_id)
    data       = request.get_json(silent=True) or {}

    if "score" not in data:
        return error("Score is required", 400)

    score = float(data["score"])
    assignment = submission.assignment

    if score < 0 or score > assignment.max_score:
        return error(f"Score must be between 0 and {assignment.max_score}", 400)

    submission.score      = score
    submission.feedback   = data.get("feedback", "")
    submission.status     = SubmissionStatus.GRADED
    submission.graded_at  = datetime.now(timezone.utc)
    submission.graded_by  = user.id

    # Notify student
    n = Notification(
        user_id    = submission.student_id,
        title      = "Assignment graded",
        message    = f'Your submission for "{assignment.title}" received {score}/{assignment.max_score}.',
        type       = "grade",
        entity_type= "submission",
        entity_id  = submission.id,
    )
    db.session.add(n)
    db.session.commit()

    return success(submission.to_dict(), "Submission graded")


# ── HELPERS ───────────────────────────────────────────────────────────────────

def _check_prerequisite(user_id, prerequisite_topic_id, project_id):
    """
    Verify the user has achieved mastery on the prerequisite topic.
    Raises HTTP 403 if not unlocked.
    """
    from app.models import Submission, Assignment, Topic
    topic = Topic.query.get(prerequisite_topic_id)
    if not topic:
        return

    # Get all graded submissions for assignments in the prerequisite topic
    graded = (
        db.session.query(Submission)
        .join(Assignment)
        .filter(
            Assignment.topic_id == prerequisite_topic_id,
            Submission.student_id == user_id,
            Submission.status == SubmissionStatus.GRADED,
        )
        .all()
    )

    if not graded:
        raise PermissionError("Complete the prerequisite topic first")

    avg = sum(s.score / s.assignment.max_score * 100 for s in graded) / len(graded)
    if avg < topic.mastery_score:
        raise PermissionError(
            f"Achieve {topic.mastery_score}% mastery in '{topic.title}' to unlock this topic"
        )


def _notify_project_members(project_id, **kwargs):
    """Send a notification to all active members of a project."""
    from app.models import ProjectMember
    members = ProjectMember.query.filter_by(project_id=project_id, is_active=True).all()
    for m in members:
        n = Notification(user_id=m.user_id, **kwargs)
        db.session.add(n)