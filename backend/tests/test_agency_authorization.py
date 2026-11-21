"""Focused tests for agency router authorization (H-3 / H-4).

  POST /agencies/                -> authenticated admins only
  GET  /agencies/{id}/stats      -> admins, or the agency that owns the id (403 otherwise)

Run with:
    backend/.venv/Scripts/python.exe tests/test_agency_authorization.py
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app import auth, deps, models, schemas  # noqa: E402
from app.database import Base  # noqa: E402
from app.routers import agencies  # noqa: E402

PASSWORD = "StrongPass1"


def find_route(path, method):
    for route in agencies.router.routes:
        if getattr(route, "path", None) == path and method in getattr(route, "methods", set()):
            return route
    raise AssertionError(f"route {method} {path} not found")


def dependency_calls(dependant):
    calls = []
    for dep in dependant.dependencies:
        calls.append(dep.call)
        calls.extend(dependency_calls(dep))
    return calls


class AgencyAuthorizationBase(unittest.TestCase):
    def setUp(self):
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(engine)
        self.db = Session(bind=engine)
        self.addCleanup(self.db.close)
        self._seq = 0

    def seed_user(self, email, role, agency_id=None):
        user = models.User(
            email=email,
            hashed_password=auth.get_password_hash(PASSWORD),
            full_name=email.split("@")[0],
            role=role,
            agency_id=agency_id,
            is_verified=True,
            is_email_verified=True,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def seed_agency(self, name="Agency A"):
        self._seq += 1
        agency = models.Agency(name=f"{name} {self._seq}", contact_email=f"a{self._seq}@example.com")
        self.db.add(agency)
        self.db.commit()
        self.db.refresh(agency)
        return agency

    def admin_user(self):
        return self.seed_user("admin@example.com", models.UserRole.ADMIN)

    def customer_user(self):
        return self.seed_user("customer@example.com", models.UserRole.USER)

    def agency_user(self, agency_id):
        return self.seed_user(f"agency-{agency_id}@example.com", models.UserRole.AGENCY, agency_id=agency_id)

    def assert_http(self, exc, code):
        self.assertEqual(exc.status_code, code, f"expected HTTP {code}, got {exc.status_code}")


class AnonymousAccessTests(AgencyAuthorizationBase):
    """Anonymous callers are stopped by the auth dependency before the handler runs."""

    def test_create_agency_requires_authentication(self):
        route = find_route("/", "POST")
        self.assertIn(deps.get_current_user, dependency_calls(route.dependant))

    def test_agency_stats_requires_authentication(self):
        route = find_route("/{agency_id}/stats", "GET")
        self.assertIn(deps.get_current_user, dependency_calls(route.dependant))


class CreateAgencyAuthorizationTests(AgencyAuthorizationBase):
    def body(self, name="New Agency"):
        return schemas.AgencyCreate(name=name, description="d", contact_email="new@example.com")

    def test_admin_can_create_agency(self):
        admin = self.admin_user()
        created = agencies.create_agency(self.body(), db=self.db, user=admin)
        self.assertIsNotNone(created.id)
        self.assertEqual(created.name, "New Agency")
        self.assertEqual(self.db.query(models.Agency).count(), 1)

    def test_customer_cannot_create_agency(self):
        customer = self.customer_user()
        with self.assertRaises(HTTPException) as ctx:
            agencies.create_agency(self.body(), db=self.db, user=customer)
        self.assert_http(ctx.exception, 403)
        self.assertEqual(self.db.query(models.Agency).count(), 0)

    def test_agency_cannot_create_agency(self):
        agency = self.seed_agency()
        owner = self.agency_user(agency.id)
        with self.assertRaises(HTTPException) as ctx:
            agencies.create_agency(self.body(), db=self.db, user=owner)
        self.assert_http(ctx.exception, 403)
        self.assertEqual(self.db.query(models.Agency).count(), 1)


class AgencyStatsAuthorizationTests(AgencyAuthorizationBase):
    def setUp(self):
        super().setUp()
        self.agency = self.seed_agency("Owner Agency")
        customer = self.seed_user("buyer@example.com", models.UserRole.USER)
        package = models.Package(title="Alpine", description="d", price=1000.0, agency_id=self.agency.id)
        self.db.add(package)
        self.db.commit()
        self.db.refresh(package)
        self.db.add(models.Booking(user_id=customer.id, package_id=package.id, total_price=250.0, status="confirmed"))
        self.db.add(models.Booking(user_id=customer.id, package_id=package.id, total_price=100.0, status="cancelled"))
        self.db.commit()

    def test_owner_can_read_own_stats(self):
        owner = self.agency_user(self.agency.id)
        stats = agencies.get_agency_stats(self.agency.id, db=self.db, user=owner)
        self.assertEqual(stats["total_packages"], 1)
        self.assertEqual(stats["active_bookings"], 1)
        self.assertEqual(stats["total_revenue"], 350.0)

    def test_admin_can_read_any_stats(self):
        admin = self.admin_user()
        stats = agencies.get_agency_stats(self.agency.id, db=self.db, user=admin)
        self.assertEqual(stats["total_packages"], 1)
        self.assertEqual(stats["total_revenue"], 350.0)

    def test_customer_cannot_read_stats(self):
        customer = self.seed_user("other@example.com", models.UserRole.USER)
        with self.assertRaises(HTTPException) as ctx:
            agencies.get_agency_stats(self.agency.id, db=self.db, user=customer)
        self.assert_http(ctx.exception, 403)

    def test_other_agency_cannot_read_stats(self):
        other = self.seed_agency("Other Agency")
        intruder = self.agency_user(other.id)
        with self.assertRaises(HTTPException) as ctx:
            agencies.get_agency_stats(self.agency.id, db=self.db, user=intruder)
        self.assert_http(ctx.exception, 403)

    def test_agency_without_agency_id_cannot_read_stats(self):
        orphan = self.seed_user("orphan@example.com", models.UserRole.AGENCY)
        with self.assertRaises(HTTPException) as ctx:
            agencies.get_agency_stats(self.agency.id, db=self.db, user=orphan)
        self.assert_http(ctx.exception, 403)

    def test_admin_gets_404_for_missing_agency(self):
        admin = self.admin_user()
        with self.assertRaises(HTTPException) as ctx:
            agencies.get_agency_stats(99999, db=self.db, user=admin)
        self.assert_http(ctx.exception, 404)

    def test_owner_gets_404_for_missing_agency(self):
        ghost = self.seed_user("ghost@example.com", models.UserRole.AGENCY, agency_id=99999)
        with self.assertRaises(HTTPException) as ctx:
            agencies.get_agency_stats(99999, db=self.db, user=ghost)
        self.assert_http(ctx.exception, 404)


if __name__ == "__main__":
    unittest.main(verbosity=2)
