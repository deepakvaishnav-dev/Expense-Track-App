import json
import re
from datetime import datetime, timezone
import google.generativeai as genai
from app.config import settings
from app.schemas.schemas import AIClassificationResponse, ReceiptOCRResponse

class AIService:
    def __init__(self):
        # Configure Gemini API client if API key is provided
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model_name = "gemini-2.5-flash"

    def classify_text(self, text: str) -> AIClassificationResponse:
        """
        Parses SMS or notification text using Gemini to extract amount, merchant,
        category, payment method, reference number, bank name, etc.
        """
        # Exclude OTP messages
        if self._is_otp(text):
            return AIClassificationResponse(
                amount=0.0,
                merchant=None,
                date=None,
                bank_name=None,
                category="Others",
                confidence=0.0,
                payment_method="Cash",
                reference_number=None
            )

        if not settings.GEMINI_API_KEY:
            return self._mock_classify_text(text)
        
        try:
            model = genai.GenerativeModel(self.model_name)
            
            prompt = (
                "You are an AI financial expense parsing assistant. Parse the following text from an SMS or notification "
                "representing a financial transaction. Classify it into one of these categories: Food, Grocery, Shopping, "
                "Bills, Fuel, Travel, Medical, Entertainment, Education, Investment, Salary, Subscription, EMI, Rent, Transfer, Others. "
                "Extract the transaction amount, merchant (or bank/receiver), date (ISO 8601 string, make a best estimate if today is 2026-06-24), "
                "bank name (if transaction happened through a bank/card/wallet), confidence score (0.0 to 1.0), payment method "
                "(Cash, UPI, Debit Card, Credit Card, Wallet), and reference/transaction number. "
                "If it does not represent a transaction, set category to 'Others', amount to 0, and confidence to 0.0.\n\n"
                f"Transaction Text: \"{text}\""
            )
            
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=AIClassificationResponse,
                ),
            )
            
            result_json = json.loads(response.text)
            return AIClassificationResponse(**result_json)
        except Exception as e:
            print(f"Gemini API Error: {e}")
            return self._mock_classify_text(text)

    def scan_receipt(self, image_bytes: bytes, mime_type: str) -> ReceiptOCRResponse:
        """
        Uploads and analyzes a receipt image using Gemini multimodal input
        to extract the merchant, amount, tax, date, and line-item details.
        """
        if not settings.GEMINI_API_KEY:
            return self._mock_scan_receipt()
            
        try:
            model = genai.GenerativeModel(self.model_name)
            
            prompt = (
                "Analyze this receipt image. Extract: merchant name, total amount, tax amount, "
                "transaction date (ISO 8601 format), payment method (Cash, UPI, Debit Card, Credit Card, Wallet), "
                "and an itemized list of items purchased (include name, quantity, unit_price, total_price if present). "
                "Provide the result in the exact JSON schema requested."
            )
            
            contents = [
                {
                    "mime_type": mime_type,
                    "data": image_bytes
                },
                prompt
            ]
            
            response = model.generate_content(
                contents,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=ReceiptOCRResponse,
                ),
            )
            
            result_json = json.loads(response.text)
            return ReceiptOCRResponse(**result_json)
        except Exception as e:
            print(f"Gemini OCR Error: {e}")
            return self._mock_scan_receipt()

    def _is_otp(self, text: str) -> bool:
        """Helper to quickly check if a message is an OTP code."""
        text_lower = text.lower()
        has_otp_keywords = any(w in text_lower for w in ["otp", "one time password", "verification code", "verification otp", "code is"])
        # If it has OTP keywords and isn't specifically saying "debited" or "credited"
        return has_otp_keywords and not any(w in text_lower for w in ["debited", "credited", "spent"])

    def _mock_classify_text(self, text: str) -> AIClassificationResponse:
        """Fallback rule-based heuristic parsing for local/dev without API Keys."""
        amount = 0.0
        # Simple extraction of numeric amount after common keywords
        match = re.search(r'(?:debited|spent|paid|rs\.?|inr|amt)\s*(?:of)?\s*(?:rs\.?|inr)?\s*([\d,]+(?:\.\d{2})?)', text, re.IGNORECASE)
        if match:
            amount = float(match.group(1).replace(',', ''))
            
        category = "Others"
        text_lower = text.lower()
        if any(w in text_lower for w in ["food", "restaurant", "zomato", "swiggy", "cafe", "dining", "mcdonalds"]):
            category = "Food"
        elif any(w in text_lower for w in ["uber", "ola", "metro", "auto", "cab", "travel", "flight", "irctc"]):
            category = "Travel"
        elif any(w in text_lower for w in ["jio", "airtel", "electricity", "bill", "recharge", "water", "gas"]):
            category = "Bills"
        elif any(w in text_lower for w in ["grocery", "groceries", "blinkit", "zepto", "bigbasket", "mart"]):
            category = "Grocery"
        elif any(w in text_lower for w in ["netflix", "spotify", "prime", "youtube", "hotstar"]):
            category = "Subscription"
        elif any(w in text_lower for w in ["shopping", "amazon", "flipkart", "myntra", "zara"]):
            category = "Shopping"

        payment_method = "UPI" if "upi" in text_lower else ("Credit Card" if "credit card" in text_lower else "Debit Card")
        
        # Extract basic ref number
        ref_match = re.search(r'(?:ref|txn|transaction|id|ref\.no\.?)\s*(?:is)?\s*(\d{8,14})', text, re.IGNORECASE)
        ref_num = ref_match.group(1) if ref_match else "TXN" + str(int(datetime.now(timezone.utc).timestamp()))
        
        # Extract potential bank/card
        bank_match = re.search(r'\b(hdfc|icici|sbi|axis|paytm|phonepe|gpay|bank)\b', text, re.IGNORECASE)
        bank_name = bank_match.group(1).upper() if bank_match else "UPI Bank"

        return AIClassificationResponse(
            amount=amount if amount > 0 else 100.0,  # Fallback amount if none extracted
            merchant="Local Merchant" if amount > 0 else None,
            date=datetime.now(timezone.utc).isoformat(),
            bank_name=bank_name,
            category=category,
            confidence=0.85 if amount > 0 else 0.2,
            payment_method=payment_method,
            reference_number=ref_num
        )

    def _mock_scan_receipt(self) -> ReceiptOCRResponse:
        """Mock receipt OCR extraction for local development/testing."""
        return ReceiptOCRResponse(
            merchant="Dominos Pizza",
            amount=650.00,
            tax=32.50,
            date=datetime.now(timezone.utc).date().isoformat(),
            items=[
                {"name": "Farmhouse Pizza (Medium)", "quantity": 1, "price": 450.00, "total": 450.00},
                {"name": "Garlic Breadsticks", "quantity": 1, "price": 120.00, "total": 120.00},
                {"name": "Coca Cola 500ml", "quantity": 1, "price": 47.50, "total": 47.50}
            ],
            payment_method="UPI"
        )

    def generate_heuristic_insights(
        self,
        name: str,
        monthly_spending: float,
        category_breakdown: list
    ) -> list[str]:
        """
        Generates deterministic, zero-latency heuristic financial advice
        without external API dependencies.
        """
        if not category_breakdown or monthly_spending <= 0:
            return [
                f"Welcome, {name}! Record your first transactions to unlock personalized AI financial insights.",
                "Set up monthly category budgets to keep your finances structured.",
                "Link your accounts and cards to automate your financial tracking."
            ]

        top_cat = category_breakdown[0]
        top_name = top_cat.get("name", "Expenses")
        top_amt = float(top_cat.get("amount", 0.0))
        top_pct = (top_amt / monthly_spending * 100) if monthly_spending > 0 else 0.0

        insights = [
            f"Your highest spending category is {top_name} at INR {top_amt:,.2f} ({top_pct:.1f}% of monthly spend). Planning ahead can save 10-15%.",
            f"Total monthly expenditure is currently INR {monthly_spending:,.2f}. Review discretionary spending to optimize savings.",
            "You are actively tracking your finances. Maintain this consistency to reach your savings targets faster."
        ]
        return insights

    async def get_or_generate_insights(
        self,
        user_id: str,
        name: str,
        monthly_spending: float,
        category_breakdown: list,
        force_refresh: bool = False
    ) -> list[str]:
        """
        Returns cached insights (<1ms) if present; otherwise queries Gemini
        or falls back to instant heuristics and caches the result.
        """
        if not force_refresh:
            cached = insights_cache.get(user_id)
            if cached:
                return cached

        # Generate fresh insights
        if not settings.GEMINI_API_KEY:
            heuristics = self.generate_heuristic_insights(name, monthly_spending, category_breakdown)
            insights_cache.set(user_id, heuristics)
            return heuristics

        try:
            model = genai.GenerativeModel(self.model_name)
            breakdown_text = ", ".join(
                [f"{c.get('name', 'Uncategorized')}: INR {float(c.get('amount', 0.0)):.2f}" for c in category_breakdown]
            ) or "No categories yet"

            prompt = (
                f"You are a helpful AI financial coach. The user, {name}, has spent a total of INR {monthly_spending:.2f} "
                f"this month. Their category-wise breakdown is: {breakdown_text}. "
                "Generate 3 highly personalized, action-oriented, and encouraging financial tips or insights for them. "
                "Each insight must be a single string. Output exactly a JSON list of strings (no other text)."
            )

            response = await model.generate_content_async(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json"
                ),
            )

            insights = json.loads(response.text)
            if isinstance(insights, list) and len(insights) > 0:
                result = [str(x) for x in insights[:3]]
                insights_cache.set(user_id, result)
                return result
        except Exception as e:
            print(f"Failed to generate Gemini AI insights: {e}")

        fallback = self.generate_heuristic_insights(name, monthly_spending, category_breakdown)
        insights_cache.set(user_id, fallback)
        return fallback


class FinancialInsightsCache:
    """
    Thread-safe in-memory TTL cache for AI generated financial insights.
    Guarantees sub-millisecond retrieval on high-traffic dashboard requests.
    """

    def __init__(self, ttl_seconds: int = 3600):
        import threading
        self.ttl_seconds = ttl_seconds
        self._lock = threading.Lock()
        self._cache: dict[str, tuple[float, list[str]]] = {}

    def get(self, user_id: str) -> list[str] | None:
        import time
        with self._lock:
            if user_id in self._cache:
                ts, insights = self._cache[user_id]
                if time.time() - ts < self.ttl_seconds:
                    return list(insights)
                del self._cache[user_id]
            return None

    def set(self, user_id: str, insights: list[str]) -> None:
        import time
        with self._lock:
            self._cache[user_id] = (time.time(), list(insights))

    def clear(self, user_id: str | None = None) -> None:
        with self._lock:
            if user_id:
                self._cache.pop(user_id, None)
            else:
                self._cache.clear()


insights_cache = FinancialInsightsCache(ttl_seconds=3600)
ai_service = AIService()

