"""create prompt history tables

Revision ID: 0001
Revises:
Create Date: 2026-07-10

"""
from alembic import op
from sqlalchemy import text

from app.modules.history.orm_prompt_history import PromptHistory
from app.modules.history.orm_professor_search_result import ProfessorSearchResult

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    PromptHistory.__table__.create(bind, checkfirst=True)
    ProfessorSearchResult.__table__.create(bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    ProfessorSearchResult.__table__.drop(bind, checkfirst=True)
    PromptHistory.__table__.drop(bind, checkfirst=True)
