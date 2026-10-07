import os
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.models import User, Receipt, Transaction
from app.routers.deps import get_current_active_user

router = APIRouter(tags=["Media"])

MEDIA_DIR = os.path.realpath(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "media"))
RECEIPTS_DIR = os.path.realpath(os.path.join(MEDIA_DIR, "receipts"))
os.makedirs(RECEIPTS_DIR, exist_ok=True)

ALLOWED_MEDIA_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
MIME_TYPE_MAP = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf"
}

@router.get("/media/receipts/{receipt_filename}")
async def get_receipt_media(
    receipt_filename: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Securely streams a receipt file exclusively to the authenticated owner.
    Validates against directory traversal, extension whitelist, and tenant ownership.
    """
    # 1. Path traversal check: must be a bare filename without directory traversal components
    clean_filename = os.path.basename(receipt_filename)
    if clean_filename != receipt_filename or ".." in receipt_filename or "/" in receipt_filename or "\\" in receipt_filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file identifier."
        )

    # 2. Extension validation
    ext = os.path.splitext(clean_filename)[1].lower()
    if ext not in ALLOWED_MEDIA_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported media format."
        )

    # 3. Canonical path verification: must reside strictly inside RECEIPTS_DIR or MEDIA_DIR
    target_path = os.path.realpath(os.path.join(RECEIPTS_DIR, clean_filename))
    if not (target_path.startswith(MEDIA_DIR) and os.path.isfile(target_path)):
        target_path = os.path.realpath(os.path.join(MEDIA_DIR, clean_filename))
        if not (target_path.startswith(MEDIA_DIR) and os.path.isfile(target_path)):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Receipt media not found."
            )

    # 4. Multi-tenant authorization check: Receipt must belong to current_user
    receipt_res = await db.execute(
        select(Receipt).where(
            (Receipt.user_id == current_user.id) &
            (Receipt.file_url.contains(clean_filename))
        )
    )
    receipt = receipt_res.scalar_one_or_none()
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt media not found or access denied."
        )

    media_type = MIME_TYPE_MAP.get(ext, "application/octet-stream")

    return FileResponse(
        path=target_path,
        media_type=media_type,
        headers={
            "Content-Disposition": f"inline; filename=\"{clean_filename}\"",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-cache, no-store, must-revalidate"
        }
    )

@router.get("/transactions/{txn_id}/receipt")
async def get_transaction_receipt(
    txn_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Securely retrieves the receipt file attached to a specific transaction.
    Enforces multi-tenant ownership validation on both transaction and receipt.
    """
    txn_res = await db.execute(
        select(Transaction).where(
            (Transaction.id == txn_id) & (Transaction.user_id == current_user.id)
        )
    )
    txn = txn_res.scalar_one_or_none()
    if not txn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found or access denied."
        )

    receipt_res = await db.execute(
        select(Receipt).where(
            (Receipt.transaction_id == txn_id) & (Receipt.user_id == current_user.id)
        )
    )
    receipt = receipt_res.scalar_one_or_none()
    if not receipt or not receipt.file_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No receipt attached to this transaction."
        )

    clean_filename = os.path.basename(receipt.file_url)
    target_path = os.path.realpath(os.path.join(MEDIA_DIR, clean_filename))
    if not target_path.startswith(MEDIA_DIR) or not os.path.isfile(target_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt file not found on disk."
        )

    ext = os.path.splitext(clean_filename)[1].lower()
    media_type = MIME_TYPE_MAP.get(ext, "application/octet-stream")

    return FileResponse(
        path=target_path,
        media_type=media_type,
        headers={
            "Content-Disposition": f"inline; filename=\"{clean_filename}\"",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-cache, no-store, must-revalidate"
        }
    )
