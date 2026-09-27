(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const slides = [...document.querySelectorAll('.slide')];
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0, notesOpen = false, demoOpen = false, timers = [], touchStart = null;

  // Each word enters separately while retaining the original spaces and emphasis.
  slides.forEach(slide => {
    let order = 0;
    slide.querySelectorAll('.reveal-words').forEach(element => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(node => {
        const fragment = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) fragment.append(document.createTextNode(part));
          else {
            const span = document.createElement('span'); span.className = 'word';
            span.style.setProperty('--delay', Math.min(order++ * 28, 1050) + 'ms');
            span.textContent = part; fragment.append(span);
          }
        });
        node.replaceWith(fragment);
      });
    });
  });

  function pauseAnimations() {
    document.body.classList.toggle('paused', notesOpen || document.hidden);
  }
  function goTo(target, updateHash = true) {
    index = Math.max(0, Math.min(slides.length - 1, target));
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('active', active);
      slide.inert = !active;
      if (active) { slide.removeAttribute('aria-hidden'); slide.scrollTop = 0; }
      else slide.setAttribute('aria-hidden', 'true');
    });
    $('prevSlide').disabled = index === 0;
    $('nextSlide').disabled = index === slides.length - 1;
    $('slideStatus').textContent = slides[index].getAttribute('aria-label');
    if (updateHash) {
      try { history.replaceState(null, '', '#slide-' + (index + 1)); } catch (_) { /* local-file browsers may restrict history */ }
    }
  }
  function hashSlide() {
    const match = location.hash.match(/^#slide-(\d+)$/);
    return match ? Number(match[1]) - 1 : 0;
  }
  $('prevSlide').addEventListener('click', () => goTo(index - 1));
  $('nextSlide').addEventListener('click', () => goTo(index + 1));
  window.addEventListener('hashchange', () => goTo(hashSlide(), false));
  document.addEventListener('visibilitychange', pauseAnimations);
  $('deck').addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') touchStart = {x:event.clientX,y:event.clientY};
  });
  $('deck').addEventListener('pointerup', event => {
    if (!touchStart) return;
    const dx = event.clientX - touchStart.x, dy = event.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 80 && Math.abs(dy) < 50) goTo(index + (dx < 0 ? 1 : -1));
  });
  $('deck').addEventListener('pointercancel', () => { touchStart = null; });

  function openNotes() {
    notesOpen = true; $('lessonMode').hidden = true; $('notesMode').hidden = false;
    pauseAnimations(); $('notesTitle').focus();
  }
  function closeNotes() {
    stopDemo(); demoOpen = false; $('demoModal').hidden = true; $('notesMode').inert = false;
    notesOpen = false; $('notesMode').hidden = true; $('lessonMode').hidden = false;
    pauseAnimations(); $('openNotes').focus();
  }
  $('openNotes').addEventListener('click', openNotes);
  $('closeNotes').addEventListener('click', closeNotes);

  const qrStorageKey = 'revolution-worksheet-link-v1';
  let qrValid = true;
  function rememberLink(value) {
    try {
      if (value) localStorage.setItem(qrStorageKey, value);
      else localStorage.removeItem(qrStorageKey);
    } catch (_) { /* The worksheet also works when browser storage is unavailable. */ }
  }
  function updateQr(save = true) {
    const raw = $('worksheetUrl').value.trim();
    const slots = [...document.querySelectorAll('.worksheet-qr')];
    slots.forEach(slot => slot.replaceChildren());
    $('clearQr').hidden = !raw;
    $('worksheetUrl').removeAttribute('aria-invalid');
    $('qrStatus').classList.remove('is-error');
    qrValid = true;
    if (!raw) {
      $('qrStatus').textContent = 'Без ссылки лист печатается без QR-кода.';
      if (save) rememberLink('');
      return;
    }
    try {
      const hasProtocol = /^[a-z][a-z0-9+.-]*:/i.test(raw);
      if (!hasProtocol && !raw.split('/')[0].includes('.')) throw new Error('url');
      const url = new URL(hasProtocol ? raw : 'https://' + raw);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('url');
      if (url.href.length > 450) throw new Error('length');
      const qr = qrcode(0, 'M');
      qr.addData(url.href, 'Byte'); qr.make();
      const count = qr.getModuleCount();
      // At 27 mm including a four-module quiet zone, modules remain at least .35 mm.
      if (count > 69) throw new Error('length');
      let path = '';
      for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
          if (qr.isDark(row, col)) path += `M${col + 4} ${row + 4}h1v1h-1z`;
        }
      }
      const ns = 'http://www.w3.org/2000/svg';
      slots.forEach(slot => {
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', `0 0 ${count + 8} ${count + 8}`);
        svg.setAttribute('width', '27'); svg.setAttribute('height', '27');
        svg.setAttribute('aria-label', 'QR-код: материалы урока');
        svg.setAttribute('role', 'img'); svg.setAttribute('shape-rendering', 'crispEdges');
        const white = document.createElementNS(ns, 'rect');
        white.setAttribute('width', String(count + 8)); white.setAttribute('height', String(count + 8)); white.setAttribute('fill', '#fff');
        const modules = document.createElementNS(ns, 'path');
        modules.setAttribute('d', path); modules.setAttribute('fill', '#000');
        svg.append(white, modules); slot.append(svg);
      });
      $('qrStatus').textContent = 'QR-код добавлен на обе копии.';
      if (save) rememberLink(url.href);
    } catch (error) {
      qrValid = false;
      if (save) rememberLink('');
      $('worksheetUrl').setAttribute('aria-invalid', 'true');
      $('qrStatus').classList.add('is-error');
      $('qrStatus').textContent = error.message === 'length'
        ? 'Ссылка слишком длинная для печати. Используйте короткую ссылку на материал.'
        : 'Вставьте ссылку на материал, например https://адрес-сайта.рф/урок';
    }
  }
  try { $('worksheetUrl').value = localStorage.getItem(qrStorageKey) || ''; } catch (_) { /* optional persistence */ }
  $('worksheetUrl').addEventListener('input', () => updateQr());
  $('clearQr').addEventListener('click', () => { $('worksheetUrl').value = ''; updateQr(); $('worksheetUrl').focus(); });

  function updateWorksheet() {
    const definitions = $('definitions').checked, examples = $('examples').checked, answers = $('answers').checked;
    document.querySelectorAll('#worksheetHost [data-field]').forEach(field => {
      const category = field.dataset.category;
      const show = answers || (category === 'definition' && definitions) || (category === 'example' && examples);
      field.setAttribute('visibility', show ? 'visible' : 'hidden');
    });
    $('answerBadge').hidden = !answers;
    $('variantStatus').textContent = answers ? 'Образец с ответами' : 'Ученический вариант';
    $('printSheet').textContent = answers ? 'Печатать образец · 2 на A4' : 'Печать · 2 на A4';
  }
  ['definitions','examples','answers'].forEach(id => $(id).addEventListener('change', updateWorksheet));
  $('resetSheet').addEventListener('click', () => {
    $('definitions').checked = true; $('examples').checked = false; $('answers').checked = false; updateWorksheet();
  });
  $('printSheet').addEventListener('click', async () => {
    updateWorksheet(); updateQr();
    if (!qrValid) { $('worksheetUrl').focus(); return; }
    const button = $('printSheet'); button.disabled = true;
    try { if (document.fonts) await document.fonts.ready; window.print(); }
    finally { button.disabled = false; }
  });
  window.addEventListener('beforeprint', () => { updateWorksheet(); updateQr(false); });

  function stopDemo() { timers.forEach(clearTimeout); timers = []; }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function instruction(text, step) { $('demoInstruction').textContent = text; $('demoStep').textContent = 'Шаг ' + step + ' из 3'; }
  function writeWord(element, word, start) {
    [...word].forEach((_, n) => later(() => { element.textContent = word.slice(0, n + 1); }, start + n * 160));
  }
  function completeDemo() {
    $('lawWord').textContent = 'законы'; $('parliamentWord').textContent = 'парламент';
    $('demoPencil').style.opacity = '0'; $('demoCheck').hidden = false;
    document.querySelector('.demo-paper').classList.remove('is-finding');
    instruction('Проверьте: власть монарха ограничивают законы и парламент.', 3);
  }
  function playDemo() {
    stopDemo(); $('lawWord').textContent = ''; $('parliamentWord').textContent = '';
    $('demoCheck').hidden = true; $('demoPencil').style.opacity = '0';
    document.querySelector('.demo-paper').classList.add('is-finding');
    instruction('Найдите раздел 6 «Конституционная монархия».', 1);
    if (media.matches) { completeDemo(); return; }
    later(() => {
      document.querySelector('.demo-paper').classList.remove('is-finding');
      instruction('В первый пропуск впишите слово «законы».', 2);
      $('demoPencil').style.left = '38%'; $('demoPencil').style.top = '59%'; $('demoPencil').style.opacity = '1';
    }, 2400);
    writeWord($('lawWord'), 'законы', 3250);
    later(() => {
      instruction('После союза «и» запишите слово «парламент».', 2);
      $('demoPencil').style.left = '83%';
    }, 5300);
    writeWord($('parliamentWord'), 'парламент', 6200);
    later(completeDemo, 9000);
  }
  function openDemo() {
    demoOpen = true; $('notesMode').inert = true; $('demoModal').hidden = false;
    $('demoTitle').focus(); playDemo();
  }
  function closeDemo() {
    stopDemo(); demoOpen = false; $('demoModal').hidden = true; $('notesMode').inert = false; $('openDemo').focus();
  }
  $('openDemo').addEventListener('click', openDemo);
  $('closeDemo').addEventListener('click', closeDemo);
  $('finishDemo').addEventListener('click', closeDemo);
  $('replayDemo').addEventListener('click', playDemo);
  $('demoModal').addEventListener('click', event => { if (event.target === $('demoModal')) closeDemo(); });
  document.addEventListener('keydown', event => {
    if (demoOpen) {
      if (event.key === 'Escape') { event.preventDefault(); closeDemo(); }
      if (event.key === 'Tab') {
        const buttons = [...$('demoModal').querySelectorAll('button')];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === $('demoTitle'))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      return;
    }
    if (notesOpen) { if (event.key === 'Escape') closeNotes(); return; }
    if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.target.tagName === 'BUTTON' && event.key === ' ') return;
    if (['ArrowRight','PageDown',' '].includes(event.key)) { event.preventDefault(); goTo(index + 1); }
    if (['ArrowLeft','PageUp'].includes(event.key)) { event.preventDefault(); goTo(index - 1); }
    if (event.key === 'Home') { event.preventDefault(); goTo(0); }
    if (event.key === 'End') { event.preventDefault(); goTo(slides.length - 1); }
  });
  updateWorksheet(); updateQr(false); goTo(hashSlide(), false);
})();
