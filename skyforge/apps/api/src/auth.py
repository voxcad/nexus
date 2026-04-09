import logging

import firebase_admin
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth, credentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.db import get_db
from src.models import User

logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK once
try:
    firebase_admin.get_app()
except ValueError:
    if settings.firebase_project_id:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {"projectId": settings.firebase_project_id})

bearer_scheme = HTTPBearer()


async def verify_firebase_token(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """Verify Firebase ID token from Authorization header."""
    try:
        decoded = auth.verify_id_token(creds.credentials)
        return decoded
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed")


async def get_or_create_user(
    token: dict = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get existing user by firebase_uid or create on first login."""
    result = await db.execute(select(User).where(User.firebase_uid == token["uid"]))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            firebase_uid=token["uid"],
            email=token.get("email", ""),
            full_name=token.get("name", ""),
        )
        db.add(user)
        await db.flush()

    return user
