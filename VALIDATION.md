# Kiểm tra cập nhật Area Cartogram · 2026-10-02

Bản này thay Dorling bằng đa giác biến dạng liên tục; kết quả kiểm tra vòng tròn của bản cũ không áp dụng.

- Node: 6/6 kiểm thử đạt. Có kiểm tra lưới hai vùng chung biên: đỉnh chung giữ cùng chỉ số, tỷ lệ diện tích hội tụ về 1:3; giá trị âm dùng độ lớn, missing không biến thành zero.
- Chromium headless: 176 SVG path quốc gia/lãnh thổ, không còn circle.country. Không có tọa độ NaN/Infinity.
- Kiểm tra dân số, GDP, HDI, tăng dân số (có âm), nợ chính phủ (thưa dữ liệu), lọc Châu Á, đổi bảng màu, hủy worker bằng chuyển về Cartographic, xuất SVG.
- Sai lệch phân bổ diện tích sau tối đa 180 vòng trong mẫu kiểm tra: dân số 2,3%; GDP 12,7%; HDI 10,3%; tăng dân số 13,4%; nợ chính phủ 7,5%. Giao diện hiển thị sai lệch thực của mỗi kết quả; đây không phải tỷ lệ diện tích chính xác và không phải sai số tối đa từng nước.
- Đã xem ảnh desktop 1440px và mobile 390px. Mobile không tràn ngang; không ghi nhận lỗi JavaScript.
- SVG xuất gồm các ô màu và ghi chú phương pháp; CSV giữ giá trị nguồn, không xuất giá trị biến dạng.
- Không xác nhận hình học đầu ra dùng được cho phân tích GIS hoặc mọi biên không tự giao; mục tiêu là trực quan hóa bản đồ thống kê.

Nguồn dữ liệu được giữ nguyên. GitHub Pages đã bật trước lần cập nhật này; hai workflow được bổ sung engine và worker vào gói triển khai.
