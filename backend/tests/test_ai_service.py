import pytest
from app.services.ai_service import ai_service
from app.schemas.schemas import AIClassificationResponse, ReceiptOCRResponse

def test_is_otp():
    assert ai_service._is_otp("Your OTP code is 4539") is True
    assert ai_service._is_otp("Your transaction verification code is 8872. Do not share.") is True
    assert ai_service._is_otp("Your account XXX1234 has been debited Rs 1000") is False

def test_mock_classify_text_heuristics():
    # Test food classification
    text_food = "Your Swiggy order of Rs. 450.00 was successful via HDFC card"
    res_food = ai_service._mock_classify_text(text_food)
    assert res_food.amount == 450.0
    assert res_food.category == "Food"
    assert res_food.payment_method == "Debit Card"

    # Test travel classification
    text_travel = "Rs. 180 spent on UBER RIDE using Paytm UPI"
    res_travel = ai_service._mock_classify_text(text_travel)
    assert res_travel.amount == 180.0
    assert res_travel.category == "Travel"
    assert res_travel.payment_method == "UPI"

    # Test bills classification
    text_bills = "Jio recharge of Rs 299 successful."
    res_bills = ai_service._mock_classify_text(text_bills)
    assert res_bills.amount == 299.0
    assert res_bills.category == "Bills"

def test_mock_receipt_ocr():
    res = ai_service._mock_scan_receipt()
    assert isinstance(res, ReceiptOCRResponse)
    assert res.merchant == "Dominos Pizza"
    assert res.amount == 650.00
    assert len(res.items) == 3
