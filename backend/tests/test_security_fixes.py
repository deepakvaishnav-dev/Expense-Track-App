import pytest
from datetime import datetime, timedelta, timezone
import uuid
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException
from app.services.auth_service import auth_service
from app.models.models import User, PasswordResetToken, Account, Transaction
from app.schemas.schemas import PasswordResetConfirm, TransactionCreate, TransactionUpdate
from app.routers.auth import confirm_password_reset
from app.routers.media import get_receipt_media

def test_password_reset_token_entropy_and_format():
    """Verify reset token generation generates high entropy, urlsafe strings."""
    tokens = set()
    for _ in range(50):
        t = auth_service.generate_reset_token()
        assert len(t) >= 40
        assert "/" not in t and "+" not in t  # URL-safe check
        tokens.add(t)
    assert len(tokens) == 50  # Zero collisions

def test_password_reset_token_sha256_hashing():
    """Verify SHA-256 hash generation is 64 hex characters and whitespace stripped."""
    raw_token = "   abc123XYZ_secret_token   "
    h1 = auth_service.hash_reset_token(raw_token)
    h2 = auth_service.hash_reset_token(raw_token.strip())
    
    assert len(h1) == 64
    assert h1 == h2
    assert all(c in "0123456789abcdef" for c in h1)

@pytest.mark.asyncio
async def test_confirm_password_reset_rejects_empty_token():
    """Verify empty/missing token is rejected immediately."""
    mock_db = AsyncMock()
    req = PasswordResetConfirm(token="   ", new_password="NewSecurePassword123!")
    
    with pytest.raises(HTTPException) as exc_info:
        await confirm_password_reset(req, db=mock_db)
    assert exc_info.value.status_code == 400
    assert "Invalid or expired" in exc_info.value.detail

@pytest.mark.asyncio
async def test_confirm_password_reset_rejects_nonexistent_token():
    """Verify invalid token hashes yield 400."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    req = PasswordResetConfirm(token="invalid_random_token", new_password="NewSecurePassword123!")
    with pytest.raises(HTTPException) as exc_info:
        await confirm_password_reset(req, db=mock_db)
    assert exc_info.value.status_code == 400

@pytest.mark.asyncio
async def test_confirm_password_reset_rejects_used_token():
    """Verify already-used token is rejected."""
    mock_db = AsyncMock()
    used_token = PasswordResetToken(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        token_hash="fakehash",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        is_used=True
    )
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = used_token
    mock_db.execute.return_value = mock_result

    req = PasswordResetConfirm(token="already_used_token", new_password="NewSecurePassword123!")
    with pytest.raises(HTTPException) as exc_info:
        await confirm_password_reset(req, db=mock_db)
    assert exc_info.value.status_code == 400

@pytest.mark.asyncio
async def test_confirm_password_reset_rejects_expired_token():
    """Verify expired token is rejected and marked used."""
    mock_db = AsyncMock()
    expired_token = PasswordResetToken(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        token_hash="fakehash",
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=5),  # 5 min in past
        is_used=False
    )
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = expired_token
    mock_db.execute.return_value = mock_result

    req = PasswordResetConfirm(token="expired_token", new_password="NewSecurePassword123!")
    with pytest.raises(HTTPException) as exc_info:
        await confirm_password_reset(req, db=mock_db)
    assert exc_info.value.status_code == 400
    assert expired_token.is_used is True

@pytest.mark.asyncio
async def test_confirm_password_reset_success():
    """Verify valid token updates user password and consumes token atomically."""
    mock_db = AsyncMock()
    user_id = uuid.uuid4()
    valid_token = PasswordResetToken(
        id=uuid.uuid4(),
        user_id=user_id,
        token_hash="fakehash",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        is_used=False
    )
    user = User(
        id=user_id,
        email="test@example.com",
        password_hash="old_hash",
        full_name="Test User",
        is_active=True
    )

    # First call returns token, second call returns user
    mock_token_res = MagicMock()
    mock_token_res.scalar_one_or_none.return_value = valid_token
    mock_user_res = MagicMock()
    mock_user_res.scalar_one_or_none.return_value = user

    mock_db.execute.side_effect = [mock_token_res, mock_user_res]

    req = PasswordResetConfirm(token="valid_token_123", new_password="NewSecretPassword999!")
    res = await confirm_password_reset(req, db=mock_db)

    assert res["detail"] == "Password successfully updated."
    assert valid_token.is_used is True
    assert user.password_hash != "old_hash"
    assert auth_service.verify_password("NewSecretPassword999!", user.password_hash) is True
    assert mock_db.commit.called

@pytest.mark.asyncio
async def test_media_path_traversal_prevention():
    """Verify path traversal patterns and unallowed file extensions are rejected with 400."""
    dummy_user = User(id=uuid.uuid4(), is_active=True)
    mock_db = AsyncMock()

    # Traversal with ..
    with pytest.raises(HTTPException) as exc_info:
        await get_receipt_media("../../etc/passwd", current_user=dummy_user, db=mock_db)
    assert exc_info.value.status_code == 400
    assert "Invalid file identifier" in exc_info.value.detail

    # Traversal with forward slash
    with pytest.raises(HTTPException) as exc_info:
        await get_receipt_media("subfolder/image.jpg", current_user=dummy_user, db=mock_db)
    assert exc_info.value.status_code == 400

    # Unallowed extension (executable)
    with pytest.raises(HTTPException) as exc_info:
        await get_receipt_media("malicious.exe", current_user=dummy_user, db=mock_db)
    assert exc_info.value.status_code == 400
    assert "Unsupported media format" in exc_info.value.detail

    # Unallowed extension (script)
    with pytest.raises(HTTPException) as exc_info:
        await get_receipt_media("shell.sh", current_user=dummy_user, db=mock_db)
    assert exc_info.value.status_code == 400

@pytest.mark.asyncio
async def test_create_transaction_rejects_unowned_account():
    """Verify BOLA protection: user cannot create transaction on another user's account."""
    from app.routers.transactions import create_transaction
    from decimal import Decimal
    user = User(id=uuid.uuid4(), is_active=True)
    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = None  # Account not found for this user
    mock_db.execute.return_value = mock_res

    req = TransactionCreate(
        account_id=uuid.uuid4(),
        amount=Decimal("100.00"),
        merchant="Store",
        type="Expense",
        payment_method="UPI",
        date=datetime.now(timezone.utc)
    )

    with pytest.raises(HTTPException) as exc_info:
        await create_transaction(req, current_user=user, db=mock_db)
    assert exc_info.value.status_code == 404
    assert "Account not found or access denied" in exc_info.value.detail

@pytest.mark.asyncio
async def test_update_transaction_rejects_unowned_target_account():
    """Verify BOLA protection: user cannot move transaction to an account they don't own."""
    from app.routers.transactions import update_transaction
    from decimal import Decimal
    user = User(id=uuid.uuid4(), is_active=True)
    mock_db = AsyncMock()
    orig_account_id = uuid.uuid4()
    victim_account_id = uuid.uuid4()

    db_txn = Transaction(
        id=uuid.uuid4(),
        user_id=user.id,
        account_id=orig_account_id,
        amount=Decimal("50.00"),
        type="Expense"
    )
    orig_account = Account(id=orig_account_id, user_id=user.id, balance=500.0)

    # 1. Transaction found
    res1 = MagicMock()
    res1.scalar_one_or_none.return_value = db_txn
    # 2. Original account found
    res2 = MagicMock()
    res2.scalar_one_or_none.return_value = orig_account
    # 3. Target account NOT found for current_user (belongs to victim)
    res3 = MagicMock()
    res3.scalar_one_or_none.return_value = None

    mock_db.execute.side_effect = [res1, res2, res3]

    req = TransactionUpdate(account_id=victim_account_id)
    with pytest.raises(HTTPException) as exc_info:
        await update_transaction(db_txn.id, req, current_user=user, db=mock_db)
    assert exc_info.value.status_code == 404
    assert "Target account not found or access denied" in exc_info.value.detail

@pytest.mark.asyncio
async def test_update_subscription_rejects_unowned_target_account():
    """Verify BOLA protection: user cannot update subscription to unowned account."""
    from app.routers.subscriptions import update_subscription
    from app.models.models import Subscription
    from app.schemas.schemas import SubscriptionUpdate
    from decimal import Decimal
    user = User(id=uuid.uuid4(), is_active=True)
    mock_db = AsyncMock()

    db_sub = Subscription(
        id=uuid.uuid4(),
        user_id=user.id,
        account_id=uuid.uuid4(),
        category_id=uuid.uuid4(),
        name="Netflix",
        amount=Decimal("499.00"),
        billing_period="Monthly",
        next_billing_date=datetime.now(timezone.utc)
    )

    # 1. Subscription found
    res1 = MagicMock()
    res1.scalar_one_or_none.return_value = db_sub
    # 2. Account check returns None
    res2 = MagicMock()
    res2.scalar_one_or_none.return_value = None

    mock_db.execute.side_effect = [res1, res2]

    req = SubscriptionUpdate(account_id=uuid.uuid4())
    with pytest.raises(HTTPException) as exc_info:
        await update_subscription(db_sub.id, req, current_user=user, db=mock_db)
    assert exc_info.value.status_code == 404
    assert "Linked Account not found or access denied" in exc_info.value.detail


def test_csv_formula_injection_sanitization():
    """Verify formula injection triggers (=, +, -, @, \\t, \\r) are safely neutralized."""
    from app.services.document_service import _sanitize_csv_cell

    # Dangerous spreadsheet formulas
    assert _sanitize_csv_cell("=cmd|'/C calc'!A0") == "'=cmd|'/C calc'!A0"
    assert _sanitize_csv_cell("@SUM(1+1)") == "'@SUM(1+1)"
    assert _sanitize_csv_cell("+1234567890") == "'+1234567890"
    assert _sanitize_csv_cell("-12345") == "'-12345"
    assert _sanitize_csv_cell("\tleadingtab") == "'\tleadingtab"
    assert _sanitize_csv_cell("\rleadingreturn") == "'\rleadingreturn"

    # Benign string inputs
    assert _sanitize_csv_cell("Starbucks Coffee") == "Starbucks Coffee"
    assert _sanitize_csv_cell("Groceries at Mart") == "Groceries at Mart"
    assert _sanitize_csv_cell("") == ""
    assert _sanitize_csv_cell(None) == ""


def test_csv_export_utf8_sig_and_formula_escaping():
    """Verify generated CSV includes UTF-8-SIG BOM and escapes formula cells."""
    from app.services.document_service import DocumentService
    from decimal import Decimal

    malicious_txn = Transaction(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        account_id=uuid.uuid4(),
        amount=Decimal("1500.00"),
        merchant="=cmd|'/C powershell'!A0",
        notes="@DDE('cmd';'whoami')",
        type="Expense",
        payment_method="UPI",
        date=datetime(2026, 6, 25, 12, 0, 0, tzinfo=timezone.utc),
        is_recurring=False,
        ref_number="+919876543210"
    )

    csv_bytes = DocumentService.generate_csv([malicious_txn])

    # Must start with UTF-8-SIG BOM
    assert csv_bytes.startswith(b"\xef\xbb\xbf")
    csv_text = csv_bytes.decode("utf-8-sig")

    # Formula characters must be single-quote prefixed
    assert "'=cmd|'/C powershell'!A0" in csv_text
    assert "'@DDE('cmd';'whoami')" in csv_text
    assert "'+919876543210" in csv_text


def test_magic_byte_verification():
    """Verify image magic bytes inspection accepts valid formats and rejects disguised payloads."""
    from app.routers.ai import detect_image_mime_and_extension

    # Valid JPEG
    jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01"
    mime, ext = detect_image_mime_and_extension(jpeg_bytes)
    assert mime == "image/jpeg"
    assert ext == ".jpg"

    # Valid PNG
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    mime, ext = detect_image_mime_and_extension(png_bytes)
    assert mime == "image/png"
    assert ext == ".png"

    # Valid WebP
    webp_bytes = b"RIFF\x20\x00\x00\x00WEBPVP8 "
    mime, ext = detect_image_mime_and_extension(webp_bytes)
    assert mime == "image/webp"
    assert ext == ".webp"

    # Reject Windows PE Executable
    pe_bytes = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00"
    with pytest.raises(HTTPException) as exc_info:
        detect_image_mime_and_extension(pe_bytes)
    assert exc_info.value.status_code == 400

    # Reject HTML script
    html_bytes = b"<html><script>alert(1)</script></html>"
    with pytest.raises(HTTPException) as exc_info:
        detect_image_mime_and_extension(html_bytes)
    assert exc_info.value.status_code == 400

    # Reject Bash script
    sh_bytes = b"#!/bin/bash\nrm -rf /"
    with pytest.raises(HTTPException) as exc_info:
        detect_image_mime_and_extension(sh_bytes)
    assert exc_info.value.status_code == 400


def test_production_secrets_fail_fast_validation():
    """Verify Settings rejects default placeholder keys in production mode."""
    from app.config import Settings

    # Production with default keys must fail immediately
    with pytest.raises(ValueError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="supersecretaccesskeychangeitinproduction1234567890",
            REFRESH_SECRET_KEY="supersecretrefreshkeychangeitinproduction0987654321",
            ENCRYPTION_KEY="y1B9N8Wq6M4w8E-XjA4Vn5K6jV4W4l7R4x1D8f9V2s0="
        )
    assert "CRITICAL PRODUCTION SECURITY ERROR" in str(exc_info.value)

    # Production with short key (<32 chars) must fail
    with pytest.raises(ValueError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="shortkey",
            REFRESH_SECRET_KEY="shortrefresh",
            ENCRYPTION_KEY="shortenc"
        )
    assert "CRITICAL PRODUCTION SECURITY ERROR" in str(exc_info.value)

    # Production with strong, distinct secrets must succeed
    prod_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="k" * 40,
        REFRESH_SECRET_KEY="r" * 40,
        ENCRYPTION_KEY="e" * 40
    )
    assert prod_settings.ENVIRONMENT == "production"


