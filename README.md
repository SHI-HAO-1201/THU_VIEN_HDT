# Mộc Thư

## Chạy ứng dụng

Ứng dụng dùng Python 3.10 trở lên và SQLite có sẵn trong Python; không cần cài thư viện ngoài.

```powershell
python "máy-chủ/server.py"
```

Mở <http://127.0.0.1:8000>. Lần đầu, hệ thống yêu cầu tạo tài khoản quản trị viên. Sau đó, quản trị viên tạo và khóa/mở khóa tài khoản đăng nhập của thủ thư tại **Tài khoản thủ thư**.

SQLite tự khởi tạo tại `data/thu_vien.sqlite3`. Mật khẩu được băm bằng PBKDF2-HMAC-SHA256; phiên đăng nhập được lưu dạng mã băm. Máy chủ chỉ lắng nghe trên `127.0.0.1`.

## Cấu trúc thư mục

```text
Độc giả/       giao diện/ + chức năng/
thủ thư/       giao diện/ + chức năng/
quản lí/       giao diện/ + chức năng/
xác-thực/     giao diện/ + chức năng/
dùng-chung/   giao diện/ + chức năng/
máy-chủ/      server.py
index.html    điểm vào ứng dụng
```

## Quyền hiện tại

- **Quản trị viên:** dashboard, báo cáo, tạo và khóa/mở khóa tài khoản đăng nhập của thủ thư; có khung quản lý thẻ thư viện.
- **Thủ thư:** xem, thêm, sửa, xóa danh mục sách, quản lý kho và có khung quản lý thẻ thư viện.
- **Độc giả:** xem danh mục sách; trang đăng nhập có khung đăng ký tài khoản độc giả.

Máy chủ kiểm tra quyền cho cả trang theo vai trò và API. Tài khoản bị khóa sẽ mất hiệu lực phiên đăng nhập.

## Tài khoản đăng nhập và thẻ thư viện

Đây là hai loại hồ sơ riêng:

- **Tài khoản đăng nhập** gồm tên đăng nhập, mật khẩu và vai trò; dùng để xác thực và phân quyền vào hệ thống. Quản trị viên quản lý tài khoản thủ thư.
- **Thẻ thư viện** là hồ sơ do thư viện cấp cho độc giả, có mã thẻ, ngày cấp/hết hạn và trạng thái sử dụng dịch vụ. Thủ thư và quản trị viên có khung giao diện mở/khóa thẻ.

Các khung thẻ thư viện và đăng ký tài khoản độc giả hiện mới là giao diện mẫu; thao tác chưa lưu vào SQLite. Tài khoản quản trị/thủ thư và danh mục sách hiện được lưu trong SQLite. Các màn hình mượn/trả, phiếu nhập, đặt trước, tiền phạt và báo cáo chi tiết vẫn dùng dữ liệu minh họa.
