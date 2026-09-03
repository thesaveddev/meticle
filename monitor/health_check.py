#!/usr/bin/env python3
"""
Meticle Docker Health Monitor
Checks all containers and services, sends email alerts on failures.
Runs via cron every 5 minutes.
"""

import subprocess
import smtplib
import json
import os
import sys
import time
from email.mime.text import MIMEText
from datetime import datetime, timezone

# --- Configuration ---
COMPOSE_DIR = "/opt/meticle"
STATE_FILE = f"{COMPOSE_DIR}/monitor/.health_state.json"
LOG_FILE = f"{COMPOSE_DIR}/monitor/health_check.log"


def load_env_file(path):
    """Load simple KEY=VALUE entries without overriding the process environment."""
    try:
        with open(path) as f:
            for raw_line in f:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                    value = value[1:-1]
                os.environ.setdefault(key.strip(), value)
    except OSError:
        pass


load_env_file(f"{COMPOSE_DIR}/.env")
SMTP_HOST = os.environ.get("SMTP_HOST")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASS = os.environ.get("SMTP_PASS")
SMTP_FROM = os.environ.get("SMTP_FROM")
ALERT_TO = os.environ.get("ALERT_TO", "itsopeyemi@gmail.com")

# Services to monitor. Resolve the current container ID through Compose so
# recreates, project-name changes, and container suffixes do not create false
# "missing container" alerts.
CONTAINERS = {
    "api": {"role": "API server", "critical": True},
    "web": {"role": "Web frontend", "critical": True},
    "db": {"role": "PostgreSQL database", "critical": True},
    "redis": {"role": "Redis cache", "critical": True},
}

# Health endpoints to probe
HEALTH_PROBES = [
    {"name": "API health/live", "url": "http://localhost:3002/health/live", "timeout": 10},
    {"name": "API health/ready", "url": "http://localhost:3002/health/ready", "timeout": 10},
    {"name": "Web frontend", "url": "http://localhost:3000/", "timeout": 10},
]

# Cooldown: dont re-alert for the same issue within this many seconds
ALERT_COOLDOWN = 1800  # 30 minutes


def log(msg):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    line = f"[{ts}] {msg}"
    print(line)
    try:
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
        if os.path.getsize(LOG_FILE) > 1_000_000:
            with open(LOG_FILE, "r") as f:
                lines = f.readlines()
            with open(LOG_FILE, "w") as f:
                f.writelines(lines[-500:])
    except Exception:
        pass


def load_state():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_state(state):
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def check_container(service):
    try:
        container = subprocess.run(
            ["docker", "compose", "-f", f"{COMPOSE_DIR}/docker-compose.prod.yml", "ps", "-q", service],
            capture_output=True, text=True, timeout=10
        )
        container_id = container.stdout.strip().splitlines()[0] if container.returncode == 0 and container.stdout.strip() else ""
        if not container_id:
            return {"status": "missing", "health": "unknown", "restarts": 0}
        result = subprocess.run(
            ["docker", "inspect", "--format",
             "{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}|{{.RestartCount}}",
             container_id],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return {"status": "missing", "health": "unknown", "restarts": 0}
        parts = result.stdout.strip().split("|")
        return {
            "status": parts[0] if len(parts) > 0 else "unknown",
            "health": parts[1] if len(parts) > 1 else "unknown",
            "restarts": int(parts[2]) if len(parts) > 2 else 0,
        }
    except Exception:
        return {"status": "error", "health": "unknown", "restarts": 0}


def check_probe(probe):
    try:
        result = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
             "--connect-timeout", str(probe["timeout"]),
             "--max-time", str(probe["timeout"]),
             probe["url"]],
            capture_output=True, text=True, timeout=probe["timeout"] + 5
        )
        code = int(result.stdout.strip()) if result.stdout.strip() else 0
        return {"ok": 200 <= code < 400, "status_code": code}
    except Exception as e:
        return {"ok": False, "status_code": 0, "error": str(e)}


def check_disk():
    try:
        result = subprocess.run(
            ["df", "--output=pcent", "/"],
            capture_output=True, text=True, timeout=5
        )
        lines = result.stdout.strip().split("\n")
        if len(lines) > 1:
            usage = int(lines[1].strip().rstrip("%"))
            return {"ok": usage < 90, "usage_percent": usage}
    except Exception:
        pass
    return {"ok": True, "usage_percent": 0}


def check_memory():
    try:
        result = subprocess.run(
            ["free", "-m"],
            capture_output=True, text=True, timeout=5
        )
        for line in result.stdout.split("\n"):
            if line.startswith("Mem:"):
                parts = line.split()
                total = int(parts[1])
                available = int(parts[6]) if len(parts) > 6 else int(parts[3])
                usage_pct = ((total - available) / total) * 100
                return {"ok": usage_pct < 90, "usage_percent": round(usage_pct)}
    except Exception:
        pass
    return {"ok": True, "usage_percent": 0}


def should_alert(state, key):
    now = time.time()
    last_alert = state.get(key, 0)
    return (now - last_alert) > ALERT_COOLDOWN


def mark_alerted(state, key):
    state[key] = time.time()


def clear_alert(state, key):
    state.pop(key, None)


def send_email(subject, body):
    if not all((SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM, ALERT_TO)):
        log("Alert email skipped: SMTP configuration is incomplete")
        return False
    try:
        msg = MIMEText(body, "plain")
        msg["Subject"] = f"[Meticle Monitor] {subject}"
        msg["From"] = SMTP_FROM
        msg["To"] = ALERT_TO

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        log(f"Alert email sent: {subject}")
        return True
    except Exception as e:
        log(f"Failed to send email: {e}")
        return False


def run_checks():
    issues = []
    warnings = []
    recovered = []
    state = load_state()

    # 1. Check containers
    for name, config in CONTAINERS.items():
        info = check_container(name)
        alert_key = f"container:{name}"

        if info["status"] != "running":
            issues.append(f"Container service {name} ({config['role']}) is {info['status'].upper()}")
            if should_alert(state, alert_key):
                send_email(
                    f"ALERT: {config['role']} is {info['status']}",
                    f"The Compose service '{name}' ({config['role']}) is {info['status']}.\n\n"
                    f"Run: cd {COMPOSE_DIR} && docker compose -f docker-compose.prod.yml logs {name} --tail=50\n"
                    f"Fix: cd {COMPOSE_DIR} && docker compose -f docker-compose.prod.yml restart {name}"
                )
                mark_alerted(state, alert_key)
        elif info["health"] == "unhealthy":
            issues.append(f"Container {name} ({config['role']}) is unhealthy")
            if should_alert(state, alert_key):
                send_email(
                    f"ALERT: {config['role']} is unhealthy",
                    f"The Compose service '{name}' ({config['role']}) reports unhealthy status.\n\n"
                    f"Run: cd {COMPOSE_DIR} && docker compose -f docker-compose.prod.yml ps {name} && docker compose -f docker-compose.prod.yml logs {name} --tail=50"
                )
                mark_alerted(state, alert_key)
        elif info["restarts"] > 5:
            warnings.append(f"Container {name} has restarted {info['restarts']} times")
            if should_alert(state, f"{alert_key}:restarts"):
                send_email(
                    f"WARNING: {config['role']} restarting frequently",
                    f"The Compose service '{name}' ({config['role']}) has restarted {info['restarts']} times.\n\n"
                    f"Check: cd {COMPOSE_DIR} && docker compose -f docker-compose.prod.yml logs {name} --tail=100"
                )
                mark_alerted(state, f"{alert_key}:restarts")
        else:
            if alert_key in state:
                recovered.append(f"{config['role']} ({name}) recovered")
                clear_alert(state, alert_key)

    # 2. Run HTTP probes
    for probe in HEALTH_PROBES:
        result = check_probe(probe)
        alert_key = f"probe:{probe['name']}"

        if not result["ok"]:
            code = result.get("status_code", 0)
            issues.append(f"Probe '{probe['name']}' returned {code}")
            if should_alert(state, alert_key):
                send_email(
                    f"ALERT: {probe['name']} unreachable (HTTP {code})",
                    f"The health probe '{probe['name']}' at {probe['url']} returned HTTP {code}.\n\n"
                    f"This may indicate the API or web server is down."
                )
                mark_alerted(state, alert_key)
        else:
            if alert_key in state:
                recovered.append(f"Probe '{probe['name']}' recovered")
                clear_alert(state, alert_key)

    # 3. Check disk
    disk = check_disk()
    disk_key = "system:disk"
    if not disk["ok"]:
        issues.append(f"Disk usage at {disk['usage_percent']}%")
        if should_alert(state, disk_key):
            send_email(
                f"ALERT: Disk usage critical ({disk['usage_percent']}%)",
                f"Disk usage on the VPS is at {disk['usage_percent']}%.\n\n"
                f"Run: df -h / && docker system prune -f"
            )
            mark_alerted(state, disk_key)
    else:
        if disk["usage_percent"] > 75:
            warnings.append(f"Disk usage at {disk['usage_percent']}%")
        if disk_key in state:
            recovered.append(f"Disk usage recovered to {disk['usage_percent']}%")
            clear_alert(state, disk_key)

    # 4. Check memory
    mem = check_memory()
    mem_key = "system:memory"
    if not mem["ok"]:
        issues.append(f"Memory usage at {mem['usage_percent']}%")
        if should_alert(state, mem_key):
            send_email(
                f"ALERT: Memory usage critical ({mem['usage_percent']}%)",
                f"Memory usage on the VPS is at {mem['usage_percent']}%.\n\n"
                f"Run: free -m && docker stats --no-stream"
            )
            mark_alerted(state, mem_key)
    else:
        if mem_key in state:
            recovered.append(f"Memory usage recovered to {mem['usage_percent']}%")
            clear_alert(state, mem_key)

    # 5. Send recovery notification if all clear and was previously down
    if recovered and not issues:
        recovery_key = "system:recovery_sent"
        last_recovery = state.get(recovery_key, 0)
        if (time.time() - last_recovery) > 3600:
            send_email(
                "RECOVERY: All services restored",
                "All monitored services have recovered:\n\n" +
                "\n".join(f"  - {r}" for r in recovered) +
                "\n\nCurrent status: All systems operational."
            )
            state[recovery_key] = time.time()

    save_state(state)
    return issues, warnings, recovered


def main():
    log("Health check started")
    issues, warnings, recovered = run_checks()

    if issues:
        log(f"ISSUES ({len(issues)}): " + "; ".join(issues))
    if warnings:
        log(f"WARNINGS ({len(warnings)}): " + "; ".join(warnings))
    if recovered:
        log(f"RECOVERED ({len(recovered)}): " + "; ".join(recovered))
    if not issues and not warnings:
        log("All checks passed")

    sys.exit(1 if issues else 0)


if __name__ == "__main__":
    main()
