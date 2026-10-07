import base64
import hashlib
from cryptography.fernet import Fernet
from app.config import settings
from sqlalchemy.types import TypeDecorator, String

class EncryptionService:
    def __init__(self):
        # Derive a valid Fernet key from settings.ENCRYPTION_KEY to prevent startup crashes
        key_bytes = settings.ENCRYPTION_KEY.encode("utf-8")
        sha256_hash = hashlib.sha256(key_bytes).digest()
        fernet_key = base64.urlsafe_b64encode(sha256_hash)
        self.fernet = Fernet(fernet_key)

    def encrypt(self, plain_text: str) -> str:
        if plain_text is None:
            return None
        encrypted_bytes = self.fernet.encrypt(plain_text.encode("utf-8"))
        return encrypted_bytes.decode("utf-8")

    def decrypt(self, cipher_text: str) -> str:
        if cipher_text is None:
            return None
        try:
            decrypted_bytes = self.fernet.decrypt(cipher_text.encode("utf-8"))
            return decrypted_bytes.decode("utf-8")
        except Exception:
            return "[Decryption Error]"

encryption_service = EncryptionService()

class EncryptedString(TypeDecorator):
    """
    SQLAlchemy Custom Type that automatically encrypts string values 
    before insertion and decrypts them upon retrieval.
    """
    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return encryption_service.encrypt(str(value))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return encryption_service.decrypt(value)

class EncryptedFloat(TypeDecorator):
    """
    SQLAlchemy Custom Type that automatically encrypts float values 
    as strings before insertion and decrypts/casts them back upon retrieval.
    """
    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return encryption_service.encrypt(str(value))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        decrypted = encryption_service.decrypt(value)
        try:
            return float(decrypted)
        except ValueError:
            return 0.0
