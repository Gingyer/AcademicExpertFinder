import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

_DATABASE_URL = os.environ.get("DATABASE_URL", "")

if not _DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL が環境変数に設定されていません。"
        ".env ファイルに DATABASE_URL=postgresql+... を設定してください。"
    )

engine = create_engine(
    _DATABASE_URL,
    pool_pre_ping=True,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ping_db() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
