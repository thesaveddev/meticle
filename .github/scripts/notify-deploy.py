import json
import os
import smtplib
import ssl
import urllib.request
from email.mime.text import MIMEText


def send_slack(message: str, webhook_url: str) -> None:
    payload = json.dumps({"text": message}).encode("utf-8")
    request = urllib.request.Request(
        webhook_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status >= 300:
            raise RuntimeError(f"Slack returned HTTP {response.status}")


def send_email(message: str, subject: str) -> None:
    host = os.environ.get("DEPLOY_SMTP_HOST", "")
    user = os.environ.get("DEPLOY_SMTP_USER", "")
    password = os.environ.get("DEPLOY_SMTP_PASS", "")
    sender = os.environ.get("DEPLOY_SMTP_FROM", "")
    recipient = os.environ.get("DEPLOY_ALERT_TO", "")
    if not all((host, user, password, sender, recipient)):
        print("Email deployment alert skipped: SMTP configuration is incomplete")
        return

    mail = MIMEText(message, "plain", "utf-8")
    mail["Subject"] = subject
    mail["From"] = sender
    mail["To"] = recipient
    port = int(os.environ.get("DEPLOY_SMTP_PORT", "587"))
    secure = os.environ.get("DEPLOY_SMTP_SECURE", "false").lower() == "true"
    if secure:
        with smtplib.SMTP_SSL(host, port, timeout=20, context=ssl.create_default_context()) as server:
            server.login(user, password)
            server.send_message(mail)
    else:
        with smtplib.SMTP(host, port, timeout=20) as server:
            server.starttls(context=ssl.create_default_context())
            server.login(user, password)
            server.send_message(mail)
    print("Email deployment alert sent")


stage = os.environ.get("FAILED_STAGE", "production deployment or rollback")
commit = os.environ.get("COMMIT_SHA", "unknown commit")
branch = os.environ.get("BRANCH_NAME", "unknown branch")
api_result = os.environ.get("BUILD_API_RESULT", "unknown")
web_result = os.environ.get("BUILD_WEB_RESULT", "unknown")
deploy_result = os.environ.get("DEPLOY_RESULT", "unknown")
run_url = os.environ.get("RUN_URL", "")
message = (
    "Meticle deployment failed.\n\n"
    f"Stage: {stage}\n"
    f"Commit: {commit}\n"
    f"Branch: {branch}\n"
    f"API build: {api_result}\n"
    f"Web build: {web_result}\n"
    f"Deploy result: {deploy_result}\n\n"
    f"Review the workflow: {run_url}\n"
)

webhook_url = os.environ.get("SLACK_WEBHOOK_URL", "")
if webhook_url:
    try:
        send_slack(message, webhook_url)
        print("Slack deployment alert sent")
    except Exception as error:
        print(f"Slack deployment alert failed: {error}")
else:
    print("Slack deployment alert skipped: webhook is not configured")

try:
    send_email(message, f"Meticle deployment failed: {stage}")
except Exception as error:
    print(f"Email deployment alert failed: {error}")
