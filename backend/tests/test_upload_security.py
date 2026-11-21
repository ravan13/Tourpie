"""Focused security tests for TourPie file uploads.

Covers the three upload surfaces hardened for this task:
  * Agency application documents - MIME/magic-byte validation, size limits,
    safe (flat, sanitized) file names, streaming writes with cleanup, and
    storage-root containment on download.
  * Booking document ``file_url`` - only https:// URLs or internal storage keys.
  * Avatar URLs / data URLs - SVG and unsafe http URLs rejected.

Run with:
    backend/.venv/Scripts/python.exe tests/test_upload_security.py
"""

import base64
import io
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException  # noqa: E402
from fastapi.responses import FileResponse  # noqa: E402

from app.routers import agencies, trip_marketplace, users  # noqa: E402

PDF_BYTES = b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n"
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8
JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"\x00" * 8
WEBP_BYTES = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 4
HTML_BYTES = b"<html><script>alert(1)</script></html>"


def make_upload(content, *, filename="doc.pdf", content_type="application/pdf", size=None):
    upload = types.SimpleNamespace()
    upload.file = io.BytesIO(content)
    upload.filename = filename
    upload.content_type = content_type
    upload.size = len(content) if size is None else size
    return upload


class FakeQuery:
    def __init__(self, result):
        self._result = result

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._result


class FakeDb:
    def __init__(self, app_row):
        self.app_row = app_row

    def query(self, model):
        return FakeQuery(self.app_row)


def make_application(**overrides):
    data = {
        "id": 1,
        "user_id": 1,
        "business_license_path": None,
        "tourism_certificate_path": None,
        "id_verification_path": None,
    }
    data.update(overrides)
    return types.SimpleNamespace(**data)


ADMIN = types.SimpleNamespace(id=99, role="admin")


# --------------------------------------------------------------------------- #
# Agency application upload validation
# --------------------------------------------------------------------------- #
class AgencyUploadValidationTests(unittest.TestCase):
    def test_pdf_accepted(self):
        detected, safe_name = agencies._validate_application_upload(
            make_upload(PDF_BYTES, filename="license.pdf"), field="business_license"
        )
        self.assertEqual(detected, "application/pdf")
        self.assertTrue(safe_name.endswith(".pdf"))

    def test_png_accepted(self):
        detected, safe_name = agencies._validate_application_upload(
            make_upload(PNG_BYTES, filename="id.png", content_type="image/png"), field="id_verification"
        )
        self.assertEqual(detected, "image/png")
        self.assertTrue(safe_name.endswith(".png"))

    def test_jpeg_alias_normalized(self):
        detected, safe_name = agencies._validate_application_upload(
            make_upload(JPEG_BYTES, filename="photo.jpg", content_type="image/jpg"), field="id_verification"
        )
        self.assertEqual(detected, "image/jpeg")
        self.assertTrue(safe_name.endswith(".jpg"))

    def test_webp_accepted(self):
        detected, _ = agencies._validate_application_upload(
            make_upload(WEBP_BYTES, filename="x.webp", content_type="image/webp"), field="id_verification"
        )
        self.assertEqual(detected, "image/webp")

    def test_unsupported_declared_type_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            agencies._validate_application_upload(
                make_upload(PDF_BYTES, content_type="text/html"), field="business_license"
            )
        self.assertEqual(ctx.exception.status_code, 400)

    def test_declared_type_mismatch_rejected(self):
        # Declares PNG but the bytes are a PDF.
        with self.assertRaises(HTTPException) as ctx:
            agencies._validate_application_upload(
                make_upload(PDF_BYTES, filename="x.png", content_type="image/png"), field="business_license"
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("match", ctx.exception.detail.lower())

    def test_unknown_magic_bytes_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            agencies._validate_application_upload(
                make_upload(HTML_BYTES, content_type="application/octet-stream"), field="business_license"
            )
        self.assertEqual(ctx.exception.status_code, 400)

    def test_declared_size_over_limit_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            agencies._validate_application_upload(
                make_upload(PDF_BYTES, size=agencies.MAX_APPLICATION_UPLOAD_BYTES + 1),
                field="business_license",
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("large", ctx.exception.detail.lower())

    def test_traversal_filename_is_sanitized(self):
        _, safe_name = agencies._validate_application_upload(
            make_upload(PDF_BYTES, filename="../../../etc/passwd.pdf"), field="business_license"
        )
        self.assertNotIn("/", safe_name)
        self.assertNotIn("\\", safe_name)
        self.assertNotIn("..", safe_name)
        self.assertTrue(safe_name.endswith(".pdf"))

    def test_extension_comes_from_content_not_filename(self):
        _, safe_name = agencies._validate_application_upload(
            make_upload(PDF_BYTES, filename="payload.html", content_type="application/pdf"),
            field="business_license",
        )
        self.assertTrue(safe_name.endswith(".pdf"))
        self.assertNotIn("html", safe_name)

    def test_sniff_rejects_markup(self):
        self.assertIsNone(agencies._sniff_upload_type(b"<svg onload=alert(1)>"))
        self.assertIsNone(agencies._sniff_upload_type(HTML_BYTES[:16]))


class AgencyUploadStreamTests(unittest.TestCase):
    def test_stream_writes_full_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "out.pdf"
            agencies._write_upload_stream(make_upload(PDF_BYTES), dest)
            self.assertTrue(dest.is_file())
            self.assertEqual(dest.read_bytes(), PDF_BYTES)

    def test_stream_aborts_over_limit_and_removes_partial_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "out.pdf"
            oversized = PDF_BYTES + b"A" * 4096
            with patch.object(agencies, "MAX_APPLICATION_UPLOAD_BYTES", 64), patch.object(
                agencies, "UPLOAD_CHUNK_BYTES", 16
            ):
                with self.assertRaises(HTTPException) as ctx:
                    agencies._write_upload_stream(make_upload(oversized), dest)
            self.assertEqual(ctx.exception.status_code, 400)
            self.assertFalse(dest.exists())


# --------------------------------------------------------------------------- #
# Agency document download containment
# --------------------------------------------------------------------------- #
class AgencyDownloadContainmentTests(unittest.TestCase):
    def test_traversal_path_rejected(self):
        app_row = make_application(business_license_path="uploads/../../../etc/passwd")
        with self.assertRaises(HTTPException) as ctx:
            agencies.download_agency_application_document(
                1, "business_license", db=FakeDb(app_row), user=ADMIN
            )
        self.assertEqual(ctx.exception.status_code, 404)

    def test_missing_file_rejected(self):
        app_row = make_application(business_license_path="uploads/agency_applications/1/missing.pdf")
        with self.assertRaises(HTTPException) as ctx:
            agencies.download_agency_application_document(
                1, "business_license", db=FakeDb(app_row), user=ADMIN
            )
        self.assertEqual(ctx.exception.status_code, 404)

    def test_unknown_kind_rejected(self):
        app_row = make_application(business_license_path="uploads/agency_applications/1/x.pdf")
        with self.assertRaises(HTTPException) as ctx:
            agencies.download_agency_application_document(1, "unknown", db=FakeDb(app_row), user=ADMIN)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_valid_file_served_with_safe_media_type(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            storage = root / "uploads"
            target = storage / "agency_applications" / "1" / "business_license_x.pdf"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(PDF_BYTES)
            app_row = make_application(
                business_license_path="uploads/agency_applications/1/business_license_x.pdf"
            )
            with patch.object(agencies, "UPLOAD_DIR_ROOT", root), patch.object(
                agencies, "UPLOAD_STORAGE_ROOT", storage
            ):
                response = agencies.download_agency_application_document(
                    1, "business_license", db=FakeDb(app_row), user=ADMIN
                )
            self.assertIsInstance(response, FileResponse)
            self.assertEqual(response.media_type, "application/pdf")
            self.assertTrue(str(response.path).endswith("business_license_x.pdf"))

    def test_media_type_defaults_to_octet_stream(self):
        self.assertEqual(agencies._document_media_type(Path("x.html")), "application/octet-stream")
        self.assertEqual(agencies._document_media_type(Path("x.pdf")), "application/pdf")


# --------------------------------------------------------------------------- #
# Booking document file_url validation
# --------------------------------------------------------------------------- #
class DocumentFileUrlTests(unittest.TestCase):
    def test_https_url_allowed(self):
        value = "https://cdn.example.com/docs/booking-1.pdf"
        self.assertEqual(trip_marketplace._validate_document_file_url(value), value)

    def test_internal_key_allowed(self):
        value = "uploads/agency_applications/1/business_license_x.pdf"
        self.assertEqual(trip_marketplace._validate_document_file_url(value), value)

    def test_internal_key_with_leading_slash_allowed(self):
        value = "/uploads/agency_applications/1/x.pdf"
        self.assertEqual(trip_marketplace._validate_document_file_url(value), value)

    def test_plain_http_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            trip_marketplace._validate_document_file_url("http://example.com/x.pdf")
        self.assertEqual(ctx.exception.status_code, 400)

    def test_javascript_scheme_rejected(self):
        with self.assertRaises(HTTPException):
            trip_marketplace._validate_document_file_url("javascript:alert(1)")

    def test_data_scheme_rejected(self):
        with self.assertRaises(HTTPException):
            trip_marketplace._validate_document_file_url("data:text/html;base64,PHNjcmlwdD4=")

    def test_file_scheme_rejected(self):
        with self.assertRaises(HTTPException):
            trip_marketplace._validate_document_file_url("file:///etc/passwd")

    def test_credentials_in_url_rejected(self):
        with self.assertRaises(HTTPException):
            trip_marketplace._validate_document_file_url("https://user:pass@example.com/x.pdf")

    def test_scheme_relative_url_rejected(self):
        with self.assertRaises(HTTPException):
            trip_marketplace._validate_document_file_url("//example.com/x.pdf")

    def test_internal_key_traversal_rejected(self):
        with self.assertRaises(HTTPException):
            trip_marketplace._validate_document_file_url("uploads/../../etc/passwd")

    def test_internal_key_dot_segment_rejected(self):
        with self.assertRaises(HTTPException):
            trip_marketplace._validate_document_file_url("uploads/./x.pdf")

    def test_empty_rejected(self):
        with self.assertRaises(HTTPException):
            trip_marketplace._validate_document_file_url("")

    def test_whitespace_rejected(self):
        with self.assertRaises(HTTPException):
            trip_marketplace._validate_document_file_url("https://example.com/a b.pdf")

    def test_too_long_rejected(self):
        with self.assertRaises(HTTPException):
            trip_marketplace._validate_document_file_url("https://example.com/" + "a" * 3000)

    def test_https_placeholder_fallback_allowed(self):
        # The frontend agency page falls back to a text_to_image https URL; keep it working.
        value = "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=x&image_size=square"
        self.assertEqual(trip_marketplace._validate_document_file_url(value), value)


# --------------------------------------------------------------------------- #
# Avatar URL / data URL sanitization
# --------------------------------------------------------------------------- #
class AvatarSanitizeTests(unittest.TestCase):
    def test_svg_not_a_supported_type(self):
        self.assertNotIn("image/svg+xml", users.SUPPORTED_AVATAR_MIME_TYPES)

    def test_https_url_accepted(self):
        value = "https://cdn.example.com/avatar.png"
        self.assertEqual(users._sanitize_avatar_url(value), value)

    def test_http_url_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            users._sanitize_avatar_url("http://cdn.example.com/avatar.png")
        self.assertEqual(ctx.exception.status_code, 400)

    def test_credentials_in_url_rejected(self):
        with self.assertRaises(HTTPException):
            users._sanitize_avatar_url("https://user:pass@cdn.example.com/avatar.png")

    def test_plain_string_rejected(self):
        with self.assertRaises(HTTPException):
            users._sanitize_avatar_url("not-a-url")

    def test_javascript_url_rejected(self):
        with self.assertRaises(HTTPException):
            users._sanitize_avatar_url("javascript:alert(1)")

    def test_empty_returns_none(self):
        self.assertIsNone(users._sanitize_avatar_url(""))
        self.assertIsNone(users._sanitize_avatar_url(None))

    def test_valid_png_data_url_accepted(self):
        encoded = base64.b64encode(PNG_BYTES).decode()
        value = f"data:image/png;base64,{encoded}"
        self.assertEqual(users._sanitize_avatar_url(value), value)

    def test_svg_data_url_rejected(self):
        svg = b"<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>"
        value = f"data:image/svg+xml;base64,{base64.b64encode(svg).decode()}"
        with self.assertRaises(HTTPException) as ctx:
            users._sanitize_avatar_url(value)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_mismatched_data_url_rejected(self):
        # Declares PNG but carries JPEG bytes.
        value = f"data:image/png;base64,{base64.b64encode(JPEG_BYTES).decode()}"
        with self.assertRaises(HTTPException) as ctx:
            users._sanitize_avatar_url(value)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_non_base64_data_url_rejected(self):
        with self.assertRaises(HTTPException):
            users._sanitize_avatar_url("data:image/png,notbase64")

    def test_oversized_data_url_rejected(self):
        encoded = base64.b64encode(PNG_BYTES + b"\x00" * 64).decode()
        value = f"data:image/png;base64,{encoded}"
        with patch.object(users, "MAX_AVATAR_UPLOAD_BYTES", 8):
            with self.assertRaises(HTTPException) as ctx:
                users._sanitize_avatar_url(value)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_too_long_url_rejected(self):
        with self.assertRaises(HTTPException):
            users._sanitize_avatar_url("https://example.com/" + "a" * 3000)


if __name__ == "__main__":
    unittest.main(verbosity=2)
