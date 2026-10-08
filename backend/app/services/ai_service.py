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
                "You are an AI financial expense parsing assistant specialized in Indian UPI and Banking SMS alerts "
                "(HDFC, SBI, ICICI, Axis, Kotak, PNB, Paytm, PhonePe, Google Pay, Cred).\n"
                "Parse the following text from an SMS representing a financial transaction into JSON with these exact keys:\n"
                "{\n"
                '  "amount": 350.0,\n'
                '  "merchant": "Swiggy",\n'
                '  "category": "Food",\n'
                '  "payment_method": "UPI",\n'
                '  "bank_name": "HDFC",\n'
                '  "reference_number": "428192849182",\n'
                '  "confidence": 0.95\n'
                "}\n\n"
                "Important Rules:\n"
                "1. If payment is Person-to-Person (P2P UPI transfer to friend/individual), category MUST be 'Transfer'.\n"
                "2. If payment is to a restaurant, cafe, tea stall, dhaba, Swiggy, Zomato, category MUST be 'Food'.\n"
                "3. If payment is to a kirana store, supermarket, Blinkit, Zepto, grocery mart, category MUST be 'Grocery'.\n"
                "4. If payment is for petrol, diesel, fuel pump, category MUST be 'Fuel'.\n"
                "5. Extract exact recipient/merchant name.\n"
                "6. If the text is an OTP or non-financial message, set amount=0, confidence=0.0, category='Others'.\n"
                "Output ONLY valid JSON.\n\n"
                f"Transaction Text: \"{text}\""
            )
            
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                ),
            )
            
            raw_text = response.text.strip()
            match = re.search(r'\{[\s\S]*\}', raw_text)
            result_json = json.loads(match.group(0)) if match else json.loads(raw_text)

            amt = float(result_json.get("amount", 0.0) or 0.0)
            if amt <= 0:
                return self._mock_classify_text(text)

            return AIClassificationResponse(
                amount=amt,
                merchant=result_json.get("merchant") or "UPI Merchant",
                date=result_json.get("date") or datetime.now(timezone.utc).isoformat(),
                bank_name=result_json.get("bank_name") or "UPI Bank",
                category=result_json.get("category") or "Others",
                confidence=float(result_json.get("confidence", 0.9) or 0.9),
                payment_method=result_json.get("payment_method") or "UPI",
                reference_number=str(result_json.get("reference_number") or f"UPI{int(datetime.now(timezone.utc).timestamp())}")
            )
        except Exception as e:
            print(f"AI API Error: {e}")
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
            print(f"AI OCR Error: {e}")
            return self._mock_scan_receipt()

    def _is_otp(self, text: str) -> bool:
        """Helper to quickly check if a message is an OTP code."""
        text_lower = text.lower()
        has_otp_keywords = any(w in text_lower for w in ["otp", "one time password", "verification code", "verification otp", "code is"])
        return has_otp_keywords and not any(w in text_lower for w in ["debited", "credited", "spent"])

    def _mock_classify_text(self, text: str) -> AIClassificationResponse:
        """Robust rule-based heuristic parsing for Indian UPI & Bank SMS."""
        text_lower = text.lower()
        amount = 0.0

        # 1. Amount extraction: Handles "Rs. 350.00", "Rs 350", "INR 1,200", "debited by 120.0", "paid 450", etc.
        amt_match = re.search(
            r'(?:debited\s*(?:by|for|with)?|spent|paid|transferred|sent|credited\s*(?:with|by)?|rs\.?|inr|amt\.?)\s*(?:of)?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)',
            text,
            re.IGNORECASE
        )
        if amt_match:
            try:
                amount = float(amt_match.group(1).replace(',', ''))
            except ValueError:
                amount = 0.0

        if amount <= 0:
            secondary_match = re.search(r'(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)', text, re.IGNORECASE)
            if secondary_match:
                try:
                    amount = float(secondary_match.group(1).replace(',', ''))
                except ValueError:
                    amount = 0.0

        # 2. Extract Merchant / Recipient
        merchant = "UPI Merchant"
        p2m_match = re.search(r'upi\/(?:p2m|p2p)\/[\d\w]+\/([a-zA-Z0-9\s\.\@\-\&]+?)(?:\/|\s|\.|$)', text, re.IGNORECASE)
        to_match = re.search(r'(?:transfer\s+to|transferred\s+to|sent\s+to|paid\s+to|to\s+vpa|to)\s+([A-Za-z0-9\s\.\@\-\&]{2,30}?)(?:\s+(?:on|via|using|ref|utr|avbl|bal|\.|\-)|$)', text, re.IGNORECASE)
        at_match = re.search(r'(?:at|info)\s+([A-Za-z0-9\s\.\@\-\&]{2,30}?)(?:\s+(?:on|via|using|ref|avbl|bal|\.|\-)|$)', text, re.IGNORECASE)

        is_p2p = False
        if "p2p" in text_lower or "@" in text_lower:
            is_p2p = True

        if p2m_match:
            merchant = p2m_match.group(1).strip()
        elif to_match:
            candidate = to_match.group(1).strip()
            if candidate.lower() not in ["your", "a/c", "account", "the", "bank", "vpa"]:
                merchant = candidate
        elif at_match:
            candidate = at_match.group(1).strip()
            if candidate.lower() not in ["your", "a/c", "account", "the", "bank"]:
                merchant = candidate

        merchant = re.sub(r'^(the|a)\s+', '', merchant, flags=re.IGNORECASE).strip()
        if len(merchant) > 35:
            merchant = merchant[:35].strip()
        if not merchant or merchant.lower() in ["bank", "user", "upi"]:
            merchant = "UPI Transfer"

        # 3. Categorization logic
        category = "Others"
        m_lower = merchant.lower()

        if any(w in m_lower or w in text_lower for w in ["swiggy", "zomato", "mcdonald", "kfc", "domino", "burger", "pizza", "tea", "chai", "coffee", "cafe", "restaurant", "dhaba", "food", "dining", "bakery", "sweets", "kitchen", "biryani", "canteen"]):
            category = "Food"
        elif any(w in m_lower or w in text_lower for w in ["blinkit", "zepto", "bigbasket", "instamart", "kirana", "supermarket", "grocery", "mart", "provision", "store", "bazaar", "dairy", "milk", "vegetable", "fruit", "mandi"]):
            category = "Grocery"
        elif any(w in m_lower or w in text_lower for w in ["uber", "ola", "rapido", "metro", "auto", "cab", "travel", "flight", "indigo", "irctc", "railway", "redbus", "makemytrip"]):
            category = "Travel"
        elif any(w in m_lower or w in text_lower for w in ["fuel", "petrol", "diesel", "hpcl", "bpcl", "iocl", "indian oil", "bharat petroleum", "cng"]):
            category = "Fuel"
        elif any(w in m_lower or w in text_lower for w in ["jio", "airtel", "vi ", "vodafone", "bescom", "electricity", "bill", "recharge", "water", "gas", "broadband", "wifi", "cylinder"]):
            category = "Bills"
        elif any(w in m_lower or w in text_lower for w in ["amazon", "flipkart", "myntra", "meesho", "ajio", "nykaa", "zara", "h&m", "retail", "shopping", "clothing", "wear"]):
            category = "Shopping"
        elif any(w in m_lower or w in text_lower for w in ["netflix", "spotify", "prime", "youtube", "hotstar", "disney", "apple", "google storage"]):
            category = "Subscription"
        elif any(w in text_lower for w in ["salary", "payroll", "credited by employer", "stipend"]):
            category = "Salary"
        elif is_p2p or any(w in text_lower for w in ["p2p", "sent to friend", "person to person", "transfer to"]):
            category = "Transfer"

        # 4. Payment Method
        payment_method = "UPI"
        if "credit card" in text_lower:
            payment_method = "Credit Card"
        elif "debit card" in text_lower:
            payment_method = "Debit Card"

        # 5. Reference Number
        ref_match = re.search(r'(?:ref(?:\s*no)?|rrn|utr|txn(?:\s*id)?|id)\s*[:\-\s]?\s*([A-Za-z0-9]{8,18})', text, re.IGNORECASE)
        ref_num = ref_match.group(1) if ref_match else f"UPI{int(datetime.now(timezone.utc).timestamp())}"

        # 6. Bank Name
        bank_match = re.search(r'\b(hdfc|icici|sbi|axis|kotak|pnb|bob|canara|yes\s*bank|paytm|phonepe|gpay|idfc|indusind)\b', text, re.IGNORECASE)
        bank_name = bank_match.group(1).upper() if bank_match else "UPI Bank"

        return AIClassificationResponse(
            amount=amount if amount > 0 else 0.0,
            merchant=merchant if amount > 0 else None,
            date=datetime.now(timezone.utc).isoformat(),
            bank_name=bank_name,
            category=category,
            confidence=0.90 if amount > 0 else 0.0,
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
            print(f"Failed to generate AI insights: {e}")

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

