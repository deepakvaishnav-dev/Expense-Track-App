from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import datetime, timezone
from typing import List, Optional
import random

from app.db.session import get_db
from app.models.models import User, KhataPerson, KhataTransaction
from app.schemas.schemas import (
    KhataPersonCreate,
    KhataPersonUpdate,
    KhataPersonResponse,
    KhataTransactionCreate,
    KhataTransactionUpdate,
    KhataTransactionResponse,
    KhataSummaryResponse,
    KhataSettleRequest,
    KhataTransactionCreateResponse,
    KhataBatchSyncRequest,
)
from app.routers.deps import get_current_active_user

router = APIRouter(prefix="/khata", tags=["Accounts Book (P2P Ledger)"])

AVATAR_COLORS = [
    "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899",
    "#06B6D4", "#F97316", "#6366F1", "#14B8A6"
]

def _build_person_response(person: KhataPerson) -> KhataPersonResponse:
    """
    Computes ledger totals and latest activity for a person.
    Utilizes pre-loaded transactions to avoid any extra queries.
    """
    gave = 0.0
    got = 0.0
    txns = getattr(person, "transactions", []) or []

    for t in txns:
        amt = float(t.amount or 0.0)
        if t.type == "GAVE":
            gave += amt
        elif t.type == "GOT":
            got += amt

    net = round(gave - got, 2)
    last_txn = txns[0] if txns else None

    return KhataPersonResponse(
        id=person.id,
        name=person.name,
        phone=person.phone,
        color=person.color or "#3B82F6",
        total_gave=round(gave, 2),
        total_got=round(got, 2),
        net_balance=net,
        last_txn_date=last_txn.date if last_txn else None,
        last_note=last_txn.note if last_txn else None,
        txn_count=len(txns),
        created_at=person.created_at,
    )


@router.get("/summary", response_model=KhataSummaryResponse)
async def get_khata_summary(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns aggregated receivable and payable totals for the user's Accounts Book.
    Leverages indexes for fast real-time ledger balance calculation.
    """
    query = (
        select(KhataPerson)
        .where(KhataPerson.user_id == current_user.id)
        .options(selectinload(KhataPerson.transactions))
    )
    result = await db.execute(query)
    persons = result.scalars().all()

    total_receivable = 0.0
    total_payable = 0.0

    for person in persons:
        resp = _build_person_response(person)
        if resp.net_balance > 0:
            total_receivable += resp.net_balance
        elif resp.net_balance < 0:
            total_payable += abs(resp.net_balance)

    net_balance = round(total_receivable - total_payable, 2)

    return KhataSummaryResponse(
        total_receivable=round(total_receivable, 2),
        total_payable=round(total_payable, 2),
        net_balance=net_balance,
        total_persons=len(persons),
    )


@router.get("/persons", response_model=List[KhataPersonResponse])
async def list_khata_persons(
    search: Optional[str] = Query(None, description="Search by contact name or phone"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves all Accounts Book contacts for the user with calculated net balances and counts.
    Sorted by most recent ledger activity.
    """
    query = (
        select(KhataPerson)
        .where(KhataPerson.user_id == current_user.id)
        .options(selectinload(KhataPerson.transactions))
    )

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(KhataPerson.name).like(term),
                KhataPerson.phone.like(term)
            )
        )

    result = await db.execute(query)
    persons = result.scalars().all()

    person_responses = [_build_person_response(p) for p in persons]

    # Sort: contacts with latest transactions first; fall back to created_at
    def sort_key(p: KhataPersonResponse):
        dt = p.last_txn_date or p.created_at
        return dt.timestamp() if dt else 0

    person_responses.sort(key=sort_key, reverse=True)
    return person_responses


@router.post("/persons", response_model=KhataPersonResponse, status_code=status.HTTP_201_CREATED)
async def create_khata_person(
    payload: KhataPersonCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates a new contact in Accounts Book.
    """
    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Person name cannot be blank.")

    # Check if a contact with exact same name already exists
    existing_res = await db.execute(
        select(KhataPerson)
        .where(
            (KhataPerson.user_id == current_user.id) &
            (func.lower(KhataPerson.name) == clean_name.lower())
        )
        .options(selectinload(KhataPerson.transactions))
    )
    existing = existing_res.scalar_one_or_none()
    if existing:
        return _build_person_response(existing)

    color = payload.color or random.choice(AVATAR_COLORS)
    new_person = KhataPerson(
        user_id=current_user.id,
        name=clean_name,
        phone=payload.phone.strip() if payload.phone else None,
        color=color,
    )
    db.add(new_person)
    await db.commit()
    await db.refresh(new_person)
    new_person.transactions = []
    return _build_person_response(new_person)


@router.get("/persons/{person_id}", response_model=KhataPersonResponse)
async def get_khata_person(
    person_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves details for a single person.
    """
    result = await db.execute(
        select(KhataPerson)
        .where(
            (KhataPerson.id == person_id) &
            (KhataPerson.user_id == current_user.id)
        )
        .options(selectinload(KhataPerson.transactions))
    )
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found.")
    return _build_person_response(person)


@router.put("/persons/{person_id}", response_model=KhataPersonResponse)
async def update_khata_person(
    person_id: UUID,
    payload: KhataPersonUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Updates name, phone, or avatar color for an existing Accounts Book contact.
    """
    result = await db.execute(
        select(KhataPerson)
        .where(
            (KhataPerson.id == person_id) &
            (KhataPerson.user_id == current_user.id)
        )
        .options(selectinload(KhataPerson.transactions))
    )
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found.")

    if payload.name is not None and payload.name.strip():
        person.name = payload.name.strip()
    if payload.phone is not None:
        person.phone = payload.phone.strip() if payload.phone.strip() else None
    if payload.color is not None:
        person.color = payload.color

    await db.commit()
    await db.refresh(person)
    return _build_person_response(person)


@router.delete("/persons/{person_id}", status_code=status.HTTP_200_OK)
async def delete_khata_person(
    person_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Deletes a contact and cascades deletion to all their ledger transactions.
    """
    result = await db.execute(
        select(KhataPerson).where(
            (KhataPerson.id == person_id) &
            (KhataPerson.user_id == current_user.id)
        )
    )
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found.")

    await db.delete(person)
    await db.commit()
    return {"detail": "Person and associated ledger records deleted successfully."}


@router.get("/persons/{person_id}/transactions", response_model=List[KhataTransactionResponse])
async def list_person_transactions(
    person_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves all ledger transactions for a specific contact, ordered chronologically.
    Uses index `ix_khata_txns_person_id_date`.
    """
    # Verify person ownership
    person_res = await db.execute(
        select(KhataPerson).where(
            (KhataPerson.id == person_id) & (KhataPerson.user_id == current_user.id)
        )
    )
    person = person_res.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found.")

    query = (
        select(KhataTransaction)
        .where(
            (KhataTransaction.person_id == person_id) &
            (KhataTransaction.user_id == current_user.id)
        )
        .order_by(desc(KhataTransaction.date), desc(KhataTransaction.created_at))
    )
    result = await db.execute(query)
    txns = result.scalars().all()

    # Attach person reference for person_name resolution
    for t in txns:
        t.person = person

    return txns


@router.post("/transactions", response_model=KhataTransactionCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_khata_transaction(
    payload: KhataTransactionCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Records a new transaction (GAVE = Lent, GOT = Borrowed, SETTLE = Settled).
    Automatically links to existing person or creates one if not existing.
    """
    clean_person_name = payload.person_name.strip()
    if not clean_person_name:
        raise HTTPException(status_code=400, detail="Person name cannot be blank.")

    # 1. Resolve or create person
    person: Optional[KhataPerson] = None
    if payload.person_id:
        p_res = await db.execute(
            select(KhataPerson)
            .where(
                (KhataPerson.id == payload.person_id) &
                (KhataPerson.user_id == current_user.id)
            )
            .options(selectinload(KhataPerson.transactions))
        )
        person = p_res.scalar_one_or_none()

    if not person:
        p_res = await db.execute(
            select(KhataPerson)
            .where(
                (KhataPerson.user_id == current_user.id) &
                (func.lower(KhataPerson.name) == clean_person_name.lower())
            )
            .options(selectinload(KhataPerson.transactions))
        )
        person = p_res.scalar_one_or_none()

    if not person:
        person = KhataPerson(
            user_id=current_user.id,
            name=clean_person_name,
            phone=payload.phone.strip() if payload.phone else None,
            color=random.choice(AVATAR_COLORS),
        )
        db.add(person)
        await db.flush()
        person.transactions = []
    elif payload.phone and payload.phone.strip() and not person.phone:
        person.phone = payload.phone.strip()

    # 2. Insert transaction
    new_txn = KhataTransaction(
        user_id=current_user.id,
        person_id=person.id,
        type=payload.type.upper(),
        amount=round(float(payload.amount), 2),
        date=payload.date,
        note=payload.note.strip() if payload.note else None,
        due_date=payload.due_date,
    )
    db.add(new_txn)
    await db.commit()
    await db.refresh(new_txn)

    # Re-fetch person with updated transactions
    updated_person_res = await db.execute(
        select(KhataPerson)
        .where(KhataPerson.id == person.id)
        .options(selectinload(KhataPerson.transactions))
    )
    refreshed_person = updated_person_res.scalar_one()
    new_txn.person = refreshed_person

    return KhataTransactionCreateResponse(
        transaction=KhataTransactionResponse.model_validate(new_txn),
        person=_build_person_response(refreshed_person),
    )


@router.put("/transactions/{txn_id}", response_model=KhataTransactionResponse)
async def update_khata_transaction(
    txn_id: UUID,
    payload: KhataTransactionUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Updates an existing ledger transaction.
    """
    res = await db.execute(
        select(KhataTransaction)
        .where(
            (KhataTransaction.id == txn_id) &
            (KhataTransaction.user_id == current_user.id)
        )
        .options(selectinload(KhataTransaction.person))
    )
    txn = res.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    if payload.type:
        txn.type = payload.type.upper()
    if payload.amount is not None:
        txn.amount = round(float(payload.amount), 2)
    if payload.note is not None:
        txn.note = payload.note.strip() if payload.note.strip() else None
    if payload.date:
        txn.date = payload.date
    if payload.due_date is not None:
        txn.due_date = payload.due_date

    await db.commit()
    await db.refresh(txn)
    return txn


@router.delete("/transactions/{txn_id}", status_code=status.HTTP_200_OK)
async def delete_khata_transaction(
    txn_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Deletes a transaction entry from the Accounts Book.
    """
    res = await db.execute(
        select(KhataTransaction).where(
            (KhataTransaction.id == txn_id) &
            (KhataTransaction.user_id == current_user.id)
        )
    )
    txn = res.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    await db.delete(txn)
    await db.commit()
    return {"detail": "Transaction deleted successfully."}


@router.post("/persons/{person_id}/settle", response_model=KhataPersonResponse)
async def settle_khata_account(
    person_id: UUID,
    payload: KhataSettleRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Settles an entire account to zero balance.
    If net balance > 0 (Receivable/Lent), records settlement transaction as RECEIVED.
    If net balance < 0 (Payable/Borrowed), records settlement transaction as PAID.
    """
    res = await db.execute(
        select(KhataPerson)
        .where(
            (KhataPerson.id == person_id) &
            (KhataPerson.user_id == current_user.id)
        )
        .options(selectinload(KhataPerson.transactions))
    )
    person = res.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found.")

    current_stats = _build_person_response(person)
    net = current_stats.net_balance

    if net == 0:
        return current_stats

    settle_amount = abs(net)
    settlement_type = "RECEIVED" if net > 0 else "PAID"
    settle_note = payload.note or f"Account settled (₹{settle_amount:,.2f})"

    settle_txn = KhataTransaction(
        user_id=current_user.id,
        person_id=person.id,
        type="SETTLE",
        settlement_type=settlement_type,
        amount=settle_amount,
        date=datetime.now(timezone.utc),
        note=settle_note,
    )
    db.add(settle_txn)
    await db.commit()

    # Re-fetch person with updated transactions
    refreshed_res = await db.execute(
        select(KhataPerson)
        .where(KhataPerson.id == person_id)
        .options(selectinload(KhataPerson.transactions))
    )
    updated_person = refreshed_res.scalar_one()
    return _build_person_response(updated_person)


@router.post("/sync", status_code=status.HTTP_200_OK)
async def sync_khata_batch(
    payload: KhataBatchSyncRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Batch migration / synchronization endpoint.
    Uploads offline or localStorage ledger items to the main database safely.
    """
    inserted_count = 0
    for item in payload.items:
        clean_name = item.person_name.strip()
        if not clean_name:
            continue

        # Look up or create person
        p_res = await db.execute(
            select(KhataPerson)
            .where(
                (KhataPerson.user_id == current_user.id) &
                (func.lower(KhataPerson.name) == clean_name.lower())
            )
        )
        person = p_res.scalar_one_or_none()
        if not person:
            person = KhataPerson(
                user_id=current_user.id,
                name=clean_name,
                phone=item.phone.strip() if item.phone else None,
                color=random.choice(AVATAR_COLORS),
            )
            db.add(person)
            await db.flush()

        new_txn = KhataTransaction(
            user_id=current_user.id,
            person_id=person.id,
            type=item.type.upper(),
            amount=round(float(item.amount), 2),
            date=item.date,
            note=item.note.strip() if item.note else None,
            due_date=item.due_date,
        )
        db.add(new_txn)
        inserted_count += 1

    await db.commit()
    return {"detail": f"Successfully migrated/synced {inserted_count} transaction(s)."}
