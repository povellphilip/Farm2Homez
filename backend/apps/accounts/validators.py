import re

from django.core.exceptions import ValidationError

PHONE_PATTERN = re.compile(r'^\+?[0-9]{8,15}$')


class LetterAndDigitValidator:
    def validate(self, password, user=None):
        if not re.search(r'[A-Za-z]', password) or not re.search(r'\d', password):
            raise ValidationError('Password must contain at least one letter and one number.', code='password_letter_digit')

    def get_help_text(self):
        return 'Your password must contain at least one letter and one number.'


def normalize_phone(value):
    """Strip spaces, dashes and brackets; return '' for empty input."""
    cleaned = re.sub(r'[\s\-()]', '', value or '')
    if cleaned and not PHONE_PATTERN.match(cleaned):
        raise ValidationError('Enter a valid phone number, e.g. +919876543210.')
    return cleaned
