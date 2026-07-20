import os
import resend

resend.api_key = os.getenv("RESEND_API_KEY")


def send_email(to: str, subject: str, html: str):
    return resend.Emails.send({
        "from": os.getenv("EMAIL_FROM"),
        "to": [to],
        "subject": subject,
        "html": html,
    })


def send_verification_email(email: str, verification_url: str):
    subject = "Verify your TourPie account"

    html = f"""
<h2>Welcome to TourPie!</h2>

<p>Thanks for creating your account.</p>

<p>Please verify your email by clicking the link below:</p>

<p>
    <a href="{verification_url}">
        Verify Email
    </a>
</p>
"""

    return send_email(
        to=email,
        subject=subject,
        html=html,
    )