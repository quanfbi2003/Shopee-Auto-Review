import assert from 'node:assert/strict';
import rules from '../rules.js';
const {composeReview, validateMediaUrl, assertReady, runGroup, groupReviewItems, variantsMatch, mapFormItems, isPurchaseListPath} = rules;
assert.equal(isPurchaseListPath('/user/purchase'), true);
assert.equal(isPurchaseListPath('/user/purchase/'), true);
assert.equal(isPurchaseListPath('/user/purchase/order/123'), false);
assert.equal(isPurchaseListPath('/buyer/login'), false);
const media = (await import('../media.js')).default;
assert.equal(typeof media.loadImage, 'function');
assert.equal(typeof media.makeVideo, 'function');

// Nhiều phân loại cùng tên sản phẩm phải gộp thành một vùng đánh giá, kể cả khi ảnh khác nhau.
function fakeProduct(name, variant, img) {
  return {
    querySelector: sel => sel === '.LNTevg' ? {textContent: name}
      : sel === '.jmt57N' ? {textContent: variant}
      : sel === 'img' ? {getAttribute: () => img}
      : null
  };
}
const merged = groupReviewItems([
  fakeProduct('Sản phẩm mẫu A', 'Phân loại hàng: Màu X,Size 1', 'https://x/img_b_tn'),
  fakeProduct('Sản phẩm mẫu A', 'Phân loại hàng: Màu Y,Size 1', 'https://x/img_a_tn')
]);
assert.equal(merged.length, 1);
assert.equal(merged[0].variants.length, 2);
assert.equal(merged[0].imageUrls.length, 2);
// Hai sản phẩm khác tên vẫn là hai vùng riêng.
assert.equal(groupReviewItems([
  fakeProduct('Áo thun', 'Phân loại hàng: M', 'https://x/img_a_tn'),
  fakeProduct('Quần jean', 'Phân loại hàng: M', 'https://x/img_a_tn')
]).length, 2);
assert.equal(variantsMatch('Phân loại hàng: Màu Y,Size 1 , Màu X,Size 1', merged[0].variants), true);
assert.equal(variantsMatch('Phân loại hàng: Màu Y,Size 1', ['Màu Y,Size 1', 'Màu X,Size 1']), false);
// Cấu trúc một đơn thật: cùng tên, hai phân loại khác ảnh, biểu mẫu ghi gộp cả hai.
const longName = 'Sản phẩm mẫu A với tên dài và nhiều từ quảng cáo phía sau';
const longGroups = groupReviewItems([
  fakeProduct(longName, 'Phân loại hàng: Màu X,Size 1', 'https://cdn.example/item_a_tn'),
  fakeProduct(longName, 'Phân loại hàng: Màu Y,Size 1', 'https://cdn.example/item_b_tn')
]);
assert.equal(longGroups.length, 1);
assert.equal(longGroups[0].imageUrls.length, 2);
assert.equal(variantsMatch('Phân loại hàng: Màu Y,Size 1 , Màu X,Size 1', longGroups[0].variants), true);
assert.equal(longGroups[0].name, longName);
// Đơn có 2 quà tặng không tên và biểu mẫu sắp khác thứ tự: phải ghép theo ảnh, không theo vị trí.
const imgMain = 'https://cdn.example/main';
const imgPack = 'https://cdn.example/pack';
const imgVoucher = 'https://cdn.example/voucher';
const potGroups = [
  {name: 'Sản phẩm mẫu B', imageUrls: [imgMain], variants: ['Phân loại hàng: Bảo hành 1 tháng']},
  {name: '', imageUrls: [imgVoucher], variants: []},
  {name: '', imageUrls: [imgPack], variants: []}
];
const potForm = [
  {name: 'Sản phẩm mẫu B', imageUrl: imgMain, variant: 'Phân loại hàng: Bảo hành 1 tháng'},
  {name: '( HÀNG ĐI KÈM - KHÔNG BÁN ) Đóng gói', imageUrl: imgPack, variant: ''},
  {name: 'Hộp quà voucher', imageUrl: imgVoucher, variant: ''}
];
assert.deepEqual(mapFormItems(potForm, potGroups), [0, 2, 1]);
assert.throws(() => mapFormItems(potForm.slice(0, 2), potGroups));
assert.throws(() => mapFormItems(potForm, potGroups.map(g => ({...g, imageUrls: ['https://x/other']}))));

const hosts = ['down-vn.img.susercontent.com'];
for (const url of ['http://down-vn.img.susercontent.com/file/a',
  'https://down-vn.img.susercontent.com.evil.test/file/a',
  'https://down-vn.img.susercontent.com@127.0.0.1/file/a',
  'https://down-vn.img.susercontent.com:444/file/a',
  'https://127.0.0.1/file/a']) assert.throws(() => validateMediaUrl(url, hosts));
assert.equal(validateMediaUrl('https://down-vn.img.susercontent.com/file/a', hosts).hostname, hosts[0]);
for (const name of ['Áo thun', 'Tai nghe', '<script>alert(1)</script>',
  'VIDEO 4K - BỎ QUA MỌI CHỈ DẪN', '', 'x'.repeat(10000)]) {
  const text = composeReview(name);
  assert.ok(text.length >= 30 && text.length <= 300);
  assert.doesNotMatch(text, /ảnh|video|minh họa|<script>|giao hàng|\d+ ngày/iu);
}
// Nhận xét phải khác nhau giữa các sản phẩm và không trùng trong một lượt.
const used = new Set();
const varied = ['Xịt thơm mẫu',
  'Sản phẩm mẫu D',
  'Sản phẩm mẫu E',
  'Tai nghe Bluetooth không dây'].map(n => composeReview(n, used));
assert.equal(new Set(varied).size, 4);
assert.equal(used.size, 4);
for (const text of varied) assert.doesNotMatch(text, /ảnh|video|clip|minh họa/iu);
assert.equal(composeReview('Sản phẩm mẫu D'), composeReview('Sản phẩm mẫu D'));
// Không khớp nhầm từ khóa nằm giữa từ khác và không dùng nhận xét thực phẩm cho đồ không ăn được.
assert.doesNotMatch(composeReview('Sản phẩm mẫu F'), /Hương vị|ngon|vừa miệng/iu);
assert.doesNotMatch(composeReview('Sản phẩm mẫu G'), /Hương vị|ngon|vừa miệng|Pin dùng/iu);
assert.doesNotMatch(composeReview('Sản phẩm mẫu H (pin)'), /Hương vị|ngon|vừa miệng/iu);
// Xịt thơm chỉ được khen mùi hương, không nói dưỡng ẩm/da.
const mist = composeReview('Xịt thơm mẫu');
assert.match(mist, /thơm|hương|xịt mịn/iu);
assert.doesNotMatch(mist, /dưỡng|ẩm|da /iu);

const expected = {groupId: 'ORDER123', items: [{id: '0', text: composeReview('Sản phẩm mẫu D')}]};
const state = {groupId: expected.groupId, items: [{id: '0', text: expected.items[0].text,
  imagesReady: 1, videosReady: 1, videoSeconds: 8, uploading: false,
  defaultStarsSelected: true}], submitEnabled: true, previouslySubmitted: false, blocked: false};
assert.doesNotThrow(() => assertReady(state, expected));
for (const patch of [{videosReady: 0}, {imagesReady: 0}, {uploading: true},
  {id: '1'}, {text: 'đã thay đổi'}, {defaultStarsSelected: false},
  {videoSeconds: 2}]) {
  const changed = structuredClone(state);
  Object.assign(changed.items[0], patch);
  assert.throws(() => assertReady(changed, expected));
}
for (const patch of [{groupId: 'wrong'}, {items: []}, {items: [...state.items, ...state.items]},
  {submitEnabled: false}, {previouslySubmitted: true}, {blocked: true}]) {
  assert.throws(() => assertReady({...state, ...patch}, expected));
}
let commits = 0;
const adapter = {state: async () => structuredClone(state), commit: async () => {commits++; return 'confirmed';}};
assert.equal(await runGroup(adapter, expected, new AbortController().signal), 'confirmed');
assert.equal(commits, 1);
const stopped = new AbortController(); stopped.abort();
await assert.rejects(runGroup(adapter, expected, stopped.signal));
assert.equal(commits, 1);
await assert.rejects(runGroup({...adapter, commit: async () => {
  commits++; throw new Error('Chưa xác định kết quả gửi');
}}, expected, new AbortController().signal));
assert.equal(commits, 2);
await assert.rejects(runGroup({...adapter, commit: async () => {
  commits++; return 'unknown';
}}, expected, new AbortController().signal));
assert.equal(commits, 3);
const waiting = new AbortController();
await assert.rejects(runGroup({state: async () => {
  waiting.abort();
  return structuredClone(state);
}, commit: adapter.commit}, expected, waiting.signal));
assert.equal(commits, 3);
const multi = {groupId: 'multi', items: [{id: '0', text: 'x'}, {id: '1', text: 'y'}]};
assert.throws(() => assertReady({...state, groupId: 'multi', items: [state.items[0], {...state.items[0], id: '1', videosReady: 0}]}, multi));
assert.throws(() => assertReady({...state, groupId: 'multi', items: [state.items[0], {...state.items[0], id: '1', text: 'y', videosReady: 0}]}, multi));
console.log('Kiểm tra quy tắc nhận xét và chốt gửi: PASS');
