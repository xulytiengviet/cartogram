# World Atlas — Cartographic & Cartogram

Ứng dụng bản đồ thế giới bằng tiếng Việt, Long Ngo phát triển. Chạy tĩnh trên GitHub Pages, không API key, không backend, không cần npm install.

## Sử dụng

- **Cartographic:** bản đồ choropleth, phép chiếu Equal Earth; địa lý không biến dạng theo chỉ tiêu.
- **Cartogram:** biến dạng đa giác liên tục bằng rubber-sheet (Dougenik), tối đa 180 vòng; đỉnh chung dùng cùng tọa độ. Diện tích xấp xỉ tỷ lệ trị tuyệt đối chỉ tiêu, không dùng vòng tròn. Sai lệch phân bổ diện tích được hiển thị trên giao diện.
- 30 nhóm / 37 chuỗi (gồm cán cân thương mại tính toán); chỉ tiêu có thành phần được chọn riêng.
- Chọn năm 2010–2025 hoặc mới nhất từng quốc gia, lọc châu lục, tìm chỉ tiêu/quốc gia.
- Nhấn quốc gia xem chuỗi thời gian; thiếu năm sẽ ngắt đường biểu đồ.
- Xuất CSV có ISO3, đơn vị, năm thực tế, nguồn và ngày tải; xuất SVG kèm thông tin nguồn.
- URL lưu trạng thái để chia sẻ; hỗ trợ bàn phím, thiết bị di động, zoom/pan.

## Chạy và kiểm tra

```sh
python3 -m http.server 8080
# Mở http://localhost:8080
npm test
```

Mã ứng dụng dùng ES modules; không mở index.html bằng file://.

## Dữ liệu và cách diễn giải

`data/indicators.json` là danh mục đầy đủ mã chỉ tiêu, đơn vị, phạm vi và lưu ý. 35 chuỗi World Bank WDI và một chuỗi HDI được đóng gói cùng ứng dụng. Snapshot có trường `source`, `url`, `retrieved`, `rows`: `[ISO3, năm, giá trị]`. Dữ liệu trên bản đồ chỉ gồm quốc gia có hình học Natural Earth; không hiển thị các nhóm tổng hợp World Bank như World hoặc khu vực.

- API: https://datahelpdesk.worldbank.org/knowledgebase/topics/125589-developer-information
- Dữ liệu WDI: https://data.worldbank.org/ ; điều khoản: https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets
- HDI: UNDP Human Development Reports qua https://ourworldindata.org/grapher/human-development-index ; nguồn gốc https://hdr.undp.org/data-center
- Natural Earth 1:110m: https://www.naturalearthdata.com/about/terms-of-use/ (public domain); ranh giới tổng quát hóa, không thể dùng xác định chủ quyền, có thể thiếu các quốc đảo/lãnh thổ nhỏ.
- D3 7.9.0 được đóng gói cục bộ, giấy phép ISC trong `vendor/D3-LICENSE`.

**Không có số liệu giả hoặc nội suy.** Mới nhất lấy năm mới nhất của mỗi quốc gia trong cửa sổ 2010–2025; không có nghĩa là cùng năm. Chọn một năm cụ thể để so sánh đồng nhất. Các giá trị null không phải số 0. Số 0 có diện tích sàn nhỏ để tránh đa giác suy biến; dữ liệu thiếu không có lực mục tiêu, chỉ biến dạng thụ động và tô xám. Giá trị âm dùng trị tuyệt đối khi tính diện tích, giữ dấu trong tooltip/bảng/CSV. Với tỷ lệ/phần trăm, cartogram so sánh tỷ lệ, không thể hiện tổng đóng góp.

Nợ công dùng **nợ chính phủ trung ương**, không thay thế nợ toàn khu vực công. Độ tuổi lao động dùng 15–64. Nước/vệ sinh dùng ít nhất mức cơ bản. Nhóm 21 chọn biết chữ; nhóm 24 chọn chi tiêu y tế; nhóm 30 chọn chi tiêu quân sự. CO₂ không gồm LULUCF. Cơ cấu giá trị gia tăng không nhất thiết cộng đủ 100% GDP. Gini giữa các năm/phương pháp khảo sát cần thận trọng.

## Cập nhật dữ liệu

```sh
python3 scripts/refresh-data.py
npm test
```

Script chỉ thay từng snapshot sau khi tải và kiểm tra hợp lệ. Lỗi nguồn trả exit code khác 0; workflow không commit một lần tải chưa hoàn tất. GitHub Actions có lịch ngày 5 mỗi tháng và chạy thủ công; sau khi cập nhật sẽ triển khai trực tiếp vì commit dùng GITHUB_TOKEN không kích hoạt workflow push mới. Cửa sổ hiện cố định 2010–2025; mở rộng đồng thời script, UI và kiểm thử nếu muốn thêm năm.

## GitHub Pages

Trong **Settings → Pages → Source**, chọn **GitHub Actions**. Workflow `Validate and deploy World Atlas` chạy kiểm thử, chỉ đóng gói tệp công khai, triển khai khi push main. URL dự kiến: https://xulytiengviet.github.io/cartogram/ . Cần Pages được bật trên repository; workflow không chứa khóa truy cập cá nhân.

## Cấu trúc

- `index.html`, `styles.css`: giao diện responsive.
- `app.js`: tương tác, phép chiếu, cartogram diện tích, bảng, biểu đồ, xuất tệp.
- `core.js`: chọn năm, tính cán cân, tỷ lệ diện tích, CSV.
- `data/`: dữ liệu thực và hình học.
- `scripts/refresh-data.py`: tải lại nguồn chính thức.
- `tests/core.test.js`: kiểm chứng quy tắc số liệu và snapshot.

Mã nguồn MIT. Dữ liệu và thư viện bên thứ ba tuân theo giấy phép nguồn tương ứng.

## Cartogram diện tích và bảng màu

- Thuật toán lấy cảm hứng từ Dougenik, Chrisman & Niemeyer (1985), mô tả phương pháp: https://github.com/shawnbot/topogram . Engine viết riêng trong `cartogram-engine.js`; worker tính ngoài luồng giao diện.
- `projection.stream` cắt qua kinh tuyến đổi ngày trước khi tạo lưới; các đỉnh trùng tọa độ được dùng chung. Không làm biến dạng trực tiếp kinh/vĩ độ.
- Diện tích mục tiêu dùng trị tuyệt đối dữ liệu. Sai lệch = ½ tổng |tỷ phần diện tích − tỷ phần giá trị| của các quốc gia có giá trị khác 0. Không phải sai số tối đa từng quốc gia.
- Diện tích sàn: 10⁻⁷ tổng diện tích ban đầu của các quốc gia có giá trị khác 0. Vì có sàn và giới hạn vòng lặp, không tuyên bố tỷ lệ chính xác. Không dùng hình học kết quả cho đo đạc/phân tích GIS.
- Các nước thiếu dữ liệu không được gán giá trị; hình học của chúng dịch chuyển theo trường lực lân cận.
- Ba bảng màu: Spectral, Turbo, Viridis. Cả hai chế độ dùng 7 lớp phân vị cùng ngưỡng. Tooltip trên ô chú giải ghi khoảng giá trị. Màu không biểu thị âm/dương hoặc tốt/xấu.
- Worker được hủy khi đổi chỉ tiêu/năm/khu vực/chế độ; cache tối đa 12 kết quả. Đổi bảng màu dùng lại hình học đã tính.
