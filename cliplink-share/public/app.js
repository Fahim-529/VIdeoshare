(function () {
  let state = {
    links: [],
    clicks: [],
    activeLinkId: null
  };

  const shortenForm = document.getElementById('shortenForm');
  const urlInput = document.getElementById('urlInput');
  const prefixSelect = document.getElementById('prefixSelect');
  const shortenBtn = document.getElementById('shortenBtn');

  const shortLinkText = document.getElementById('shortLinkText');
  const destHint = document.getElementById('destHint');
  const copyBtn = document.getElementById('copyBtn');
  const openBtn = document.getElementById('openBtn');
  const linksBar = document.getElementById('linksBar');

  const clickCountBadge = document.getElementById('clickCountBadge');
  const ipList = document.getElementById('ipList');
  const simBtn = document.getElementById('simBtn');
  const clearBtn = document.getElementById('clearBtn');
  const toast = document.getElementById('toast');

  let toastTimeout = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildUrl(link) {
    if (!link) return '';
    const prefix = link.pathPrefix || 'v';
    if (prefix === 'youtube.com/watch') {
      return `${window.location.origin}/youtube.com/watch?v=${link.slug}`;
    }
    return `${window.location.origin}/${prefix}/${link.slug}`;
  }

  async function copyToClipboard(text, msg = 'Copied!') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showToast(msg);
  }

  function formatTime(iso) {
    if (!iso) return '';
    const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (diff < 10) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async function loadData() {
    try {
      const res = await fetch('/api/links', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      state.links = data.links || [];
      state.clicks = data.clicks || [];

      if (!state.activeLinkId && state.links.length > 0) {
        state.activeLinkId = state.links[0].id;
      } else if (state.activeLinkId && !state.links.some(l => l.id === state.activeLinkId)) {
        state.activeLinkId = state.links[0]?.id || null;
      }

      render();
    } catch (e) {
      console.error(e);
    }
  }

  function render() {
    const activeLink = state.links.find(l => l.id === state.activeLinkId) || state.links[0];

    if (!activeLink) {
      shortLinkText.textContent = 'Paste a link above to generate a short URL';
      destHint.textContent = '';
      openBtn.href = '#';
      linksBar.innerHTML = '';
    } else {
      const fullUrl = buildUrl(activeLink);
      shortLinkText.textContent = fullUrl;
      destHint.textContent = `Redirects to: ${activeLink.targetUrl}`;
      openBtn.href = fullUrl;

      linksBar.innerHTML = state.links
        .map(l => {
          const isCurrent = l.id === activeLink.id;
          return `
            <span class="link-pill ${isCurrent ? 'active' : ''}" data-id="${escapeHtml(l.id)}">
              <span>/${escapeHtml(l.pathPrefix || 'v')}/${escapeHtml(l.slug)} (${l.totalClicks || 0})</span>
              <span class="link-pill-del" data-del="${escapeHtml(l.id)}" title="Delete">×</span>
            </span>
          `;
        })
        .join('');
    }

    const filteredClicks = activeLink
      ? state.clicks.filter(c => c.linkId === activeLink.id)
      : state.clicks;

    clickCountBadge.textContent = String(filteredClicks.length);

    if (filteredClicks.length === 0) {
      ipList.innerHTML = `
        <div class="empty-state">
          No clicks yet on this link. Share the link above or click <strong>Test Open ↗</strong> / <strong>+ Test Phone Click</strong>.
        </div>
      `;
      return;
    }

    ipList.innerHTML = filteredClicks
      .map(c => {
        const net = c.info || c.geo || {};
        const region = [net.city, net.country].filter(Boolean).join(', ') || 'Unknown Region';
        const isp = net.isp || 'Unknown ISP';
        const device = c.device?.model || 'Device';
        const osBrowser = [c.device?.os, c.device?.browser].filter(Boolean).join(' • ');
        const coords =
          typeof net.lat === 'number' && typeof net.lon === 'number' && (net.lat !== 0 || net.lon !== 0)
            ? `${net.lat.toFixed(4)}, ${net.lon.toFixed(4)}`
            : '';

        return `
          <div class="ip-row">
            <div class="ip-main">
              <div class="ip-address" data-ip="${escapeHtml(c.ip)}" title="Click to copy IP">
                <span>IP: ${escapeHtml(c.ip)}</span>
                <span style="font-size:0.72rem; color:#9ca3af; font-weight:400;">(Copy)</span>
              </div>
              <div class="ip-meta">🌐 ${escapeHtml(region)} — <span style="color:#9ca3af;">${escapeHtml(isp)}</span></div>
              <div class="ip-sub">📱 ${escapeHtml(device)} (${escapeHtml(osBrowser)})</div>
            </div>
            <div class="ip-right">
              <span class="time-tag">${escapeHtml(formatTime(c.timestamp))}</span>
              ${coords ? `<span class="time-tag" style="color:#6b7280;">${escapeHtml(coords)}</span>` : ''}
            </div>
          </div>
        `;
      })
      .join('');
  }

  shortenForm.addEventListener('submit', async e => {
    e.preventDefault();
    const targetUrl = urlInput.value.trim();
    if (!targetUrl) return;

    shortenBtn.disabled = true;
    shortenBtn.textContent = 'Shortening...';

    try {
      const payload = { targetUrl };
      if (prefixSelect.value !== 'auto') {
        payload.pathPrefix = prefixSelect.value;
      }

      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.link) {
        state.activeLinkId = data.link.id;
        urlInput.value = '';
        await loadData();
        copyToClipboard(buildUrl(data.link), 'Short link created & copied!');
      } else {
        showToast(data.error || 'Invalid link');
      }
    } catch {
      showToast('Failed to shorten link');
    } finally {
      shortenBtn.disabled = false;
      shortenBtn.textContent = 'Shorten Link';
    }
  });

  copyBtn.addEventListener('click', () => {
    const activeLink = state.links.find(l => l.id === state.activeLinkId) || state.links[0];
    if (activeLink) {
      copyToClipboard(buildUrl(activeLink), 'Short link copied!');
    }
  });

  linksBar.addEventListener('click', async e => {
    const delId = e.target.getAttribute('data-del');
    if (delId) {
      e.stopPropagation();
      await fetch(`/api/links/${encodeURIComponent(delId)}`, { method: 'DELETE' });
      if (state.activeLinkId === delId) state.activeLinkId = null;
      await loadData();
      return;
    }

    const pill = e.target.closest('.link-pill');
    if (pill) {
      state.activeLinkId = pill.getAttribute('data-id');
      render();
    }
  });

  ipList.addEventListener('click', e => {
    const ipEl = e.target.closest('[data-ip]');
    if (ipEl) {
      const ip = ipEl.getAttribute('data-ip');
      copyToClipboard(ip, `IP ${ip} copied!`);
    }
  });

  simBtn.addEventListener('click', async () => {
    const activeLink = state.links.find(l => l.id === state.activeLinkId) || state.links[0];
    if (!activeLink) return;
    await fetch(`/api/links/${encodeURIComponent(activeLink.id)}/simulate`, { method: 'POST' });
    await loadData();
    showToast('Logged test phone click IP!');
  });

  clearBtn.addEventListener('click', async () => {
    const activeLink = state.links.find(l => l.id === state.activeLinkId) || state.links[0];
    if (!activeLink) return;
    await fetch(`/api/links/${encodeURIComponent(activeLink.id)}/clicks`, { method: 'DELETE' });
    await loadData();
    showToast('Cleared click IPs');
  });

  loadData();
  setInterval(loadData, 2500);
})();
