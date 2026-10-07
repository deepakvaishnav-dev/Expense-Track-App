import pytest
from app.services.encryption_service import encryption_service

def test_string_encryption_lifecycle():
    plain_text = "HDFC Bank (8901)"
    encrypted = encryption_service.encrypt(plain_text)
    
    assert encrypted != plain_text
    assert len(encrypted) > 0
    
    decrypted = encryption_service.decrypt(encrypted)
    assert decrypted == plain_text

def test_semantic_security():
    # Encrypting the same text twice should result in different ciphertexts (due to random IV in Fernet)
    # but both must decrypt back to the original plain text.
    plain_text = "Secret Data"
    enc1 = encryption_service.encrypt(plain_text)
    enc2 = encryption_service.encrypt(plain_text)
    
    assert enc1 != enc2
    assert encryption_service.decrypt(enc1) == plain_text
    assert encryption_service.decrypt(enc2) == plain_text

def test_null_handling():
    assert encryption_service.encrypt(None) is None
    assert encryption_service.decrypt(None) is None

def test_invalid_decryption():
    # Attempting to decrypt random garbage should return the error fallback string
    result = encryption_service.decrypt("invalid_encrypted_data")
    assert result == "[Decryption Error]"
