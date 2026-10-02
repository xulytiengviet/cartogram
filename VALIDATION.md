# Kiểm tra bản dựng · 2026-10-02

- Node: 5/5 kiểm thử đạt (chọn năm/thiếu dữ liệu, zero/âm, cán cân cùng năm, tỷ lệ diện tích, CSV, kiểm tra snapshot).
- Chromium headless: đã duyệt 30 nhóm, toàn bộ 37 chuỗi ở chế độ cartogram. Không ghi nhận lỗi JavaScript, tọa độ không hợp lệ, vòng tròn vượt viewBox hoặc chồng lấn >0,5 đơn vị SVG.
- Dân số mới nhất: 170/176 quốc gia/lãnh thổ trên hình học Natural Earth có quan sát. Các quốc gia nhỏ không có hình học không nằm trong mẫu số.
- Đã thao tác đổi chế độ, chỉ tiêu, thành phần, năm, khu vực; tìm/chọn Việt Nam; mở/đóng phương pháp; tải CSV.
- Đã xem ảnh chụp desktop 1440px và mobile 390px; mobile không tràn ngang.
- GitHub Actions lần đầu chạy: 5/5 kiểm thử đạt. Deploy bị chặn ở configure-pages do repository chưa bật Pages (404).

Để xuất bản: Settings → Pages → Source → GitHub Actions, sau đó Actions → Validate and deploy World Atlas → Run workflow (main).

Đây là kết quả kiểm tra chức năng và tính nhất quán xử lý dữ liệu, không phải xác nhận độc lập độ chính xác mọi quan sát của nhà cung cấp.
