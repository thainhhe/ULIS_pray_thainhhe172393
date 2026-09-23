'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const incenseView = document.getElementById('incense-view');
  const fortuneView = document.getElementById('fortune-view');
  const merit = document.getElementById('merit-section');
  const incenseTab = document.getElementById('show-incense');
  const fortuneTab = document.getElementById('show-fortune');
  const stage = document.getElementById('fortune-stage');
  const sticks = document.getElementById('fortune-sticks');
  const result = document.getElementById('fortune-result');
  const draw = document.getElementById('btn-fortune');
  const status = document.getElementById('fortune-status');
  const kit = document.getElementById('fortune-kit');
  const motion = document.getElementById('fortune-motion');
  const reducedMotion = { get matches() { return !motion.checked; } };
  motion.addEventListener('change', () => {
    fortuneView.classList.toggle('without-motion', !motion.checked);
  });
  const fortunes = [
    { topic: 'Gia đình', message: 'Nhà luôn ấm, lòng luôn yên, yêu thương thêm gắn kết.' },
    { topic: 'Sự nghiệp', message: 'Bền lòng với điều mình chọn, cơ hội mới sẽ nở hoa.' },
    { topic: 'Tình duyên', message: 'Chân thành mở lối, yêu thương đến đúng lúc.' },
    { topic: 'Sức khoẻ', message: 'Thân tâm an lành, mỗi ngày thêm một niềm vui.' },
    { topic: 'Học tập', message: 'Chăm học từng ngày, tri thức nở hoa, ước mơ rộng mở.' },
  ];
  let busy = false;
  let timer;
  let selectedStick;
  let flyingStick;
  let shakeAnimation;

  for (let i = 0; i < 17; i++) {
    const stick = document.createElement('img');
    stick.src = 'assets/fortune-stick.svg';
    stick.alt = '';
    stick.draggable = false;
    stick.className = 'fortune-stick';
    stick.style.setProperty('--x', `${48 + i * 8}px`);
    stick.style.setProperty('--lean', `${(i - 8) * 1.4}deg`);
    stick.style.setProperty('--lift', `${(i * 17) % 43}px`);
    stick.style.setProperty('--delay', `${-i * 0.047}s`);
    sticks.appendChild(stick);
  }

  function resetDraw() {
    clearTimeout(timer);
    shakeAnimation?.cancel();
    shakeAnimation = null;
    busy = false;
    draw.disabled = false;
    motion.disabled = false;
    stage.classList.remove('is-shaking', 'is-extracting', 'is-presenting', 'is-opening');
    if (selectedStick) selectedStick.classList.remove('is-chosen', 'is-departed');
    flyingStick?.remove();
    flyingStick = null;
  }

  function switchView(showFortune) {
    if (!showFortune && busy) {
      resetDraw();
      result.hidden = true;
      stage.classList.remove('has-result');
      draw.textContent = 'Gieo quẻ';
      status.textContent = 'Nghĩ về điều bạn mong ước, rồi gieo một quẻ nhé.';
    }
    incenseView.hidden = showFortune;
    document.body.classList.toggle('showing-fortune', showFortune);
    merit.hidden = showFortune;
    fortuneView.hidden = !showFortune;
    incenseTab.setAttribute('aria-pressed', String(!showFortune));
    fortuneTab.setAttribute('aria-pressed', String(showFortune));
    incenseTab.classList.toggle('is-active', !showFortune);
    fortuneTab.classList.toggle('is-active', showFortune);
    // Recalculate the original incense position after its container is visible.
    if (!showFortune) window.dispatchEvent(new Event('resize'));
  }
  incenseTab.addEventListener('click', () => switchView(false));
  fortuneTab.addEventListener('click', () => switchView(true));

  draw.addEventListener('click', () => {
    if (busy) return;
    resetDraw();
    busy = true;
    draw.disabled = true;
    motion.disabled = true;
    draw.textContent = 'Đang gieo quẻ…';
    result.hidden = true;
    stage.classList.remove('has-result');
    status.textContent = 'Ống quẻ đang lắc, lộc xuân đang đến…';
    const index = Math.floor(Math.random() * fortunes.length);
    const fortune = fortunes[index];
    selectedStick = sticks.children[6 + Math.floor(Math.random() * 5)];
    stage.classList.add('is-shaking');

    function extractStick() {
      stage.classList.remove('is-shaking');
      stage.classList.add('is-extracting');
      selectedStick.classList.add('is-chosen');
      draw.textContent = 'Đang rút quẻ…';
      status.textContent = 'Một quẻ đang trồi lên từ trong ống…';
      timer = setTimeout(() => {
        // Continue from the exact on-screen position of the stick just extracted.
        const origin = selectedStick.getBoundingClientRect();
        const bounds = stage.getBoundingClientRect();
        flyingStick = document.createElement('div');
        flyingStick.className = 'fortune-flying-stick';
        flyingStick.setAttribute('aria-hidden', 'true');
        flyingStick.style.left = `${origin.left - bounds.left}px`;
        flyingStick.style.top = `${origin.top - bounds.top}px`;
        flyingStick.style.width = `${origin.width}px`;
        flyingStick.style.height = `${origin.height}px`;
        flyingStick.style.setProperty('--flight-x', `${bounds.width / 2 - origin.width / 2 - (origin.left - bounds.left)}px`);
        flyingStick.style.setProperty('--flight-y', `${55 - (origin.top - bounds.top)}px`);
        stage.appendChild(flyingStick);
        selectedStick.classList.add('is-departed');
        stage.classList.add('is-presenting');
        status.textContent = 'Quẻ đã rời ống, đang mở lời chúc dành cho bạn…';
        timer = setTimeout(() => {
          document.getElementById('fortune-number').textContent = `QUẺ SỐ 0${index + 1}`;
          document.getElementById('fortune-topic').textContent = fortune.topic;
          document.getElementById('fortune-message').textContent = fortune.message;
          result.hidden = false;
          stage.classList.add('has-result', 'is-opening');
          timer = setTimeout(() => {
            flyingStick?.remove();
            flyingStick = null;
            busy = false;
            draw.disabled = false;
            motion.disabled = false;
            draw.textContent = 'Gieo quẻ lần nữa';
            status.textContent = `Quẻ ${fortune.topic}: ${fortune.message}`;
          }, reducedMotion.matches ? 0 : 700);
        }, reducedMotion.matches ? 0 : 1100);
      }, reducedMotion.matches ? 0 : 1600);
    }

    if (reducedMotion.matches) {
      timer = setTimeout(extractStick, 100);
      return;
    }

    // Animate the whole container directly; extraction waits for the last sway.
    // Keep the same scale throughout the shake, including on narrow screens.
    const scale = window.innerWidth <= 420 ? .82 : .94;
    const pose = (x, tilt, depth, y = 0) =>
      `translate3d(${x}px, ${y}px, 0) rotateZ(${tilt}deg) rotateY(${depth}deg) rotateX(-8deg) scale(${scale})`;
    const animation = kit.animate([
      { transform: pose(0, 0, 0), offset: 0 },
      { transform: pose(-22, -18, -16, -7), offset: .25 },
      { transform: pose(0, 0, 0, -12), offset: .5 },
      { transform: pose(22, 18, 16, -7), offset: .75 },
      { transform: pose(0, 0, 0), offset: 1 },
    ], { duration: 520, iterations: 6, easing: 'ease-in-out' });
    shakeAnimation = animation;
    animation.finished.then(() => {
      if (shakeAnimation !== animation) return;
      shakeAnimation = null;
      extractStick();
    }).catch(() => { /* Switching screens cancels the current draw. */ });
  });
});
