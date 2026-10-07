import csv
import io
from datetime import datetime
from decimal import Decimal
from typing import List, Any
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from app.models.models import Transaction

FORMULA_TRIGGERS = ('=', '+', '-', '@', '\t', '\r')

def _sanitize_csv_cell(value: Any) -> str:
    """
    Sanitizes spreadsheet cell values to prevent CSV / Formula Injection (CWE-1236).
    If a string begins with dangerous formula execution operators (=, +, -, @, \t, \r),
    prepends a single quote (') to force spreadsheet software (Excel, LibreOffice)
    to treat the cell strictly as a safe text literal.
    """
    if value is None:
        return ""
    str_val = str(value)
    if str_val and str_val.startswith(FORMULA_TRIGGERS):
        return f"'{str_val}"
    return str_val

class DocumentService:
    @staticmethod
    def generate_csv(transactions: List[Transaction]) -> bytes:
        """
        Generates a secure CSV byte string for a list of transactions,
        neutralizing spreadsheet formula injections and applying UTF-8-SIG encoding.
        """
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write headers
        writer.writerow([
            "Transaction ID", 
            "Date", 
            "Merchant/Payee", 
            "Amount", 
            "Type (Expense/Income)", 
            "Category", 
            "Payment Method", 
            "Notes", 
            "Reference Number", 
            "Is Recurring"
        ])
        
        for txn in transactions:
            writer.writerow([
                _sanitize_csv_cell(txn.id),
                _sanitize_csv_cell(txn.date.isoformat() if txn.date else ""),
                _sanitize_csv_cell(txn.merchant),
                float(txn.amount),
                _sanitize_csv_cell(txn.type),
                _sanitize_csv_cell(txn.category.name if txn.category else "Uncategorized"),
                _sanitize_csv_cell(txn.payment_method),
                _sanitize_csv_cell(txn.notes or ""),
                _sanitize_csv_cell(txn.ref_number or ""),
                "Yes" if txn.is_recurring else "No"
            ])
            
        return output.getvalue().encode("utf-8-sig")

    @staticmethod
    def generate_pdf(transactions: List[Transaction], username: str) -> bytes:
        """Generates a professional styled PDF document for financial statements."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=letter, 
            rightMargin=36, 
            leftMargin=36, 
            topMargin=36, 
            bottomMargin=36
        )
        story = []
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor("#1E3A8A"),  # Deep Navy Blue
            spaceAfter=8
        )
        subtitle_style = ParagraphStyle(
            'SubtitleStyle',
            parent=styles['Normal'],
            fontSize=11,
            textColor=colors.HexColor("#4B5563"),  # Gray
            spaceAfter=24
        )
        
        # Title & Subtitle block
        story.append(Paragraph("Expense Tracker AI - Financial Statement", title_style))
        story.append(Paragraph(
            f"Prepared for: {username} | Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Total Transactions: {len(transactions)}", 
            subtitle_style
        ))
        story.append(Spacer(1, 10))
        
        # Compile table data
        # Table headers
        data = [["Date", "Merchant", "Category", "Payment Method", "Amount"]]
        total_expense = 0.0
        total_income = 0.0
        
        for txn in transactions:
            date_str = txn.date.strftime("%Y-%m-%d") if txn.date else ""
            cat_name = txn.category.name if txn.category else "Uncategorized"
            amount_val = float(txn.amount)
            
            if txn.type.lower() == "expense":
                total_expense += amount_val
                amount_str = f"-INR {amount_val:,.2f}"
            else:
                total_income += amount_val
                amount_str = f"+INR {amount_val:,.2f}"
                
            data.append([date_str, txn.merchant[:24], cat_name, txn.payment_method, amount_str])
            
        # Summary Rows
        data.append(["", "", "", "Total Income:", f"INR {total_income:,.2f}"])
        data.append(["", "", "", "Total Expenses:", f"INR {total_expense:,.2f}"])
        net_savings = total_income - total_expense
        data.append(["", "", "", "Net Balance:", f"INR {net_savings:,.2f}"])
        
        # Setup Table with custom column widths
        # Letter width is 612pt. Margins are 36x2 = 72. Total printable width = 540pt
        t = Table(data, colWidths=[70, 150, 100, 110, 110])
        
        # Base table styling
        t_style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (4, 0), (4, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('GRID', (0, 0), (-1, -4), 0.5, colors.HexColor("#E5E7EB")),
            ('FONTNAME', (-2, -3), (-1, -1), 'Helvetica-Bold'),
        ])
        
        # Color transaction amounts
        for i in range(1, len(transactions) + 1):
            # Alternating row backgrounds
            bg_color = colors.HexColor("#F9FAFB") if i % 2 == 0 else colors.HexColor("#FFFFFF")
            t_style.add('BACKGROUND', (0, i), (-1, i), bg_color)
            
            # Text color for +/- transactions
            txn = transactions[i-1]
            txt_color = colors.HexColor("#EF4444") if txn.type.lower() == "expense" else colors.HexColor("#10B981")
            t_style.add('TEXTCOLOR', (4, i), (4, i), txt_color)
            
        # Summary row styling
        t_style.add('LINEABOVE', (3, -3), (4, -3), 1.5, colors.HexColor("#1E3A8A"))
        t_style.add('TEXTCOLOR', (4, -3), (4, -3), colors.HexColor("#10B981"))
        t_style.add('TEXTCOLOR', (4, -2), (4, -2), colors.HexColor("#EF4444"))
        t_style.add('TEXTCOLOR', (4, -1), (4, -1), colors.HexColor("#1E3A8A") if net_savings >= 0 else colors.HexColor("#EF4444"))
        
        t.setStyle(t_style)
        story.append(t)
        
        # Render the PDF
        doc.build(story)
        return buffer.getvalue()
