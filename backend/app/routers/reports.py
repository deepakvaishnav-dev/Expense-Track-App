from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.models.models import User, Transaction
from app.schemas.schemas import ReportGenerateRequest
from app.services.document_service import DocumentService
from app.routers.deps import get_current_active_user
from datetime import datetime

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.post("/generate")
async def generate_report(
    req: ReportGenerateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generates a financial statement in CSV or PDF format for a given date range.
    """
    # 1. Fetch transactions in range with preloaded categories
    query = select(Transaction).where(
        and_(
            Transaction.user_id == current_user.id,
            Transaction.date >= req.start_date,
            Transaction.date <= req.end_date
        )
    ).order_by(Transaction.date).options(selectinload(Transaction.category))

    result = await db.execute(query)
    transactions = result.scalars().all()

    if not transactions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No transactions found within the specified date range."
        )

    # 2. Output generation based on format
    fmt = req.format.lower()
    if fmt == "csv":
        csv_bytes = DocumentService.generate_csv(transactions)
        filename = f"report_{req.start_date.strftime('%Y%m%d')}_{req.end_date.strftime('%Y%m%d')}.csv"
        return Response(
            content=csv_bytes,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    elif fmt == "pdf":
        pdf_bytes = DocumentService.generate_pdf(transactions, current_user.full_name)
        filename = f"report_{req.start_date.strftime('%Y%m%d')}_{req.end_date.strftime('%Y%m%d')}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported format type. Use 'pdf' or 'csv'."
        )
