import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import get_settings

logger = logging.getLogger("tiny-hr-email")
settings = get_settings()


def send_email_notification(to_email: str, subject: str, html_body: str):
    """
    Sends email notification. If SMTP settings are specified in settings,
    sends a real secure SMTP email. Otherwise, falls back to logging mock format.
    """
    sent_real = False
    
    if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
        try:
            # Create message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_FROM
            msg["To"] = to_email
            
            # Record the MIME type html.
            part = MIMEText(html_body, "html")
            msg.attach(part)
            
            # Establish secure session
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10.0) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM, to_email, msg.as_string())
                
            logger.info(f"📧 [REAL EMAIL SENT] To: {to_email}, Subject: {subject}")
            sent_real = True
        except Exception as e:
            logger.error(f"❌ Real SMTP send failed, falling back to mock logger: {str(e)}")

    if not sent_real:
        separator = "=" * 60
        logger.info(
            f"\n{separator}\n"
            f"📧 [MOCK EMAIL SENT]\n"
            f"📅 Date & Time:  Universal standard log\n"
            f"✉️ To:           {to_email}\n"
            f"📌 Subject:      {subject}\n"
            f"{separator}\n"
            f"{html_body}\n"
            f"{separator}\n"
        )
        # Also print directly to ensure it reaches docker container output logs visible to developers
        print(
            f"\n{separator}\n"
            f"📧 [MOCK EMAIL SENT]\n"
            f"✉️ To:           {to_email}\n"
            f"📌 Subject:      {subject}\n"
            f"{separator}\n"
            f"{html_body}\n"
            f"{separator}\n",
            flush=True
        )

