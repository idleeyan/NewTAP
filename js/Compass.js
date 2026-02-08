
export class CompassClock {
  constructor() {
    this.init();
  }

  init() {
    // Initialize compass in add button
    // We need to wait for the DOM or at least the button to exist
    // But since the button is dynamically created by UIManager, we might need a method to init specific element
    this.startClockLoop();
  }

  initCompassInButton(containerId) {
    const hoursRing = document.getElementById('compassHoursBtn');
    const minutesRing = document.getElementById('compassMinutesBtn');
    const secondsRing = document.getElementById('compassSecondsBtn');
    const dateEl = document.getElementById('compassDateBtn');
    const weekdayEl = document.getElementById('compassWeekdayBtn');

    if (!hoursRing || !minutesRing || !secondsRing) {
      return false;
    }

    // Initialize - using percentage radius
    this.createGlowRing(hoursRing, 24, 42, 'hours');   // 42% radius
    this.createGlowRing(minutesRing, 60, 38, 'minutes'); // 38% radius
    this.createGlowRing(secondsRing, 60, 30, 'seconds'); // 30% radius

    this.updateClockUI();
    return true;
  }

  createGlowRing(container, count, radiusPercent, type) {
    container.innerHTML = '';
    container.dataset.type = type;
    container.dataset.count = count;

    // Create glow track
    const glowTrack = document.createElement('div');
    glowTrack.className = 'compass-glow-track';
    container.appendChild(glowTrack);

    // Create dots and numbers
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 360 - 90;
      const rad = (angle * Math.PI) / 180;
      // Use percentage for position
      const x = 50 + radiusPercent * Math.cos(rad);
      const y = 50 + radiusPercent * Math.sin(rad);

      // Dot
      const dot = document.createElement('div');
      dot.className = 'compass-glow-dot';
      dot.dataset.value = i;
      dot.style.cssText = `
        position: absolute;
        left: ${x}%;
        top: ${y}%;
        transform: translate(-50%, -50%);
      `;
      container.appendChild(dot);

      // Number
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
      container.appendChild(num);
    }
  }

  startClockLoop() {
    this.updateClockUI();
    setInterval(() => this.updateClockUI(), 1000);
  }

  updateClockUI() {
    const hoursRing = document.getElementById('compassHoursBtn');
    const minutesRing = document.getElementById('compassMinutesBtn');
    const secondsRing = document.getElementById('compassSecondsBtn');
    const dateEl = document.getElementById('compassDateBtn');
    const weekdayEl = document.getElementById('compassWeekdayBtn');

    if (!hoursRing) return;

    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();

    // Update date
    if (dateEl) dateEl.textContent = `${now.getMonth() + 1}/${now.getDate()}`;
    if (weekdayEl) {
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      weekdayEl.textContent = weekdays[now.getDay()];
    }

    // Rotate rings
    const hoursRotation = -h * 15;
    const minutesRotation = -m * 6;
    const secondsRotation = -s * 6;

    hoursRing.style.transform = `translate(-50%, -50%) rotate(${hoursRotation}deg)`;
    minutesRing.style.transform = `translate(-50%, -50%) rotate(${minutesRotation}deg)`;
    secondsRing.style.transform = `translate(-50%, -50%) rotate(${secondsRotation}deg)`;

    this.updateGlowRing(hoursRing, h, hoursRotation, 24);
    this.updateGlowRing(minutesRing, m, minutesRotation, 60);
    this.updateGlowRing(secondsRing, s, secondsRotation, 60);
  }

  updateGlowRing(container, current, rotation, total) {
    const dots = container.querySelectorAll('.compass-glow-dot');
    const numbers = container.querySelectorAll('.glow-number');
    const halfTotal = total / 2;

    dots.forEach((dot) => {
      dot.classList.remove('active', 'nearby');
      const val = parseInt(dot.dataset.value);

      if (val === current) {
        dot.classList.add('active');
      } else {
        let diff = val - current;
        if (diff < -halfTotal) diff += total;
        if (diff > halfTotal) diff -= total;
        if (Math.abs(diff) <= 3 && Math.abs(diff) > 0) {
          dot.classList.add('nearby');
        }
      }
    });

    numbers.forEach((num) => {
      const val = parseInt(num.dataset.value);
      num.classList.remove('active', 'nearby');

      if (val === current) {
        num.classList.add('active');
        num.style.opacity = '1';
      } else {
        let diff = val - current;
        if (diff < -halfTotal) diff += total;
        if (diff > halfTotal) diff -= total;
        if (Math.abs(diff) <= 2 && Math.abs(diff) > 0) {
          num.classList.add('nearby');
          num.style.opacity = '0.6';
        } else {
          num.style.opacity = '0';
        }
      }

      // Keep numbers upright
      num.style.transform = `translate(-50%, -50%) rotate(${-rotation}deg)`;
    });
  }
}
