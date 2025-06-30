import pytest
from django.utils import timezone

from or_managements.models import VerificationSession, OperationSession


@pytest.mark.django_db
def test_verification_session_factory(django_user_model, operation_session):
    """
    Test creating a VerificationSession instance.
    """
    vs = VerificationSession.objects.create(
        operation_session=operation_session,
        state="incomplete",
        open_until=timezone.now()
    )
    assert vs.state == "incomplete"
