# Mộc Thư

## Chạy ứng dụng

Ứng dụng dùng Python 3.10 trở lên và SQLite có sẵn trong Python; không cần cài thư viện ngoài.

```powershell
python "máy-chủ/server.py"
```

Mở <http://127.0.0.1:8000>. Trang chủ và danh mục cơ bản được xem công khai. Hệ thống tự tạo ba tài khoản demo khi khởi động; tại trang đăng nhập, chọn nút theo vai trò để vào thẳng trang độc giả, thủ thư hoặc quản trị. Tài khoản demo dùng mật khẩu `Demo@12345`. Quản trị viên có thể tạo tài khoản quản trị khác và thủ thư tại **Tài khoản nhân sự**.

Đặt sách và xem chi tiết cần đăng nhập. Đăng nhập bằng email hoặc tên đăng nhập; hệ thống tự chuyển đến trang theo vai trò đã cấp cho tài khoản. Tài khoản độc giả và thẻ thư viện được thủ thư cấp cùng lúc tại **Quản lý độc giả**. Quên mật khẩu cần email đã lưu trong hồ sơ; server cục bộ in mã một lần (15 phút) ra cửa sổ terminal vì bản chạy nội bộ chưa cấu hình dịch vụ email.

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

- **Quản trị viên:** dashboard, báo cáo, tạo tài khoản quản trị/thủ thư và quản lý trạng thái tài khoản nhân sự, tra cứu và mở/khóa thẻ.
- **Thủ thư:** quản lý sách, kho, mượn trả; tạo tài khoản độc giả kèm thẻ thư viện và quản lý trạng thái thẻ.
- **Độc giả:** tra cứu, đặt sách bằng thẻ còn hiệu lực và xem thông tin sách sau khi đăng nhập.

Trang chủ công khai có thể tìm danh mục sách. Màn chọn vai trò chỉ là lối vào đăng nhập; vai trò thật luôn lấy từ hồ sơ tài khoản trên máy chủ. Ảnh bìa dùng ảnh bìa trực tuyến đã ghép theo tên sách hoặc tra theo tên sách qua Open Library; nếu nguồn ảnh không có bản phù hợp, danh mục vẫn hiện chữ cái đầu làm ảnh dự phòng.

Máy chủ kiểm tra quyền cho cả trang theo vai trò và API. Tài khoản bị khóa sẽ mất hiệu lực phiên đăng nhập. Không còn bước bắt buộc tạo quản trị viên ở lần chạy đầu; endpoint thiết lập quản trị ban đầu đã bị vô hiệu hóa. Phiên đăng nhập không thể chuyển sang vai trò/tài khoản khác.

## Tài khoản đăng nhập và thẻ thư viện

Đây là hai loại hồ sơ riêng:

- **Tài khoản đăng nhập** gồm tên đăng nhập, email, mật khẩu và vai trò; dùng để xác thực và phân quyền vào hệ thống. Quản trị viên tạo tài khoản quản trị/thủ thư; thủ thư tạo tài khoản độc giả.
- **Thẻ thư viện** là hồ sơ do thư viện cấp cho độc giả, có mã thẻ, ngày cấp/hết hạn và trạng thái sử dụng dịch vụ. Thủ thư và quản trị viên có khung giao diện mở/khóa thẻ.

Tài khoản, thẻ độc giả, yêu cầu đặt sách, danh mục và phiếu mượn được lưu trong SQLite. Phiếu mượn do thủ thư lập có hạn trả 14 ngày; màn hình nhận trả cập nhật phiếu và tồn kho. Một số báo cáo và nội dung dashboard vẫn là dữ liệu minh họa. Khi nâng cấp cơ sở dữ liệu có các tài khoản mẫu cũ admin, thuthu, docgia dùng mật khẩu 123, máy chủ sẽ vô hiệu hóa các tài khoản đó nếu mật khẩu chưa được đổi.
