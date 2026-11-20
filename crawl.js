/* Üye sayfası tarayıcı / Member page crawler
   Run from the bookmark on a member-list page (logos or names that link to one page per company).
   It opens each company page in the background, reads name, contact, phone, e-mail, web, address,
   and gives a table to paste into tab 3 of https://ttcistanbul.github.io/buyer/ */
(() => {
  if (window.__ttcCrawl) { window.__ttcCrawl.show(); return; }
  const host = location.hostname.replace(/^www\./, '');
  const SKIP = /(iletisim|contact|hakkimizda|hakkinda|about|haber|news|duyuru|announce|kurumsal|corporate|uyelik|membership|basvuru|etkinlik|event|galeri|gallery|blog|category|kategori|tag|etiket|page\/\d|bot-check|captcha|cdn-cgi|wp-|feed|login|giris|kvkk|gizlilik|privacy|cerez|cookie|yonetim|board|tuzuk|mevzuat|yayin|publication|rapor|report|sitemap|search|arama|\.pdf|\.jpe?g|\.png|\.docx?|\.xlsx?)/i;
  const SOCIAL = /(facebook|instagram|twitter|x\.com|linkedin|youtube|tiktok|wa\.me|whatsapp|google\.|goo\.gl|apple\.com|play\.google|t\.me|pinterest|flickr|vimeo)/i;

  // --- 1) candidate member links on this page
  const inChrome = el => el.closest('header,nav,footer,aside,[role=navigation],.menu,.navbar,.footer,.header,#footer,#header');
  const listLinks = [...document.querySelectorAll('a[href]')];
  const sameSite = listLinks.filter(a => { try { const u = new URL(a.href); return u.hostname.replace(/^www\./, '') === host && !inChrome(a) && u.pathname.length > 1 && !SKIP.test(u.pathname) && u.href.split('#')[0] !== location.href.split('#')[0]; } catch (e) { return false; } });
  const groups = {};
  for (const a of sameSite) { const u = new URL(a.href); const segs = u.pathname.replace(/\/$/, '').split('/'); const key = segs.slice(0, -1).join('/') || '/'; (groups[key] = groups[key] || new Set()).add(u.origin + u.pathname); }
  const best = Object.entries(groups).sort((a, b) => b[1].size - a[1].size)[0];
  let urls = best ? [...best[1]] : [];
  // some sites open each company with onclick="window.open('…')" instead of a link
  const NAMES = {};
  const clickItems = [];
  document.querySelectorAll('[onclick],[data-href],[data-url],[data-link]').forEach(el => {
    if (inChrome(el)) return;
    const src = (el.getAttribute('onclick') || '') + ' ' + (el.getAttribute('data-href') || el.getAttribute('data-url') || el.getAttribute('data-link') || '');
    const m = src.match(/(https?:\/\/[^'"\s)]+)/); if (!m) return;
    let u; try { u = new URL(m[1]); } catch (e) { return; }
    if (SOCIAL.test(u.hostname) || SKIP.test(u.pathname)) return;
    const name = el.textContent.replace(/\s+/g, ' ').trim();
    const key = u.href.split('#')[0];
    if (name && name.length > 2 && name.length < 160 && !/^(web ?sitesi|website|detay|incele|devam[ıi]?|more|details|git|visit)$/i.test(name)) NAMES[key] = NAMES[key] || name;
    if (!clickItems.includes(key)) clickItems.push(key);
  });
  if (clickItems.length >= 5 && clickItems.length > urls.length) urls = clickItems;

  // things that belong to the association itself (shown on this list page) are not company data
  const pageText = document.body.innerText;
  const ownMails = new Set((pageText.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []).map(s => s.toLowerCase()));
  const ownLinks = new Set(listLinks.filter(a => inChrome(a)).map(a => { try { return new URL(a.href).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }));
  const digits = s => s.replace(/\D/g, '').replace(/^90/, '').replace(/^0/, '');
  const RX_PHONE = /(?:\+?90[\s\-.()]*)?\(?0?\s*[2-5]\d{2}\)?[\s\-.]*\d{3}[\s\-.]*\d{2}[\s\-.]*\d{2}/g;
  const ownPhones = new Set((pageText.match(RX_PHONE) || []).map(digits));

  let rows = [];
  // --- 2) panel
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;width:380px;max-width:94vw;background:#fff;color:#222;border:2px solid #1d6b3a;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.25);font:14px/1.45 system-ui,sans-serif;padding:14px';
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>Üye sayfası tarayıcı / Member crawler</b><button data-x style="border:0;background:none;font-size:18px;cursor:pointer">×</button></div>
  <p data-msg style="margin:8px 0"></p>
  <div data-bar style="height:6px;background:#eee;border-radius:3px;overflow:hidden;margin:6px 0"><i style="display:block;height:100%;width:0;background:#1d6b3a"></i></div>
  <div style="display:flex;gap:6px;flex-wrap:wrap">
   <button data-go style="padding:6px 12px;background:#1d6b3a;color:#fff;border:0;border-radius:6px;cursor:pointer">Başla / Start</button>
   <button data-stop hidden style="padding:6px 12px;border:1px solid #999;background:#fff;border-radius:6px;cursor:pointer">Durdur / Stop</button>
   <button data-copy hidden style="padding:6px 12px;background:#1d6b3a;color:#fff;border:0;border-radius:6px;cursor:pointer">Kopyala / Copy</button>
   <button data-dl hidden style="padding:6px 12px;border:1px solid #999;background:#fff;border-radius:6px;cursor:pointer">CSV indir</button>
  </div>
  <details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;color:#666">Bulunan sayfalar / Pages found</summary><textarea data-urls style="width:100%;height:120px;font-size:11px;margin-top:4px" spellcheck="false"></textarea><div style="font-size:11px;color:#666">Yanlış olanları sil, eksikleri ekle (her satıra bir adres). / Delete wrong ones, add missing ones.</div></details>`;
  document.body.appendChild(box);
  const $ = s => box.querySelector(s);
  const msg = t => { $('[data-msg]').textContent = t; };
  $('[data-urls]').value = urls.join('\n');
  msg(urls.length ? `${urls.length} firma sayfası bulundu. Kontrol etmek için “Bulunan sayfalar”a bak, sonra Başla. / ${urls.length} company pages found.` : 'Firma sayfası bulunamadı. Bu sayfada firmalar başka sayfalara bağlı değil olabilir; listeyi kopyalayıp yapıştır. / No company pages found.');
  $('[data-x]').onclick = () => { box.remove(); window.__ttcCrawl = null; };
  window.__ttcCrawl = { show: () => box.scrollIntoView(), get rows() { return rows; }, read: u => read(u) };

  // --- 3) read one company page
  const LBL = { contact: ['İsim Soyisim', 'İsim Soyad', 'Ad Soyad', 'Adı Soyadı', 'Yetkili Kişi', 'Yetkili', 'Contact Person', 'Name Surname'], title: ['Görevi', 'Görev', 'Unvanı', 'Ünvanı', 'Unvan', 'Ünvan', 'Position', 'Title'], phone: ['Telefon', 'Tel:', 'Tel.', 'Phone'], fax: ['Faks', 'Fax'], email: ['E-posta', 'E-Posta', 'Eposta', 'E-mail', 'E-Mail', 'Email', 'Mail:', 'Mail'], info: ['Faaliyet Alanları', 'Faaliyet Alanı', 'Faaliyet Konusu', 'Faaliyet', 'Ürünler', 'Activities'], web: ['Web Sitesi', 'Web Site', 'Website', 'Web Adresi', 'Web:', 'Site'], address: ['Adres', 'Address'] };
  const ALL = Object.entries(LBL).flatMap(([k, a]) => a.flatMap(l => [[l, k], [l.toLocaleUpperCase('tr'), k]]));
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const RX_LBL = new RegExp('(' + ALL.map(x => esc(x[0])).sort((a, b) => b.length - a.length).join('|') + ')\\s*:?\\s*', 'g');
  const kindOf = l => (ALL.find(x => x[0] === l.trim().replace(/:$/, '') || x[0] === l) || ALL.find(x => x[0].trim().replace(/:$/, '') === l.trim().replace(/[:\s]+$/, '')) || [])[1];
  const slugName = url => { const s = new URL(url).pathname.replace(/\/$/, '').split('/').pop().replace(/[-_]\d{6,}([-_.]\d+)*$/, '').replace(/\.html?$/, ''); return s.replace(/[-_]+/g, ' ').toLocaleUpperCase('tr').replace(/\bA S$/, 'A.Ş.').replace(/\bLTD STI\b/, 'LTD. ŞTİ.').trim(); };
  // values that repeat on most pages (the association's own address, phone, slogan) are not company data
  function dropRepeats(list) {
    if (list.length < 5) return;
    for (const k of ['company', 'contact', 'title', 'email', 'phone', 'web', 'address', 'city', 'info']) {
      const n = {}; list.forEach(r => { if (r[k]) n[r[k]] = (n[r[k]] || 0) + 1; });
      for (const [v, c] of Object.entries(n)) if (c >= Math.max(3, list.length * 0.3)) list.forEach(r => { if (r[k] === v) r[k] = k === 'company' ? slugName(r.page) : ''; });
    }
  }
  async function read(url) {
    const uh = new URL(url).hostname.replace(/^www\./, '');
    if (uh !== host) return { company: NAMES[url] || uh, contact: '', title: '', email: '', phone: '', web: url, address: '', city: '', info: '', page: location.href.split('#')[0] };
    const html = await (await fetch(url, { credentials: 'omit' })).text();
    const d = new DOMParser().parseFromString(html, 'text/html');
    d.querySelectorAll('script,style,noscript,header,footer,nav,aside,form,iframe,[role=navigation]').forEach(e => e.remove());
    d.querySelectorAll('p,div,li,tr,td,th,dd,dt,h1,h2,h3,h4,h5,h6,br,section,article,span').forEach(e => e.append('\n'));
    const lines = (d.body ? d.body.textContent : '').replace(/[\t  ]+/g, ' ').split('\n').map(s => s.trim()).filter(Boolean);
    const r = { company: '', contact: '', title: '', email: '', phone: '', web: '', address: '', city: '', info: '', page: url };
    const bad = s => !s || s.length < 3 || s.length > 160 || /[:：]\s*$/.test(s) || /^(https?:\/\/|www\.)|@|^[+\d\s()\-]{7,}$/.test(s);
    const heads = [...d.querySelectorAll('h1,h2')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(s => !bad(s));
    const tparts = [(d.querySelector('meta[property="og:title"]') || {}).content || '', d.title || ''].flatMap(s => s.split(/\s[–|\-]\s/)).map(s => s.trim()).filter(s => !bad(s));
    r.company = heads[0] || tparts[0] || slugName(url);
    if (NAMES[url]) r.company = NAMES[url];
    // labelled fields
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(RX_LBL);
      for (let j = 1; j < parts.length; j += 2) {
        const k = kindOf(parts[j]); if (!k) continue;
        let v = (parts[j + 1] || '').replace(/^[\s:：\-–]+/, '').trim(); if (!v && lines[i + 1] && !RX_LBL.test(lines[i + 1])) v = lines[i + 1]; RX_LBL.lastIndex = 0;
        const okv = k === 'web' ? /^(https?:\/\/|www\.)|\.[a-z]{2,}(\/|$)/i.test(v) : k === 'phone' ? /\d{3}.*\d{2}/.test(v) : k === 'email' ? /@/.test(v) : true;
        if (v && okv && !r[k] && k !== 'fax' && (k === 'info' ? v.length < 600 : v.length < 250)) r[k] = v;
      }
    }
    // e-mails
    const mails = [...d.querySelectorAll('a[href^="mailto:"]')].map(a => a.href.slice(7).split('?')[0]).concat(html.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []).map(s => s.toLowerCase()).filter(m => !ownMails.has(m) && !/\.(png|jpe?g|gif|webp|svg)$/.test(m) && !/(sentry|wixpress|example)/.test(m));
    if (!r.email || /@/.test(r.email) === false) r.email = mails[0] || '';
    // phone
    if (!r.phone) { const ph = (lines.join(' ').match(RX_PHONE) || []).find(p => !ownPhones.has(digits(p))); r.phone = ph || ''; }
    // web: first outside link that is not social and not on the list page
    if (!r.web) { const w = [...d.querySelectorAll('a[href^="http"]')].map(a => a.href).concat([...d.querySelectorAll('[onclick]')].map(e => (e.getAttribute('onclick').match(/(https?:\/\/[^'"\s)]+)/) || [])[1]).filter(Boolean)).find(h => { try { const u = new URL(h); const hn = u.hostname.replace(/^www\./, ''); return hn !== host && !SOCIAL.test(hn) && !ownLinks.has(hn); } catch (e) { return false; } }); r.web = w || ''; }
    // address fallback
    if (!r.address) r.address = lines.find(l => l.length < 220 && /(mah\.|mahalle|cad\.|caddesi|sok\.|sokak|bulvar|osb|organize sanayi|no\s*:|\b\d{5}\b.*\/)/i.test(l)) || '';
    const m = r.address.match(/\/\s*([^\/]+?)\s*(\/\s*(t[uü]rkiye|turkey))?\s*$/i); r.city = m ? m[1].replace(/t[uü]rkiye|turkey/i, '').trim() : '';
    // description: longest paragraph
    if (!r.info) r.info = [...d.querySelectorAll('p')].map(p => p.textContent.replace(/\s+/g, ' ').trim()).filter(t => t.length > 60 && !/@|copyright|©|çerez|cookie/i.test(t)).sort((a, b) => b.length - a.length)[0] || '';
    r.info = r.info.slice(0, 400);
    return r;
  }

  // --- 4) run
  let stop = false;
  const H = ['Firma', 'Yetkili', 'Görevi', 'E-posta', 'Telefon', 'Web', 'Adres', 'Şehir', 'Faaliyet', 'Sayfa'];
  const tsv = () => [H.join('\t'), ...rows.map(r => [r.company, r.contact, r.title, r.email, r.phone, r.web, r.address, r.city, r.info, r.page].map(c => String(c || '').replace(/[\t\r\n]+/g, ' ')).join('\t'))].join('\n');
  $('[data-stop]').onclick = () => { stop = true; };
  $('[data-go]').onclick = async () => {
    urls = $('[data-urls]').value.split('\n').map(s => s.trim()).filter(s => /^https?:\/\//.test(s));
    if (!urls.length) return;
    stop = false; rows = []; $('[data-go]').hidden = true; $('[data-stop]').hidden = false;
    let fail = 0;
    for (let i = 0; i < urls.length && !stop; i++) {
      msg(`${i + 1} / ${urls.length} okunuyor… / reading…`);
      $('[data-bar] i').style.width = (100 * (i + 1) / urls.length) + '%';
      const ext = new URL(urls[i]).hostname.replace(/^www\./, '') !== host;
      try { rows.push(await read(urls[i])); } catch (e) { fail++; if (NAMES[urls[i]]) rows.push({ company: NAMES[urls[i]], contact: '', title: '', email: '', phone: '', web: '', address: '', city: '', info: '', page: urls[i] }); }
      if (!ext) await new Promise(r => setTimeout(r, 350));
    }
    dropRepeats(rows);
    $('[data-stop]').hidden = true; $('[data-go]').hidden = false; $('[data-copy]').hidden = !rows.length; $('[data-dl]').hidden = !rows.length;
    const nPhone = rows.filter(r => r.phone).length, nMail = rows.filter(r => r.email).length;
    msg(`Bitti: ${rows.length} firma (telefon ${nPhone}, e-posta ${nMail}${fail ? `, ${fail} sayfa açılmadı` : ''}). “Kopyala”ya bas ve 3. sekmeye yapıştır. / Done: press Copy and paste into tab 3.`);
  };
  $('[data-copy]').onclick = async () => {
    try { await navigator.clipboard.writeText(tsv()); msg('Kopyalandı. 3. sekmede kutuya yapıştır (Ctrl+V). / Copied. Paste into tab 3.'); }
    catch (e) { const t = document.createElement('textarea'); t.value = tsv(); box.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); msg('Kopyalandı. / Copied.'); }
  };
  $('[data-dl]').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + tsv().split('\n').map(l => l.split('\t').map(c => '"' + c.replace(/"/g, '""') + '"').join(';')).join('\r\n')],{ type: 'text/csv;charset=utf-8' })); a.download = host.replace(/\W+/g, '_') + '_uyeler.csv'; a.click(); };
})();
