from datetime import datetime
from typing import Any
from urllib.parse import urlsplit

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from django.utils import timezone
from rest_framework import serializers

from .models import ProhibitedSite, StudyUser, Task

# TODO Add docstrings to each of these functions to help newcomers understand what they do


# serializers are cool because they allow you to skip having to deal with the model constructors
User = get_user_model()


class StudyUserSerializer(serializers.HyperlinkedModelSerializer):
    # includes support for password hashing and safety
    class Meta:  # type: ignore
        # TODO Changed from User to StudyUser
        model = User
        fields = ["id", "username", "email", "password", "money"]
        extra_kwargs = {
            "password": {
                "write_only": True,
                "style": {
                    "input_type": "password",
                },
            }
        }

    def create(self, validated_data: dict[str, Any]) -> StudyUser:
        # hashes passwords
        return StudyUser.objects.create_user(**validated_data)


class TaskSerializer(serializers.HyperlinkedModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:  # type: ignore
        model = Task
        fields: list[str] = ["reward", "name", "category", "due_date", "description", "user"]

    def validate_due_date(self, value: datetime) -> datetime:
        if value < timezone.now():
            raise serializers.ValidationError("Newly created task cannot be past due")
        return value

    def validate_reward(self, value: int) -> int:
        if value < 0:
            raise serializers.ValidationError("Reward cannot be negative")
        if value > 100:
            raise serializers.ValidationError("Reward exceeds permitted amount")
        return value


class ProhibitedSiteSerializer(serializers.ModelSerializer):
    url = serializers.CharField(allow_blank=True, max_length=253)

    class Meta:
        model = ProhibitedSite
        fields = ["id", "url"]
        read_only_fields = ["id"]

    def validate_url(self, value: str) -> str:
        raw_value = value.strip()
        if not raw_value or any(character.isspace() for character in raw_value):
            raise serializers.ValidationError("Enter a valid website host.")

        candidate = raw_value if "://" in raw_value else f"https://{raw_value}"
        try:
            parsed = urlsplit(candidate)
            URLValidator(schemes=["http", "https"])(candidate)
            hostname = parsed.hostname
            if not hostname or parsed.username or parsed.password or parsed.path not in ("", "/"):
                raise ValueError
            port = parsed.port
            if port and port not in (80, 443):
                raise ValueError
            normalized_host = hostname.rstrip(".").encode("idna").decode("ascii").lower()
        except (DjangoValidationError, UnicodeError, ValueError):
            raise serializers.ValidationError("Enter a valid HTTP or HTTPS website host.") from None

        return normalized_host
