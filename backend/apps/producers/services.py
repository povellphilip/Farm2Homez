from django.db import transaction
from django.utils import timezone

from apps.core import audit
from apps.core.exceptions import ServiceError
from apps.core.notifications import send_email

from .models import ProducerProfile, VerificationStatus


@transaction.atomic
def decide_verification(profile, *, decision, note, actor, request=None):
    profile = ProducerProfile.objects.select_for_update().get(pk=profile.pk)
    if decision == VerificationStatus.REJECTED and not note.strip():
        raise ServiceError('Explain what the producer needs to provide.', code='note_required', errors={'note': ['A reason is required.']})
    previous = profile.verification_status
    profile.verification_status = decision
    profile.verification_note = note.strip()
    profile.verified_at = timezone.now() if decision == VerificationStatus.VERIFIED else None
    profile.verified_by = actor if decision == VerificationStatus.VERIFIED else None
    profile.save(update_fields=['verification_status', 'verification_note', 'verified_at', 'verified_by', 'updated_at'])
    audit.record(
        f'producer.{decision.lower()}',
        actor=actor,
        target=profile,
        metadata={'previous': previous, 'note': profile.verification_note},
        request=request,
    )
    if decision == VerificationStatus.VERIFIED:
        body = 'Your farm has been verified. You can now publish listings on the marketplace.'
    else:
        body = f'We could not verify your farm yet.\n\nNote from our team: {profile.verification_note}\n\nUpdate your farm details and resubmit from your dashboard.'
    send_email('Farm verification update', f'Hi {profile.user.full_name},\n\n{body}\n', [profile.user.email])
    return profile


@transaction.atomic
def resubmit_verification(profile, request=None):
    if profile.verification_status != VerificationStatus.REJECTED:
        raise ServiceError('Only rejected applications can be resubmitted.', code='invalid_state', status_code=409)
    profile.verification_status = VerificationStatus.PENDING
    profile.save(update_fields=['verification_status', 'updated_at'])
    audit.record('producer.resubmitted', actor=profile.user, target=profile, request=request)
    return profile
