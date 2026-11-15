"""Local development server for Moc Thu (Python standard library only)."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
import time
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
    ("Nhà giả kim", "Paulo Coelho", "VH-00124", "Văn học", "vi", 25, 18, 5, "A-02-14", "Tốt"),
    ("Tuổi trẻ đáng giá bao nhiêu", "Rosie Nguyễn", "KN-00087", "Kỹ năng sống", "vi", 20, 14, 8, "B-01-08", "Tốt"),
    ("Đắc nhân tâm", "Dale Carnegie", "KN-00031", "Kỹ năng sống", "vi", 3, 2, 5, "B-03-02", "Cũ"),
    ("Rừng Na Uy", "Haruki Murakami", "VH-00209", "Văn học", "vi", 18, 11, 5, "A-04-22", "Tốt"),
    ("Sống xanh mỗi ngày", "Katherine Martinko", "MT-00064", "Khác", "vi", 4, 0, 3, "C-02-01", "Tốt"),
    ("Tư duy nhanh và chậm", "Daniel Kahneman", "KT-00089", "Kinh tế - Tâm lý", "vi", 12, 5, 3, "B-01-12", "Tốt"),
    ("Sapiens: Lược sử loài người", "Yuval Noah Harari", "LS-00204", "Lịch sử - Khoa học", "vi", 14, 6, 4, "C-03-02", "Tốt"),
    ("Hoàng tử bé", "Antoine de Saint-Exupéry", "TN-00018", "Văn học thiếu nhi", "vi", 9, 2, 3, "C-01-04", "Tốt"),
    ("Cây cam ngọt của tôi", "José Mauro de Vasconcelos", "VH-00310", "Văn học", "vi", 11, 3, 3, "A-02-09", "Tốt"),
    ("The Little Prince", "Antoine de Saint-Exupéry", "EN-00018", "Children's fiction", "en", 6, 1, 2, "C-01-05", "Tốt"),
    ("Atomic Habits", "James Clear", "EN-00042", "Self-development", "en", 8, 3, 2, "B-02-10", "Tốt"),
    ("Pride and Prejudice", "Jane Austen", "EN-00057", "Classic literature", "en", 5, 2, 2, "A-01-06", "Tốt"),
    ("A Brief History of Time", "Stephen Hawking", "EN-00063", "Science", "en", 4, 1, 1, "C-02-08", "Cũ"),
    ("Cho tôi xin một vé đi tuổi thơ", "Nguyễn Nhật Ánh", "TN-00032", "Văn học thiếu nhi", "vi", 10, 4, 3, "C-01-08", "Tốt"),
    ("Dám bị ghét", "Kishimi Ichiro", "TL-00075", "Kinh tế - Tâm lý", "vi", 7, 2, 2, "B-03-11", "Tốt"),
    ("Muôn kiếp nhân sinh", "Nguyên Phong", "VH-00401", "Văn học", "vi", 8, 2, 2, "A-03-05", "Tốt"),
    ("Khéo ăn khéo nói sẽ có được thiên hạ", "Trác Nhã", "KN-00402", "Kỹ năng sống", "vi", 6, 1, 2, "B-02-04", "Tốt"),
    ("Sống đơn giản cho mình thanh thản", "Shunmyo Masuno", "TL-00403", "Kinh tế - Tâm lý", "vi", 5, 1, 2, "B-03-14", "Tốt"),
    ("Đi tìm lẽ sống", "Viktor E. Frankl", "TL-00404", "Kinh tế - Tâm lý", "vi", 9, 3, 2, "B-03-16", "Tốt"),
    ("Bí mật của may mắn", "Alex Rovira", "KN-00405", "Kỹ năng sống", "vi", 7, 2, 2, "B-01-18", "Tốt"),
    ("Dế mèn phiêu lưu ký", "Tô Hoài", "TN-00406", "Văn học thiếu nhi", "vi", 12, 3, 3, "C-01-10", "Tốt"),
    ("Lược sử vạn vật", "Bill Bryson", "KH-00407", "Lịch sử - Khoa học", "vi", 5, 2, 2, "C-02-12", "Tốt"),
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
                email TEXT NOT NULL DEFAULT '',
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
            CREATE TABLE IF NOT EXISTS password_resets (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS library_cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                card_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
                status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
                issued_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                issued_by INTEGER REFERENCES users(id) ON DELETE SET NULL
            );
            CREATE TABLE IF NOT EXISTS card_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                note TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
                created_at TEXT NOT NULL,
                resolved_at TEXT,
                resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
            );
            CREATE TABLE IF NOT EXISTS reservations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
                copy_id INTEGER REFERENCES book_copies(id) ON DELETE SET NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL DEFAULT '',
                fulfilled_at TEXT,
                status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cancelled', 'fulfilled'))
            );
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                author TEXT NOT NULL,
                code TEXT NOT NULL COLLATE NOCASE UNIQUE,
                category TEXT NOT NULL DEFAULT 'Khác',
                language TEXT NOT NULL DEFAULT 'vi',
                stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
                borrowed INTEGER NOT NULL DEFAULT 0 CHECK (borrowed >= 0 AND borrowed <= stock),
                minimum INTEGER NOT NULL DEFAULT 0 CHECK (minimum >= 0),
                location TEXT NOT NULL DEFAULT '',
                quality TEXT NOT NULL DEFAULT 'Tốt',
                summary TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS loans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
                copy_id INTEGER REFERENCES book_copies(id) ON DELETE SET NULL,
                reader_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                reader_code TEXT NOT NULL,
                borrowed_at TEXT NOT NULL,
                due_at TEXT NOT NULL,
                returned_at TEXT,
                renew_count INTEGER NOT NULL DEFAULT 0,
                fine_amount INTEGER NOT NULL DEFAULT 0,
                compensation_amount INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS ix_loans_open ON loans(returned_at, due_at);
            CREATE TABLE IF NOT EXISTS suppliers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                contact_name TEXT NOT NULL DEFAULT '',
                email TEXT NOT NULL DEFAULT '',
                phone TEXT NOT NULL DEFAULT '',
                address TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS receipts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                receipt_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
                supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
                received_at TEXT NOT NULL,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                note TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS receipt_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
                book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
                quantity INTEGER NOT NULL CHECK (quantity > 0),
                unit_cost INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost >= 0)
            );
            CREATE TABLE IF NOT EXISTS exports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                export_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
                exported_at TEXT NOT NULL,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                reason TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS export_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                export_id INTEGER NOT NULL REFERENCES exports(id) ON DELETE CASCADE,
                copy_id INTEGER NOT NULL REFERENCES book_copies(id) ON DELETE RESTRICT,
                action TEXT NOT NULL CHECK (action IN ('damaged', 'retired'))
            );
            CREATE TABLE IF NOT EXISTS book_copies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
                barcode TEXT NOT NULL UNIQUE COLLATE NOCASE,
                status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'loaned', 'reserved', 'damaged', 'retired')),
                location TEXT NOT NULL DEFAULT '',
                condition TEXT NOT NULL DEFAULT 'Tốt',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS fines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
                reader_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                amount INTEGER NOT NULL CHECK (amount >= 0),
                reason TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'waived')),
                created_at TEXT NOT NULL,
                settled_at TEXT
            );
            CREATE TABLE IF NOT EXISTS backup_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                enabled INTEGER NOT NULL DEFAULT 0,
                interval_days INTEGER NOT NULL DEFAULT 7,
                last_backup_at TEXT
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
        book_columns = {row["name"] for row in db.execute("PRAGMA table_info(books)")}
        if "summary" not in book_columns:
            db.execute("ALTER TABLE books ADD COLUMN summary TEXT NOT NULL DEFAULT ''")
        if "language" not in book_columns:
            db.execute("ALTER TABLE books ADD COLUMN language TEXT NOT NULL DEFAULT 'vi'")
        user_columns = {row["name"] for row in db.execute("PRAGMA table_info(users)")}
        if "email" not in user_columns:
            db.execute("ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT ''")
        db.execute("INSERT OR IGNORE INTO backup_settings (id, enabled, interval_days) VALUES (1, 0, 7)")
        loan_columns = {row["name"] for row in db.execute("PRAGMA table_info(loans)")}
        for name, declaration in (
            ("copy_id", "INTEGER REFERENCES book_copies(id) ON DELETE SET NULL"),
            ("reader_user_id", "INTEGER REFERENCES users(id) ON DELETE SET NULL"),
            ("renew_count", "INTEGER NOT NULL DEFAULT 0"),
            ("fine_amount", "INTEGER NOT NULL DEFAULT 0"),
            ("compensation_amount", "INTEGER NOT NULL DEFAULT 0"),
        ):
            if name not in loan_columns:
                db.execute(f"ALTER TABLE loans ADD COLUMN {name} {declaration}")
        reservation_columns = {row["name"] for row in db.execute("PRAGMA table_info(reservations)")}
        if "expires_at" not in reservation_columns:
            db.execute("ALTER TABLE reservations ADD COLUMN expires_at TEXT NOT NULL DEFAULT ''")
        if "fulfilled_at" not in reservation_columns:
            db.execute("ALTER TABLE reservations ADD COLUMN fulfilled_at TEXT")
        if "copy_id" not in reservation_columns:
            db.execute("ALTER TABLE reservations ADD COLUMN copy_id INTEGER REFERENCES book_copies(id) ON DELETE SET NULL")

        now = utc_now()
        db.executemany(
            """INSERT OR IGNORE INTO books
            (name, author, code, category, language, stock, borrowed, minimum, location, quality, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [(*book, now, now) for book in SEED_BOOKS],
        )

        for book in db.execute("SELECT id, code, stock, borrowed, location FROM books").fetchall():
            existing = db.execute("SELECT COUNT(*) FROM book_copies WHERE book_id = ?", (book["id"],)).fetchone()[0]
            now = utc_now()
            for index in range(existing, book["stock"]):
                state = "loaned" if index < book["borrowed"] else "available"
                db.execute(
                    "INSERT OR IGNORE INTO book_copies (book_id, barcode, status, location, created_at) VALUES (?, ?, ?, ?, ?)",
                    (book["id"], f"{book['code']}-{index + 1:04d}", state, book["location"], now),
                )

        legacy_accounts = (("admin", "admin"), ("thuthu", "librarian"), ("docgia", "reader"))
        for username, expected_role in legacy_accounts:
            row = db.execute("SELECT * FROM users WHERE username = ? COLLATE NOCASE", (username,)).fetchone()
            if not row or row["role"] != expected_role or row["status"] != "active":
                continue
            try:
                salt = bytes.fromhex(row["password_salt"])
                expected_hash = bytes.fromhex(row["password_hash"])
            except ValueError:
                continue
            if hmac.compare_digest(password_digest("123", salt), expected_hash):
                db.execute(
                    "UPDATE users SET username = ?, status = 'disabled' WHERE id = ?",
                    (f"legacy-disabled-{row['id']}-{username}", row["id"]),
                )
                db.execute("DELETE FROM sessions WHERE user_id = ?", (row["id"],))
                log_action(db, None, "legacy_demo_account_disabled", username)

        # Local demo logins are seeded once so first-run access never depends on setup.
        demo_accounts = (
            ("demo_admin", "Quản trị viên demo", "demo.admin@moc-thu.local", "admin"),
            ("demo_librarian", "Thủ thư demo", "demo.librarian@moc-thu.local", "librarian"),
            ("demo_reader", "Độc giả demo", "demo.reader@moc-thu.local", "reader"),
        )
        for username, full_name, email, role in demo_accounts:
            row = db.execute("SELECT id FROM users WHERE username = ? COLLATE NOCASE", (username,)).fetchone()
            if row:
                user_id = row["id"]
            else:
                salt = secrets.token_bytes(16)
                cursor = db.execute(
                    """INSERT INTO users (username, full_name, email, role, password_salt, password_hash, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (username, full_name, email, role, salt.hex(), password_digest("Demo@12345", salt).hex(), utc_now()),
                )
                user_id = cursor.lastrowid
            if role == "reader":
                db.execute(
                    """INSERT OR IGNORE INTO library_cards (user_id, card_code, status, issued_at, expires_at)
                       VALUES (?, 'DEMO-READER-CARD', 'active', ?, ?)""",
                    (user_id, utc_now(), (datetime.now(timezone.utc) + timedelta(days=3650)).isoformat(timespec="seconds")),
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
        "email": row["email"],
        "role": row["role"],
        "status": row["status"],
        "createdAt": row["created_at"],
    }


def log_action(db: sqlite3.Connection, user_id: int | None, action: str, detail: str = "") -> None:
    db.execute(
        "INSERT INTO audit_log (user_id, action, detail, created_at) VALUES (?, ?, ?, ?)",
        (user_id, action, detail[:240], utc_now()),
    )


def backup_database(user_id: int | None = None) -> Path:
    backup_dir = DATA_DIR / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    filename = f"backup-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.sqlite3"
    destination = backup_dir / filename
    source = connect_db()
    target = sqlite3.connect(destination)
    try:
        source.backup(target)
    finally:
        target.close()
        source.close()
    with connect_db() as db:
        db.execute("UPDATE backup_settings SET last_backup_at = ? WHERE id = 1", (utc_now(),))
        log_action(db, user_id, "database_backup", filename)
    return destination


def backup_scheduler() -> None:
    while True:
        time.sleep(900)
        try:
            with connect_db() as db:
                settings = db.execute("SELECT enabled, interval_days, last_backup_at FROM backup_settings WHERE id = 1").fetchone()
            if not settings or not settings["enabled"]:
                continue
            last = datetime.fromisoformat(settings["last_backup_at"]) if settings["last_backup_at"] else None
            if last is None or datetime.now(timezone.utc) - last >= timedelta(days=settings["interval_days"]):
                backup_database()
        except (OSError, sqlite3.Error, ValueError) as error:
            print(f"[Sao lưu tự động] {error}")


def expire_reservations(db: sqlite3.Connection) -> None:
    now = utc_now()
    expired = db.execute(
        "SELECT id, copy_id FROM reservations WHERE status = 'pending' AND expires_at != '' AND expires_at <= ?",
        (now,),
    ).fetchall()
    for reservation in expired:
        if reservation["copy_id"]:
            db.execute("UPDATE book_copies SET status = 'available' WHERE id = ? AND status = 'reserved'", (reservation["copy_id"],))
        db.execute("UPDATE reservations SET status = 'cancelled' WHERE id = ?", (reservation["id"],))


def sync_book_copies(db: sqlite3.Connection, book: sqlite3.Row) -> None:
    copies = db.execute("SELECT id, barcode, status FROM book_copies WHERE book_id = ? ORDER BY id", (book["id"],)).fetchall()
    active = [copy for copy in copies if copy["status"] in {"available", "loaned", "reserved"}]
    target = book["stock"]
    if len(active) > target:
        removable = [copy for copy in reversed(copies) if copy["status"] == "available"]
        while len(active) > target and removable:
            db.execute("DELETE FROM book_copies WHERE id = ?", (removable.pop(0)["id"],))
            active.pop()
        if len(active) > target:
            raise ValueError("Không thể giảm tồn dưới số bản đang mượn hoặc giữ chỗ.")
    elif len(active) < target:
        next_index = 1
        existing_codes = {copy["barcode"] for copy in copies}
        while len(active) < target:
            barcode = f"{book['code']}-{next_index:04d}"
            next_index += 1
            if barcode in existing_codes:
                continue
            db.execute(
                "INSERT INTO book_copies (book_id, barcode, location, created_at) VALUES (?, ?, ?, ?)",
                (book["id"], barcode, book["location"], utc_now()),
            )
            existing_codes.add(barcode)
            active.append({"status": "available"})


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
            super().do_GET()
            return
        if path == "/api/setup/status":
            self.send_json(200, {"needsSetup": False})
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
            user = self.current_user()
            with connect_db() as db:
                expire_reservations(db)
                if user:
                    rows = db.execute(
                        """SELECT b.*, (SELECT COUNT(*) FROM book_copies c WHERE c.book_id = b.id AND c.status = 'available') AS available_copies
                           FROM books b ORDER BY b.id DESC"""
                    ).fetchall()
                else:
                    rows = db.execute(
                        """SELECT b.id, b.name, b.author, b.code, b.category, b.stock, b.borrowed,
                                  (SELECT COUNT(*) FROM book_copies c WHERE c.book_id = b.id AND c.status = 'available') AS available_copies
                           FROM books b ORDER BY b.id DESC"""
                    ).fetchall()
            self.send_json(200, {"books": [dict(row) for row in rows]})
            return
        if path == "/api/search":
            query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            term = str(query.get("q", [""])[0]).strip()
            author = str(query.get("author", [""])[0]).strip()
            category = str(query.get("category", [""])[0]).strip()
            language = str(query.get("language", [""])[0]).strip().lower()
            available_only = query.get("available", [""])[0] == "1"
            with connect_db() as db:
                expire_reservations(db)
                rows = db.execute(
                    """SELECT books.id, books.name, books.author, books.code, books.category, books.language, books.stock, books.borrowed,
                              (SELECT COUNT(*) FROM book_copies c WHERE c.book_id = books.id AND c.status = 'available') AS available_copies
                       FROM books
                       WHERE (? = '' OR name LIKE ? OR author LIKE ? OR code LIKE ? OR category LIKE ?)
                         AND (? = '' OR author LIKE ?) AND (? = '' OR category = ?)
                         AND (? = '' OR language = ?)
                         AND (? = 0 OR EXISTS (SELECT 1 FROM book_copies c WHERE c.book_id = books.id AND c.status = 'available'))
                       ORDER BY name COLLATE NOCASE LIMIT 200""",
                    (term, f"%{term}%", f"%{term}%", f"%{term}%", f"%{term}%",
                     author, f"%{author}%", category, category, language, language, 1 if available_only else 0),
                ).fetchall()
            self.send_json(200, {"books": [dict(row) for row in rows]})
            return
        book_match = re.fullmatch(r"/api/books/(\d+)", path)
        if book_match:
            if not self.require_user():
                return
            with connect_db() as db:
                row = db.execute("SELECT * FROM books WHERE id = ?", (int(book_match.group(1)),)).fetchone()
                copies = db.execute("SELECT barcode, status, location, condition FROM book_copies WHERE book_id = ? ORDER BY barcode", (int(book_match.group(1)),)).fetchall()
            if not row:
                self.send_json(404, {"error": "Không tìm thấy tài liệu."})
            else:
                self.send_json(200, {"book": dict(row), "copies": [dict(copy) for copy in copies]})
            return
        book_history_match = re.fullmatch(r"/api/books/(\d+)/history", path)
        if book_history_match:
            if not self.require_user({"librarian"}):
                return
            with connect_db() as db:
                rows = db.execute(
                    """SELECT l.*, b.name AS book_name, u.full_name AS reader_name
                       FROM loans l JOIN books b ON b.id = l.book_id
                       LEFT JOIN users u ON u.id = l.reader_user_id
                       WHERE l.book_id = ? ORDER BY l.id DESC LIMIT 100""",
                    (int(book_history_match.group(1)),),
                ).fetchall()
            self.send_json(200, {"loans": [dict(row) for row in rows]})
            return
        if path == "/api/reservations":
            reader = self.require_user({"reader"})
            if reader:
                with connect_db() as db:
                    expire_reservations(db)
                    rows = db.execute(
                        """SELECT r.*, b.name AS book_name, b.code AS book_code
                           FROM reservations r JOIN books b ON b.id = r.book_id
                           WHERE r.user_id = ? ORDER BY r.id DESC""", (reader["id"],)
                    ).fetchall()
                self.send_json(200, {"reservations": [dict(row) for row in rows]})
            return
        if path == "/api/readers":
            if not self.require_user({"librarian"}):
                return
            with connect_db() as db:
                rows = db.execute(
                    """SELECT u.id, u.username, u.full_name, u.email, u.status, u.created_at,
                              c.id AS card_id, c.card_code, c.status AS card_status, c.expires_at,
                              (SELECT COUNT(*) FROM loans l WHERE l.reader_user_id = u.id AND l.returned_at IS NULL) AS active_loans
                       FROM users u LEFT JOIN library_cards c ON c.user_id = u.id
                       WHERE u.role = 'reader' ORDER BY u.created_at DESC, u.id DESC"""
                ).fetchall()
            self.send_json(200, {"readers": [dict(row) for row in rows]})
            return
        reader_history_match = re.fullmatch(r"/api/readers/(\d+)/history", path)
        if reader_history_match:
            if not self.require_user({"librarian"}):
                return
            reader_id = int(reader_history_match.group(1))
            with connect_db() as db:
                reader = db.execute("SELECT id FROM users WHERE id = ? AND role = 'reader'", (reader_id,)).fetchone()
                if not reader:
                    self.send_json(404, {"error": "Không tìm thấy độc giả."})
                    return
                rows = db.execute(
                    """SELECT l.*, b.name AS book_name FROM loans l JOIN books b ON b.id = l.book_id
                       WHERE l.reader_user_id = ? ORDER BY l.id DESC""", (reader_id,)
                ).fetchall()
            self.send_json(200, {"loans": [dict(row) for row in rows]})
            return
        if path == "/api/cards":
            if not self.require_user({"admin", "librarian"}):
                return
            with connect_db() as db:
                rows = db.execute(
                    """SELECT c.id, c.card_code, c.status, c.issued_at, c.expires_at,
                              u.full_name, u.email
                       FROM library_cards c JOIN users u ON u.id = c.user_id
                       ORDER BY c.id DESC"""
                ).fetchall()
            self.send_json(200, {"cards": [dict(row) for row in rows]})
            return
        if path == "/api/card-requests":
            if not self.require_user({"librarian"}):
                return
            with connect_db() as db:
                rows = db.execute(
                    """SELECT r.*, u.full_name, u.email, u.username, c.card_code
                       FROM card_requests r JOIN users u ON u.id = r.user_id
                       LEFT JOIN library_cards c ON c.user_id = r.user_id
                       ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.id DESC"""
                ).fetchall()
            self.send_json(200, {"requests": [dict(row) for row in rows]})
            return
        if path == "/api/suppliers":
            if not self.require_user({"admin", "librarian"}):
                return
            with connect_db() as db:
                rows = db.execute("SELECT * FROM suppliers ORDER BY name COLLATE NOCASE").fetchall()
            self.send_json(200, {"suppliers": [dict(row) for row in rows]})
            return
        if path == "/api/receipts":
            if not self.require_user({"librarian"}):
                return
            with connect_db() as db:
                rows = db.execute(
                    """SELECT r.*, s.name AS supplier_name, u.full_name AS created_by_name,
                              COALESCE(SUM(i.quantity), 0) AS total_quantity,
                              COALESCE(SUM(i.quantity * i.unit_cost), 0) AS total_cost
                       FROM receipts r JOIN suppliers s ON s.id = r.supplier_id
                       LEFT JOIN users u ON u.id = r.created_by
                       LEFT JOIN receipt_items i ON i.receipt_id = r.id
                       GROUP BY r.id ORDER BY r.received_at DESC, r.id DESC"""
                ).fetchall()
            self.send_json(200, {"receipts": [dict(row) for row in rows]})
            return
        if path == "/api/exports":
            if not self.require_user({"librarian"}):
                return
            with connect_db() as db:
                rows = db.execute(
                    """SELECT e.*, u.full_name AS created_by_name, COUNT(i.id) AS copy_count
                       FROM exports e LEFT JOIN users u ON u.id = e.created_by
                       LEFT JOIN export_items i ON i.export_id = e.id
                       GROUP BY e.id ORDER BY e.id DESC"""
                ).fetchall()
            self.send_json(200, {"exports": [dict(row) for row in rows]})
            return
        if path == "/api/audit":
            if not self.require_user({"admin"}):
                return
            query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            search = str(query.get("q", [""])[0]).strip()
            with connect_db() as db:
                rows = db.execute(
                    """SELECT a.*, u.username, u.full_name FROM audit_log a
                       LEFT JOIN users u ON u.id = a.user_id
                       WHERE (? = '' OR a.action LIKE ? OR a.detail LIKE ? OR u.username LIKE ? OR u.full_name LIKE ?)
                       ORDER BY a.id DESC LIMIT 500""",
                    (search, f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"),
                ).fetchall()
            self.send_json(200, {"events": [dict(row) for row in rows]})
            return
        if path == "/api/stats":
            if not self.require_user({"admin"}):
                return
            query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            start_date = str(query.get("from", [""])[0]).strip()
            end_date = str(query.get("to", [""])[0]).strip()
            for value in (start_date, end_date):
                if value and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                    self.send_json(400, {"error": "Khoảng ngày không hợp lệ."})
                    return
                if value:
                    try:
                        datetime.fromisoformat(value)
                    except ValueError:
                        self.send_json(400, {"error": "Khoảng ngày không hợp lệ."})
                        return
            if start_date and end_date and start_date > end_date:
                self.send_json(400, {"error": "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc."})
                return
            with connect_db() as db:
                result = {
                    "books": db.execute("SELECT COUNT(*) FROM books").fetchone()[0],
                    "copies": db.execute("SELECT COALESCE(SUM(stock), 0) FROM books").fetchone()[0],
                    "activeReaders": db.execute("SELECT COUNT(*) FROM users WHERE role = 'reader' AND status = 'active'").fetchone()[0],
                    "activeCards": db.execute("SELECT COUNT(*) FROM library_cards WHERE status = 'active' AND expires_at > ?", (utc_now(),)).fetchone()[0],
                    "openLoans": db.execute("SELECT COUNT(*) FROM loans WHERE returned_at IS NULL").fetchone()[0],
                    "overdueLoans": db.execute("SELECT COUNT(*) FROM loans WHERE returned_at IS NULL AND due_at < ?", (utc_now(),)).fetchone()[0],
                    "unpaidFines": db.execute("SELECT COALESCE(SUM(amount), 0) FROM fines WHERE status = 'unpaid'").fetchone()[0],
                    "reservations": db.execute("SELECT COUNT(*) FROM reservations WHERE status = 'pending'").fetchone()[0],
                    "lowStock": db.execute("SELECT COUNT(*) FROM books WHERE stock - borrowed <= minimum").fetchone()[0],
                    "loansToday": db.execute("SELECT COUNT(*) FROM loans WHERE date(borrowed_at) = date('now')").fetchone()[0],
                    "returnsToday": db.execute("SELECT COUNT(*) FROM loans WHERE date(returned_at) = date('now')").fetchone()[0],
                    "loansThisMonth": db.execute("SELECT COUNT(*) FROM loans WHERE strftime('%Y-%m', borrowed_at) = strftime('%Y-%m', 'now')").fetchone()[0],
                    "returnsThisMonth": db.execute("SELECT COUNT(*) FROM loans WHERE returned_at IS NOT NULL AND strftime('%Y-%m', returned_at) = strftime('%Y-%m', 'now')").fetchone()[0],
                    "onTimeReturns": db.execute("SELECT COUNT(*) FROM loans WHERE returned_at IS NOT NULL AND returned_at <= due_at").fetchone()[0],
                    "totalReturns": db.execute("SELECT COUNT(*) FROM loans WHERE returned_at IS NOT NULL").fetchone()[0],
                    "lateFinesThisMonth": db.execute("SELECT COALESCE(SUM(amount), 0) FROM fines WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')").fetchone()[0],
                    "activeSuppliers": db.execute("SELECT COUNT(*) FROM suppliers WHERE status = 'active'").fetchone()[0],
                }
                if start_date or end_date:
                    start_bound = start_date or end_date or datetime.now(timezone.utc).date().isoformat()
                    end_bound = end_date or start_date or datetime.now(timezone.utc).date().isoformat()
                    period_params = (start_bound, end_bound)
                    result["loansInPeriod"] = db.execute("SELECT COUNT(*) FROM loans WHERE date(borrowed_at) BETWEEN date(?) AND date(?)", period_params).fetchone()[0]
                    result["returnsInPeriod"] = db.execute("SELECT COUNT(*) FROM loans WHERE returned_at IS NOT NULL AND date(returned_at) BETWEEN date(?) AND date(?)", period_params).fetchone()[0]
                    result["onTimeReturnsInPeriod"] = db.execute("SELECT COUNT(*) FROM loans WHERE returned_at IS NOT NULL AND returned_at <= due_at AND date(returned_at) BETWEEN date(?) AND date(?)", period_params).fetchone()[0]
                    result["totalReturnsInPeriod"] = db.execute("SELECT COUNT(*) FROM loans WHERE returned_at IS NOT NULL AND date(returned_at) BETWEEN date(?) AND date(?)", period_params).fetchone()[0]
                    result["finesInPeriod"] = db.execute("SELECT COALESCE(SUM(amount), 0) FROM fines WHERE date(created_at) BETWEEN date(?) AND date(?)", period_params).fetchone()[0]
                    result["unpaidFinesInPeriod"] = db.execute("SELECT COALESCE(SUM(amount), 0) FROM fines WHERE status = 'unpaid' AND date(created_at) BETWEEN date(?) AND date(?)", period_params).fetchone()[0]
                    result["receiptValueInPeriod"] = db.execute("SELECT COALESCE(SUM(i.quantity * i.unit_cost), 0) FROM receipt_items i JOIN receipts r ON r.id = i.receipt_id WHERE date(r.received_at) BETWEEN date(?) AND date(?)", period_params).fetchone()[0]
                    result["exportsInPeriod"] = db.execute("SELECT COUNT(*) FROM exports WHERE date(exported_at) BETWEEN date(?) AND date(?)", period_params).fetchone()[0]
                    result["topBooks"] = [dict(row) for row in db.execute(
                        """SELECT b.name, b.code, COUNT(l.id) AS loan_count FROM books b LEFT JOIN loans l
                           ON l.book_id = b.id AND date(l.borrowed_at) BETWEEN date(?) AND date(?)
                           GROUP BY b.id ORDER BY loan_count DESC, b.name LIMIT 10""", period_params
                    ).fetchall()]
                    trend_from = datetime.fromisoformat(start_bound).date()
                    trend_to = datetime.fromisoformat(end_bound).date()
                    total_days = max(1, (trend_to - trend_from).days + 1)
                    trend = []
                    for index in range(7):
                        if total_days < 7 and index >= total_days:
                            trend.append({"label": "", "loans": 0, "returns": 0})
                            continue
                        if total_days < 7:
                            bucket_start = trend_from + timedelta(days=index)
                            bucket_end = bucket_start
                        else:
                            bucket_start = trend_from + timedelta(days=(index * total_days) // 7)
                            bucket_end = trend_from + timedelta(days=(((index + 1) * total_days) // 7) - 1)
                            if bucket_end < bucket_start:
                                bucket_end = bucket_start
                        bounds = (bucket_start.isoformat(), bucket_end.isoformat())
                        trend.append({
                            "label": bucket_start.strftime("%d/%m") if bucket_start == bucket_end else bucket_start.strftime("%d/%m") + "–" + bucket_end.strftime("%d/%m"),
                            "loans": db.execute("SELECT COUNT(*) FROM loans WHERE date(borrowed_at) BETWEEN date(?) AND date(?)", bounds).fetchone()[0],
                            "returns": db.execute("SELECT COUNT(*) FROM loans WHERE returned_at IS NOT NULL AND date(returned_at) BETWEEN date(?) AND date(?)", bounds).fetchone()[0],
                        })
                    result["trend"] = trend
                result["topBooks"] = [dict(row) for row in db.execute(
                    """SELECT b.name, b.code, COUNT(l.id) AS loan_count
                       FROM books b LEFT JOIN loans l ON l.book_id = b.id
                       GROUP BY b.id ORDER BY loan_count DESC, b.name LIMIT 10"""
                ).fetchall()]
                result["categoryStats"] = [dict(row) for row in db.execute(
                    """SELECT b.category, COUNT(DISTINCT b.id) AS title_count,
                              COALESCE(SUM(b.stock), 0) AS copies, COALESCE(SUM(b.borrowed), 0) AS borrowed
                       FROM books b GROUP BY b.category ORDER BY title_count DESC"""
                ).fetchall()]
            self.send_json(200, {"stats": result})
            return
        if path == "/api/backup-settings":
            if not self.require_user({"admin"}):
                return
            with connect_db() as db:
                settings = db.execute("SELECT enabled, interval_days, last_backup_at FROM backup_settings WHERE id = 1").fetchone()
            self.send_json(200, {"settings": dict(settings)})
            return
        if path == "/api/backups":
            if not self.require_user({"admin"}):
                return
            backup_dir = DATA_DIR / "backups"
            files = sorted(backup_dir.glob("backup-*.sqlite3"), reverse=True) if backup_dir.exists() else []
            self.send_json(200, {"backups": [{"filename": f.name, "size": f.stat().st_size, "modifiedAt": datetime.fromtimestamp(f.stat().st_mtime, timezone.utc).isoformat(timespec="seconds")} for f in files]})
            return
        if path == "/api/fines":
            if not self.require_user({"admin", "librarian"}):
                return
            with connect_db() as db:
                rows = db.execute(
                    """SELECT f.*, u.full_name AS reader_name, l.reader_code, b.name AS book_name
                       FROM fines f JOIN loans l ON l.id = f.loan_id
                       JOIN books b ON b.id = l.book_id LEFT JOIN users u ON u.id = f.reader_user_id
                       ORDER BY f.id DESC"""
                ).fetchall()
            self.send_json(200, {"fines": [dict(row) for row in rows]})
            return
        if path == "/api/copies":
            if not self.require_user({"librarian"}):
                return
            with connect_db() as db:
                rows = db.execute(
                    """SELECT c.*, b.name AS book_name FROM book_copies c
                       JOIN books b ON b.id = c.book_id ORDER BY c.id DESC LIMIT 5000"""
                ).fetchall()
            self.send_json(200, {"copies": [dict(row) for row in rows]})
            return
        if path == "/api/profile":
            reader = self.require_user({"reader"})
            if reader:
                with connect_db() as db:
                    expire_reservations(db)
                    profile = db.execute(
                        """SELECT u.id, u.username, u.full_name, u.email, u.created_at,
                                  c.card_code, c.status AS card_status, c.expires_at
                           FROM users u LEFT JOIN library_cards c ON c.user_id = u.id WHERE u.id = ?""",
                        (reader["id"],),
                    ).fetchone()
                self.send_json(200, {"profile": dict(profile)})
            return
        if path == "/api/reader/history":
            reader = self.require_user({"reader"})
            if reader:
                with connect_db() as db:
                    expire_reservations(db)
                    loans = db.execute(
                        """SELECT l.*, b.name AS book_name FROM loans l JOIN books b ON b.id = l.book_id
                           WHERE l.reader_user_id = ? ORDER BY l.id DESC""", (reader["id"],)
                    ).fetchall()
                    reservations = db.execute(
                        """SELECT r.*, b.name AS book_name FROM reservations r JOIN books b ON b.id = r.book_id
                           WHERE r.user_id = ? ORDER BY r.id DESC""", (reader["id"],)
                    ).fetchall()
                self.send_json(200, {"loans": [dict(row) for row in loans], "reservations": [dict(row) for row in reservations]})
            return
        copies_match = re.fullmatch(r"/api/books/(\d+)/copies", path)
        if copies_match:
            if not self.require_user():
                return
            with connect_db() as db:
                rows = db.execute("SELECT * FROM book_copies WHERE book_id = ? ORDER BY barcode", (int(copies_match.group(1)),)).fetchall()
            self.send_json(200, {"copies": [dict(row) for row in rows]})
            return
        if path == "/api/loans":
            if not self.require_user({"librarian"}):
                return
            with connect_db() as db:
                rows = db.execute(
                    """SELECT l.*, b.name AS book_name, u.full_name AS reader_name, c.barcode
                       FROM loans l JOIN books b ON b.id = l.book_id
                       LEFT JOIN users u ON u.id = l.reader_user_id
                       LEFT JOIN book_copies c ON c.id = l.copy_id
                       ORDER BY l.id DESC"""
                ).fetchall()
            self.send_json(200, {"loans": [{
                "id": row["id"],
                "bookId": row["book_id"],
                "bookName": row["book_name"],
                "readerName": row["reader_name"],
                "barcode": row["barcode"],
                "readerCode": row["reader_code"],
                "borrowedAt": row["borrowed_at"],
                "dueAt": row["due_at"],
                "returnedAt": row["returned_at"],
                "renewCount": row["renew_count"],
                "fineAmount": row["fine_amount"],
                "compensationAmount": row["compensation_amount"],
            } for row in rows]})
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
            # Phân tách vai trò rõ ràng, độc lập: mỗi vai trò làm việc trong đúng không gian được phân quyền
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
            self.send_json(403, {"error": "Thiết lập quản trị lần đầu đã được gỡ bỏ. Hãy đăng nhập bằng tài khoản được cấp."})
            return

        if path == "/api/demo-login":
            role = str(data.get("role", ""))
            demo_usernames = {"admin": "demo_admin", "librarian": "demo_librarian", "reader": "demo_reader"}
            username = demo_usernames.get(role)
            if not username:
                self.send_json(400, {"error": "Vai trò demo không hợp lệ."})
                return
            with connect_db() as db:
                user = db.execute("SELECT * FROM users WHERE username = ? COLLATE NOCASE AND role = ? AND status = 'active'", (username, role)).fetchone()
                if not user:
                    self.send_json(403, {"error": "Tài khoản demo đã bị vô hiệu hóa."})
                    return
                token = secrets.token_urlsafe(32)
                now = utc_now()
                db.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
                db.execute(
                    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
                    (hashlib.sha256(token.encode()).hexdigest(), user["id"],
                     (datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS)).isoformat(timespec="seconds"), now),
                )
                log_action(db, user["id"], "demo_login", role)
            body = json.dumps({"home": ROLE_HOME[role]}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.set_session_cookie(token, SESSION_HOURS * 3600)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return

        if path == "/api/login":
            username = str(data.get("username", data.get("email", ""))).strip()
            password = str(data.get("password", ""))
            with connect_db() as db:
                matches = db.execute(
                    "SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE",
                    (username, username),
                ).fetchall()
                user = matches[0] if len(matches) == 1 else None
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

        if path == "/api/signup":
            self.send_json(403, {"error": "Tài khoản độc giả được cấp bởi thủ thư tại thư viện."})
            return

        if path == "/api/password-reset/request":
            username = str(data.get("username", "")).strip()
            email = str(data.get("email", "")).strip().lower()
            with connect_db() as db:
                user = db.execute("SELECT id, username, email FROM users WHERE username = ? COLLATE NOCASE AND status = 'active'", (username,)).fetchone()
                if user and user["email"] and user["email"].casefold() != email.casefold():
                    user = None
                if user:
                    token = secrets.token_urlsafe(32)
                    now = datetime.now(timezone.utc)
                    db.execute("DELETE FROM password_resets WHERE expires_at <= ?", (now.isoformat(timespec="seconds"),))
                    db.execute("DELETE FROM password_resets WHERE user_id = ?", (user["id"],))
                    db.execute("INSERT INTO password_resets (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
                               (hashlib.sha256(token.encode()).hexdigest(), user["id"], (now + timedelta(minutes=15)).isoformat(timespec="seconds"), utc_now()))
                    print(f"[Khôi phục mật khẩu] Tài khoản {user['username']}; mã dùng một lần (15 phút): {token}")
            self.send_json(200, {"ok": True, "message": "Nếu thông tin khớp, mã khôi phục đã được in trong cửa sổ máy chủ (hiệu lực 15 phút)."})
            return

        if path == "/api/password-reset/confirm":
            token = str(data.get("token", "")).strip()
            password = str(data.get("password", ""))
            if len(password) < 10:
                self.send_json(400, {"error": "Mật khẩu mới cần ít nhất 10 ký tự."})
                return
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            now = utc_now()
            with connect_db() as db:
                db.execute("BEGIN IMMEDIATE")
                reset = db.execute("SELECT user_id FROM password_resets WHERE token_hash = ? AND expires_at > ?", (token_hash, now)).fetchone()
                if not reset:
                    self.send_json(400, {"error": "Mã khôi phục không hợp lệ hoặc đã hết hạn."})
                    return
                salt = secrets.token_bytes(16)
                db.execute("UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?", (salt.hex(), password_digest(password, salt).hex(), reset["user_id"]))
                db.execute("DELETE FROM password_resets WHERE user_id = ?", (reset["user_id"],))
                db.execute("DELETE FROM sessions WHERE user_id = ?", (reset["user_id"],))
                log_action(db, reset["user_id"], "password_reset", "")
            self.send_json(200, {"ok": True})
            return

        if path == "/api/switch-role":
            if not self.require_user():
                return
            self.send_json(403, {"error": "Hãy đăng nhập bằng tài khoản được cấp đúng vai trò."})
            return

        if path == "/api/backups":
            actor = self.require_user({"admin"})
            if not actor:
                return
            backup = backup_database(actor["id"])
            self.send_json(201, {"backup": backup.name})
            return

        if path == "/api/backup-settings":
            actor = self.require_user({"admin"})
            if not actor:
                return
            enabled = 1 if data.get("enabled") else 0
            try:
                interval = int(data.get("intervalDays", 7))
            except (TypeError, ValueError):
                interval = 0
            if not 1 <= interval <= 90:
                self.send_json(400, {"error": "Chu kỳ sao lưu phải từ 1 đến 90 ngày."})
                return
            with connect_db() as db:
                db.execute("UPDATE backup_settings SET enabled = ?, interval_days = ? WHERE id = 1", (enabled, interval))
                log_action(db, actor["id"], "backup_schedule_updated", f"{enabled}:{interval}")
            self.send_json(200, {"ok": True, "enabled": bool(enabled), "intervalDays": interval})
            return

        if path == "/api/backups/restore":
            actor = self.require_user({"admin"})
            if not actor:
                return
            filename = str(data.get("filename", ""))
            if Path(filename).name != filename or not re.fullmatch(r"backup-\d{8}-\d{6}\.sqlite3", filename):
                self.send_json(400, {"error": "Tên bản sao lưu không hợp lệ."})
                return
            source_path = DATA_DIR / "backups" / filename
            if not source_path.is_file():
                self.send_json(404, {"error": "Không tìm thấy bản sao lưu."})
                return
            backup_database(actor["id"])
            source = sqlite3.connect(source_path)
            target = connect_db()
            try:
                source.backup(target)
            finally:
                target.close()
                source.close()
            initialize_db()
            with connect_db() as db:
                log_action(db, None, "database_restored", filename)
            self.send_json(200, {"ok": True, "message": "Đã khôi phục dữ liệu; vui lòng đăng nhập lại."})
            return

        if path == "/api/suppliers":
            actor = self.require_user({"admin", "librarian"})
            if not actor:
                return
            name = str(data.get("name", "")).strip()
            if not name:
                self.send_json(400, {"error": "Tên nhà cung cấp là bắt buộc."})
                return
            with connect_db() as db:
                cursor = db.execute(
                    "INSERT INTO suppliers (name, contact_name, email, phone, address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (name, str(data.get("contactName", "")).strip(), str(data.get("email", "")).strip().lower(),
                     str(data.get("phone", "")).strip(), str(data.get("address", "")).strip(), utc_now()),
                )
                row = db.execute("SELECT * FROM suppliers WHERE id = ?", (cursor.lastrowid,)).fetchone()
                log_action(db, actor["id"], "supplier_created", name)
            self.send_json(201, {"supplier": dict(row)})
            return

        card_action = re.fullmatch(r"/api/cards/(\d+)/(renew|replace)", path)
        if card_action:
            actor = self.require_user({"librarian"})
            if not actor:
                return
            card_id = int(card_action.group(1))
            action = card_action.group(2)
            now = datetime.now(timezone.utc)
            with connect_db() as db:
                db.execute("BEGIN IMMEDIATE")
                card = db.execute("SELECT * FROM library_cards WHERE id = ?", (card_id,)).fetchone()
                if not card:
                    self.send_json(404, {"error": "Không tìm thấy thẻ thư viện."})
                    return
                if db.execute("SELECT 1 FROM fines WHERE reader_user_id = ? AND status = 'unpaid' LIMIT 1", (card["user_id"],)).fetchone():
                    self.send_json(409, {"error": "Độc giả còn khoản phạt chưa thanh toán."})
                    return
                if db.execute("SELECT 1 FROM loans WHERE reader_user_id = ? AND returned_at IS NULL AND due_at < ? LIMIT 1",
                              (card["user_id"], (now - timedelta(days=180)).isoformat(timespec="seconds"))).fetchone():
                    self.send_json(409, {"error": "Chưa thể gia hạn/cấp lại thẻ khi còn sách quá hạn trên 180 ngày."})
                    return
                if action == "renew":
                    current_expiry = datetime.fromisoformat(card["expires_at"])
                    expiry = (max(now, current_expiry) + timedelta(days=365)).isoformat(timespec="seconds")
                    db.execute("UPDATE library_cards SET expires_at = ?, status = 'active' WHERE id = ?", (expiry, card_id))
                    log_action(db, actor["id"], "library_card_renewed", card["card_code"])
                    self.send_json(200, {"ok": True, "expiresAt": expiry})
                    return
                code = f"DG-{card['user_id']:06d}-R{secrets.token_hex(2).upper()}"
                expiry = (max(now, datetime.fromisoformat(card["expires_at"])) + timedelta(days=365)).isoformat(timespec="seconds")
                db.execute("UPDATE library_cards SET card_code = ?, issued_at = ?, expires_at = ?, status = 'active', issued_by = ? WHERE id = ?",
                           (code, now.isoformat(timespec="seconds"), expiry, actor["id"], card_id))
                log_action(db, actor["id"], "library_card_replaced", code)
            self.send_json(200, {"ok": True, "cardCode": code, "expiresAt": expiry})
            return

        if path == "/api/receipts":
            actor = self.require_user({"librarian"})
            if not actor:
                return
            try:
                supplier_id = int(data.get("supplierId", 0))
                items = data.get("items", [])
                if not isinstance(items, list) or not items or len(items) > 100:
                    raise ValueError
                normalized = []
                for item in items:
                    book_id = int(item.get("bookId", 0))
                    quantity = int(item.get("quantity", 0))
                    unit_cost = int(item.get("unitCost", 0))
                    if book_id < 1 or not 1 <= quantity <= 10000 or unit_cost < 0:
                        raise ValueError
                    normalized.append((book_id, quantity, unit_cost))
            except (TypeError, ValueError, AttributeError):
                self.send_json(400, {"error": "Nhà cung cấp, sách, số lượng và đơn giá chưa hợp lệ."})
                return
            now = datetime.now(timezone.utc)
            receipt_code = str(data.get("receiptCode", "")).strip() or f"PN-{now.strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(2).upper()}"
            try:
                with connect_db() as db:
                    db.execute("BEGIN IMMEDIATE")
                    supplier = db.execute("SELECT id FROM suppliers WHERE id = ? AND status = 'active'", (supplier_id,)).fetchone()
                    if not supplier:
                        self.send_json(404, {"error": "Không tìm thấy nhà cung cấp đang hoạt động."})
                        return
                    books = {}
                    for book_id, quantity, _ in normalized:
                        book = db.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
                        if not book:
                            self.send_json(404, {"error": f"Không tìm thấy sách mã số {book_id}."})
                            return
                        books[book_id] = book
                    cursor = db.execute(
                        "INSERT INTO receipts (receipt_code, supplier_id, received_at, created_by, note) VALUES (?, ?, ?, ?, ?)",
                        (receipt_code, supplier_id, now.isoformat(timespec="seconds"), actor["id"], str(data.get("note", "")).strip()[:500]),
                    )
                    receipt_id = cursor.lastrowid
                    for book_id, quantity, unit_cost in normalized:
                        book = books[book_id]
                        db.execute("INSERT INTO receipt_items (receipt_id, book_id, quantity, unit_cost) VALUES (?, ?, ?, ?)", (receipt_id, book_id, quantity, unit_cost))
                        db.execute("UPDATE books SET stock = stock + ?, updated_at = ? WHERE id = ?", (quantity, utc_now(), book_id))
                        existing = db.execute("SELECT COUNT(*) FROM book_copies WHERE book_id = ?", (book_id,)).fetchone()[0]
                        for serial in range(existing + 1, existing + quantity + 1):
                            db.execute(
                                "INSERT INTO book_copies (book_id, barcode, location, created_at) VALUES (?, ?, ?, ?)",
                                (book_id, f"{book['code']}-{serial:04d}", book["location"], utc_now()),
                            )
                    log_action(db, actor["id"], "receipt_created", f"{receipt_code}:{len(normalized)}")
                self.send_json(201, {"receiptId": receipt_id, "receiptCode": receipt_code})
            except sqlite3.IntegrityError:
                self.send_json(409, {"error": "Mã phiếu nhập hoặc mã vạch bản sao đã tồn tại."})
            return

        if path == "/api/exports":
            actor = self.require_user({"librarian"})
            if not actor:
                return
            reason = str(data.get("reason", "")).strip()[:300]
            items = data.get("items", [])
            if not reason or not isinstance(items, list) or not items or len(items) > 200:
                self.send_json(400, {"error": "Nhập lý do và chọn ít nhất một bản sao."})
                return
            normalized = []
            try:
                for item in items:
                    copy_id = int(item.get("copyId", 0))
                    action = str(item.get("action", "retired"))
                    if copy_id < 1 or action not in {"damaged", "retired"}:
                        raise ValueError
                    normalized.append((copy_id, action))
            except (ValueError, TypeError, AttributeError):
                self.send_json(400, {"error": "Danh sách bản sao không hợp lệ."})
                return
            now = datetime.now(timezone.utc)
            export_code = str(data.get("exportCode", "")).strip() or f"PX-{now.strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(2).upper()}"
            try:
                with connect_db() as db:
                    db.execute("BEGIN IMMEDIATE")
                    copies = []
                    for copy_id, action in normalized:
                        copy = db.execute("SELECT * FROM book_copies WHERE id = ?", (copy_id,)).fetchone()
                        if not copy or copy["status"] not in {"available", "damaged"}:
                            self.send_json(409, {"error": f"Bản sao {copy_id} không tồn tại hoặc đang được mượn/giữ chỗ."})
                            return
                        copies.append((copy, action))
                    cursor = db.execute("INSERT INTO exports (export_code, exported_at, created_by, reason) VALUES (?, ?, ?, ?)",
                                        (export_code, now.isoformat(timespec="seconds"), actor["id"], reason))
                    for copy, action in copies:
                        was_counted = copy["status"] in {"available", "loaned", "reserved"}
                        if action == "damaged" and copy["status"] != "damaged":
                            db.execute("UPDATE books SET stock = MAX(0, stock - 1), updated_at = ? WHERE id = ?", (utc_now(), copy["book_id"]))
                        elif action == "retired" and was_counted:
                            db.execute("UPDATE books SET stock = MAX(0, stock - 1), updated_at = ? WHERE id = ?", (utc_now(), copy["book_id"]))
                        db.execute("UPDATE book_copies SET status = ? WHERE id = ?", (action, copy["id"]))
                        db.execute("INSERT INTO export_items (export_id, copy_id, action) VALUES (?, ?, ?)", (cursor.lastrowid, copy["id"], action))
                    log_action(db, actor["id"], "export_created", f"{export_code}:{len(copies)}:{reason}")
                self.send_json(201, {"exportCode": export_code, "copyCount": len(copies)})
            except sqlite3.IntegrityError:
                self.send_json(409, {"error": "Mã phiếu xuất đã tồn tại."})
            return

        if path == "/api/loans":
            actor = self.require_user({"librarian"})
            if not actor:
                return
            reader_code = str(data.get("readerCode", "")).strip()
            try:
                book_id = int(data.get("bookId", 0))
            except (ValueError, TypeError):
                book_id = 0
            if not reader_code or len(reader_code) > 50 or book_id < 1:
                self.send_json(400, {"error": "Nhập mã độc giả hợp lệ và chọn một đầu sách."})
                return
            with connect_db() as db:
                db.execute("BEGIN IMMEDIATE")
                expire_reservations(db)
                card = db.execute(
                    """SELECT c.user_id, u.status FROM library_cards c JOIN users u ON u.id = c.user_id
                       WHERE c.card_code = ? COLLATE NOCASE AND c.status = 'active' AND c.expires_at > ?""",
                    (reader_code, utc_now()),
                ).fetchone()
                if not card or card["status"] != "active":
                    self.send_json(400, {"error": "Mã thẻ không hợp lệ, đã khóa hoặc hết hạn."})
                    return
                active_count = db.execute(
                    "SELECT COUNT(*) FROM loans WHERE returned_at IS NULL AND (reader_user_id = ? OR reader_code = ? COLLATE NOCASE)",
                    (card["user_id"], reader_code),
                ).fetchone()[0]
                if active_count >= 5:
                    self.send_json(409, {"error": "Độc giả đã đạt giới hạn 5 tài liệu đang mượn."})
                    return
                overdue = db.execute(
                    "SELECT 1 FROM loans WHERE returned_at IS NULL AND due_at < ? AND (reader_user_id = ? OR reader_code = ? COLLATE NOCASE) LIMIT 1",
                    (utc_now(), card["user_id"], reader_code),
                ).fetchone()
                if overdue:
                    self.send_json(409, {"error": "Độc giả còn tài liệu quá hạn, chưa thể mượn thêm."})
                    return
                unpaid = db.execute("SELECT 1 FROM fines WHERE reader_user_id = ? AND status = 'unpaid' LIMIT 1", (card["user_id"],)).fetchone()
                if unpaid:
                    self.send_json(409, {"error": "Độc giả còn khoản phạt chưa thanh toán."})
                    return
                book = db.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
                if not book:
                    self.send_json(404, {"error": "Không tìm thấy đầu sách."})
                    return
                if book["stock"] <= book["borrowed"]:
                    self.send_json(409, {"error": "Đầu sách này hiện đã hết bản khả dụng trong kho."})
                    return
                reservation = db.execute(
                    "SELECT id, copy_id FROM reservations WHERE user_id = ? AND book_id = ? AND status = 'pending' AND copy_id IS NOT NULL ORDER BY id LIMIT 1",
                    (card["user_id"], book_id),
                ).fetchone()
                copy = db.execute(
                    "SELECT id, barcode FROM book_copies WHERE id = ? AND status = 'reserved'",
                    (reservation["copy_id"],),
                ).fetchone() if reservation else None
                if not copy:
                    reservation = None
                    copy = db.execute("SELECT id, barcode FROM book_copies WHERE book_id = ? AND status = 'available' ORDER BY id LIMIT 1", (book_id,)).fetchone()
                if not copy:
                    self.send_json(409, {"error": "Không còn bản sao ở trạng thái sẵn sàng."})
                    return
                borrowed_at = datetime.now(timezone.utc)
                due_at = borrowed_at + timedelta(days=14)
                cursor = db.execute(
                    "INSERT INTO loans (book_id, copy_id, reader_user_id, reader_code, borrowed_at, due_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (book_id, copy["id"], card["user_id"], reader_code, borrowed_at.isoformat(timespec="seconds"), due_at.isoformat(timespec="seconds")),
                )
                db.execute("UPDATE book_copies SET status = 'loaned' WHERE id = ?", (copy["id"],))
                if reservation:
                    db.execute("UPDATE reservations SET status = 'fulfilled', fulfilled_at = ? WHERE id = ?", (utc_now(), reservation["id"]))
                db.execute(
                    "UPDATE books SET borrowed = borrowed + 1, updated_at = ? WHERE id = ?",
                    (utc_now(), book_id),
                )
                updated_book = db.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
                log_action(db, actor["id"], "loan_created", f"{cursor.lastrowid}:{reader_code}:{book['code']}")
                loan_id = cursor.lastrowid
            self.send_json(201, {
                "loan": {
                    "id": loan_id,
                    "bookId": book_id,
                    "bookName": book["name"],
                    "readerCode": reader_code,
                    "barcode": copy["barcode"],
                    "borrowedAt": borrowed_at.isoformat(timespec="seconds"),
                    "dueAt": due_at.isoformat(timespec="seconds"),
                    "returnedAt": None,
                },
                "book": dict(updated_book),
            })
            return

        issue_card_match = re.fullmatch(r"/api/readers/(\d+)/card", path)
        if issue_card_match:
            actor = self.require_user({"librarian"})
            if not actor:
                return
            user_id = int(issue_card_match.group(1))
            now = datetime.now(timezone.utc)
            with connect_db() as db:
                db.execute("BEGIN IMMEDIATE")
                reader = db.execute("SELECT id FROM users WHERE id = ? AND role = 'reader' AND status = 'active'", (user_id,)).fetchone()
                if not reader:
                    self.send_json(404, {"error": "Không tìm thấy tài khoản độc giả đang hoạt động."})
                    return
                existing = db.execute("SELECT card_code FROM library_cards WHERE user_id = ?", (user_id,)).fetchone()
                if existing:
                    self.send_json(409, {"error": "Độc giả này đã có thẻ " + existing["card_code"] + "."})
                    return
                card_code = f"DG-{user_id:06d}"
                expires = (now + timedelta(days=365)).isoformat(timespec="seconds")
                db.execute(
                    "INSERT INTO library_cards (user_id, card_code, issued_at, expires_at, issued_by) VALUES (?, ?, ?, ?, ?)",
                    (user_id, card_code, now.isoformat(timespec="seconds"), expires, actor["id"]),
                )
                log_action(db, actor["id"], "library_card_issued", f"{user_id}:{card_code}")
            self.send_json(201, {"ok": True, "cardCode": card_code, "expiresAt": expires})
            return

        if path == "/api/readers":
            actor = self.require_user({"librarian"})
            if not actor:
                return
            full_name = str(data.get("fullName", "")).strip()
            username = str(data.get("username", "")).strip()
            email = str(data.get("email", "")).strip().lower()
            password = str(data.get("password", ""))
            if not full_name or not re.fullmatch(r"[A-Za-z0-9._-]{3,32}", username) or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) or len(password) < 10:
                self.send_json(400, {"error": "Nhập đủ thông tin hợp lệ; mật khẩu cần tối thiểu 10 ký tự."})
                return
            salt = secrets.token_bytes(16)
            now = datetime.now(timezone.utc)
            try:
                with connect_db() as db:
                    db.execute("BEGIN IMMEDIATE")
                    if db.execute("SELECT 1 FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE OR username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE", (username, email, email, username)).fetchone():
                        self.send_json(409, {"error": "Email hoặc tên đăng nhập đã được sử dụng."})
                        return
                    cursor = db.execute(
                        "INSERT INTO users (username, full_name, email, role, password_salt, password_hash, created_at) VALUES (?, ?, ?, 'reader', ?, ?, ?)",
                        (username, full_name, email, salt.hex(), password_digest(password, salt).hex(), utc_now()),
                    )
                    user_id = cursor.lastrowid
                    card_code = f"DG-{user_id:06d}"
                    expires = (now + timedelta(days=365)).isoformat(timespec="seconds")
                    db.execute(
                        "INSERT INTO library_cards (user_id, card_code, issued_at, expires_at, issued_by) VALUES (?, ?, ?, ?, ?)",
                        (user_id, card_code, now.isoformat(timespec="seconds"), expires, actor["id"]),
                    )
                    row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
                    log_action(db, actor["id"], "reader_and_card_created", f"{username}:{card_code}")
                self.send_json(201, {"user": safe_user(row), "cardCode": card_code, "expiresAt": expires})
            except sqlite3.IntegrityError:
                self.send_json(409, {"error": "Tên đăng nhập hoặc email đã tồn tại."})
            return

        if path == "/api/card-requests":
            actor = self.require_user({"reader"})
            if not actor:
                return
            with connect_db() as db:
                pending = db.execute("SELECT id FROM card_requests WHERE user_id = ? AND status = 'pending'", (actor["id"],)).fetchone()
                if pending:
                    self.send_json(409, {"error": "Bạn đã có yêu cầu thẻ đang chờ xử lý."})
                    return
                cursor = db.execute("INSERT INTO card_requests (user_id, note, created_at) VALUES (?, ?, ?)", (actor["id"], str(data.get("note", "")).strip()[:300], utc_now()))
                log_action(db, actor["id"], "library_card_requested", str(cursor.lastrowid))
            self.send_json(201, {"ok": True, "requestId": cursor.lastrowid})
            return

        card_request_match = re.fullmatch(r"/api/card-requests/(\d+)/resolve", path)
        if card_request_match:
            actor = self.require_user({"librarian"})
            if not actor:
                return
            request_id = int(card_request_match.group(1))
            action = str(data.get("action", ""))
            if action not in {"approve", "reject"}:
                self.send_json(400, {"error": "Thao tác xử lý yêu cầu không hợp lệ."})
                return
            now = datetime.now(timezone.utc)
            with connect_db() as db:
                db.execute("BEGIN IMMEDIATE")
                request = db.execute("SELECT * FROM card_requests WHERE id = ? AND status = 'pending'", (request_id,)).fetchone()
                if not request:
                    self.send_json(404, {"error": "Yêu cầu thẻ không tồn tại hoặc đã được xử lý."})
                    return
                card_code = None
                if action == "approve":
                    card = db.execute("SELECT id, card_code FROM library_cards WHERE user_id = ?", (request["user_id"],)).fetchone()
                    expires = (now + timedelta(days=365)).isoformat(timespec="seconds")
                    if card:
                        card_code = card["card_code"]
                        db.execute("UPDATE library_cards SET status='active', issued_at=?, expires_at=?, issued_by=? WHERE id=?", (now.isoformat(timespec="seconds"), expires, actor["id"], card["id"]))
                    else:
                        card_code = f"DG-{request['user_id']:06d}"
                        db.execute("INSERT INTO library_cards (user_id, card_code, issued_at, expires_at, issued_by) VALUES (?, ?, ?, ?, ?)", (request["user_id"], card_code, now.isoformat(timespec="seconds"), expires, actor["id"]))
                db.execute("UPDATE card_requests SET status=?, resolved_at=?, resolved_by=? WHERE id=?", ("approved" if action == "approve" else "rejected", now.isoformat(timespec="seconds"), actor["id"], request_id))
                log_action(db, actor["id"], "library_card_request_" + action, str(request_id))
            self.send_json(200, {"ok": True, "cardCode": card_code})
            return

        if path == "/api/reservations":
            actor = self.require_user({"reader"})
            if not actor:
                return
            try:
                book_id = int(data.get("bookId", 0))
            except (ValueError, TypeError):
                book_id = 0
            with connect_db() as db:
                card = db.execute("SELECT status, expires_at FROM library_cards WHERE user_id = ?", (actor["id"],)).fetchone()
                if not card or card["status"] != "active" or card["expires_at"] <= utc_now():
                    self.send_json(403, {"error": "Bạn cần thẻ thư viện còn hiệu lực để đặt sách. Vui lòng liên hệ thủ thư."})
                    return
                book = db.execute("SELECT id, name, stock, borrowed FROM books WHERE id = ?", (book_id,)).fetchone()
                if not book:
                    self.send_json(404, {"error": "Không tìm thấy sách."})
                    return
                existing = db.execute("SELECT 1 FROM reservations WHERE user_id = ? AND book_id = ? AND status = 'pending' LIMIT 1", (actor["id"], book_id)).fetchone()
                if existing:
                    self.send_json(409, {"error": "Bạn đã có yêu cầu đặt chỗ cho sách này."})
                    return
                copy = db.execute("SELECT id FROM book_copies WHERE book_id = ? AND status = 'available' ORDER BY id LIMIT 1", (book_id,)).fetchone()
                now = datetime.now(timezone.utc)
                expires = (now + timedelta(days=3)).isoformat(timespec="seconds") if copy else ""
                cursor = db.execute(
                    "INSERT INTO reservations (user_id, book_id, copy_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
                    (actor["id"], book_id, copy["id"] if copy else None, now.isoformat(timespec="seconds"), expires),
                )
                if copy:
                    db.execute("UPDATE book_copies SET status = 'reserved' WHERE id = ?", (copy["id"],))
                log_action(db, actor["id"], "book_reserved", f"{cursor.lastrowid}:{book_id}")
            self.send_json(201, {"ok": True, "message": "Đã ghi nhận yêu cầu đặt sách."})
            return

        cancel_reservation = re.fullmatch(r"/api/reservations/(\d+)/cancel", path)
        if cancel_reservation:
            actor = self.require_user({"reader"})
            if not actor:
                return
            reservation_id = int(cancel_reservation.group(1))
            with connect_db() as db:
                db.execute("BEGIN IMMEDIATE")
                reservation = db.execute("SELECT * FROM reservations WHERE id = ? AND user_id = ? AND status = 'pending'", (reservation_id, actor["id"])).fetchone()
                if not reservation:
                    self.send_json(404, {"error": "Không tìm thấy yêu cầu đặt chỗ đang chờ."})
                    return
                db.execute("UPDATE reservations SET status = 'cancelled' WHERE id = ?", (reservation_id,))
                if reservation["copy_id"]:
                    db.execute("UPDATE book_copies SET status = 'available' WHERE id = ? AND status = 'reserved'", (reservation["copy_id"],))
                log_action(db, actor["id"], "reservation_cancelled", str(reservation_id))
            self.send_json(200, {"ok": True})
            return

        renew_match = re.fullmatch(r"/api/loans/(\d+)/renew", path)
        if renew_match:
            actor = self.require_user({"reader", "librarian"})
            if not actor:
                return
            loan_id = int(renew_match.group(1))
            with connect_db() as db:
                db.execute("BEGIN IMMEDIATE")
                loan = db.execute("SELECT * FROM loans WHERE id = ?", (loan_id,)).fetchone()
                if not loan or (actor["role"] == "reader" and loan["reader_user_id"] != actor["id"]):
                    self.send_json(404, {"error": "Không tìm thấy phiếu mượn của tài khoản này."})
                    return
                if loan["returned_at"]:
                    self.send_json(409, {"error": "Sách đã được trả, không thể gia hạn."})
                    return
                if loan["renew_count"] >= 2:
                    self.send_json(409, {"error": "Mỗi lượt mượn chỉ được gia hạn tối đa 2 lần."})
                    return
                if loan["due_at"] < utc_now():
                    self.send_json(409, {"error": "Phiếu đã quá hạn, không thể gia hạn."})
                    return
                waiting = db.execute("SELECT 1 FROM reservations WHERE book_id = ? AND status = 'pending' AND user_id != ? LIMIT 1", (loan["book_id"], loan["reader_user_id"] or -1)).fetchone()
                if waiting:
                    self.send_json(409, {"error": "Tài liệu đã có độc giả đặt chỗ, không thể gia hạn."})
                    return
                new_due = (datetime.fromisoformat(loan["due_at"]) + timedelta(days=7)).isoformat(timespec="seconds")
                db.execute("UPDATE loans SET due_at = ?, renew_count = renew_count + 1 WHERE id = ?", (new_due, loan_id))
                log_action(db, actor["id"], "loan_renewed", f"{loan_id}:{new_due}")
            self.send_json(200, {"ok": True, "dueAt": new_due, "renewCount": loan["renew_count"] + 1})
            return

        settle_match = re.fullmatch(r"/api/fines/(\d+)/settle", path)
        if settle_match:
            actor = self.require_user({"librarian"})
            if not actor:
                return
            fine_id = int(settle_match.group(1))
            now = utc_now()
            with connect_db() as db:
                db.execute("BEGIN IMMEDIATE")
                fine = db.execute("SELECT * FROM fines WHERE id = ? AND status = 'unpaid'", (fine_id,)).fetchone()
                if not fine:
                    self.send_json(404, {"error": "Không tìm thấy khoản phạt chưa thanh toán."})
                    return
                db.execute("UPDATE fines SET status = 'paid', settled_at = ? WHERE id = ?", (now, fine_id))
                if fine["reader_user_id"]:
                    remaining = db.execute("SELECT 1 FROM fines WHERE reader_user_id = ? AND status = 'unpaid' AND id != ? LIMIT 1", (fine["reader_user_id"], fine_id)).fetchone()
                    overdue = db.execute("SELECT 1 FROM loans WHERE reader_user_id = ? AND returned_at IS NULL AND due_at < ? LIMIT 1", (fine["reader_user_id"], now)).fetchone()
                    if not remaining and not overdue:
                        db.execute("UPDATE library_cards SET status = 'active' WHERE user_id = ? AND expires_at > ?", (fine["reader_user_id"], now))
                log_action(db, actor["id"], "fine_settled", str(fine_id))
            self.send_json(200, {"ok": True})
            return

        return_match = re.fullmatch(r"/api/loans/(\d+)/return", path)
        if return_match:
            actor = self.require_user({"librarian"})
            if not actor:
                return
            loan_id = int(return_match.group(1))
            now = utc_now()
            damaged = bool(data.get("damaged"))
            lost = bool(data.get("lost"))
            try:
                compensation = max(0, int(data.get("compensationAmount", 0)))
            except (TypeError, ValueError):
                self.send_json(400, {"error": "Số tiền bồi thường không hợp lệ."})
                return
            with connect_db() as db:
                db.execute("BEGIN IMMEDIATE")
                loan = db.execute(
                    "SELECT l.*, b.code FROM loans l JOIN books b ON b.id = l.book_id WHERE l.id = ?",
                    (loan_id,),
                ).fetchone()
                if not loan:
                    self.send_json(404, {"error": "Không tìm thấy phiếu mượn."})
                    return
                if loan["returned_at"]:
                    self.send_json(409, {"error": "Phiếu mượn này đã được nhận trả."})
                    return
                due = datetime.fromisoformat(loan["due_at"])
                returned = datetime.now(timezone.utc)
                days_late = max(0, (returned.date() - due.date()).days)
                late_fine = days_late * 2000
                if (lost or damaged) and compensation == 0:
                    self.send_json(400, {"error": "Nhập giá trị bồi thường cho tài liệu hư hỏng hoặc bị mất."})
                    return
                total = late_fine + compensation
                db.execute("UPDATE loans SET returned_at = ?, fine_amount = ?, compensation_amount = ? WHERE id = ?", (now, late_fine, compensation, loan_id))
                db.execute(
                    "UPDATE books SET borrowed = MAX(0, borrowed - 1), stock = MAX(0, stock - ?), updated_at = ? WHERE id = ?",
                    (1 if (lost or damaged) else 0, now, loan["book_id"]),
                )
                copy_id = loan["copy_id"]
                if not copy_id and not lost:
                    old_copy = db.execute("SELECT id FROM book_copies WHERE book_id = ? AND status = 'loaned' ORDER BY id LIMIT 1", (loan["book_id"],)).fetchone()
                    copy_id = old_copy["id"] if old_copy else None
                if copy_id:
                    copy_status = "retired" if lost else ("damaged" if damaged else "available")
                    if copy_status == "available":
                        next_reservation = db.execute(
                            """SELECT r.id FROM reservations r JOIN library_cards c ON c.user_id = r.user_id
                               WHERE r.book_id = ? AND r.status = 'pending' AND r.copy_id IS NULL
                                 AND c.status = 'active' AND c.expires_at > ? ORDER BY r.id LIMIT 1""",
                            (loan["book_id"], now),
                        ).fetchone()
                        if next_reservation:
                            copy_status = "reserved"
                            db.execute(
                                "UPDATE reservations SET copy_id = ?, expires_at = ? WHERE id = ?",
                                (copy_id, (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(timespec="seconds"), next_reservation["id"]),
                            )
                    db.execute("UPDATE book_copies SET status = ? WHERE id = ?", (copy_status, copy_id))
                if total:
                    reasons = []
                    if days_late:
                        reasons.append(f"Trễ hạn {days_late} ngày")
                    if compensation:
                        reasons.append("Bồi thường tài liệu hư hỏng/mất")
                    db.execute(
                        "INSERT INTO fines (loan_id, reader_user_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)",
                        (loan_id, loan["reader_user_id"], total, "; ".join(reasons), now),
                    )
                    if loan["reader_user_id"]:
                        db.execute("UPDATE library_cards SET status = 'disabled' WHERE user_id = ?", (loan["reader_user_id"],))
                log_action(db, actor["id"], "loan_returned", f"{loan_id}:{loan['code']}")
            self.send_json(200, {"ok": True, "returnedAt": now, "lateDays": days_late, "fineAmount": late_fine, "compensationAmount": compensation, "totalDue": total})
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
            email = str(data.get("email", "")).strip().lower()
            password = str(data.get("password", ""))
            role = str(data.get("role", ""))
            if not full_name or not re.fullmatch(r"[A-Za-z0-9._-]{3,32}", username) or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) or len(password) < 10 or role not in {"admin", "librarian"}:
                self.send_json(400, {"error": "Nhập đủ thông tin hợp lệ; mật khẩu cần tối thiểu 10 ký tự."})
                return
            salt = secrets.token_bytes(16)
            try:
                with connect_db() as db:
                    if db.execute("SELECT 1 FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE OR username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE", (username, email, email, username)).fetchone():
                        self.send_json(409, {"error": "Email hoặc tên đăng nhập đã được sử dụng."})
                        return
                    cursor = db.execute(
                        """INSERT INTO users (username, full_name, email, role, password_salt, password_hash, created_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?)""",
                        (username, full_name, email, role, salt.hex(), password_digest(password, salt).hex(), utc_now()),
                    )
                    row = db.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
                    log_action(db, actor["id"], "user_created", f"{username}:{role}")
                self.send_json(201, {"user": safe_user(row)})
            except sqlite3.IntegrityError:
                self.send_json(409, {"error": "Tên đăng nhập đã tồn tại."})
            return

        reset_user_match = re.fullmatch(r"/api/users/(\d+)/reset-password", path)
        if reset_user_match:
            actor = self.require_user({"admin"})
            if not actor:
                return
            user_id = int(reset_user_match.group(1))
            temporary_password = secrets.token_urlsafe(12)
            salt = secrets.token_bytes(16)
            with connect_db() as db:
                target = db.execute("SELECT id, role FROM users WHERE id = ?", (user_id,)).fetchone()
                if not target or target["role"] == "reader":
                    self.send_json(404, {"error": "Không tìm thấy tài khoản nhân sự."})
                    return
                db.execute("UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?", (salt.hex(), password_digest(temporary_password, salt).hex(), user_id))
                db.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
                log_action(db, actor["id"], "user_password_reset", str(user_id))
            self.send_json(200, {"ok": True, "temporaryPassword": temporary_password})
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
                """INSERT INTO books
                           (name, author, code, category, language, stock, borrowed, minimum, location, quality, summary, created_at, updated_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (*book, now, now),
                    )
                    row = db.execute("SELECT * FROM books WHERE id = ?", (cursor.lastrowid,)).fetchone()
                    sync_book_copies(db, row)
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
        language = str(data.get("language", "vi")).strip().lower()
        if language not in {"vi", "en"}:
            raise ValueError("Ngôn ngữ tài liệu không hợp lệ.")
        return (name, author, code, str(data.get("category", "Khác")), language, stock, borrowed, minimum,
                str(data.get("location", "")).strip(), str(data.get("quality", "Tốt")),
                str(data.get("summary", "")).strip()[:300])

    def do_PUT(self):
        path = self.path_only()
        reader_match = re.fullmatch(r"/api/readers/(\d+)", path)
        if reader_match:
            actor = self.require_user({"librarian"})
            if not actor:
                return
            try:
                data = self.read_json()
            except ValueError as exc:
                self.send_json(400, {"error": str(exc)})
                return
            reader_id = int(reader_match.group(1))
            name = str(data.get("fullName", "")).strip()
            email = str(data.get("email", "")).strip().lower()
            status = data.get("status")
            if (name and len(name) > 100) or (email and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email)) or status not in (None, "active", "disabled"):
                self.send_json(400, {"error": "Thông tin độc giả không hợp lệ."})
                return
            with connect_db() as db:
                target = db.execute("SELECT id FROM users WHERE id = ? AND role = 'reader'", (reader_id,)).fetchone()
                if not target:
                    self.send_json(404, {"error": "Không tìm thấy độc giả."})
                    return
                if email and db.execute("SELECT 1 FROM users WHERE email = ? COLLATE NOCASE AND id != ?", (email, reader_id)).fetchone():
                    self.send_json(409, {"error": "Email đã được sử dụng."})
                    return
                db.execute("UPDATE users SET full_name = COALESCE(NULLIF(?, ''), full_name), email = COALESCE(NULLIF(?, ''), email), status = COALESCE(?, status) WHERE id = ?", (name, email, status, reader_id))
                if status == "disabled":
                    db.execute("DELETE FROM sessions WHERE user_id = ?", (reader_id,))
                log_action(db, actor["id"], "reader_updated", str(reader_id))
            self.send_json(200, {"ok": True})
            return
        if path == "/api/profile":
            actor = self.require_user({"reader"})
            if not actor:
                return
            try:
                data = self.read_json()
            except ValueError as exc:
                self.send_json(400, {"error": str(exc)})
                return
            name = str(data.get("fullName", "")).strip()
            email = str(data.get("email", "")).strip().lower()
            if not name or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
                self.send_json(400, {"error": "Họ tên và email hợp lệ là bắt buộc."})
                return
            with connect_db() as db:
                if db.execute("SELECT 1 FROM users WHERE email = ? COLLATE NOCASE AND id != ?", (email, actor["id"])).fetchone():
                    self.send_json(409, {"error": "Email đã được sử dụng."})
                    return
                db.execute("UPDATE users SET full_name = ?, email = ? WHERE id = ?", (name, email, actor["id"]))
                log_action(db, actor["id"], "reader_profile_updated", "")
            self.send_json(200, {"ok": True, "fullName": name, "email": email})
            return
        copy_match = re.fullmatch(r"/api/copies/(\d+)", path)
        if copy_match:
            actor = self.require_user({"librarian"})
            if not actor:
                return
            try:
                data = self.read_json()
            except ValueError as exc:
                self.send_json(400, {"error": str(exc)})
                return
            status = data.get("status")
            if status not in {"available", "damaged", "retired"}:
                self.send_json(400, {"error": "Trạng thái bản sao không hợp lệ."})
                return
            copy_id = int(copy_match.group(1))
            with connect_db() as db:
                db.execute("BEGIN IMMEDIATE")
                copy = db.execute("SELECT * FROM book_copies WHERE id = ?", (copy_id,)).fetchone()
                if not copy:
                    self.send_json(404, {"error": "Không tìm thấy bản sao."})
                    return
                if copy["status"] in {"loaned", "reserved"}:
                    self.send_json(409, {"error": "Bản sao đang được mượn hoặc giữ chỗ."})
                    return
                if copy["status"] != status:
                    counted = {"available", "loaned", "reserved"}
                    delta = (1 if status in counted else 0) - (1 if copy["status"] in counted else 0)
                    db.execute("UPDATE books SET stock = MAX(0, stock + ?), updated_at = ? WHERE id = ?", (delta, utc_now(), copy["book_id"]))
                db.execute("UPDATE book_copies SET status = ?, location = COALESCE(?, location), condition = COALESCE(?, condition) WHERE id = ?",
                           (status, data.get("location"), data.get("condition"), copy_id))
                log_action(db, actor["id"], "copy_updated", f"{copy['barcode']}:{status}")
            self.send_json(200, {"ok": True})
            return
        supplier_match = re.fullmatch(r"/api/suppliers/(\d+)", path)
        if supplier_match:
            actor = self.require_user({"admin", "librarian"})
            if not actor:
                return
            try:
                data = self.read_json()
            except ValueError as exc:
                self.send_json(400, {"error": str(exc)})
                return
            supplier_id = int(supplier_match.group(1))
            name = str(data.get("name", "")).strip()
            status = data.get("status")
            if (name and len(name) > 150) or status not in (None, "active", "disabled"):
                self.send_json(400, {"error": "Thông tin nhà cung cấp không hợp lệ."})
                return
            with connect_db() as db:
                cursor = db.execute(
                    """UPDATE suppliers SET name = COALESCE(NULLIF(?, ''), name),
                       contact_name = COALESCE(?, contact_name), email = COALESCE(?, email),
                       phone = COALESCE(?, phone), address = COALESCE(?, address), status = COALESCE(?, status)
                       WHERE id = ?""",
                    (name, data.get("contactName"), data.get("email"), data.get("phone"), data.get("address"), status, supplier_id),
                )
                if not cursor.rowcount:
                    self.send_json(404, {"error": "Không tìm thấy nhà cung cấp."})
                    return
                log_action(db, actor["id"], "supplier_updated", str(supplier_id))
                row = db.execute("SELECT * FROM suppliers WHERE id = ?", (supplier_id,)).fetchone()
            self.send_json(200, {"supplier": dict(row)})
            return
        card_match = re.fullmatch(r"/api/cards/(\d+)", path)
        if card_match:
            actor = self.require_user({"admin", "librarian"})
            if not actor:
                return
            try:
                data = self.read_json()
            except ValueError as exc:
                self.send_json(400, {"error": str(exc)})
                return
            status = data.get("status")
            if status not in {"active", "disabled"}:
                self.send_json(400, {"error": "Trạng thái thẻ không hợp lệ."})
                return
            with connect_db() as db:
                card = db.execute("SELECT user_id FROM library_cards WHERE id = ?", (int(card_match.group(1)),)).fetchone()
                if not card:
                    self.send_json(404, {"error": "Không tìm thấy thẻ thư viện."})
                    return
                if status == "active":
                    unpaid = db.execute("SELECT 1 FROM fines WHERE reader_user_id = ? AND status = 'unpaid' LIMIT 1", (card["user_id"],)).fetchone()
                    long_overdue = db.execute("SELECT 1 FROM loans WHERE reader_user_id = ? AND returned_at IS NULL AND due_at < ? LIMIT 1",
                                              (card["user_id"], (datetime.now(timezone.utc) - timedelta(days=180)).isoformat(timespec="seconds"))).fetchone()
                    if unpaid or long_overdue:
                        self.send_json(409, {"error": "Chưa thể mở thẻ khi còn nợ phạt hoặc sách quá hạn trên 180 ngày."})
                        return
                cursor = db.execute("UPDATE library_cards SET status = ? WHERE id = ?", (status, int(card_match.group(1))))
                if not cursor.rowcount:
                    self.send_json(404, {"error": "Không tìm thấy thẻ thư viện."})
                    return
                log_action(db, actor["id"], "library_card_updated", f"{card_match.group(1)}:{status}")
            self.send_json(200, {"ok": True})
            return
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
            username = str(data.get("username", "")).strip() if data.get("username") is not None else None
            email = str(data.get("email", "")).strip().lower() if data.get("email") is not None else None
            if status not in (None, "active", "disabled") or role not in (None, "admin", "librarian"):
                self.send_json(400, {"error": "Vai trò hoặc trạng thái không hợp lệ."})
                return
            if (username is not None and not re.fullmatch(r"[A-Za-z0-9._-]{3,32}", username)) or (email is not None and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email)):
                self.send_json(400, {"error": "Tên đăng nhập hoặc email không hợp lệ."})
                return
            with connect_db() as db:
                target = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
                if not target:
                    self.send_json(404, {"error": "Không tìm thấy tài khoản."})
                    return
                if target["role"] == "reader":
                    self.send_json(403, {"error": "Hồ sơ độc giả do thủ thư quản lý."})
                    return
                if username is not None or email is not None:
                    duplicate = db.execute(
                        """SELECT 1 FROM users WHERE id != ? AND
                           (username = ? COLLATE NOCASE OR (? != '' AND email = ? COLLATE NOCASE)
                            OR (? != '' AND username = ? COLLATE NOCASE) OR (? != '' AND email = ? COLLATE NOCASE))""",
                        (user_id, username or target["username"], username or target["username"], username or target["username"],
                         email or target["email"], email or target["email"], email or target["email"], email or target["email"]),
                    ).fetchone()
                    if duplicate:
                        self.send_json(409, {"error": "Email hoặc tên đăng nhập đã được sử dụng."})
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
                db.execute("""UPDATE users SET full_name = COALESCE(NULLIF(?, ''), full_name),
                           username = COALESCE(?, username), email = COALESCE(?, email),
                           role = COALESCE(?, role), status = COALESCE(?, status) WHERE id = ?""",
                           (full_name, username, email, role, status, user_id))
                if status == "disabled" or role is not None:
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
                    db.execute(
                        """UPDATE books
                           SET name=?, author=?, code=?, category=?, language=?, stock=?, borrowed=?, minimum=?, location=?,
                               quality=?, summary=?, updated_at=?
                           WHERE id=?""",
                        (*book, utc_now(), book_id),
                    )
                    row = db.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
                    if not row:
                        self.send_json(404, {"error": "Không tìm thấy tài liệu."})
                        return
                    sync_book_copies(db, row)
                    log_action(db, actor["id"], "book_updated", row["code"])
                self.send_json(200, {"book": dict(row)})
            except sqlite3.IntegrityError:
                self.send_json(409, {"error": "Mã tài liệu đã tồn tại."})
            except ValueError as exc:
                self.send_json(409, {"error": str(exc)})
            return
        self.send_json(404, {"error": "Không tìm thấy API."})

    def do_DELETE(self):
        path = self.path_only()
        user_match = re.fullmatch(r"/api/users/(\d+)", path)
        if user_match:
            actor = self.require_user({"admin"})
            if not actor:
                return
            user_id = int(user_match.group(1))
            if user_id == actor["id"]:
                self.send_json(400, {"error": "Không thể xóa tài khoản đang đăng nhập."})
                return
            with connect_db() as db:
                target = db.execute("SELECT id, username, role, status FROM users WHERE id = ?", (user_id,)).fetchone()
                if not target or target["role"] == "reader":
                    self.send_json(404, {"error": "Không tìm thấy tài khoản nhân sự."})
                    return
                if target["role"] == "admin" and target["status"] == "active":
                    remaining = db.execute("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active' AND id != ?", (user_id,)).fetchone()[0]
                    if not remaining:
                        self.send_json(409, {"error": "Hệ thống cần ít nhất một quản trị viên đang hoạt động."})
                        return
                log_action(db, actor["id"], "user_deleted", f"{target['username']}:{target['role']}")
                db.execute("DELETE FROM users WHERE id = ?", (user_id,))
            self.send_json(200, {"ok": True})
            return
        supplier_match = re.fullmatch(r"/api/suppliers/(\d+)", path)
        if supplier_match:
            actor = self.require_user({"admin", "librarian"})
            if not actor:
                return
            supplier_id = int(supplier_match.group(1))
            with connect_db() as db:
                if db.execute("SELECT 1 FROM receipts WHERE supplier_id = ? LIMIT 1", (supplier_id,)).fetchone():
                    self.send_json(409, {"error": "Nhà cung cấp đã có phiếu nhập; hãy khóa thay vì xóa."})
                    return
                cursor = db.execute("DELETE FROM suppliers WHERE id = ?", (supplier_id,))
                if not cursor.rowcount:
                    self.send_json(404, {"error": "Không tìm thấy nhà cung cấp."})
                    return
                log_action(db, actor["id"], "supplier_deleted", str(supplier_id))
            self.send_json(200, {"ok": True})
            return
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
            try:
                db.execute("DELETE FROM books WHERE id = ?", (book_id,))
            except sqlite3.IntegrityError:
                self.send_json(409, {"error": "Không thể xóa sách đã có lịch sử mượn."})
                return
            log_action(db, actor["id"], "book_deleted", row["code"])
        self.send_json(200, {"ok": True})


if __name__ == "__main__":
    initialize_db()
    threading.Thread(target=backup_scheduler, name="moc-thu-backup-scheduler", daemon=True).start()
    print(f"Mộc Thư đang chạy tại http://{HOST}:{PORT}")
    print("Lần đầu mở trang sẽ yêu cầu tạo tài khoản quản trị viên.")
    try:
        ThreadingHTTPServer((HOST, PORT), LibraryHandler).serve_forever()
    except KeyboardInterrupt:
        print("\nĐã dừng máy chủ.")
