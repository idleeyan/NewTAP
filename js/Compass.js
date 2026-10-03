
export class CompassClock {
  constructor() {
    this._intervalId = null;
    this._cachedElements = null;
    this._lastH = -1;
    this._lastM = -1;
    this._lastS = -1;
    this._dotElements = new Map();
    this._numElements = new Map();
    this.init();
  }

  init() {
    this.startClockLoop();
  }

  _getElements() {
    if (this._cachedElements) return this._cachedElements;

    this._cachedElements = {
      hoursRing: document.getElementById('compassHoursBtn'),
      minutesRing: document.getElementById('compassMinutesBtn'),
      secondsRing: document.getElementById('compassSecondsBtn'),
      dateEl: document.getElementById('compassDateBtn'),
      weekdayEl: document.getElementById('compassWeekdayBtn')
    };
    return this._cachedElements;
  }

  initCompassInButton(containerId) {
    const { hoursRing, minutesRing, secondsRing } = this._getElements();

    if (!hoursRing || !minutesRing || !secondsRing) {
      return false;
    }

    this.createGlowRing(hoursRing, 24, 42, 'hours');
    this.createGlowRing(minutesRing, 60, 38, 'minutes');
    this.createGlowRing(secondsRing, 60, 30, 'seconds');

    this.updateClockUI();
    return true;
  }

  createGlowRing(container, count, radiusPercent, type) {
    container.innerHTML = '';
    container.dataset.type = type;
    container.dataset.count = count;

    const glowTrack = document.createElement('div');
    glowTrack.className = 'compass-glow-track';
    container.appendChild(glowTrack);

    const dotEls = [];
    const numEls = [];

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 360 - 90;
      const rad = (angle * Math.PI) / 180;
      const x = 50 + radiusPercent * Math.cos(rad);
      const y = 50 + radiusPercent * Math.sin(rad);

      const dot = document.createElement('div');
      dot.className = 'compass-glow-dot';
      dot.dataset.value = i;
      dot.style.cssText = `
        position: absolute;
        left: ${x}%;
        top: ${y}%;
        transform: translate(-50%, -50%);
      `;
      dotEls.push(dot);
      fragment.appendChild(dot);

      const num = document.createElement('div');
      num.className = 'compass-number glow-number';
      num.dataset.value = i;
      num.textContent = i.toString().padStart(2, '0');
      num.style.cssText = `
        position: absolute;
        left: ${x}%;
        top: ${y}%;
        transform: translate(-50%, -50%);
        opacity: 0;
        transition: opacity 0.3s ease;
      `;
      numEls.push(num);
      fragment.appendChild(num);
    }

    container.appendChild(fragment);
    this._dotElements.set(type, dotEls);
    this._numElements.set(type, numEls);
  }

  startClockLoop() {
    this.stopClockLoop();
    this.updateClockUI();
    this._intervalId = setInterval(() => this.updateClockUI(), 1000);
  }

  stopClockLoop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  updateClockUI() {
    const els = this._getElements();
    if (!els.hoursRing) return;

    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();

    if (els.dateEl) els.dateEl.textContent = `${now.getMonth() + 1}/${now.getDate()}`;
    if (els.weekdayEl) {
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      els.weekdayEl.textContent = weekdays[now.getDay()];
    }

    requestAnimationFrame(() => {
      if (h !== this._lastH) {
        const hoursRotation = -h * 15;
        els.hoursRing.style.transform = `translate(-50%, -50%) rotate(${hoursRotation}deg)`;
        this.updateGlowRing('hours', h, hoursRotation, 24);
        this._lastH = h;
      }

      if (m !== this._lastM) {
        const minutesRotation = -m * 6;
        els.minutesRing.style.transform = `translate(-50%, -50%) rotate(${minutesRotation}deg)`;
        this.updateGlowRing('minutes', m, minutesRotation, 60);
        this._lastM = m;
      }

      if (s !== this._lastS) {
        const secondsRotation = -s * 6;
        els.secondsRing.style.transform = `translate(-50%, -50%) rotate(${secondsRotation}deg)`;
        this.updateGlowRing('seconds', s, secondsRotation, 60);
        this._lastS = s;
      }
    });
  }

  updateGlowRing(type, current, rotation, total) {
    const dots = this._dotElements.get(type);
    const numbers = this._numElements.get(type);
    if (!dots || !numbers) return;

    const halfTotal = total / 2;

    for (let i = 0; i < total; i++) {
      const dot = dots[i];
      const val = i;
      let diff = val - current;
      if (diff < -halfTotal) diff += total;
      if (diff > halfTotal) diff -= total;
      const absDiff = Math.abs(diff);

      let dotClass = 'compass-glow-dot';
      if (val === current) {
        dotClass += ' active';
      } else if (absDiff <= 3 && absDiff > 0) {
        dotClass += ' nearby';
      }
      if (dot.className !== dotClass) {
        dot.className = dotClass;
      }

      const num = numbers[i];
      let numClass = 'compass-number glow-number';
      if (val === current) {
        numClass += ' active';
        num.style.opacity = '1';
      } else if (absDiff <= 2 && absDiff > 0) {
        numClass += ' nearby';
        num.style.opacity = '0.6';
      } else {
        num.style.opacity = '0';
      }
      if (num.className !== numClass) {
        num.className = numClass;
      }

      num.style.transform = `translate(-50%, -50%) rotate(${-rotation}deg)`;
    }
  }
}
