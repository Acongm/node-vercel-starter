#!/usr/bin/env python3
"""#37 live quality gate for the production nest project.

Applies only missing additive migrations, then proves User/Chat/Settings
against https://api.acongm.com with ephemeral Supabase users.

Required env:
  ACONGM_SUPABASE_ACCESS_TOKEN

Never prints tokens, passwords, or provider secrets.
"""

from __future__ import annotations

import json
import os
import secrets
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REF = "ejprvntpxlyydkzsjqnv"
SUPABASE_URL = f"https://{REF}.supabase.co"
API_URL = os.environ.get("LIVE_API_URL", "https://api.acongm.com")
BROWSER_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = [
    (
        "20260808050000",
        "comments_constraints_repair",
        ROOT / "supabase/migrations/20260808050000_comments_constraints_repair.sql",
    ),
    (
        "20260814010000",
        "user_settings",
        ROOT / "supabase/migrations/20260814010000_user_settings.sql",
    ),
]


class GateError(RuntimeError):
    pass


def management(method: str, path: str, token: str, payload: dict | None = None):
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": BROWSER_UA,
    }
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.supabase.com/v1{path}",
        data=data,
        headers=headers,
        method=method,
    )
    return _send(req)


def sql(token: str, query: str):
    status, body = management(
        "POST",
        f"/projects/{REF}/database/query",
        token,
        {"query": query},
    )
    if status >= 400:
        raise GateError(f"SQL failed ({status}): {json.dumps(body)[:800]}")
    return body


def _send(req: urllib.request.Request):
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = {"raw": raw[:800]}
        return exc.code, parsed


def http_json(
    method: str,
    url: str,
    headers: dict[str, str] | None = None,
    payload: dict | None = None,
):
    req_headers = {"Accept": "application/json", "User-Agent": BROWSER_UA}
    if headers:
        req_headers.update(headers)
    data = None
    if payload is not None:
        req_headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    return _send(req)


def split_sql(text: str) -> list[str]:
    statements: list[str] = []
    current: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("--") and not current:
            continue
        current.append(line)
        if stripped.endswith(";"):
            statement = "\n".join(current).strip()
            if statement:
                statements.append(statement)
            current = []
    tail = "\n".join(current).strip()
    if tail:
        statements.append(tail)
    return statements


def applied_versions(token: str) -> set[str]:
    rows = sql(
        token,
        "select version from supabase_migrations.schema_migrations",
    )
    return {row["version"] for row in rows}


def apply_missing_migrations(token: str, evidence: dict) -> None:
    comments = sql(
        token,
        """
        select
          count(*) filter (where char_length(author) not between 1 and 80) as bad_author,
          count(*) filter (where char_length(content) not between 1 and 2000) as bad_content,
          count(*) as total
        from public.comments
        """,
    )[0]
    evidence["comments_precheck"] = comments
    if comments["bad_author"] or comments["bad_content"]:
        raise GateError(f"comments rows violate intended CHECKs: {comments}")

    current = applied_versions(token)
    applied: list[str] = []
    skipped: list[str] = []
    for version, name, path in MIGRATIONS:
        if version in current:
            skipped.append(f"{version}_{name}")
            continue
        for statement in split_sql(path.read_text()):
            sql(token, statement)
        sql(
            token,
            f"""
            insert into supabase_migrations.schema_migrations (version, name)
            values ('{version}', '{name}')
            """,
        )
        applied.append(f"{version}_{name}")
    evidence["migrations_applied"] = applied
    evidence["migrations_already_present"] = skipped


def verify_schema(token: str, evidence: dict) -> None:
    checks = sql(
        token,
        """
        select conname, pg_get_constraintdef(oid) as def
        from pg_constraint
        where conrelid = 'public.comments'::regclass and contype = 'c'
        order by conname
        """,
    )
    names = {row["conname"] for row in checks}
    if "comments_author_check" not in names or "comments_content_check" not in names:
        raise GateError(f"comments CHECKs missing after apply: {checks}")
    table = sql(token, "select to_regclass('public.user_settings') as rel")[0]["rel"]
    if table != "user_settings":
        raise GateError("public.user_settings was not created")
    versions = sorted(applied_versions(token))
    evidence["comments_checks"] = checks
    evidence["user_settings_table"] = table
    evidence["migration_versions"] = versions
    for version, _, _ in MIGRATIONS:
        if version not in versions:
            raise GateError(f"migration {version} missing from history")


def fetch_keys(token: str) -> dict[str, str]:
    status, body = management("GET", f"/projects/{REF}/api-keys", token)
    if status >= 400 or not isinstance(body, list):
        raise GateError(f"api-keys failed ({status})")
    keys: dict[str, str] = {}
    for item in body:
        key_type = item.get("type") or ""
        value = item.get("api_key") or ""
        if key_type and value:
            keys[key_type] = value
    if "legacy" in keys and "anon" not in keys:
        # Management API labels anon/service_role as type=legacy + name.
        for item in body:
            name = item.get("name")
            value = item.get("api_key") or ""
            if name in {"anon", "service_role"} and value:
                keys[name] = value
    if "anon" not in keys or "service_role" not in keys:
        raise GateError("anon/service_role keys unavailable")
    return keys


def create_user(keys: dict[str, str], email: str, password: str) -> str:
    status, body = http_json(
        "POST",
        f"{SUPABASE_URL}/auth/v1/admin/users",
        {
            "apikey": keys["service_role"],
            "Authorization": f"Bearer {keys['service_role']}",
        },
        {"email": email, "password": password, "email_confirm": True},
    )
    if status >= 400:
        raise GateError(f"create user failed ({status}): {json.dumps(body)[:400]}")
    return body["id"]


def sign_in(keys: dict[str, str], email: str, password: str) -> str:
    status, body = http_json(
        "POST",
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        {"apikey": keys["anon"]},
        {"email": email, "password": password},
    )
    if status >= 400 or not body or "access_token" not in body:
        raise GateError(f"sign-in failed ({status})")
    return body["access_token"]


def delete_user(keys: dict[str, str], user_id: str) -> None:
    req = urllib.request.Request(
        f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
        headers={
            "apikey": keys["service_role"],
            "Authorization": f"Bearer {keys['service_role']}",
            "User-Agent": BROWSER_UA,
        },
        method="DELETE",
    )
    _send(req)


def api(method: str, path: str, token: str | None = None, payload: dict | None = None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return http_json(method, f"{API_URL}{path}", headers, payload)


def expect_code(status: int, body, expected: str, evidence_key: str, evidence: dict):
    code = None
    if isinstance(body, dict):
        code = body.get("code") or (body.get("error") or {}).get("code")
    evidence[evidence_key] = {"status": status, "code": code}
    if status not in {401, 403} or code != expected:
        raise GateError(f"{evidence_key} expected {expected}, got {status} {code}")


def prove_unauthenticated(evidence: dict) -> None:
    status, body = api("GET", "/api/health")
    evidence["health"] = {
        "status": status,
        "dataMode": (body or {}).get("dataMode"),
        "ok": (body or {}).get("ok"),
    }
    if status != 200 or (body or {}).get("dataMode") != "supabase":
        raise GateError(f"health unexpected: {body}")

    status, body = api("GET", "/api/user/info")
    expect_code(status, body, "AUTH_REQUIRED", "user_info_no_token", evidence)

    status, body = api("GET", "/api/chats")
    expect_code(status, body, "AUTH_REQUIRED", "chats_no_token", evidence)

    status, body = api("GET", "/api/user/info", token="not-a-jwt")
    expect_code(status, body, "INVALID_TOKEN", "user_info_invalid_token", evidence)


def prove_authenticated(token: str, keys: dict[str, str], evidence: dict) -> None:
    stamp = str(int(time.time()))
    password = secrets.token_urlsafe(24)
    users = [
        {
            "label": "a",
            "email": f"qg-770c-a-{stamp}@acongm.invalid",
            "password": password,
        },
        {
            "label": "b",
            "email": f"qg-770c-b-{stamp}@acongm.invalid",
            "password": password,
        },
    ]
    created: list[str] = []
    try:
        for user in users:
            user["id"] = create_user(keys, user["email"], user["password"])
            created.append(user["id"])
            user["token"] = sign_in(keys, user["email"], user["password"])

        status, info = api("GET", "/api/user/info", token=users[0]["token"])
        if status != 200 or not isinstance(info, dict):
            raise GateError(f"getUserInfo failed ({status})")
        user_info = info.get("userInfo") or {}
        evidence["getUserInfo"] = {
            "status": status,
            "id": info.get("id"),
            "hasUserInfo": bool(user_info),
            "displayName": bool(user_info.get("displayName") or user_info.get("accountLabel")),
            "isAnonymous": info.get("isAnonymous"),
        }
        if info.get("id") != users[0]["id"]:
            raise GateError("getUserInfo id does not match created user")

        status, settings = api("GET", "/api/user/settings", token=users[0]["token"])
        if status != 200 or "effective" not in (settings or {}):
            raise GateError(f"GET settings failed ({status})")
        evidence["settings_defaults"] = {
            "status": status,
            "schemaVersion": settings.get("schemaVersion"),
            "hasEffective": "effective" in settings,
            "hasDefaults": "defaults" in settings,
        }

        status, patched = api(
            "PATCH",
            "/api/user/settings",
            token=users[0]["token"],
            payload={"theme": "dark", "defaultPrompt": "Be concise."},
        )
        if status != 200:
            raise GateError(f"PATCH settings failed ({status}): {json.dumps(patched)[:400]}")
        document = (patched or {}).get("settings") or patched or {}
        effective = document.get("effective") or {}
        evidence["settings_patch"] = {
            "status": status,
            "theme": effective.get("theme"),
            "defaultPrompt": (effective.get("chat") or {}).get("defaultPrompt"),
            "hasUserInfo": bool((patched or {}).get("userInfo")),
        }
        if effective.get("theme") != "dark":
            raise GateError("settings PATCH did not persist theme=dark")

        row = sql(
            token,
            f"select theme, default_prompt from public.user_settings where user_id = '{users[0]['id']}'",
        )
        evidence["user_settings_row"] = {
            "present": bool(row),
            "theme": row[0]["theme"] if row else None,
        }
        if not row or row[0]["theme"] != "dark":
            raise GateError("user_settings row missing after PATCH")

        status, chat = api(
            "POST",
            "/api/chats",
            token=users[0]["token"],
            payload={"title": "qg-770c live gate", "pagePath": "/quality-gate"},
        )
        if status not in {200, 201} or not (chat or {}).get("id"):
            raise GateError(f"create chat failed ({status}): {json.dumps(chat)[:400]}")
        chat_id = chat["id"]
        evidence["create_chat"] = {"status": status, "id": chat_id}

        status, listed = api("GET", "/api/chats", token=users[0]["token"])
        chats = (listed or {}).get("chats") or listed
        evidence["list_chats"] = {
            "status": status,
            "count": len(chats) if isinstance(chats, list) else None,
        }
        if status != 200:
            raise GateError(f"list chats failed ({status})")

        status, hidden = api("GET", f"/api/chats/{chat_id}", token=users[1]["token"])
        evidence["cross_user_get"] = {"status": status, "code": (hidden or {}).get("code")}
        if status not in {403, 404}:
            raise GateError(f"cross-user get should hide chat, got {status}")

        status, _ = api("DELETE", f"/api/chats/{chat_id}", token=users[0]["token"])
        evidence["delete_chat"] = {"status": status}
        if status not in {200, 204}:
            raise GateError(f"delete chat failed ({status})")
    finally:
        for user_id in created:
            delete_user(keys, user_id)
        evidence["ephemeral_users_deleted"] = len(created)


def auth_config_flags(token: str, evidence: dict) -> None:
    status, body = management("GET", f"/projects/{REF}/config/auth", token)
    if status >= 400 or not isinstance(body, dict):
        raise GateError(f"auth config failed ({status})")
    evidence["auth_flags"] = {
        "external_anonymous_users_enabled": body.get("external_anonymous_users_enabled"),
        "security_manual_linking_enabled": body.get("security_manual_linking_enabled"),
        "external_github_enabled": body.get("external_github_enabled"),
        "external_google_enabled": body.get("external_google_enabled"),
        "site_url": body.get("site_url"),
        "uri_allow_list_empty": not bool(body.get("uri_allow_list")),
    }


def main() -> int:
    token = os.environ.get("ACONGM_SUPABASE_ACCESS_TOKEN")
    if not token:
        print("ACONGM_SUPABASE_ACCESS_TOKEN is required", file=sys.stderr)
        return 2

    evidence: dict = {
        "project": REF,
        "api": API_URL,
        "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    try:
        auth_config_flags(token, evidence)
        apply_missing_migrations(token, evidence)
        verify_schema(token, evidence)
        prove_unauthenticated(evidence)
        keys = fetch_keys(token)
        prove_authenticated(token, keys, evidence)
        evidence["ok"] = True
    except Exception as exc:  # noqa: BLE001 — gate must record any failure
        evidence["ok"] = False
        evidence["error"] = str(exc)
        print(json.dumps(evidence, indent=2))
        return 1

    evidence["finishedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    print(json.dumps(evidence, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
