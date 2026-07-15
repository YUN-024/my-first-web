const canvas = document.getElementById('avatar-canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const P = 8; // pixel unit size for blocky pixel-art look

const controls = {
  hairStyle: document.getElementById('hair-style'),
  hairColor: document.getElementById('hair-color'),
  skinColor: document.getElementById('skin-color'),
  eyeStyle: document.getElementById('eye-style'),
  topStyle: document.getElementById('top-style'),
  topColor: document.getElementById('top-color'),
  bottomStyle: document.getElementById('bottom-style'),
  bottomColor: document.getElementById('bottom-color'),
  shoeColor: document.getElementById('shoe-color'),
  hatStyle: document.getElementById('hat-style'),
};

function px(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawAvatar() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;

  // ---- proportions: 3-heads-tall (head : body = 1 : 2) ----
  const headH = 96, headW = 88;
  const headTop = 16;
  const headLeft = cx - headW / 2;

  const torsoTop = headTop + headH - 8;
  const torsoH = 96;
  const torsoW = 72;
  const torsoLeft = cx - torsoW / 2;

  const legTop = torsoTop + torsoH - 6;
  const legH = 72;
  const legW = 24;
  const gap = 8;

  const footTop = legTop + legH - 4;
  const footH = 16;

  const skin = controls.skinColor.value;
  const hair = controls.hairColor.value;
  const top = controls.topColor.value;
  const bottom = controls.bottomColor.value;
  const shoe = controls.shoeColor.value;

  // ---- legs ----
  px(cx - gap / 2 - legW, legTop, legW, legH, bottom);
  px(cx + gap / 2, legTop, legW, legH, bottom);
  if (controls.bottomStyle.value === 'shorts') {
    // shorten pant length, show skin below
    px(cx - gap / 2 - legW, legTop + legH * 0.4, legW, legH * 0.6, skin);
    px(cx + gap / 2, legTop + legH * 0.4, legW, legH * 0.6, skin);
    px(cx - gap / 2 - legW, legTop, legW, legH * 0.4, bottom);
    px(cx + gap / 2, legTop, legW, legH * 0.4, bottom);
  } else if (controls.bottomStyle.value === 'skirt') {
    px(torsoLeft, legTop - 10, torsoW, 30, bottom); // skirt flare
    px(cx - gap / 2 - legW, legTop + 20, legW, legH - 20, skin);
    px(cx + gap / 2, legTop + 20, legW, legH - 20, skin);
  }

  // ---- feet/shoes ----
  px(cx - gap / 2 - legW, footTop, legW, footH, shoe);
  px(cx + gap / 2, footTop, legW, footH, shoe);

  // ---- torso ----
  px(torsoLeft, torsoTop, torsoW, torsoH, top);
  // arms
  px(torsoLeft - 16, torsoTop + 8,16, torsoH * 0.7, skin);
  px(torsoLeft + torsoW, torsoTop + 8,16, torsoH * 0.7, skin);
  if (controls.topStyle.value === 'hoodie') {
    px(torsoLeft - 4, torsoTop, torsoW + 8, 14, shadeColor(top, -20));
  } else if (controls.topStyle.value === 'jacket') {
    px(cx - 4, torsoTop, 8, torsoH, shadeColor(top, -30));
  }

  // ---- head ----
  px(headLeft, headTop, headW, headH, skin);

  // ears
  px(headLeft - 6, headTop + headH * 0.4, 6, 16, skin);
  px(headLeft + headW, headTop + headH * 0.4, 6, 16, skin);

  // eyes
  const eyeY = headTop + headH * 0.55;
  if (controls.eyeStyle.value === 'dot') {
    px(headLeft + headW * 0.28, eyeY, 8, 8, '#1b1b24');
    px(headLeft + headW * 0.64, eyeY, 8, 8, '#1b1b24');
  } else if (controls.eyeStyle.value === 'line') {
    px(headLeft + headW * 0.25, eyeY + 4, 12, 3, '#1b1b24');
    px(headLeft + headW * 0.62, eyeY + 4, 12, 3, '#1b1b24');
  } else if (controls.eyeStyle.value === 'star') {
    px(headLeft + headW * 0.28, eyeY, 8, 8, '#ffd23f');
    px(headLeft + headW * 0.64, eyeY, 8, 8, '#ffd23f');
    px(headLeft + headW * 0.30, eyeY - 4, 4, 4, '#ffd23f');
    px(headLeft + headW * 0.66, eyeY - 4, 4, 4, '#ffd23f');
  }
  // mouth
  px(headLeft + headW * 0.4, headTop + headH * 0.75, headW * 0.2, 4, '#1b1b24');

  // hair
  if (controls.hairStyle.value === 'short') {
    px(headLeft - 2, headTop - 10, headW + 4, 20, hair);
  } else if (controls.hairStyle.value === 'long') {
    px(headLeft - 2, headTop - 10, headW + 4, 20, hair);
    px(headLeft - 10, headTop + 6, 12, headH * 0.6, hair);
    px(headLeft + headW - 2, headTop + 6, 12, headH * 0.6, hair);
  } else if (controls.hairStyle.value === 'spiky') {
    for (let i = 0; i < 5; i++) {
      px(headLeft + i * (headW / 5), headTop - 16, headW / 5 - 4, 20, hair);
    }
  }
  // bald -> no hair drawn

  // hat/accessory
  if (controls.hatStyle.value === 'cap') {
    px(headLeft - 6, headTop - 18, headW + 12, 16, '#ff5da2');
    px(headLeft + headW * 0.6, headTop - 4, headW * 0.5, 8, '#ff5da2');
  } else if (controls.hatStyle.value === 'ribbon') {
    px(headLeft + headW * 0.5 - 10, headTop - 14, 20, 14, '#ff5da2');
  }
}

Object.values(controls).forEach(el => el.addEventListener('input', drawAvatar));

function shadeColor(hex, amt) {
  const num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0x00FF) + amt;
  let b = (num & 0x0000FF) + amt;
  r = Math.max(Math.min(255, r), 0);
  g = Math.max(Math.min(255, g), 0);
  b = Math.max(Math.min(255, b), 0);
  return '#' + (g | (r << 8) | (b << 16)).toString(16).padStart(6, '0');
}

document.getElementById('download-avatar').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'my-pixel-avatar.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

drawAvatar();
