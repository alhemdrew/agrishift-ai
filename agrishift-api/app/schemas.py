import re

from pydantic import BaseModel, EmailStr, Field, field_validator


def check_password(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Use at least 8 characters.")
    if len(value) > 72:
        raise ValueError("Use 72 characters or fewer.")
    if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
        raise ValueError("Include at least one letter and one number.")
    return value


class SignupIn(BaseModel):
    name: str = Field(max_length=120)
    email: EmailStr
    password: str

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Enter your full name.")
        return value

    @field_validator("email")
    @classmethod
    def lower_email(cls, value: str) -> str:
        return value.lower()

    @field_validator("password")
    @classmethod
    def password_rules(cls, value: str) -> str:
        return check_password(value)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)

    @field_validator("email")
    @classmethod
    def lower_email(cls, value: str) -> str:
        return value.lower()


class EmailIn(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def lower_email(cls, value: str) -> str:
        return value.lower()


class TokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str

    @field_validator("password")
    @classmethod
    def password_rules(cls, value: str) -> str:
        return check_password(value)
