"""Regression tests for communication template discovery."""

from app.services.communications.email import EmailService
from app.services.communications.pdf_reports import PDFReportService


def test_pdf_report_template_is_available(test_db):
    service = PDFReportService(test_db)

    template = service.jinja_env.get_template("pdf/daily_report.html")

    assert template.filename.endswith("app/templates/pdf/daily_report.html")


def test_daily_report_email_template_is_available():
    service = EmailService()

    template = service.jinja_env.get_template("daily_report.html")

    assert template.filename.endswith("app/templates/emails/daily_report.html")
