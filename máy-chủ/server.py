"""Local development server for Moc Thu (Python standard library only)."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import urllib.parse
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "thu_vien.sqlite3"
HOST = "127.0.0.1"
PORT = int(os.environ.get("MOC_THU_PORT", "8000"))
SESSION_HOURS = 8
PASSWORD_ROUNDS = 310_000

ROLE_HOME = {
    "admin": "/quản lí/giao diện/trang-chủ.html",
    "librarian": "/thủ thư/giao diện/trang-chủ.html",
    "reader": "/Độc giả/giao diện/trang-chủ.html",
}
LOGIN_PAGE = "/xác-thực/giao diện/dang-nhap.html"
ROLE_PREFIX = {
    "/quản lí/": "admin",
    "/thủ thư/": "librarian",
    "/Độc giả/": "reader",
}
SEED_BOOKS = [
    ("Nhà giả kim", "Paulo Coelho", "VH-00124", "Văn học", 25, 18, 5, "A-02-14", "Tốt"),
    ("Tuổi trẻ đáng giá bao nhiêu", "Rosie Nguyễn", "KN-00087", "Kỹ năng sống", 20, 14, 8, "B-01-08", "Tốt"),
    ("Đắc nhân tâm", "Dale Carnegie", "KN-00031", "Kỹ năng sống", 3, 2, 5, "B-03-02", "Cũ"),
    ("Rừng Na Uy", "Haruki Murakami", "VH-00209", "Văn học", 18, 11, 5, "A-04-22", "Tốt"),
    ("Sống xanh mỗi ngày", "Katherine Martinko", "MT-00064", "Khác", 4, 0, 3, "C-02-01", "Tốt"),
]


def connect_db() -> sqlite3.Connection:
    DATA_DIR.mkdir(exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


def initialize_db() -> None:
    with connect_db() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL COLLATE NOCASE UNIQUE,
                full_name TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin', 'librarian', 'reader')),
                password_salt TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_sessions_expiry ON sessions(expires_at);
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                author TEXT NOT NULL,
                code TEXT NOT NULL COLLATE NOCASE UNIQUE,
                category TEXT NOT NULL DEFAULT 'Khác',
                stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
                borrowed INTEGER NOT NULL DEFAULT 0 CHECK (borrowed >= 0 AND borrowed <= stock),
                minimum INTEGER NOT NULL DEFAULT 0 CHECK (minimum >= 0),
                location TEXT NOT NULL DEFAULT '',
                quality TEXT NOT NULL DEFAULT 'Tốt',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action TEXT NOT NULL,
                detail TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            );
            """
        )
        if db.execute("SELECT COUNT(*) FROM books").fetchone()[0] == 0:
            now = utc_now()
            db.executemany(
                """INSERT INTO books
                (name, author, code, category, stock, borrowed, minimum, location, quality, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [(*book, now, now) for book in SEED_BOOKS],
            )


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def password_digest(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ROUNDS)


def safe_user(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "username": row["username"],
        "fullName": row["full_name"],
        "role": row["role"],
        "status": row["status"],
        "createdAt": row["created_at"],
    }


def log_action(db: sqlite3.Connection, user_id: int | None, action: str, detail: str = "") -> None:
    db.execute(
        "INSERT INTO audit_log (user_id, action, detail, created_at) VALUES (?, ?, ?, ?)",
        (user_id, action, detail[:240], utc_now()),
    )


class LibraryHandler(SimpleHTTPRequestHandler):
    server_version = "MocThu/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def send_json(self, status: int, value: dict) -> None:
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict:
        try:
            length = max(0, min(int(self.headers.get("Content-Length", "0")), 64_000))
            value = json.loads(self.rfile.read(length) or b"{}")
            return value if isinstance(value, dict) else {}
        except (ValueError, json.JSONDecodeError):
            raise ValueError("Dữ liệu gửi lên không hợp lệ.")

    def path_only(self) -> str:
        return urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)

    def current_user(self) -> sqlite3.Row | None:
        cookie = self.headers.get("Cookie", "")
        token = None
        for item in cookie.split(";"):
            key, separator, value = item.strip().partition("=")
            if separator and key == "moc_thu_session":
                token = value
                break
        if not token:
            return None
        token_hash = hashlib.sha256(token.encode("ascii", "ignore")).hexdigest()
        now = utc_now()
        with connect_db() as db:
            row = db.execute(
                """SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
                   WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'""",
                (token_hash, now),
            ).fetchone()
            if row is None:
                db.execute("DELETE FROM sessions WHERE token_hash = ? OR expires_at <= ?", (token_hash, now))
            return row

    def require_user(self, roles: set[str] | None = None) -> sqlite3.Row | None:
        user = self.current_user()
        if user is None:
            self.send_json(401, {"error": "Vui lòng đăng nhập lại."})
            return None
        if roles and user["role"] not in roles:
            self.send_json(403, {"error": "Tài khoản không có quyền thực hiện thao tác này."})
            return None
        return user

    def set_session_cookie(self, token: str, max_age: int) -> None:
        self.send_header(
            "Set-Cookie",
            f"moc_thu_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={max_age}",
        )

    def role_for_path(self, path: str) -> str | None:
        for prefix, role in ROLE_PREFIX.items():
            if path.startswith(prefix):
                return role
        return None

    @staticmethod
    def redirect_target(path: str) -> str:
        # HTTP headers must be ASCII-safe; quote Vietnamese folder names.
        return urllib.parse.quote(path, safe="/")

    def do_HEAD(self):
        # Static pages are role-protected in do_GET; do not expose them through HEAD.
        self.send_error(405, "HEAD is not supported")

    def do_GET(self):
        path = self.path_only()
        if path in ("/", "/index.html"):
            user = self.current_user()
            self.send_response(302)
            target = ROLE_HOME[user["role"]] if user else LOGIN_PAGE
            self.send_header("Location", self.redirect_target(target))
            self.end_headers()
            return
        if path == "/api/setup/status":
            with connect_db() as db:
                exists = db.execute("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").fetchone() is not None
            self.send_json(200, {"needsSetup": not exists})
            return
        if path == "/api/session":
            user = self.require_user()
            if user:
                self.send_json(200, {"user": safe_user(user)})
            return
        if path == "/api/users":
            user = self.require_user({"admin"})
            if user:
                with connect_db() as db:
                    rows = db.execute("SELECT * FROM users ORDER BY created_at DESC, id DESC").fetchall()
                self.send_json(200, {"users": [safe_user(row) for row in rows]})
            return
        if path == "/api/books":
            if not self.require_user():
                return
            with connect_db() as db:
                rows = db.execute("SELECT * FROM books ORDER BY id DESC").fetchall()
            self.send_json(200, {"books": [dict(row) for row in rows]})
            return
        if path.startswith("/api/"):
            self.send_json(404, {"error": "Không tìm thấy API."})
            return

        expected_role = self.role_for_path(path)
        if expected_role:
            user = self.current_user()
            if user is None:
                self.send_response(302)
                self.send_header("Location", self.redirect_target(LOGIN_PAGE))
                self.end_headers()
                return
            if user["role"] != expected_role:
                self.send_response(302)
                self.send_header("Location", self.redirect_target(ROLE_HOME[user["role"]]))
                self.end_headers()
                return
        relative = Path(path.lstrip("/"))
        if any(part.startswith(".") or part.lower() == "data" for part in relative.parts) or relative.suffix in {".py", ".sqlite", ".sqlite3", ".db"}:
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        path = self.path_only()
        try:
            data = self.read_json()
        except ValueError as exc:
            self.send_json(400, {"error": str(exc)})
            return

        if path == "/api/setup":
            full_name = str(data.get("fullName", "")).strip()
            username = str(data.get("username", "")).strip()
            password = str(data.get("password", ""))
            if not full_name or not re.fullmatch(r"[A-Za-z0-9._-]{3,32}", username) or len(password) < 12:
                self.send_json(400, {"error": "Nhập họ tên, tên đăng nhập 3–32 ký tự và mật khẩu tối thiểu 12 ký tự."})
                return
            token = secrets.token_urlsafe(32)
            salt = secrets.token_bytes(16)
            now = utc_now()
            try:
                with connect_db() as db:
                    db.execute("BEGIN IMMEDIATE")
                    if db.execute("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").fetchone():
                        self.send_json(409, {"error": "Tài khoản quản trị đã được thiết lập."})
                        return
                    cursor = db.execute(
                        """INSERT INTO users (username, full_name, role, password_salt, password_hash, created_at)
                           VALUES (?, ?, 'admin', ?, ?, ?)""",
                        (username, full_name, salt.hex(), password_digest(password, salt).hex(), now),
                    )
                    user_id = cursor.lastrowid
                    db.execute(
                        "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
                        (hashlib.sha256(token.encode()).hexdigest(), user_id,
                         (datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS)).isoformat(timespec="seconds"), now),
                    )
                    log_action(db, user_id, "setup_admin", username)
                    created = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            except sqlite3.IntegrityError:
                self.send_json(409, {"error": "Tên đăng nhập đã tồn tại."})
                return
            body = json.dumps({"user": safe_user(created), "home": ROLE_HOME["admin"]}, ensure_ascii=False).encode("utf-8")
            self.send_response(201)
            self.set_session_cookie(token, SESSION_HOURS * 3600)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return

        if path == "/api/login":
            username = str(data.get("username", "")).strip()
            password = str(data.get("password", ""))
            with connect_db() as db:
                user = db.execute("SELECT * FROM users WHERE username = ? COLLATE NOCASE", (username,)).fetchone()
                valid = False
                if user:
                    try:
                        salt = bytes.fromhex(user["password_salt"])
                        expected = bytes.fromhex(user["password_hash"])
                        valid = hmac.compare_digest(password_digest(password, salt), expected)
                    except ValueError:
                        valid = False
                if not user or user["status"] != "active" or not valid:
                    log_action(db, user["id"] if user else None, "login_failed", username)
                    self.send_json(401, {"error": "Tên đăng nhập hoặc mật khẩu không đúng."})
                    return
                token = secrets.token_urlsafe(32)
                now = utc_now()
                db.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
                db.execute(
                    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
                    (hashlib.sha256(token.encode()).hexdigest(), user["id"],
                     (datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS)).isoformat(timespec="seconds"), now),
                )
                log_action(db, user["id"], "login", "")
                role = user["role"]
            body = json.dumps({"home": ROLE_HOME[role]}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.set_session_cookie(token, SESSION_HOURS * 3600)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return

        if path == "/api/logout":
            cookie = self.headers.get("Cookie", "")
            token = next((part.strip().split("=", 1)[1] for part in cookie.split(";") if part.strip().startswith("moc_thu_session=")), "")
            user = self.current_user()
            with connect_db() as db:
                if token:
                    db.execute("DELETE FROM sessions WHERE token_hash = ?", (hashlib.sha256(token.encode()).hexdigest(),))
                if user:
                    log_action(db, user["id"], "logout", "")
            body = b'{"ok":true}'
            self.send_response(200)
            self.send_header("Set-Cookie", "moc_thu_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0")
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if path == "/api/users":
            actor = self.require_user({"admin"})
            if not actor:
                return
            full_name = str(data.get("fullName", "")).strip()
            username = str(data.get("username", "")).strip()
            password = str(data.get("password", ""))
            role = str(data.get("role", ""))
            if not full_name or not re.fullmatch(r"[A-Za-z0-9._-]{3,32}", username) or len(password) < 10 or role not in ROLE_HOME:
                self.send_json(400, {"error": "Thông tin chưa hợp lệ; mật khẩu cần tối thiểu 10 ký tự."})
                return
            salt = secrets.token_bytes(16)
            try:
                with connect_db() as db:
                    cursor = db.execute(
                        """INSERT INTO users (username, full_name, role, password_salt, password_hash, created_at)
                           VALUES (?, ?, ?, ?, ?, ?)""",
                        (username, full_name, role, salt.hex(), password_digest(password, salt).hex(), utc_now()),
                    )
                    row = db.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
                    log_action(db, actor["id"], "user_created", f"{username}:{role}")
                self.send_json(201, {"user": safe_user(row)})
            except sqlite3.IntegrityError:
                self.send_json(409, {"error": "Tên đăng nhập đã tồn tại."})
            return

        if path == "/api/books":
            actor = self.require_user({"librarian"})
            if not actor:
                return
            try:
                book = self.book_input(data)
                now = utc_now()
                with connect_db() as db:
                    cursor = db.execute(
                        """INSERT INTO books (name, author, code, category, stock, borrowed, minimum, location, quality, created_at, updated_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (*book, now, now),
                    )
                    row = db.execute("SELECT * FROM books WHERE id = ?", (cursor.lastrowid,)).fetchone()
                    log_action(db, actor["id"], "book_created", row["code"])
                self.send_json(201, {"book": dict(row)})
            except (ValueError, sqlite3.IntegrityError) as exc:
                message = "Mã tài liệu đã tồn tại." if isinstance(exc, sqlite3.IntegrityError) else str(exc)
                self.send_json(400, {"error": message})
            return

        self.send_json(404, {"error": "Không tìm thấy API."})

    @staticmethod
    def book_input(data: dict) -> tuple:
        name = str(data.get("name", "")).strip()
        author = str(data.get("author", "")).strip()
        code = str(data.get("code", "")).strip()
        if not name or not author or not code:
            raise ValueError("Tên sách, tác giả và mã tài liệu là bắt buộc.")
        try:
            stock = max(0, int(data.get("stock", 0)))
            borrowed = max(0, int(data.get("borrowed", 0)))
            minimum = max(0, int(data.get("minimum", 0)))
        except (ValueError, TypeError):
            raise ValueError("Số lượng phải là số nguyên không âm.")
        if borrowed > stock:
            raise ValueError("Số bản đang mượn không thể vượt số bản trong kho.")
        return (name, author, code, str(data.get("category", "Khác")), stock, borrowed, minimum,
                str(data.get("location", "")).strip(), str(data.get("quality", "Tốt")))

    def do_PUT(self):
        path = self.path_only()
        match = re.fullmatch(r"/api/users/(\d+)", path)
        if match:
            actor = self.require_user({"admin"})
            if not actor:
                return
            try:
                data = self.read_json()
            except ValueError as exc:
                self.send_json(400, {"error": str(exc)})
                return
            user_id = int(match.group(1))
            status = data.get("status")
            full_name = str(data.get("fullName", "")).strip()
            role = data.get("role")
            if status not in (None, "active", "disabled") or role not in (None, "admin", "librarian", "reader"):
                self.send_json(400, {"error": "Vai trò hoặc trạng thái không hợp lệ."})
                return
            with connect_db() as db:
                target = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
                if not target:
                    self.send_json(404, {"error": "Không tìm thấy tài khoản."})
                    return
                if user_id == actor["id"] and (status == "disabled" or (role and role != "admin")):
                    self.send_json(400, {"error": "Không thể tự khóa hoặc hạ quyền tài khoản đang đăng nhập."})
                    return
                becomes_admin = (role or target["role"]) == "admin" and (status or target["status"]) == "active"
                removes_admin = target["role"] == "admin" and target["status"] == "active" and (role not in (None, "admin") or status == "disabled")
                if removes_admin and not becomes_admin:
                    remaining = db.execute("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active' AND id != ?", (user_id,)).fetchone()[0]
                    if remaining == 0:
                        self.send_json(400, {"error": "Hệ thống cần ít nhất một quản trị viên đang hoạt động."})
                        return
                db.execute("UPDATE users SET full_name = COALESCE(NULLIF(?, ''), full_name), role = COALESCE(?, role), status = COALESCE(?, status) WHERE id = ?",
                           (full_name, role, status, user_id))
                if status == "disabled":
                    db.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
                log_action(db, actor["id"], "user_updated", str(user_id))
                row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            self.send_json(200, {"user": safe_user(row)})
            return

        match = re.fullmatch(r"/api/books/(\d+)", path)
        if match:
            actor = self.require_user({"librarian"})
            if not actor:
                return
            try:
                data = self.read_json()
                book = self.book_input(data)
            except ValueError as exc:
                self.send_json(400, {"error": str(exc)})
                return
            book_id = int(match.group(1))
            try:
                with connect_db() as db:
                    db.execute("UPDATE books SET name=?, author=?, code=?, category=?, stock=?, borrowed=?, minimum=?, location=?, quality=?, updated_at=? WHERE id=?",
                               (*book, utc_now(), book_id))
                    row = db.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
                    if not row:
                        self.send_json(404, {"error": "Không tìm thấy tài liệu."})
                        return
                    log_action(db, actor["id"], "book_updated", row["code"])
                self.send_json(200, {"book": dict(row)})
            except sqlite3.IntegrityError:
                self.send_json(409, {"error": "Mã tài liệu đã tồn tại."})
            return
        self.send_json(404, {"error": "Không tìm thấy API."})

    def do_DELETE(self):
        path = self.path_only()
        match = re.fullmatch(r"/api/books/(\d+)", path)
        if not match:
            self.send_json(404, {"error": "Không tìm thấy API."})
            return
        actor = self.require_user({"librarian"})
        if not actor:
            return
        book_id = int(match.group(1))
        with connect_db() as db:
            row = db.execute("SELECT code FROM books WHERE id = ?", (book_id,)).fetchone()
            if not row:
                self.send_json(404, {"error": "Không tìm thấy tài liệu."})
                return
            db.execute("DELETE FROM books WHERE id = ?", (book_id,))
            log_action(db, actor["id"], "book_deleted", row["code"])
        self.send_json(200, {"ok": True})


if __name__ == "__main__":
    initialize_db()
    print(f"Mộc Thư đang chạy tại http://{HOST}:{PORT}")
    print("Lần đầu mở trang sẽ yêu cầu tạo tài khoản quản trị viên.")
    try:
        ThreadingHTTPServer((HOST, PORT), LibraryHandler).serve_forever()
    except KeyboardInterrupt:
        print("\nĐã dừng máy chủ.")
