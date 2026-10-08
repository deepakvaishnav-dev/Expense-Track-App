from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, desc
from app.db.session import get_db
from app.models.models import User, Receipt, Transaction, Account, Category
from app.schemas.schemas import ReceiptOCRResponse, TransactionResponse
from app.services.ai_service import ai_service
from app.services.budget_monitor import budget_monitor
from app.routers.deps import get_current_active_user
import uuid
import os
import shutil
from datetime import datetime, timezone
from decimal import Decimal
import google.generativeai as genai
from app.config import settings
from pydantic import BaseModel


router = APIRouter(prefix="/ai", tags=["AI Integration"])

# Secure Media storage boundaries
MEDIA_DIR = os.path.realpath(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "media"))
RECEIPTS_DIR = os.path.realpath(os.path.join(MEDIA_DIR, "receipts"))
os.makedirs(RECEIPTS_DIR, exist_ok=True)

MAX_UPLOAD_SIZE = 20 * 1024 * 1024  # 20 MB ceiling

def detect_image_mime_and_extension(data: bytes) -> tuple[str, str]:
    """
    Validates binary header signatures (magic bytes) to strictly verify image types.
    Prevents binary polyglots and disguises.
    Returns (mime_type, file_extension) or raises HTTPException(400).
    """
    if len(data) >= 3 and data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", ".jpg"
    elif len(data) >= 8 and data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", ".png"
    elif len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", ".webp"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Binary signature must match JPEG, PNG, or WebP."
        )

@router.post("/scan-receipt", response_model=TransactionResponse)
async def scan_receipt(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Accepts a receipt image, verifies magic bytes, enforces 20MB limit, saves to receipts dir,
    performs Gemini-driven OCR, creates transaction, updates accounts with row lock, and links receipt.
    """
    # 1. Read file bytes and enforce strict 20MB file size limit
    img_bytes = await file.read()
    if len(img_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds the 20MB upload limit."
        )
    if len(img_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    # 2. Validate binary magic-byte signatures
    validated_mime, validated_ext = detect_image_mime_and_extension(img_bytes)

    # 3. Discard client filename, generate cryptographically random UUID filename
    saved_filename = f"{uuid.uuid4().hex}{validated_ext}"
    local_path = os.path.realpath(os.path.join(RECEIPTS_DIR, saved_filename))

    # Path traversal verification
    if not local_path.startswith(RECEIPTS_DIR):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid destination storage path."
        )

    try:
        with open(local_path, "wb") as buffer:
            buffer.write(img_bytes)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store receipt image securely: {e}"
        )

    # 4. Read validated bytes and execute Gemini OCR extraction
    extracted: ReceiptOCRResponse = ai_service.scan_receipt(img_bytes, validated_mime)

    # 4. Query user accounts to resolve payment account with row-level locking
    accounts_res = await db.execute(
        select(Account).where(Account.user_id == current_user.id).with_for_update()
    )
    user_accounts = accounts_res.scalars().all()
    if not user_accounts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No financial accounts configured. Set up an account before uploading receipts."
        )

    # Resolve account
    target_account = user_accounts[0]  # Fallback
    if extracted.payment_method:
        for acc in user_accounts:
            if extracted.payment_method.lower() in acc.name.lower() or extracted.payment_method.lower() in acc.type.lower():
                target_account = acc
                break

    # 5. Resolve category (system fallback or matching name)
    cat_res = await db.execute(
        select(Category).where(
            (Category.name.ilike("Others")) & (Category.user_id == None)
        )
    )
    fallback_category = cat_res.scalar_one_or_none()

    # 6. Create Transaction
    amount = Decimal(str(extracted.amount))
    target_account.balance -= float(amount)  # Receipt is always an Expense

    db_txn = Transaction(
        user_id=current_user.id,
        account_id=target_account.id,
        category_id=fallback_category.id if fallback_category else None,
        amount=amount,
        merchant=extracted.merchant or "Receipt Merchant",
        type="Expense",
        notes=f"Receipt scan. Extracted payment method: {extracted.payment_method}. Items: {len(extracted.items)} details.",
        payment_method=extracted.payment_method or "Cash",
        date=datetime.now(timezone.utc),
        raw_source="Receipt"
    )
    db.add(target_account)
    db.add(db_txn)
    await db.flush()  # Flush to generate db_txn.id

    # 7. Create Receipt details and link to Transaction with authenticated URL
    db_receipt = Receipt(
        user_id=current_user.id,
        transaction_id=db_txn.id,
        file_url=f"/api/media/receipts/{saved_filename}",
        raw_ocr_text=f"Merchant: {extracted.merchant}\nTotal: {extracted.amount}\nItems count: {len(extracted.items)}",
        extracted_data=extracted.model_dump()
    )
    db.add(db_receipt)
    await db.commit()
    await db.refresh(db_txn)

    # Re-evaluate budget alerts
    if fallback_category:
        await budget_monitor.evaluate_transaction_for_alerts(
            db, current_user.id, fallback_category.id
        )

    return db_txn


class AIChatRequest(BaseModel):
    message: str


class AIChatResponse(BaseModel):
    response: str


@router.post("/chat", response_model=AIChatResponse)
async def ai_chat(
    req: AIChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Accepts user text message, gathers context about their recent transactions,
    and asks AI to generate an answer about their spending.
    """
    # Fetch last 150 transactions for context
    txn_res = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .order_by(desc(Transaction.date))
        .limit(150)
    )
    txns = txn_res.scalars().all()

    # Fetch all categories to map IDs to Names
    cat_res = await db.execute(select(Category))
    categories = cat_res.scalars().all()
    cat_map = {c.id: c.name for c in categories}

    txns_text = ""
    for t in txns:
        cat_name = cat_map.get(t.category_id, "Others")
        date_str = t.date.strftime("%Y-%m-%d") if t.date else "Unknown Date"
        txns_text += f"- {date_str}: {t.merchant or 'Unknown Merchant'} | Amount: ₹{t.amount} | Category: {cat_name} | Method: {t.payment_method} | Notes: {t.notes or ''}\n"

    if not settings.GEMINI_API_KEY:
        return AIChatResponse(
            response="I'm sorry, my AI capabilities are currently running in offline fallback mode since the API Key is not configured. But from your records, it seems you have logged some expenses recently!"
        )

    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.5-flash")
        current_date_str = datetime.now().strftime("%Y-%m-%d")
        
        prompt = (
            f"You are a helpful AI financial coach for an expense tracker app called Expense Tracker AI.\n"
            f"User Profile Name: {current_user.full_name}\n"
            f"Current Date: {current_date_str}\n\n"
            f"Here are the user's recent transactions (up to 150):\n"
            f"{txns_text}\n\n"
            f"User's Question: \"{req.message}\"\n\n"
            f"Provide a friendly, conversational response. Analyze the transactions list to answer their question accurately. "
            f"If they ask for coffee spending, look for transactions with 'coffee', 'starbucks', etc. "
            f"Be concise (1-3 sentences) and format amounts in Rupees (e.g. ₹150) if Indian Rupees, or match the user's request. "
            f"Keep it extremely professional and helpful."
        )
        response = model.generate_content(prompt)
        return AIChatResponse(response=response.text.strip())
    except Exception as e:
        print(f"AI Chat Error: {e}")
        return AIChatResponse(response="I encountered an issue analyzing your transactions. Please try again.")

