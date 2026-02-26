from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


# Bcrypt limit; passwords longer than this are truncated before hashing.
_BCRYPT_MAX_BYTES = 72


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    university_id: UUID | None = None
    skills: list[str] | None = None
    interests: list[str] | None = None

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        encoded = v.encode("utf-8")
        if len(encoded) <= _BCRYPT_MAX_BYTES:
            return v
        return encoded[:_BCRYPT_MAX_BYTES].decode("utf-8", errors="ignore")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        encoded = v.encode("utf-8")
        if len(encoded) <= _BCRYPT_MAX_BYTES:
            return v
        return encoded[:_BCRYPT_MAX_BYTES].decode("utf-8", errors="ignore")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
