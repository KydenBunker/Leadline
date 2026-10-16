
/* Leadline V5.1 — original on-device UI sound and micro-interactions.
   No audio downloads, no external network calls, no audio recordings.
   This module does not modify Leadline's data or cloud settings. */
(() => {
  'use strict';
  const PREF_KEY = 'leadline-v5.1-ui-feedback';
  const defaults = { enabled: true, volume: 38, style: 'bubble' };
  const styles = new Set(['bubble', 'soft', 'crisp']);
  const limit = n => Math.min(100, Math.max(0, Number(n) || 0));
  let settings = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    if (typeof saved.enabled === 'boolean') settings.enabled = saved.enabled;
    if (Number.isFinite(Number(saved.volume))) settings.volume = limit(saved.volume);
    if (styles.has(saved.style)) settings.style = saved.style;
  } catch { /* Private mode may prevent saving; controls still work. */ }
  const $ = id => document.getElementById(id);
  let context = null;
  let lastSliderAt = 0;
  let lastSliderBucket = null;
  let lastKeyAt = 0;
  const persist = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(settings)); } catch { /* no storage */ } };
  const originalPop = (kind = 'tap', force = false) => {
    if ((!settings.enabled && !force) || settings.volume <= 0) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      context ||= new AudioContextClass();
      if (context.state === 'suspended') void context.resume().catch(() => {});
      const now = context.currentTime;
      const master = context.createGain();
      // Log-like volume taper: even 100% remains quiet relative to media playback.
      master.gain.value = (settings.volume / 100) * .25;
      master.connect(context.destination);
      const isBubble = settings.style === 'bubble';
      const isCrisp = settings.style === 'crisp';
      const isConfirm = kind === 'confirm';
      const isAdjust = kind === 'adjust';
      const duration = isCrisp ? .045 : settings.style === 'soft' ? .09 : .105;
      const peak = isConfirm ? 1.12 : isAdjust ? .70 : 1;
      const base = isCrisp ? 750 : isBubble ? 480 : 360;
      const startHz = base * (isConfirm ? 1.22 : isAdjust ? .90 : 1);
      // Two tiny decaying tones make a natural-feeling 'bloop', not sampled game audio.
      [0, 1].forEach((layer) => {
        const osc = context.createOscillator();
        const env = context.createGain();
        osc.type = layer === 0 ? 'sine' : (isCrisp ? 'triangle' : 'sine');
        const start = startHz * (layer ? 1.59 : 1);
        const end = isBubble ? start * .65 : isCrisp ? start * .86 : start * .77;
        osc.frequency.setValueAtTime(start, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(70, end), now + duration * .82);
        env.gain.setValueAtTime(.0001, now);
        env.gain.exponentialRampToValueAtTime((layer ? .18 : .62) * peak, now + .006);
        env.gain.exponentialRampToValueAtTime(.0001, now + duration);
        osc.connect(env); env.connect(master);
        osc.start(now); osc.stop(now + duration + .005);
      });
      // Let the tail play, then disconnect. Short overlapping button taps are harmless.
      window.setTimeout(() => { try { master.disconnect(); } catch {} }, 240);
    } catch { /* Unsupported audio must never block the user's tap. */ }
  };

  function bounce(el) {
    if (!el || el.disabled || el.closest('[hidden],.hidden')) return;
    el.classList.remove('ui-pop');
    // Restart small animation even when buttons are pressed repeatedly.
    void el.offsetWidth;
    el.classList.add('ui-pop');
    window.setTimeout(() => el.classList.remove('ui-pop'), 240);
  }
  function press(el) {
    bounce(el);
    const kind = el.matches('.btn-dark,.btn-light,[type="submit"],#timer-start,#timer-stop') ? 'confirm' : 'tap';
    originalPop(kind);
  }
  const BUTTON = 'button:not(:disabled), a.btn, summary, [role="button"], [data-v5-chart-day], [data-trend-day], [data-sales-point], .v5-heat-cell';
  // Pointerdown sounds more responsive than waiting for click navigation/dialog actions.
  document.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !e.isPrimary) return;
    if (e.target.closest('input,select,textarea')) return;
    const target = e.target.closest(BUTTON);
    if (!target || target.hasAttribute('data-no-ui-sound')) return;
    press(target);
  }, { passive: true, capture: true });
  // Keyboard and assistive-technology clicks deserve the same sound and motion.
  document.addEventListener('click', e => {
    if (e.detail !== 0) return;
    const target = e.target.closest(BUTTON);
    if (!target || target.hasAttribute('data-no-ui-sound')) return;
    const n = performance.now();
    if (n - lastKeyAt < 55) return;
    lastKeyAt = n; press(target);
  }, true);
  document.addEventListener('change', e => {
    const t = e.target;
    if (!t) return;
    if (t.id === 'ui-sound-on') {
      settings.enabled = !!t.checked;
      updateUI(); persist();
      if (settings.enabled) originalPop('confirm');
      return;
    }
    if (t.id === 'ui-sound-style') {
      settings.style = styles.has(t.value) ? t.value : 'bubble';
      persist(); originalPop('confirm');
      return;
    }
    if (t.matches('select,input[type="checkbox"],input[type="radio"],input[type="date"],input[type="time"]')) originalPop('adjust');
  }, true);
  document.addEventListener('input', e => {
    const t = e.target;
    if (!t.matches?.('input[type="range"]')) return;
    if (t.id === 'ui-sound-volume') {
      settings.volume = limit(t.value);
      $('ui-sound-volume-label').textContent = Math.round(settings.volume) + '%';
      t.style.setProperty('--volume-progress', settings.volume + '%');
      persist();
    }
    const now = performance.now();
    const bucket = Math.floor(Number(t.value) / Math.max(1, (Number(t.max || 100) - Number(t.min || 0)) / 14));
    if (now - lastSliderAt > 85 && bucket !== lastSliderBucket) {
      originalPop('adjust'); lastSliderAt = now; lastSliderBucket = bucket;
    }
  }, { passive: true });
  document.addEventListener('pointerup', e => {
    if (e.target.matches?.('input[type="range"]')) lastSliderBucket = null;
  }, { passive: true });
  document.addEventListener('keydown', e => {
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target.matches?.('input[type="range"]')) {
      const now = performance.now();
      if (now - lastSliderAt > 75) { originalPop('adjust'); lastSliderAt = now; }
    }
  });
  const updateUI = () => {
    $('ui-sound-on').checked = settings.enabled;
    $('ui-sound-style').value = settings.style;
    $('ui-sound-volume').value = String(settings.volume);
    $('ui-sound-volume').style.setProperty('--volume-progress', settings.volume + '%');
    $('ui-sound-volume-label').textContent = Math.round(settings.volume) + '%';
    $('ui-sound-options').classList.toggle('ui-sound-muted', !settings.enabled);
    $('ui-sound-test').disabled = !settings.enabled;
    $('ui-sound-on').setAttribute('aria-checked', settings.enabled ? 'true' : 'false');
  };
  const audioStatus=$('v54-sound-status');
  const unlockButton=$('ui-sound-unlock');
  const AudioCtor=window.AudioContext||window.webkitAudioContext;
  async function enablePhoneAudio(){
    if(!AudioCtor){if(audioStatus)audioStatus.textContent='This browser does not support Web Audio.';return false;}
    try{
      context ||= new AudioCtor();
      if(context.state==='suspended')await context.resume();
      const success=context.state==='running';
      if(audioStatus)audioStatus.textContent=success?'Audio ready. Tap any button to hear the effect. Check media volume if quiet.':'Audio paused by your browser. Tap Enable phone audio again.';
      if(unlockButton)unlockButton.textContent=success?'Audio ready ✓':'Enable phone audio';
      return success;
    }catch{if(audioStatus)audioStatus.textContent='Your browser blocked audio. Try opening the installed app and tap Enable phone audio.';return false;}
  }
  if(unlockButton)unlockButton.addEventListener('click',async()=>{if(await enablePhoneAudio())originalPop('confirm',true);});
  $('ui-sound-test').addEventListener('click', async() => { bounce($('ui-sound-test'));if(await enablePhoneAudio())originalPop('confirm',true); });
  updateUI();
})();

