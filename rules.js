function shortProductName(name) {
  const cleaned = String(name || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}\s.,&+/-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Lấy cụm tên trước dấu phân tách quảng cáo, giữ tối đa 7 từ và bỏ từ tả media.
  const head = cleaned.split(/[,|/]| - /)[0].split(' ')
    .filter(word => word && !/^(ảnh|hình|video|clip|minh|họa)$/iu.test(word))
    .slice(0, 7).join(' ').slice(0, 48).replace(/\s+\S{1,2}$/u, '').replace(/\s+(và|của|cho|với|có|để|x|\d+)$/iu, '').trim();
  return head.length >= 3 ? head : 'sản phẩm này';
}

function hashText(text) {
  let hash = 2166136261;
  for (const char of String(text)) hash = Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0;
  return hash;
}

// Các câu viết kiểu người dùng thật: ngắn, tự nhiên, khen tích cực; không nhắc ảnh/video.
const REVIEW_OPENERS = [
  p => `${p} dùng thấy ok lắm.`,
  p => `Mua ${p} về dùng ổn phết.`,
  p => `${p} đúng mô tả, dùng tốt.`,
  p => `Dùng ${p} mấy hôm rồi thấy ổn.`,
  p => `${p} ok nha, không phí tiền.`,
  p => `Hàng về ${p} dùng thấy ưng.`,
  p => `${p} dùng được, mình thấy hài lòng.`,
  p => `Đặt ${p} về mấy hôm, dùng thấy thích.`,
  p => `${p} ngoài đời nhìn đẹp hơn mình nghĩ.`,
  p => `Nhận ${p} xong dùng thử thấy ổn ngay.`,
  p => `${p} làm mình thấy hài lòng.`,
  p => `Mình mua ${p} và thấy không hối hận.`,
  p => `${p} dùng thấy ổn, đúng ý mình.`,
  p => `Thấy ${p} giá hợp lý nên mua, dùng thấy ổn.`,
  p => `${p} dùng thay cái cũ, ổn hơn hẳn.`,
  p => `Cầm ${p} trên tay thấy chắc chắn, dùng ổn.`
];
const REVIEW_DETAILS = {
  'đồ thời trang': ['Form vừa vặn, chất vải mềm', 'Mặc thoải mái, màu đẹp',
    'Đường may chắc chắn', 'Vừa người, dễ phối đồ',
    'Mặc lên dáng gọn, tôn người', 'Vải dày dặn, ít nhăn', 'Đường cắt gọn gàng',
    'Màu giống hình', 'Giặt xong không bai', 'Mặc thoáng, không bí',
    'Kích thước chuẩn', 'May chắc, không sờ chỉ', 'Dễ phối với đồ thường ngày',
    'Vải không ra màu khi giặt', 'Ủi nhanh, nếp phẳng', 'Mặc cả ngày không khó chịu'],
  'thiết bị': ['Kết nối ổn, dùng mượt', 'Chạy nhanh, không lag',
    'Lắp dễ, dùng tiện', 'Chạy ổn định',
    'Âm thanh rõ, không rè', 'Kết nối nhanh, ít ngắt', 'Sạc nhanh, dễ dùng',
    'Thiết kế nhỏ gọn', 'Nút bấm phản hồi tốt', 'Dây dài, dùng thoải mái',
    'Hiển thị rõ ràng', 'Không nóng khi dùng lâu', 'Kết nối được nhiều thiết bị',
    'Đèn sáng đều, không chói', 'Vỏ chắc, cầm chắc tay', 'Chạy ổn với nguồn điện thường'],
  'pin': ['Pin trâu, lắp vừa', 'Dùng lâu, điện ổn',
    'Còn mới, đóng gói kỹ', 'Thiết bị chạy bình thường',
    'Sạc đầy dùng được lâu', 'Điện áp ổn định', 'Vỏ pin chắc, không rò',
    'Đóng gói kỹ, hạn còn dài', 'Lắp vừa khít', 'Dùng cho đồ gia dụng ổn',
    'Để lâu không chảy pin', 'Dùng cho đồ chơi thấy ổn', 'Dung lượng đúng ghi trên vỏ',
    'Sạc nhanh, ít nóng', 'Dùng cho remote thấy ổn', 'Còn mới, tem nhãn rõ'],
  'đồ dùng': ['Dùng tiện, dễ vệ sinh', 'Chất liệu chắc, ưng',
    'Kích thước vừa nhu cầu', 'Đóng gói kỹ, ổn',
    'Dùng tiện hằng ngày', 'Chất liệu dày, không ọp ẹp', 'Dễ rửa, không bám dầu',
    'Không ám mùi', 'Kích thước đúng ghi', 'Đóng gói nhiều lớp, không móp',
    'Dùng với bếp tốt', 'Tay cầm chắc, dễ dùng', 'Để vừa ngăn kéo',
    'Chịu nhiệt ổn', 'Màu đẹp, sạch sẽ', 'Dùng xong cất gọn'],
  'nước hoa': ['Mùi thơm dễ chịu, không gắt', 'Hương nhẹ, thơm lâu',
    'Xịt mịn, chai gọn', 'Thơm sạch sẽ, thích',
    'Hương nhẹ, dễ chịu cả ngày', 'Không bị nồng', 'Thơm dịu, lịch sự',
    'Lưu hương ổn trong ngày', 'Chai nhỏ, mang theo tiện', 'Vòi xịt đều, không bị giật',
    'Mùi sạch sẽ, không gắt mũi', 'Thơm tự nhiên', 'Đóng gói kỹ, không rò',
    'Dùng được cả đi làm', 'Hương nhẹ, phù hợp hằng ngày', 'Xịt vào áo thấy thơm nhẹ'],
  'làm đẹp': ['Dùng nhẹ nhàng, không kích ứng', 'Kết cấu dễ dùng',
    'Bao bì gọn, đóng gói kỹ', 'Dùng thấy dịu',
    'Dùng lên thấy nhẹ', 'Không bị rít', 'Thấm nhanh, không bết',
    'Bao bì kín, dễ lấy', 'Mùi dễ chịu', 'Dùng hằng ngày ổn',
    'Không để lại vệt', 'Kết cấu mịn', 'Đóng gói cẩn thận',
    'Dùng tiết kiệm', 'Hộp kín, không tràn', 'Dùng sau tắm thấy dễ chịu'],
  'thực phẩm': ['Ăn ngon, vừa miệng', 'Hương vị đậm đà',
    'Đóng gói chắc, hạn còn xa', 'Khối lượng đúng',
    'Vị vừa, không quá mặn', 'Thơm, dễ ăn', 'Đóng gói chắc, không bị bẹp',
    'Hạn sử dụng dài', 'Đúng trọng lượng', 'Sợi mì dai vừa',
    'Pha dễ, nhanh gọn', 'Hộp còn nguyên seal', 'Ăn kèm thấy hợp',
    'Vị đậm đà, thơm', 'Bảo quản dễ', 'Đóng hộp tiện dùng dần'],
  'văn phòng': ['Dính chắc, dùng tiện', 'Dễ dùng, tiết kiệm thời gian',
    'Chất lượng đúng giá', 'Đóng gói cẩn thận',
    'Dính chắc trên giấy', 'Bóc ra không để lại keo', 'Cắt gọn, dễ dùng',
    'Dùng tiện hằng ngày', 'Kích thước vừa tay', 'Không lem khi viết',
    'Dùng cho văn phòng ổn', 'Giấy dày, không rách', 'Bấm êm, không kẹt',
    'Màu rõ, dễ đọc', 'Hộp gọn, để bàn tiện', 'Dùng được nhiều việc'],
  'sản phẩm': ['Dùng ổn, không có vấn đề gì', 'Thấy ưng, đáng thử',
    'Lựa chọn hợp lý', 'Đúng nhu cầu',
    'Đóng gói kỹ, giao đến nguyên vẹn', 'Dùng thấy chắc chắn', 'Thiết kế gọn gàng',
    'Dùng tiện', 'Chất lượng ổn với giá', 'Không có lỗi gì',
    'Dùng thấy dễ chịu', 'Làm đúng chức năng', 'Nhìn chỉn chu',
    'Dùng lâu thấy vẫn ổn', 'Phù hợp nhu cầu', 'Đáng để mua lần sau']
};
const REVIEW_CLOSERS = [
  'Sẽ ủng hộ shop thêm.',
  'Cảm ơn shop.',
  'Mọi người yên tâm mua.',
  'Giá vậy là hợp lý.',
  'Rất đáng tiền.',
  'Cho shop 5 sao.',
  'Đóng gói cẩn thận, giao nhanh.',
  'Shop chuẩn bị hàng kỹ.',
  'Hàng giống mô tả.',
  'Sẽ mua lại lần sau.',
  'Giá tốt, đóng gói kỹ.',
  'Dùng ổn nên giới thiệu cho bạn bè.',
  'Rất hài lòng.',
  'Đáng đồng tiền.',
  'Shop dễ thương.',
  '5 sao cho shop.'
];

function categoryOf(name) {
  // Tách từ theo ranh giới chữ để "ăn" không khớp nhầm trong "Năng", "bằng"...
  const has = pattern => new RegExp(`(^|[^\\p{L}\\p{N}])(?:${pattern})(?=$|[^\\p{L}\\p{N}])`, 'iu').test(String(name || ''));
  if (has('mã thẻ bảo hành|thẻ bảo hành|quà tặng')) return 'sản phẩm';
  if (has('pin|battery|ắc quy')) return 'pin';
  if (has('áo|quần|giày|dép|túi|váy|mũ|nón')) return 'đồ thời trang';
  if (has('đồng hồ|tai nghe|loa|cáp|sạc|điện tử|usb|bluetooth|wifi|giá đỡ|laptop|led')) return 'thiết bị';
  if (has('xịt thơm|body mist|nước hoa|perfume|mist|hương')) return 'nước hoa';
  if (has('xịt|kem|sữa tắm|dầu gội|mỹ phẩm|dưỡng|son|mặt nạ')) return 'làm đẹp';
  if (has('mì|bánh|kẹo|trà|cà phê|gạo|nước mắm|thực phẩm|đồ ăn')) return 'thực phẩm';
  if (has('băng dính|keo|băng keo|bút|giấy|ghim|kẹp')) return 'văn phòng';
  if (has('lọ|hộp|đựng|bếp|gia dụng|chén|bát|thớt|dụng cụ|bọt biển')) return 'đồ dùng';
  return 'sản phẩm';
}

function composeReview(name, used = new Set()) {
  const product = shortProductName(name);
  const details = REVIEW_DETAILS[categoryOf(name)];
  const total = REVIEW_OPENERS.length * details.length * REVIEW_CLOSERS.length;
  const start = hashText(product) % total;
  for (let offset = 0; offset < total; offset++) {
    const index = (start + offset * 37) % total;
    const opener = Math.floor(index / (details.length * REVIEW_CLOSERS.length));
    const detail = Math.floor(index / REVIEW_CLOSERS.length) % details.length;
    const closer = index % REVIEW_CLOSERS.length;
    const text = `${REVIEW_OPENERS[opener](product)} ${details[detail]}. ${REVIEW_CLOSERS[closer]}`;
    if (!used.has(text)) {
      used.add(text);
      return text;
    }
  }
  throw new Error('Hết mẫu nhận xét khác nhau; dừng để tránh đánh giá trùng lặp.');
}

function normalizeImageUrl(raw) {
  const url = String(raw || '');
  return url.endsWith('_tn') ? url.slice(0, -3) : url;
}

// Nhóm các dòng mua hàng theo tên sản phẩm: nhiều phân loại của cùng một sản phẩm
// được Shopee gộp vào một vùng đánh giá, dù ảnh của từng phân loại có thể khác nhau.
function groupReviewItems(orderProducts) {
  const groups = [];
  const indexByKey = new Map();
  for (const product of orderProducts) {
    const name = (product.querySelector('.LNTevg')?.textContent || '').trim();
    const variant = (product.querySelector('.jmt57N')?.textContent || '').trim();
    const imageUrl = normalizeImageUrl(product.querySelector('img')?.getAttribute('src') || '');
    const key = name || `img:${imageUrl}`;
    const existing = indexByKey.get(key);
    if (existing !== undefined) {
      if (imageUrl && !groups[existing].imageUrls.includes(imageUrl)) groups[existing].imageUrls.push(imageUrl);
      if (variant && !groups[existing].variants.includes(variant)) groups[existing].variants.push(variant);
      continue;
    }
    indexByKey.set(key, groups.length);
    groups.push({name, imageUrls: imageUrl ? [imageUrl] : [], variants: variant ? [variant] : []});
  }
  return groups;
}

// Biểu mẫu có thể ghi gộp "A , B"; mọi phân loại ở trang đơn phải xuất hiện trong chuỗi đó.
function variantsMatch(modalVariant, orderVariants) {
  const strip = text => String(text || '').replace(/^\s*Phân loại hàng:\s*/iu, '').replace(/\s+/g, ' ').trim();
  const modal = strip(modalVariant);
  const wanted = (orderVariants || []).map(strip).filter(Boolean);
  if (!wanted.length) return true;
  return wanted.every(variant => modal.includes(variant));
}

// Ghép từng vùng đánh giá trong biểu mẫu với đúng nhóm sản phẩm của đơn.
// Ưu tiên ảnh (đơn và biểu mẫu có thể sắp thứ tự khác nhau, quà tặng không có tên),
// rồi mới đến tên. Mỗi nhóm chỉ được dùng một lần.
function mapFormItems(formItems, groups) {
  if (!Array.isArray(formItems) || !Array.isArray(groups) || !formItems.length ||
      formItems.length !== groups.length) {
    throw new Error('Số vùng đánh giá không khớp số sản phẩm trong đơn.');
  }
  const used = new Set();
  const mapping = [];
  for (const [index, item] of formItems.entries()) {
    let groupIndex = groups.findIndex((group, i) => !used.has(i) &&
      item.imageUrl && group.imageUrls.includes(item.imageUrl));
    if (groupIndex < 0) {
      groupIndex = groups.findIndex((group, i) => !used.has(i) &&
        group.name && item.name && group.name === item.name);
    }
    if (groupIndex < 0) throw new Error('Không khớp được vùng đánh giá với sản phẩm trong đơn.');
    used.add(groupIndex);
    const group = groups[groupIndex];
    if (group.name && item.name && group.name !== item.name) {
      throw new Error('Tên sản phẩm trong biểu mẫu không khớp đơn.');
    }
    if (!variantsMatch(item.variant, group.variants)) {
      throw new Error('Phân loại trong biểu mẫu không khớp đơn.');
    }
    mapping[index] = groupIndex;
  }
  if (used.size !== groups.length) throw new Error('Có sản phẩm trong đơn không có vùng đánh giá.');
  return mapping;
}

// Shopee có thể bỏ dấu "/" cuối ở URL danh sách đơn.
function isPurchaseListPath(pathname) {
  return pathname === '/user/purchase' || pathname === '/user/purchase/';
}

function validateMediaUrl(raw, hosts = ['down-vn.img.susercontent.com']) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password ||
      (url.port && url.port !== '443') || !hosts.includes(url.hostname.toLowerCase())) {
    throw new Error('Nguồn ảnh không hợp lệ.');
  }
  return url;
}

function assertReady(state, expected) {
  if (!state || !expected || state.groupId !== expected.groupId ||
      !Array.isArray(state.items) || !Array.isArray(expected.items) ||
      !state.items.length || state.items.length !== expected.items.length ||
      !state.submitEnabled || state.previouslySubmitted || state.blocked) throw new Error('Biểu mẫu không sẵn sàng.');
  const items = new Map(state.items.map(item => [item.id, item]));
  if (items.size !== state.items.length || new Set(expected.items.map(item => item.id)).size !== expected.items.length) {
    throw new Error('Sản phẩm trong biểu mẫu bị trùng.');
  }
  for (const expectedItem of expected.items) {
    const actual = items.get(expectedItem.id);
    if (!actual || actual.text !== expectedItem.text || actual.imagesReady < 1 ||
        actual.videosReady !== 1 || actual.uploading || !actual.defaultStarsSelected ||
        !Number.isFinite(actual.videoSeconds) || Math.abs(actual.videoSeconds - 8) > .5) {
      throw new Error('Thiếu nội dung, ảnh, video hoặc sao mặc định cho sản phẩm.');
    }
  }
}

async function runGroup(adapter, expected, signal) {
  const state = await adapter.state();
  assertReady(state, expected);
  signal.throwIfAborted();
  if (await adapter.commit(expected) !== 'confirmed') throw new Error('Chưa xác định kết quả gửi.');
  return 'confirmed';
}

// Chỉ chia sẻ giữa các content script cùng isolated world; không tạo thuộc tính trên trang Shopee.
globalThis.shopeeReviewRules = {composeReview, validateMediaUrl, assertReady, runGroup, groupReviewItems, variantsMatch, mapFormItems, isPurchaseListPath};
if (typeof module !== 'undefined') module.exports = globalThis.shopeeReviewRules;
