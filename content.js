// Mẫu content script cũng khớp trang chi tiết đơn; chỉ chạy ở danh sách đơn.
if (!globalThis.__shopeeAutoReviewInspector &&
    globalThis.shopeeReviewRules.isPurchaseListPath(location.pathname)) {
  globalThis.__shopeeAutoReviewInspector = true;
  const seen = new Set();
  const usedReviews = new Set();
  let current = null;
  let blocked = false;
  let submitted = false;
  let operation = Promise.resolve();
  let submitPending = false;
  let expectedItems = null;
  let pending = null;
  const {loadImage, makeVideo} = globalThis.shopeeReviewMedia;
  const {composeReview, assertReady, runGroup, groupReviewItems, mapFormItems, isPurchaseListPath} = globalThis.shopeeReviewRules;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const form = () => document.querySelector('.shopee-popup-form');
  const rows = () => [...(form()?.querySelectorAll('.rating-modal-handler__container') || [])];
  const buttons = () => [...document.querySelectorAll('.R5DdXs button')]
    .filter(button => button.innerText.trim() === 'Đánh Giá' && !button.disabled);
  const orderId = order => {
    const link = order?.querySelector('a[href*="/user/purchase/order/"]');
    const match = link?.getAttribute('href')?.match(/\/user\/purchase\/order\/(\d+)/);
    return match?.[1];
  };
  const itemId = (row, index) => `${index}:${row.querySelector('img')?.getAttribute('src')?.split('/file/')[1] || ''}`;

  function details() {
    const currentRows = rows();
    if (!current || !form() || !currentRows.length) throw new Error('Biểu mẫu Shopee đã thay đổi hoặc bị đóng.');
    if (currentRows.length !== current.items.length) throw new Error('Số sản phẩm trong biểu mẫu đã thay đổi.');
    return currentRows;
  }

  function readState() {
    const currentRows = details();
    const footer = form().querySelector('.shopee-popup-form__footer button.btn-solid-primary');
    return {
      groupId: current.id,
      items: currentRows.map((row, index) => {
        const textarea = [...row.querySelectorAll('textarea')].find(input => input.placeholder.includes('Hãy chia sẻ'));
        const stars = [...row.querySelectorAll('.rating-stars__star--clickable')];
        const item = current.items[index];
        const media = [...row.querySelectorAll('.Y5ceMw ._Y1LWz')];
        const uploaded = tile => tile.style.backgroundImage.includes('.img.susercontent.com/');
        const imagesReady = media.filter(tile => uploaded(tile) && tile.querySelector('button[aria-label="Remove image button"]')).length;
        const videos = media.filter(tile => uploaded(tile) && tile.querySelector('button[aria-label="Remove video"]'));
        const durationLabel = videos.length === 1 ? videos[0].innerText.trim() : '';
        const videoSeconds = durationLabel === '0:08' ? 8 : null;
        return {
          id: itemId(row, index),
          text: textarea?.value || '',
          imagesReady,
          videosReady: videos.length,
          videoSeconds,
          uploading: !!row.querySelector('.Y5ceMw [role="progressbar"], .Y5ceMw [class*="loading"], .Y5ceMw [class*="progress"]'),
          defaultStarsSelected: stars.length === 5 && stars.every(star => !!star.querySelector('svg path[fill*="star__solid"]')),
          matched: row.querySelector('.ebS_Lb')?.textContent?.trim() === item.name &&
            row.querySelector('.gs2KUm')?.textContent?.trim() === item.variant &&
            row.querySelector('.I83LOI img')?.getAttribute('src') === item.originalImageUrl
        };
      }),
      submitEnabled: !!footer && !footer.disabled,
      previouslySubmitted: submitted,
      blocked: blocked || currentRows.some((row, i) => !row.querySelector('.ebS_Lb') ||
        row.querySelector('.ebS_Lb').textContent.trim() !== current.items[i].name ||
        row.querySelector('.gs2KUm')?.textContent?.trim() !== current.items[i].variant ||
        row.querySelector('.I83LOI img')?.getAttribute('src') !== current.items[i].originalImageUrl)
    };
  }

  async function handle(type, payload) {
    if (location.origin !== 'https://shopee.vn' || !isPurchaseListPath(location.pathname)) {
      throw new Error('Không phải trang đơn hàng Shopee.');
    }
    if (type === 'INSPECT') return {
      page: location.pathname,
      orders: buttons().length,
      formItems: rows().length,
      fileInputs: rows().flatMap(row => [...row.querySelectorAll('input[type="file"]')].map(input => input.accept)),
      defaultFiveStars: rows().map(row => [...row.querySelectorAll('.rating-stars__star--clickable')]
        .filter(star => star.querySelector('svg path[fill*="star__solid"]')).length === 5)
    };
    if (blocked) throw new Error('Lượt đánh giá đã dừng; tải lại trang để chạy lượt mới.');
    if (type === 'NEXT') {
      if (form()) throw new Error('Đóng biểu mẫu đang mở trước khi bắt đầu.');
      if (blocked) throw new Error('Đã dừng lượt đánh giá.');
      if (submitted) throw new Error('Kết quả lần gửi trước chưa được xác minh; không gửi tiếp.');
      const next = buttons().map(button => ({button, order: button.closest('.R5DdXs')}))
        .find(({order}) => orderId(order) && !seen.has(orderId(order)));
      if (!next) {
        // Shopee tải đơn theo từng đợt khi cuộn: cuộn lặp lại tối đa 12 lần, dừng khi có đơn mới hoặc hết đơn.
        for (let attempt = 0; attempt < 12; attempt++) {
          const before = document.querySelectorAll('.R5DdXs').length;
          const end = document.querySelector('main .spinner-container') ||
            [...document.querySelectorAll('main .R5DdXs')].at(-1) || document.querySelector('main');
          if (!end) throw new Error('Không tìm thấy danh sách đơn hàng để cuộn.');
          end.scrollIntoView({block: 'center'});
          window.scrollTo(0, document.scrollingElement.scrollHeight);
          for (let i = 0; i < 24; i++) {
            if (blocked) throw new Error('Đã dừng lượt đánh giá.');
            await pause(250);
            if (document.querySelectorAll('.R5DdXs').length > before) break;
          }
          if (buttons().some(button => {
            const id = orderId(button.closest('.R5DdXs'));
            return id && !seen.has(id);
          })) return {more: true};
          if (!document.querySelector('main .spinner-container') &&
              document.querySelectorAll('.R5DdXs').length === before) return {done: true};
        }
        throw new Error('Đã cuộn nhiều lần nhưng chưa thấy thêm đơn cần đánh giá; chưa thể xác nhận đã hết đơn.');
      }
      const id = orderId(next.order);
      const orderProducts = [...next.order.querySelectorAll('section .sjB91h')];
      // Shopee gộp các phân loại của cùng một sản phẩm vào một vùng đánh giá.
      const groups = groupReviewItems(orderProducts);
      const orderImages = groups.map(group => group.imageUrls[0]);
      const groupImageUrls = groups.map(group => group.imageUrls);
      const orderNames = groups.map(group => group.name);
      const orderVariants = groups.map(group => group.variants);
      if (!groups.length || orderImages.some(image => !image)) {
        throw new Error('Không đối chiếu được sản phẩm trong đơn.');
      }
      // Chỉ chọn đơn và chuẩn bị media; chưa mở biểu mẫu để Shopee không đóng nó khi chờ tạo video.
      pending = {id, button: next.button, orderImages, groupImageUrls, orderNames, orderVariants, media: []};
      return {id, products: orderImages.map((imageUrl, index) => ({imageUrl, name: orderNames[index] || 'sản phẩm'}))};
    }
    if (type === 'PREPARE') {
      if (!pending || document.hidden) throw new Error('Chưa có đơn để chuẩn bị hoặc tab Shopee bị ẩn.');
      const index = payload.index;
      if (!Number.isInteger(index) || index < 0 || index >= pending.orderImages.length || pending.media[index]) {
        throw new Error('Chỉ số sản phẩm không hợp lệ.');
      }
      const signal = AbortSignal.any([activeController?.signal || AbortSignal.timeout(35000), AbortSignal.timeout(35000)]);
      const image = await loadImage(pending.orderImages[index], signal);
      if (blocked) throw new Error('Đã dừng trước khi tạo video.');
      const video = await makeVideo(image, signal);
      if (blocked || document.hidden) throw new Error('Đã dừng hoặc tab Shopee bị ẩn khi tạo video.');
      pending.media[index] = {image, video};
      return {prepared: true, index};
    }
    if (type === 'OPEN') {
      if (!pending || pending.media.length !== pending.orderImages.length || pending.media.some(x => !x)) {
        throw new Error('Media chưa chuẩn bị đủ; không mở biểu mẫu.');
      }
      if (form() || document.hidden) throw new Error('Biểu mẫu đang mở hoặc tab Shopee bị ẩn.');
      const {id, button, groupImageUrls} = pending;
      button.click();
      seen.add(id);
      // ponytail: chờ tối đa 15 giây để modal tải sản phẩm; cần polling theo tín hiệu app nếu Shopee đổi luồng tải.
      for (let i = 0; i < 150 && !rows().length; i++) {
        if (blocked) throw new Error('Đã dừng lượt đánh giá.');
        await pause(100);
      }
      if (blocked) throw new Error('Đã dừng lượt đánh giá.');
      const groupRows = rows();
      if (!groupRows.length) throw new Error('Không tìm thấy biểu mẫu Đánh Giá.');
      const items = groupRows.map((row, index) => ({
        id: itemId(row, index),
        name: row.querySelector('.ebS_Lb')?.textContent?.trim(),
        variant: row.querySelector('.gs2KUm')?.textContent?.trim(),
        imageUrl: row.querySelector('.I83LOI img')?.getAttribute('src')?.replace(/_tn(?=$|[?#])/, '')
      }));
      if (items.some(item => !item.id || item.id.endsWith(':')) ||
          new Set(items.map(item => item.id)).size !== items.length) {
        throw new Error('Không nhận diện được các vùng đánh giá trong biểu mẫu.');
      }
      // Biểu mẫu và trang đơn có thể sắp thứ tự khác nhau; quà tặng không có tên nên ghép theo ảnh.
      const mapping = mapFormItems(items, groupImageUrls.map((imageUrls, index) => ({
        name: pending.orderNames[index], imageUrls, variants: pending.orderVariants[index]
      })));
      current = {
        id,
        items: items.map((item, index) => ({...item, mediaIndex: mapping[index],
          originalImageUrl: groupRows[index].querySelector('.I83LOI img').getAttribute('src'), duration: null}))
      };
      expectedItems = new Map();
      submitted = false;
      return {id, items};
    }
    if (type === 'ATTACH') {
      const currentRows = details();
      const index = current.items.findIndex(item => item.id === payload.id);
      if (index < 0) throw new Error('Không tìm thấy sản phẩm cần đánh giá.');
      const row = currentRows[index];
      const item = current.items[index];
      if (expectedItems.has(payload.id) || itemId(row, index) !== payload.id ||
          row.querySelector('.ebS_Lb')?.textContent?.trim() !== item.name ||
          row.querySelector('.I83LOI img')?.getAttribute('src') !== item.originalImageUrl) {
        throw new Error('Sản phẩm đã thay đổi hoặc đã được điền.');
      }
      if (document.hidden) throw new Error('Tab Shopee bị ẩn; hãy giữ tab đang hiển thị.');
      const textarea = [...row.querySelectorAll('textarea')].find(input => input.placeholder.includes('Hãy chia sẻ'));
      if (!textarea || row.querySelector('.Y5ceMw ._Y1LWz') ||
          [...row.querySelectorAll('input[type="file"]')].some(input => input.files.length)) {
        throw new Error('Ô nhận xét hoặc media đã thay đổi; không ghi đè.');
      }
      const media = pending?.media[item.mediaIndex];
      if (!media) throw new Error('Media của sản phẩm chưa được chuẩn bị.');
      const {image, video} = media;
      const text = composeReview(item.name, usedReviews);
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, text);
      textarea.dispatchEvent(new Event('input', {bubbles: true}));
      const imageName = `san-pham-${index}.${image.type === 'image/jpeg' ? 'jpg' : image.type.split('/')[1]}`;
      const videoInput = row.querySelector('input[accept="video/mp4"]');
      if (!row.querySelector('input[accept="image/*"]') || !videoInput) throw new Error('Thiếu trường upload của sản phẩm.');
      const upload = (input, blob, name) => {
        if (!input.isConnected || !row.isConnected) throw new Error('Biểu mẫu upload đã bị thay đổi.');
        const transfer = new DataTransfer();
        transfer.items.add(new File([blob], name, {type: blob.type}));
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', {bubbles: true}));
      };
      upload(videoInput, video.blob, `san-pham-${index}.mp4`);
      for (let i = 0; i < 80; i++) {
        if (blocked || document.hidden || !row.isConnected) throw new Error('Đã dừng, đổi tab hoặc biểu mẫu đã đổi khi chờ video.');
        if ([...row.querySelectorAll('.Y5ceMw ._Y1LWz')].some(tile =>
          tile.querySelector('button[aria-label="Remove video"]') && tile.innerText.trim() === '0:08')) break;
        await pause(250);
      }
      if (![...row.querySelectorAll('.Y5ceMw ._Y1LWz')].some(tile =>
        tile.querySelector('button[aria-label="Remove video"]') && tile.innerText.trim() === '0:08')) {
        throw new Error('Shopee chưa xác nhận video 0:08 sau 20 giây; không gắn ảnh.');
      }
      if (blocked || document.hidden) throw new Error('Đã dừng hoặc đổi tab trước khi gắn ảnh.');
      const nextImageInput = row.querySelector('input[accept="image/*"]');
      if (!nextImageInput || nextImageInput.files.length) throw new Error('Trường ảnh đã đổi sau khi tải video.');
      upload(nextImageInput, image, imageName);
      item.duration = video.duration;
      expectedItems.set(item.id, text);
      return {attached: true, id: item.id, text};
    }
    if (type === 'STATE') {
      let state;
      for (let i = 0; i < 120; i++) {
        if (blocked || document.hidden) throw new Error('Đã dừng hoặc đổi tab trong lúc chờ upload.');
        state = readState();
        if (state.items.every(item => item.imagesReady && item.videosReady)) return state;
        await pause(250);
      }
      throw new Error('Shopee chưa xác nhận đủ ảnh và video sau 30 giây; không gửi.');
    }
    if (type === 'COMMIT') {
      if (submitPending || document.hidden) throw new Error('Lần gửi trước chưa rõ kết quả hoặc trang bị ẩn; không bấm gửi.');
      const state = readState();
      if (state.groupId !== payload.expected?.groupId || state.items.length !== payload.expected.items.length ||
          expectedItems?.size !== state.items.length ||
          state.items.some((item, i) => !item.matched || item.id !== payload.expected.items[i].id ||
            item.text !== payload.expected.items[i].text || item.text !== expectedItems.get(item.id) ||
            item.imagesReady < 1 || item.videosReady !== 1 ||
            item.uploading || !item.defaultStarsSelected || !Number.isFinite(item.videoSeconds) ||
            Math.abs(item.videoSeconds - 8) > .5) ||
          state.blocked || state.previouslySubmitted || !state.submitEnabled) {
        throw new Error('Biểu mẫu chưa đúng hoặc chưa đủ media; không gửi.');
      }
      const submit = form().querySelector('.shopee-popup-form__footer button.btn-solid-primary');
      if (blocked || document.hidden || submit?.innerText?.trim().toLocaleLowerCase('vi') !== 'hoàn thành') {
        throw new Error('Nút gửi không khớp hoặc đã dừng.');
      }
      submitted = true;
      submitPending = true;
      submit.click();
      for (let i = 0; i < 120; i++) {
        await pause(250);
        if (!form()) {
          const order = [...document.querySelectorAll('.R5DdXs')].find(row => orderId(row) === current.id);
          if (order && ![...order.querySelectorAll('button')].some(button => button.innerText.trim() === 'Đánh Giá')) {
            current = null;
            pending = null;
            expectedItems = null;
            submitPending = false;
            submitted = false;
            return {confirmed: true};
          }
        }
      }
      throw new Error('Chưa xác định kết quả gửi; không tự thử lại.');
    }
    throw new Error('Lệnh không được hỗ trợ.');
  }

  async function run(dryRun = false) {
    if (blocked || running) return;
    if (form() || document.hidden) {
      error.textContent = 'Đóng biểu mẫu và giữ tab Shopee hiển thị trước khi chạy.';
      error.hidden = false;
      return;
    }
    error.hidden = true;
    running = true;
    start.disabled = true;
    inspect.disabled = true;
    const controller = new AbortController();
    activeController = controller;
    let completed = 0;
    try {
      for (let index = 0; index < 50; index++) {
        controller.signal.throwIfAborted();
        if (document.hidden) throw new Error('Tab Shopee đã bị ẩn; không tiếp tục.');
        status.textContent = `Đã gửi ${completed} đơn; đang tìm đơn tiếp theo...`;
        const group = await handle('NEXT', {});
        if (group.more) continue;
        if (group.done) {
          status.textContent = `Đã gửi ${completed} đơn. Không còn đơn đủ điều kiện trên trang.`;
          return;
        }
        for (let product = 0; product < group.products.length; product++) {
          controller.signal.throwIfAborted();
          if (document.hidden) throw new Error('Tab Shopee đã bị ẩn; không tiếp tục.');
          status.textContent = `Đang tạo video ${product + 1}/${group.products.length} cho đơn ${completed + 1}...`;
          await handle('PREPARE', {index: product});
        }
        status.textContent = `Đang mở biểu mẫu đơn ${completed + 1}...`;
        const opened = await handle('OPEN', {});
        const expected = {groupId: opened.id, items: []};
        for (const item of opened.items) {
          controller.signal.throwIfAborted();
          if (document.hidden) throw new Error('Tab Shopee đã bị ẩn; không tiếp tục.');
          status.textContent = `Đang chuẩn bị sản phẩm ${expected.items.length + 1}/${opened.items.length} của đơn ${completed + 1}...`;
          const attached = await handle('ATTACH', {id: item.id});
          if (!attached.attached || attached.id !== item.id || !attached.text) throw new Error('Chưa gắn đúng sản phẩm.');
          expected.items.push({id: item.id, text: attached.text});
        }
        status.textContent = `Đang chờ Shopee xác nhận ảnh và video cho đơn ${completed + 1}...`;
        const state = await handle('STATE', {expected});
        assertReady(state, expected);
        if (dryRun) {
          status.textContent = 'Nháp đã đủ ảnh và video; chưa bấm Hoàn thành. Đóng biểu mẫu để chạy thật sau khi kiểm tra.';
          blocked = true;
          return;
        }
        await runGroup({
          state: () => handle('STATE', {expected}),
          commit: async () => (await handle('COMMIT', {expected})).confirmed ? 'confirmed' : 'unknown'
        }, expected, controller.signal);
        completed++;
      }
      throw new Error('Đã đạt giới hạn 50 đơn/lượt, kiểm tra lại trước khi chạy tiếp.');
    } catch (cause) {
      blocked = true;
      error.textContent = cause.message || 'Lượt đánh giá thất bại.';
      error.hidden = false;
      status.textContent = `Đã dừng sau ${completed} đơn; kiểm tra trạng thái đơn đang xử lý trước khi tải lại.`;
    } finally {
      running = false;
      activeController = null;
      start.disabled = true;
      inspect.disabled = true;
    }
  }

  const panel = document.createElement('section');
  panel.id = 'shopee-auto-review-controls';
  panel.setAttribute('aria-label', 'Điều khiển đánh giá Shopee');
  Object.assign(panel.style, {position: 'fixed', bottom: '20px', right: '20px', zIndex: '2147483647',
    background: '#fff', color: '#222', padding: '14px', border: '2px solid #ee4d2d',
    borderRadius: '8px', width: '270px', boxShadow: '0 3px 12px #0003', font: '14px/1.4 system-ui'});
  const heading = document.createElement('strong');
  heading.textContent = 'Shopee Auto Review';
  const start = document.createElement('button');
  start.type = 'button';
  start.textContent = 'Bắt đầu tự đánh giá';
  start.style.margin = '8px 8px 8px 0';
  start.disabled = false; // Chỉ chạy khi người dùng bấm; mọi bài gửi đều cần preview ảnh/video và sao mặc định.
  const inspect = document.createElement('button');
  inspect.type = 'button';
  inspect.textContent = 'Thử nháp 1 đơn (không gửi)';
  inspect.style.margin = '8px 8px 8px 0';
  const stop = document.createElement('button');
  stop.type = 'button';
  stop.textContent = 'Dừng';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Sẵn sàng. Bắt đầu sẽ gửi từng đơn sau khi Shopee xác nhận đủ ảnh và video.';
  const error = document.createElement('p');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  error.style.color = '#a22020';
  panel.append(heading, document.createElement('br'), start, inspect, stop, status, error);
  document.body.append(panel);
  let running = false;
  let activeController = null;
  start.addEventListener('click', () => { if (!start.disabled && !running) run(); });
  inspect.addEventListener('click', () => { if (!inspect.disabled && !running) run(true); });
  stop.addEventListener('click', () => {
    if (!running) return;
    blocked = true;
    activeController?.abort(new Error('Đã dừng theo yêu cầu.'));
    start.disabled = true;
    status.textContent = 'Đã yêu cầu dừng; thao tác gửi đã thực hiện không thể thu hồi.';
  });
}
