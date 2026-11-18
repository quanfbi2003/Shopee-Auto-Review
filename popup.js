const toggle = document.getElementById('enabled');
const hint = document.getElementById('hint');

chrome.storage.local.get({enabled: true}).then(({enabled}) => {
  toggle.checked = enabled;
  hint.textContent = enabled
    ? 'Mở trang đơn đã hoàn thành trên Shopee để dùng.'
    : 'Extension đang tắt. Bật lại rồi tải lại trang Shopee.';
});

toggle.addEventListener('change', async () => {
  await chrome.storage.local.set({enabled: toggle.checked});
  hint.textContent = toggle.checked
    ? 'Đã bật. Tải lại trang Shopee nếu bảng điều khiển chưa hiện.'
    : 'Đã tắt. Lượt đang chạy sẽ dừng.';
});
