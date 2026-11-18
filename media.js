// ponytail: trang đơn không chứa video người bán; hiện tạo clip từ ảnh đúng món, thêm đọc video gốc qua trang sản phẩm khi cần.
const MAX_SOURCE = 12 * 1024 * 1024;
const MAX_VIDEO = 4 * 1024 * 1024;

async function loadImage(raw, signal) {
  const url = validateMediaUrl(raw);
  const response = await fetch(url, {credentials: 'omit', redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)])});
  if (!response.ok || !/^image\/(jpeg|png|webp)$/i.test(response.headers.get('content-type')?.split(';')[0] || '')) {
    throw new Error('Ảnh sản phẩm không tải được hoặc sai định dạng.');
  }
  if (!response.body) throw new Error('Nguồn ảnh không có dữ liệu.');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_SOURCE) throw new Error('Ảnh sản phẩm quá lớn.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const blob = new Blob(chunks, {type: response.headers.get('content-type').split(';')[0]});
  if (!blob.size) throw new Error('Ảnh sản phẩm trống.');
  return blob;
}

async function makeVideo(imageBlob, signal) {
  if (document.hidden) throw new Error('Hãy để tab điều khiển hiển thị khi tạo video.');
  const mime = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4']
    .find(type => MediaRecorder.isTypeSupported(type));
  if (!mime) throw new Error('Edge không ghi được video MP4.');
  const url = URL.createObjectURL(imageBlob);
  const image = new Image();
  let stream, recorder, timer, stopTimer;
  try {
    image.src = url;
    await image.decode();
    signal.throwIfAborted();
    if (document.hidden) throw new Error('Tab Shopee bị ẩn trước khi ghi video.');
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Ảnh sản phẩm không giải mã được.');
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 480;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Không thể tạo canvas video.');
    const render = () => {
      if (document.hidden) return;
      context.fillStyle = '#f2f2f2';
      context.fillRect(0, 0, 480, 480);
      const scale = Math.min(480 / image.naturalWidth, 480 / image.naturalHeight);
      const w = Math.round(image.naturalWidth * scale), h = Math.round(image.naturalHeight * scale);
      context.drawImage(image, (480 - w) / 2, (480 - h) / 2, w, h);
    };
    render();
    stream = canvas.captureStream(8);
    const chunks = [];
    recorder = new MediaRecorder(stream, {mimeType: mime, videoBitsPerSecond: 400000});
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = () => reject(new Error('Không ghi được video MP4.'));
    });
    recorder.start();
    timer = setInterval(render, 125);
    await new Promise((resolve, reject) => {
      const onAbort = () => { clearTimeout(stopTimer); reject(signal.reason || new Error('Đã dừng.')); };
      stopTimer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, 8000);
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, {once: true});
    });
    clearInterval(timer);
    signal.throwIfAborted();
    if (document.hidden) throw new Error('Tab Shopee bị ẩn khi ghi video.');
    recorder.stop();
    await stopped;
    const blob = new Blob(chunks, {type: 'video/mp4'});
    if (!blob.size || blob.size > MAX_VIDEO) throw new Error('Video rỗng hoặc vượt quá 4 MiB.');
    const duration = await readDuration(blob);
    if (!Number.isFinite(duration) || Math.abs(duration - 8) > .5) {
      throw new Error('Video sai thời lượng; không gửi đánh giá.');
    }
    return {blob, duration};
  } finally {
    clearInterval(timer);
    clearTimeout(stopTimer);
    if (recorder?.state === 'recording') recorder.stop();
    stream?.getTracks().forEach(track => track.stop());
    URL.revokeObjectURL(url);
  }
}

function readDuration(blob) {
  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.src = url;
  return new Promise((resolve, reject) => {
    let finished = false;
    const timeout = setTimeout(() => finish(new Error('Không đọc được thời lượng video.')), 10000);
    function finish(error) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      const seconds = video.duration;
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      error ? reject(error) : resolve(seconds);
    }
    video.addEventListener('loadedmetadata', () => finish(), {once: true});
    video.addEventListener('error', () => finish(new Error('Video MP4 không phát được.')), {once: true});
    video.load();
  });
}

globalThis.shopeeReviewMedia = {loadImage, makeVideo};
if (typeof module !== 'undefined') module.exports = globalThis.shopeeReviewMedia;
