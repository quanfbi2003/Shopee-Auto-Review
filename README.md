# Shopee Auto Review

Extension Microsoft Edge tự động đánh giá các đơn Shopee đã hoàn thành. Extension thao tác trực tiếp trên giao diện như người dùng — không gọi API Shopee, không đọc cookie hay mật khẩu.

> **Cảnh báo:** công cụ này gửi đánh giá dưới tài khoản Shopee của bạn và tự động hoá giao diện có thể vi phạm điều khoản sử dụng của Shopee. Chỉ dùng cho những đơn bạn đã thực sự mua và hài lòng, không dùng để spam. Bạn tự chịu trách nhiệm khi sử dụng.

## Tính năng

- Tìm các đơn còn nút **Đánh Giá**, tự cuộn tải thêm đơn, xử lý tối đa 50 đơn mỗi lượt.
- Viết nhận xét tiếng Việt theo kiểu người dùng, khác nhau cho từng sản phẩm và không lặp lại trong cùng lượt chạy.
- Giữ nguyên mức sao mặc định của Shopee, không tự chọn sao.
- Tạo clip MP4 H.264 khoảng 8 giây từ ảnh sản phẩm (tối đa 480 × 480, tối đa 4 MiB), rồi gắn video và ảnh vào đánh giá.
- Ghép đúng vùng đánh giá cho đơn nhiều sản phẩm hoặc có quà tặng bằng cách so khớp ảnh, không phụ thuộc thứ tự.
- Chỉ bấm **Hoàn thành** khi Shopee đã hiển thị preview đủ ảnh, video và sao mặc định. Nếu thiếu media, tab bị ẩn, cấu trúc giao diện thay đổi hoặc kết quả gửi không rõ, extension dừng và báo lỗi thay vì gửi thiếu.

## Cài đặt

1. Tải repo này (Code → Download ZIP rồi giải nén) hoặc `git clone`.
2. Mở `edge://extensions`, bật **Developer mode**.
3. Chọn **Load unpacked** và trỏ tới thư mục có `manifest.json`.
4. Mở trang đơn đã hoàn thành: `https://shopee.vn/user/purchase?type=3`. Bảng điều khiển **Shopee Auto Review** xuất hiện ở góc phải dưới.

Sau mỗi lần cập nhật mã, bấm **Reload** ở `edge://extensions` rồi tải lại trang Shopee.

## Sử dụng

- **Bật extension**: bật/tắt extension. Khi tắt, lượt đang chạy dừng lại và không thể bấm Bắt đầu; bật lại để chạy tiếp (cần tải lại trang nếu lượt trước đã dừng vì lỗi hoặc đã bấm Dừng).
- **Bắt đầu tự đánh giá**: chạy tuần tự các đơn còn nút Đánh Giá.
- **Dừng**: ngăn các thao tác mới. Thao tác gửi đã thực hiện thì không thể thu hồi.

Giữ tab Shopee hiển thị trong lúc chạy: Edge có thể tạm dừng tạo video khi tab bị ẩn. Sau khi dừng hoặc gặp lỗi, tải lại trang trước khi chạy lượt mới.

## Cách hoạt động

1. Đọc danh sách đơn và các sản phẩm trong đơn từ DOM.
2. Tạo video cho từng sản phẩm **trước khi** mở biểu mẫu, để Shopee không đóng biểu mẫu trong lúc chờ.
3. Mở biểu mẫu, ghép từng vùng đánh giá với sản phẩm theo ảnh, gắn video rồi gắn ảnh.
4. Chờ Shopee hiển thị preview, đối chiếu lại nội dung rồi bấm Hoàn thành đúng một lần.
5. Xác nhận thành công khi nút Đánh Giá của đơn biến mất; nếu không chắc, dừng và không tự gửi lại.

## Giới hạn đã biết

- Phụ thuộc cấu trúc giao diện Shopee; Shopee đổi giao diện có thể làm extension dừng.
- Không xử lý CAPTCHA, đăng nhập lại hay giới hạn tài khoản; không tự chuyển tab phân loại đơn.
- Ảnh dùng là ảnh sản phẩm do người bán đăng, không phải ảnh người mua tự chụp. Video được tạo tại máy từ chính ảnh đó.
- Nhận xét là các mẫu câu tích cực chung, không phản ánh đánh giá chi tiết của người dùng.
- Mức sao do Shopee mặc định; extension không chọn sao.

## Quyền riêng tư

- Chỉ chạy trên `shopee.vn` và chỉ tải ảnh từ CDN ảnh của Shopee.
- Không đọc, không lưu cookie, mật khẩu, địa chỉ nhận hàng hay lịch sử đơn.
- Video được tạo trong trình duyệt, không gửi tới dịch vụ chuyển mã bên ngoài.

## Đóng góp

Mở issue hoặc pull request mô tả rõ thay đổi. Vì extension phụ thuộc giao diện Shopee, hãy kèm cấu trúc DOM hoặc thông báo lỗi khi báo lỗi.

## Miễn trừ trách nhiệm

Phần mềm được cung cấp "nguyên trạng", không bảo đảm hoạt động liên tục hay không bị Shopee thay đổi làm ảnh hưởng. Tác giả không chịu trách nhiệm cho việc tài khoản bị hạn chế hoặc bất kỳ thiệt hại nào phát sinh từ việc sử dụng.

## Giấy phép

Phát hành theo [MIT License](LICENSE).
