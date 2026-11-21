"""Focused tests for trip booking status, payment status and document authorization.

Covers the role-based transition rules for:
  PATCH /trip-bookings/{id}/status
  PATCH /trip-bookings/{id}/documents/{document_id}/status
  POST  /trip-bookings/{id}/payments

Customers may only cancel their own bookings, submit payment status "payment_sent"
and mark documents "viewed". Agency owners and admins keep the full transition set
and are the only ones able to approve/reject documents or mark a payment completed.

Run with:
    backend/.venv/Scripts/python.exe tests/test_trip_booking_transitions.py
"""

import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException  # noqa: E402
from app import models, schemas  # noqa: E402
from app.routers import trip_marketplace as tm  # noqa: E402


class FakeQuery:
    def __init__(self, item):
        self._item = item

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def first(self):
        return self._item

    def all(self):
        return [self._item] if self._item is not None else []


class FakeDb:
    """Returns queued query results in order, one per ``query()`` call."""

    def __init__(self, results):
        self._results = list(results)
        self.added = []
        self.commits = 0

    def query(self, *args, **kwargs):
        return FakeQuery(self._results.pop(0) if self._results else None)

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        return None

    def commit(self):
        self.commits += 1

    def refresh(self, obj):
        return None


def make_booking(**overrides):
    data = {
        "id": 7,
        "user_id": 1,
        "agency_id": 2,
        "booking_code": "TP-7",
        "status": "confirmed",
        "trip_started_at": None,
        "trip_completed_at": None,
        "cancelled_at": None,
    }
    data.update(overrides)
    return types.SimpleNamespace(**data)


def make_payment(**overrides):
    data = {
        "id": 11,
        "booking_id": 7,
        "status": models.TripBookingPaymentStatus.WAITING,
        "agency_confirmed_at": None,
        "customer_confirmed_at": None,
        "agency_confirmed_by_user_id": None,
        "customer_confirmed_by_user_id": None,
        "payment_method": None,
        "reference_number": None,
        "amount": None,
        "currency": None,
        "payment_date": None,
        "note": None,
    }
    data.update(overrides)
    return types.SimpleNamespace(**data)


def make_document(**overrides):
    data = {
        "id": 21,
        "booking_id": 7,
        "status": models.TripBookingDocumentStatus.UPLOADED,
        "viewed_at": None,
        "reviewed_at": None,
    }
    data.update(overrides)
    return types.SimpleNamespace(**data)


def customer():
    return types.SimpleNamespace(id=1, role=models.UserRole.USER, agency_id=None, email="c@example.com", full_name="C")


def agency():
    return types.SimpleNamespace(id=5, role=models.UserRole.AGENCY, agency_id=2, email="a@example.com", full_name="A")


def admin():
    return types.SimpleNamespace(id=9, role=models.UserRole.ADMIN, agency_id=None, email="ad@example.com", full_name="Ad")


class TransitionTestCase(unittest.TestCase):
    def setUp(self):
        for name in ("_append_timeline", "_enrich_booking_summary", "_enrich_one_document"):
            patcher = patch.object(tm, name, return_value=None)
            self.addCleanup(patcher.stop)
            patcher.start()

    def assert_http(self, exc, code):
        self.assertEqual(exc.status_code, code, f"expected HTTP {code}, got {exc.status_code}")

    def set_booking_status(self, user, booking, status):
        return tm.set_trip_booking_status(
            booking.id,
            schemas.TripBookingStatusUpdateRequest(status=status),
            db=FakeDb([booking]),
            user=user,
        )

    def set_document_status(self, user, booking, doc, status):
        return tm.set_trip_booking_document_status(
            booking.id,
            doc.id,
            schemas.TripBookingDocumentSetStatusRequest(status=status),
            db=FakeDb([booking, doc]),
            user=user,
        )

    def upsert_payment(self, user, booking, payment, **fields):
        return tm.upsert_trip_booking_payment(
            booking.id,
            schemas.TripBookingPaymentUpsertRequest(**fields),
            db=FakeDb([booking, payment]),
            user=user,
        )


class BookingStatusTransitionTests(TransitionTestCase):
    def test_customer_can_cancel_own_booking(self):
        booking = make_booking()
        result = self.set_booking_status(customer(), booking, "cancelled")
        self.assertEqual(booking.status, "cancelled")
        self.assertIsNotNone(booking.cancelled_at)
        self.assertIs(result, booking)

    def test_customer_cannot_complete_own_booking(self):
        booking = make_booking()
        with self.assertRaises(HTTPException) as ctx:
            self.set_booking_status(customer(), booking, "completed")
        self.assert_http(ctx.exception, 403)
        self.assertEqual(booking.status, "confirmed")

    def test_customer_cannot_mark_booking_paid(self):
        booking = make_booking()
        with self.assertRaises(HTTPException) as ctx:
            self.set_booking_status(customer(), booking, "paid")
        self.assert_http(ctx.exception, 403)
        self.assertEqual(booking.status, "confirmed")

    def test_customer_cannot_set_agency_statuses(self):
        for status in ("preparing", "ready", "travelling", "reviewed", "payment_received"):
            with self.subTest(status=status):
                booking = make_booking()
                with self.assertRaises(HTTPException) as ctx:
                    self.set_booking_status(customer(), booking, status)
                self.assert_http(ctx.exception, 403)
                self.assertEqual(booking.status, "confirmed")

    def test_customer_invalid_status_rejected(self):
        booking = make_booking()
        with self.assertRaises(HTTPException) as ctx:
            self.set_booking_status(customer(), booking, "bogus")
        self.assert_http(ctx.exception, 400)
        self.assertEqual(booking.status, "confirmed")

    def test_customer_cannot_change_another_users_booking(self):
        booking = make_booking(user_id=99)
        with self.assertRaises(HTTPException) as ctx:
            self.set_booking_status(customer(), booking, "cancelled")
        self.assert_http(ctx.exception, 403)
        self.assertEqual(booking.status, "confirmed")

    def test_agency_can_drive_full_lifecycle(self):
        for status in ("preparing", "ready", "travelling", "completed", "cancelled"):
            with self.subTest(status=status):
                booking = make_booking()
                self.set_booking_status(agency(), booking, status)
                self.assertEqual(booking.status, status)

    def test_agency_status_is_case_insensitive(self):
        booking = make_booking()
        self.set_booking_status(agency(), booking, "  READY  ")
        self.assertEqual(booking.status, "ready")

    def test_admin_can_set_booking_status(self):
        booking = make_booking()
        self.set_booking_status(admin(), booking, "ready")
        self.assertEqual(booking.status, "ready")

    def test_agency_invalid_status_rejected(self):
        booking = make_booking()
        with self.assertRaises(HTTPException) as ctx:
            self.set_booking_status(agency(), booking, "bogus")
        self.assert_http(ctx.exception, 400)

    def test_agency_cannot_touch_other_agency_booking(self):
        booking = make_booking(agency_id=77)
        with self.assertRaises(HTTPException) as ctx:
            self.set_booking_status(agency(), booking, "ready")
        self.assert_http(ctx.exception, 403)


class DocumentStatusTransitionTests(TransitionTestCase):
    def test_customer_can_mark_document_viewed(self):
        booking = make_booking()
        doc = make_document()
        self.set_document_status(customer(), booking, doc, "viewed")
        self.assertEqual(doc.status, models.TripBookingDocumentStatus.VIEWED)
        self.assertIsNotNone(doc.viewed_at)

    def test_customer_cannot_approve_document(self):
        booking = make_booking()
        doc = make_document()
        with self.assertRaises(HTTPException) as ctx:
            self.set_document_status(customer(), booking, doc, "approved")
        self.assert_http(ctx.exception, 403)
        self.assertEqual(doc.status, models.TripBookingDocumentStatus.UPLOADED)

    def test_customer_cannot_reject_document(self):
        booking = make_booking()
        doc = make_document()
        with self.assertRaises(HTTPException) as ctx:
            self.set_document_status(customer(), booking, doc, "rejected")
        self.assert_http(ctx.exception, 403)
        self.assertEqual(doc.status, models.TripBookingDocumentStatus.UPLOADED)

    def test_agency_can_approve_or_reject_document(self):
        for status, expected in (
            ("approved", models.TripBookingDocumentStatus.APPROVED),
            ("rejected", models.TripBookingDocumentStatus.REJECTED),
        ):
            with self.subTest(status=status):
                booking = make_booking()
                doc = make_document()
                self.set_document_status(agency(), booking, doc, status)
                self.assertEqual(doc.status, expected)
                self.assertIsNotNone(doc.reviewed_at)

    def test_agency_can_mark_viewed(self):
        booking = make_booking()
        doc = make_document()
        self.set_document_status(agency(), booking, doc, "viewed")
        self.assertEqual(doc.status, models.TripBookingDocumentStatus.VIEWED)

    def test_admin_can_approve_document(self):
        booking = make_booking()
        doc = make_document()
        self.set_document_status(admin(), booking, doc, "approved")
        self.assertEqual(doc.status, models.TripBookingDocumentStatus.APPROVED)

    def test_invalid_document_status_rejected(self):
        for role in (customer(), agency(), admin()):
            with self.subTest(role=role.role):
                booking = make_booking()
                doc = make_document()
                with self.assertRaises(HTTPException) as ctx:
                    self.set_document_status(role, booking, doc, "bogus")
                self.assert_http(ctx.exception, 400)
                self.assertEqual(doc.status, models.TripBookingDocumentStatus.UPLOADED)


class PaymentStatusTransitionTests(TransitionTestCase):
    def test_customer_can_submit_payment_sent(self):
        booking = make_booking()
        payment = make_payment()
        result = self.upsert_payment(customer(), booking, payment, status="payment_sent")
        self.assertEqual(payment.status, models.TripBookingPaymentStatus.SENT)
        self.assertEqual(booking.status, "confirmed")
        self.assertIs(result, payment)

    def test_customer_cannot_set_payment_completed(self):
        booking = make_booking()
        payment = make_payment()
        with self.assertRaises(HTTPException) as ctx:
            self.upsert_payment(customer(), booking, payment, status="completed")
        self.assert_http(ctx.exception, 403)
        self.assertEqual(payment.status, models.TripBookingPaymentStatus.WAITING)
        self.assertEqual(booking.status, "confirmed")

    def test_customer_cannot_set_agency_confirmed(self):
        booking = make_booking()
        payment = make_payment()
        with self.assertRaises(HTTPException) as ctx:
            self.upsert_payment(customer(), booking, payment, status="agency_confirmed")
        self.assert_http(ctx.exception, 403)
        self.assertEqual(payment.status, models.TripBookingPaymentStatus.WAITING)

    def test_customer_cannot_set_waiting_payment(self):
        booking = make_booking()
        payment = make_payment()
        with self.assertRaises(HTTPException) as ctx:
            self.upsert_payment(customer(), booking, payment, status="waiting_payment")
        self.assert_http(ctx.exception, 403)

    def test_customer_sent_alias_is_not_accepted(self):
        booking = make_booking()
        payment = make_payment()
        with self.assertRaises(HTTPException) as ctx:
            self.upsert_payment(customer(), booking, payment, status="sent")
        self.assert_http(ctx.exception, 403)

    def test_customer_invalid_payment_status_rejected(self):
        booking = make_booking()
        payment = make_payment()
        with self.assertRaises(HTTPException) as ctx:
            self.upsert_payment(customer(), booking, payment, status="bogus")
        self.assert_http(ctx.exception, 400)

    def test_agency_can_confirm_and_complete_payment(self):
        booking = make_booking()
        payment = make_payment()
        self.upsert_payment(agency(), booking, payment, status="agency_confirmed")
        self.assertEqual(payment.status, models.TripBookingPaymentStatus.AGENCY_CONFIRMED)

        self.upsert_payment(agency(), booking, payment, status="completed")
        self.assertEqual(payment.status, models.TripBookingPaymentStatus.COMPLETED)
        self.assertEqual(booking.status, models.TripBookingStatus.PAID)

    def test_admin_can_complete_payment(self):
        booking = make_booking()
        payment = make_payment()
        self.upsert_payment(admin(), booking, payment, status="completed")
        self.assertEqual(payment.status, models.TripBookingPaymentStatus.COMPLETED)
        self.assertEqual(booking.status, models.TripBookingStatus.PAID)

    def test_agency_completed_creates_missing_payment_record(self):
        booking = make_booking()
        result = self.upsert_payment(agency(), booking, None, status="completed")
        self.assertEqual(result.status, models.TripBookingPaymentStatus.COMPLETED)
        self.assertEqual(booking.status, models.TripBookingStatus.PAID)

    def test_customer_confirm_flag_still_allowed(self):
        booking = make_booking()
        payment = make_payment()
        self.upsert_payment(customer(), booking, payment, customer_confirm=True)
        self.assertIsNotNone(payment.customer_confirmed_at)
        self.assertEqual(payment.status, models.TripBookingPaymentStatus.CUSTOMER_CONFIRMED)
        self.assertEqual(booking.status, "confirmed")

    def test_agency_confirm_flag_still_allowed(self):
        booking = make_booking()
        payment = make_payment()
        self.upsert_payment(agency(), booking, payment, agency_confirm=True)
        self.assertIsNotNone(payment.agency_confirmed_at)
        self.assertEqual(payment.status, models.TripBookingPaymentStatus.AGENCY_CONFIRMED)

    def test_customer_cannot_use_agency_confirm_flag(self):
        booking = make_booking()
        payment = make_payment()
        with self.assertRaises(HTTPException) as ctx:
            self.upsert_payment(customer(), booking, payment, agency_confirm=True)
        self.assert_http(ctx.exception, 403)
        self.assertIsNone(payment.agency_confirmed_at)

    def test_agency_cannot_use_customer_confirm_flag(self):
        booking = make_booking()
        payment = make_payment()
        with self.assertRaises(HTTPException) as ctx:
            self.upsert_payment(agency(), booking, payment, customer_confirm=True)
        self.assert_http(ctx.exception, 403)

    def test_customer_editing_payment_details_does_not_change_status(self):
        booking = make_booking()
        payment = make_payment()
        self.upsert_payment(customer(), booking, payment, reference_number="TXN-1", amount=100.0)
        self.assertEqual(payment.reference_number, "TXN-1")
        self.assertEqual(payment.amount, 100.0)
        self.assertEqual(payment.status, models.TripBookingPaymentStatus.WAITING)
        self.assertEqual(booking.status, "confirmed")


if __name__ == "__main__":
    unittest.main(verbosity=2)
