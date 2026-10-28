/* ================= REPTYRY — app ================= */
(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  // ?draft — попередній перегляд незбережених змін з адмінки (admin.html)
  if (params.has("draft")) {
    try { const d = JSON.parse(localStorage.getItem("reptyry-draft")); if (d && d.products) window.REPTYRY = d; } catch (e) { /* немає чернетки */ }
  }
  const D = window.REPTYRY;
  const C = D.config;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const preview = params.has("preview") || params.has("shot"); // ?preview — без заставки та інерції (для перевірок)
  if (params.has("shot")) document.documentElement.classList.add("shot"); // ?shot — без переходів, для скріншотів кінцевого стану
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;
  // фото: ім'я файлу з assets/img (поруч є -sm версія) або повний шлях / data:URL з адмінки
  const img = (name, small) => (!name ? "" : /^(data:|https?:|assets\/|\.\/)/.test(name) ? name : `assets/img/${name}${small ? "-sm" : ""}.jpg`);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
  const money = (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ${C.currency || "грн"}`;
  const MAX_QTY = 10;

  /* ---------- нормалізація даних: сайт не падає, навіть якщо в адмінці щось недозаповнили ---------- */
  D.groups = (D.groups || []).filter((g) => g && g.id);
  D.sizes = D.sizes || {};
  const firstChart = () => Object.values(D.sizes)[0] || { title: "", ua: "", cols: ["Розмір"], rows: [["ONE SIZE"]], note: "" };
  const groupOf = (id) => D.groups.find((g) => g.id === id) || D.groups[0];
  D.products = (D.products || []).filter((p) => p && p.id && p.name && D.groups.some((g) => g.id === p.group));
  D.products.forEach((p) => {
    p.images = (p.images || []).filter(Boolean);
    if (!p.colors || !p.colors.length) p.colors = [{ name: "Базовий", hex: "#111111", img: 0 }];
    p.colors.forEach((c) => { c.img = clamp(Math.floor(+c.img || 0), 0, Math.max(0, p.images.length - 1)); });
  });
  const visible = (p) => !p.hidden && p.images.length > 0;
  const shown = () => D.products.filter(visible);
  const productOf = (id) => D.products.find((p) => p.id === id && visible(p));
  const imgOf = (p, i, small) => img(p.images[i] || p.images[0], small);
  const basePrice = (p) => +(p.price || groupOf(p.group).price || 0);
  const discountOf = (p) => clamp(Math.round(+(p.discount || groupOf(p.group).discount || C.globalDiscount || 0)), 0, 90);
  const priceOf = (p) => Math.round(basePrice(p) * (1 - discountOf(p) / 100));
  const priceHTML = (p) => (discountOf(p)
    ? `<s class="old" aria-label="Стара ціна">${money(basePrice(p))}</s> <span>${money(priceOf(p))}</span> <span class="sale">−${discountOf(p)}%</span>`
    : money(priceOf(p)));
  const chartKey = (p) => (D.sizes[groupOf(p.group).size] ? groupOf(p.group).size : Object.keys(D.sizes)[0]);
  const chartOf = (p) => D.sizes[chartKey(p)] || firstChart();
  const sizesOf = (p) => {
    const all = chartOf(p).rows.map((r) => String(r[0]));
    const own = (p.sizes || []).map(String).filter((s) => all.includes(s));
    return own.length ? own : all;
  };
  const managerUrl = (text) => `https://t.me/${C.managerUsername}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

  /* ---------- безпечне сховище (може бути недоступне) ---------- */
  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* немає сховища */ } },
    wipe() { try { localStorage.removeItem("reptyry-cart"); localStorage.removeItem("reptyry-cookie-ack"); } catch (e) { /* */ } },
  };

  /* ---------- плавний (сповільнений) скрол ---------- */
  const Smooth = {
    on: !reduced && !preview && finePointer,
    target: scrollY, current: scrollY, running: false, locked: false, ease: 0.085,
    start() { if (!this.running) { this.running = true; requestAnimationFrame(this.tick); } },
    tick: () => {
      const s = Smooth;
      s.current += (s.target - s.current) * s.ease;
      if (Math.abs(s.target - s.current) < 0.5) s.current = s.target;
      window.scrollTo(0, s.current);
      if (s.current !== s.target) requestAnimationFrame(s.tick); else s.running = false;
    },
    to(y) {
      y = clamp(y, 0, maxScroll());
      if (!this.on) {
        window.scrollTo({ top: y, behavior: reduced || preview ? "auto" : "smooth" });
        // після стрибка показуємо контент одразу, не чекаючи кадрів анімації / observer
        setTimeout(revealInView, 30); setTimeout(revealInView, 700);
        return;
      }
      this.target = y; this.start();
    },
  };
  if (Smooth.on) {
    document.documentElement.classList.add("smooth-on");
    addEventListener("wheel", (e) => {
      if (Smooth.locked || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.target.closest("dialog, .table-wrap, .pm__thumbs, .cookie")) return;
      e.preventDefault();
      const k = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? innerHeight : 1;
      if (!Smooth.running) Smooth.current = scrollY;
      Smooth.target = clamp(Smooth.target + e.deltaY * k, 0, maxScroll());
      Smooth.start();
    }, { passive: false });
    addEventListener("scroll", () => { if (!Smooth.running) Smooth.target = Smooth.current = scrollY; }, { passive: true });
  }
  const headerH = () => $("#header").offsetHeight;
  const scrollToEl = (el) => Smooth.to(el.getBoundingClientRect().top + scrollY - (el.id === "top" ? 0 : headerH() - 1));

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg, action) {
    const t = $("#toast");
    t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button" class="toast__btn">${esc(action.label)}</button>` : ""}`;
    if (action) $(".toast__btn", t).addEventListener("click", () => { t.classList.remove("is-on"); action.fn(); });
    t.classList.add("is-on");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("is-on"), action ? 4200 : 2600);
  }

  /* ---------- зовнішні посилання ---------- */
  const LINKS = { channel: C.telegramChannel, manager: managerUrl(), instagram: C.instagram };
  function wireLinks(root = document) {
    $$("[data-link]", root).forEach((a) => {
      const url = LINKS[a.dataset.link];
      if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener"; }
    });
  }

  /* ---------- шматки розмітки ---------- */
  function swatchesHTML(p, name, active = 0) {
    return p.colors.map((c, i) => `
      <label class="swatch" title="${esc(c.name)}">
        <input type="radio" name="${name}" value="${i}"${i === active ? " checked" : ""} aria-label="Колір: ${esc(c.name)}">
        <span style="--c:${esc(c.hex || "#111")};${c.accent ? `--a:${esc(c.accent)}` : ""}"></span>
      </label>`).join("");
  }
  function sizesHTML(p, name, active = "") {
    return sizesOf(p).map((s) => `
      <label class="szc"><input type="radio" name="${name}" value="${esc(s)}"${s === active ? " checked" : ""}${p.soldOut ? " disabled" : ""}><span>${esc(s)}</span></label>`).join("");
  }
  const checked = (root, name) => { const el = $(`input[name="${CSS.escape(name)}"]:checked`, root); return el ? el.value : null; };

  /* ---------- каталог ---------- */
  function renderCatalog() {
    $("#groups").innerHTML = D.groups.map((g) => {
      const items = shown().filter((p) => p.group === g.id);
      if (!items.length) return "";
      const prices = [...new Set(items.map(priceOf))].sort((a, b) => a - b);
      const cards = items.map((p) => {
        const c0 = p.colors[0];
        const alt = p.images[1] || p.images[0];
        return `
        <article class="card reveal${p.soldOut ? " is-soldout" : ""}" data-id="${esc(p.id)}">
          <button class="card__media" data-open aria-label="Детальніше: ${esc(p.name)}">
            <img class="main" src="${imgOf(p, c0.img, true)}" alt="${esc(p.name)} — ${esc(p.type)}" loading="lazy" decoding="async">
            <img class="alt" src="${img(alt, true)}" alt="" loading="lazy" decoding="async">
            ${discountOf(p) ? `<span class="badge badge--sale">−${discountOf(p)}%</span>` : ""}
            ${p.soldOut ? '<span class="badge badge--out">Немає в наявності</span>' : ""}
            <span class="card__view">Детальніше</span>
          </button>
          <div class="card__body">
            <p class="card__type">${esc(p.type)}</p>
            <h4 class="card__name">${esc(p.name)}</h4>
            <p class="card__price">${priceHTML(p)}</p>
            <div class="card__opt">
              <span class="card__lbl" id="cl-${esc(p.id)}">Колір: <b>${esc(c0.name)}</b></span>
              <div class="swatches" role="radiogroup" aria-labelledby="cl-${esc(p.id)}">${swatchesHTML(p, `c-${p.id}`)}</div>
            </div>
            <div class="card__opt">
              <span class="card__lbl" id="sl-${esc(p.id)}">Розмір</span>
              <div class="sizes-pick sizes-pick--sm" role="radiogroup" aria-labelledby="sl-${esc(p.id)}">${sizesHTML(p, `s-${p.id}`)}</div>
              <p class="err" role="alert"></p>
            </div>
            <div class="card__row">
              <button class="btn btn--red btn--sm" type="button" data-add${p.soldOut ? " disabled" : ""}>${p.soldOut ? "Немає в наявності" : "В кошик"}</button>
              <a class="sizelink" href="#size-${esc(chartKey(p))}" data-size="${esc(chartKey(p))}">📏 Розмірна сітка</a>
            </div>
          </div>
        </article>`;
      }).join("");
      const priceLabel = prices.length === 1 ? money(prices[0]) : `від ${money(prices[0])}`;
      return `
      <section class="group" id="group-${esc(g.id)}" data-group="${esc(g.id)}" aria-labelledby="gt-${esc(g.id)}">
        <header class="group__head reveal">
          <h3 class="group__title" id="gt-${esc(g.id)}"><span class="glitch" data-text="${esc(g.title)}">${esc(g.title)}</span><em>${esc(g.latin)}</em></h3>
          <div class="group__meta"><span>${priceLabel}</span>
            <a class="sizelink" href="#size-${esc(g.size)}" data-size="${esc(g.size)}">Розмірна сітка</a></div>
        </header>
        <div class="grid">${cards}</div>
      </section>`;
    }).join("");

    $("#countAll").textContent = shown().length;
    $("#filters").insertAdjacentHTML("beforeend", D.groups.map((g) => {
      const c = shown().filter((p) => p.group === g.id).length;
      return c ? `<button class="chip" data-filter="${esc(g.id)}" aria-pressed="false">${esc(g.title)} <sup>${c}</sup></button>` : "";
    }).join(""));
  }

  function setCardImg(card, idx) {
    const p = productOf(card.dataset.id);
    $(".card__media .main", card).src = imgOf(p, idx, true);
  }
  const preloaded = new Set();
  function preloadColors(p) {
    if (preloaded.has(p.id)) return;
    preloaded.add(p.id);
    p.colors.forEach((c) => { new Image().src = imgOf(p, c.img, true); });
  }

  function wireCatalog() {
    $("#filters").addEventListener("click", (e) => {
      const b = e.target.closest("[data-filter]");
      if (!b) return;
      $$("#filters .chip").forEach((c) => { c.classList.toggle("is-active", c === b); c.setAttribute("aria-pressed", c === b); });
      const f = b.dataset.filter;
      $$(".group").forEach((g) => { g.hidden = f !== "all" && g.dataset.group !== f; });
      const cat = $("#filters");
      if (cat.getBoundingClientRect().top < 0) scrollToEl(cat);
    });

    const groups = $("#groups");
    const colorIdx = (card, p) => clamp(+(checked(card, `c-${p.id}`) || 0), 0, p.colors.length - 1);
    groups.addEventListener("change", (e) => {
      const card = e.target.closest(".card");
      if (!card) return;
      const p = productOf(card.dataset.id);
      if (e.target.name === `c-${p.id}`) {
        const c = p.colors[+e.target.value];
        setCardImg(card, c.img);
        $(".card__lbl b", card).textContent = c.name;
      } else if (e.target.name === `s-${p.id}`) {
        $(".err", card).textContent = "";
      }
    });
    // наведення на колір — одразу показуємо товар цього кольору
    groups.addEventListener("mouseover", (e) => {
      const card = e.target.closest(".card");
      if (!card) return;
      const p = productOf(card.dataset.id);
      preloadColors(p);
      const sw = e.target.closest(".swatch");
      if (sw) {
        const i = +$("input", sw).value;
        setCardImg(card, p.colors[i].img);
        $(".card__lbl b", card).textContent = p.colors[i].name;
      }
    });
    groups.addEventListener("mouseout", (e) => {
      const box = e.target.closest(".swatches");
      if (!box || box.contains(e.relatedTarget)) return;
      const card = box.closest(".card");
      const p = productOf(card.dataset.id);
      const ci = colorIdx(card, p);
      setCardImg(card, p.colors[ci].img);
      $(".card__lbl b", card).textContent = p.colors[ci].name;
    });
    groups.addEventListener("click", (e) => {
      const card = e.target.closest(".card");
      if (!card) return;
      const p = productOf(card.dataset.id);
      const ci = colorIdx(card, p);
      const size = checked(card, `s-${p.id}`);
      if (e.target.closest("[data-open]")) { openProduct(p.id, ci, size); return; }
      const btn = e.target.closest("[data-add]");
      if (btn) {
        if (p.soldOut) return;
        if (!size) {
          $(".err", card).textContent = "Оберіть розмір";
          shake($(".sizes-pick", card));
          $(`input[name="${CSS.escape(`s-${p.id}`)}"]`, card).focus({ preventScroll: true });
          return;
        }
        addToCart(p.id, ci, size, 1, $(".card__media .main", card), btn);
      }
    });
  }

  function shake(el) {
    el.classList.remove("is-shake"); void el.offsetWidth; el.classList.add("is-shake");
  }

  /* ---------- розмірна сітка ---------- */
  function sizeTableHTML(key, withId) {
    const s = D.sizes[key];
    return `
      <div class="table-wrap">
        <table class="stable">
          <caption${withId ? ' id="smTitle"' : ""}>${esc(s.title)}<small>${esc(s.ua)} · розмірна сітка</small></caption>
          <thead><tr>${s.cols.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead>
          <tbody>${s.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
        ${s.note ? `<p class="snote">${esc(s.note)}</p>` : ""}
      </div>`;
  }
  const chartImg = (k) => (D.sizes[k].image ? `<img src="${esc(img(D.sizes[k].image))}" alt="Схема замірів: ${esc(D.sizes[k].ua)}" loading="lazy">` : "");
  function renderSizes() {
    const keys = Object.keys(D.sizes);
    if (!keys.length) { $("#sizes").hidden = true; return; }
    $("#sizeTabs").innerHTML = keys.map((k, i) =>
      `<button class="chip${i ? "" : " is-active"}" data-sizetab="${esc(k)}" aria-pressed="${!i}">${esc(D.sizes[k].ua)}</button>`).join("");
    const show = (k) => {
      $("#sizePanel").innerHTML = `${sizeTableHTML(k)}${chartImg(k)}`;
      $$("#sizeTabs .chip").forEach((c) => { const on = c.dataset.sizetab === k; c.classList.toggle("is-active", on); c.setAttribute("aria-pressed", on); });
    };
    show(keys[0]);
    $("#sizeTabs").addEventListener("click", (e) => { const b = e.target.closest("[data-sizetab]"); if (b) show(b.dataset.sizetab); });
  }
  function openSize(key) {
    if (!D.sizes[key]) return;
    $("#smBody").innerHTML = `${sizeTableHTML(key, true)}${chartImg(key)}`;
    openDialog($("#sizeModal"));
    setHash(`size-${key}`);
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-size]");
    if (!a) return;
    e.preventDefault();
    openSize(a.dataset.size);
  });

  /* ---------- діалоги ---------- */
  function lockState() {
    const any = !!$("dialog[open]") || $("#nav").classList.contains("is-open");
    document.body.classList.toggle("is-locked", any);
    Smooth.locked = any;
    if (!any) Smooth.target = Smooth.current = scrollY;
  }
  function openDialog(d) {
    if (!d.open) d.showModal();
    d.scrollTop = 0;
    lockState();
  }
  function setHash(h) {
    try { history.replaceState(null, "", h ? `#${h}` : location.pathname + location.search); } catch (e) { /* sandbox */ }
  }
  const hashFor = (d) => (d.id === "productModal" && PM.p ? `p-${PM.p.id}` : d.id === "cartModal" ? "cart" : d.id === "legalModal" ? LG.cur : "");
  // стан після закриття оновлюємо синхронно: подія "close" ставиться в чергу і може запізнитись
  function afterClose() {
    lockState();
    const open = $$("dialog[open]");
    setHash(open.length ? hashFor(open[open.length - 1]) : "");
  }
  function closeDialog(d) { if (d.open) d.close(); afterClose(); }
  $$("dialog").forEach((d) => {
    d.addEventListener("close", afterClose); // Esc
    d.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) { closeDialog(d); return; }
      const r = d.getBoundingClientRect();
      if (e.target === d && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) closeDialog(d);
    });
  });

  /* ---------- модалка товару ---------- */
  const PM = { p: null, i: 0, color: 0, qty: 1 };
  function openProduct(id, colorIdx = 0, size = null) {
    const p = productOf(id);
    if (!p) return;
    const g = groupOf(p.group);
    Object.assign(PM, { p, color: clamp(colorIdx, 0, p.colors.length - 1), qty: 1 });
    $("#pmType").textContent = [p.type, p.tech].filter(Boolean).join(" · ");
    $("#pmName").textContent = p.name;
    $("#pmPrice").innerHTML = priceHTML(p);
    $("#pmDesc").textContent = p.desc || "";
    const techTxt = (D.techInfo || {})[p.tech];
    $("#pmTech").innerHTML = p.tech ? `<b>${esc(p.tech)}</b>${techTxt ? ` — ${esc(techTxt)}` : ""}` : "Уточнюйте у менеджера";
    $("#pmMaterial").textContent = p.material || g.material || "Склад тканини уточнюйте у менеджера";
    $("#pmSizes").innerHTML = sizesHTML(p, "pm-size", size || "");
    $("#pmErr").textContent = "";
    $("#pmQty").textContent = "1";
    const add = $("#pmAdd");
    add.disabled = !!p.soldOut;
    add.textContent = p.soldOut ? "Немає в наявності" : "Додати в кошик";
    const sl = $("#pmSizeLink"); sl.href = `#size-${chartKey(p)}`; sl.dataset.size = chartKey(p);
    $("#pmThumbs").innerHTML = p.images.map((n, i) =>
      `<button type="button" data-i="${i}" aria-label="Фото ${i + 1} з ${p.images.length}"><img src="${img(n, true)}" alt="" loading="lazy"></button>`).join("");
    $("#pmColors").innerHTML = swatchesHTML(p, "pm-color", PM.color);
    $("#pmColorName").textContent = p.colors[PM.color].name;
    const many = p.images.length > 1;
    $("#pmPrev").hidden = $("#pmNext").hidden = !many;
    showImg(p.colors[PM.color].img);
    openDialog($("#productModal"));
    setHash(`p-${p.id}`);
  }
  function showImg(i) {
    const p = PM.p, n = p.images.length;
    PM.i = (i + n) % n;
    const el = $("#pmImg"), src = img(p.images[PM.i]);
    el.classList.add("is-loading");
    el.dataset.want = src;
    const pre = new Image();
    pre.onload = pre.onerror = () => { if (PM.p === p && el.dataset.want === src) { el.src = src; el.classList.remove("is-loading"); } };
    pre.src = src;
    el.alt = `${p.name} — фото ${PM.i + 1}`;
    $("#pmCounter").textContent = `${PM.i + 1} / ${n}`;
    const thumbs = $("#pmThumbs");
    $$("button", thumbs).forEach((b) => b.classList.toggle("is-active", +b.dataset.i === PM.i));
    // ВАЖЛИВО: не scrollIntoView — він прокручує всі батьківські блоки (діалог/сторінку) і «кидає» екран.
    const at = $(`button[data-i="${PM.i}"]`, thumbs);
    if (at) thumbs.scrollTo({ left: at.offsetLeft - (thumbs.clientWidth - at.offsetWidth) / 2, behavior: reduced ? "auto" : "smooth" });
    if (n > 1) new Image().src = img(p.images[(PM.i + 1) % n]);
  }
  function setPmColor(ci, commit) {
    const c = PM.p.colors[ci];
    $("#pmColorName").textContent = c.name;
    if (commit) PM.color = ci;
    showImg(c.img);
  }
  $("#pmPrev").addEventListener("click", () => showImg(PM.i - 1));
  $("#pmNext").addEventListener("click", () => showImg(PM.i + 1));
  $("#pmThumbs").addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) showImg(+b.dataset.i); });
  $("#pmColors").addEventListener("change", (e) => setPmColor(+e.target.value, true));
  $("#pmColors").addEventListener("mouseover", (e) => { const s = e.target.closest(".swatch"); if (s) setPmColor(+$("input", s).value, false); });
  $("#pmColors").addEventListener("mouseleave", () => setPmColor(PM.color, false));
  $("#pmSizes").addEventListener("change", () => { $("#pmErr").textContent = ""; });
  $("#pmMinus").addEventListener("click", () => { PM.qty = clamp(PM.qty - 1, 1, MAX_QTY); $("#pmQty").textContent = PM.qty; });
  $("#pmPlus").addEventListener("click", () => { PM.qty = clamp(PM.qty + 1, 1, MAX_QTY); $("#pmQty").textContent = PM.qty; });
  $("#pmAdd").addEventListener("click", (e) => {
    if (PM.p.soldOut) return;
    const size = checked($("#productModal"), "pm-size");
    if (!size) { $("#pmErr").textContent = "Оберіть розмір"; shake($("#pmSizes")); $('input[name="pm-size"]').focus({ preventScroll: true }); return; }
    addToCart(PM.p.id, PM.color, size, PM.qty, $("#pmImg"), e.currentTarget);
  });
  addEventListener("keydown", (e) => {
    const pm = $("#productModal");
    if (!pm.open || $("dialog[open]:not(#productModal)")) return;
    if (e.target.matches("input, textarea")) return; // стрілки в радіо-групах — для вибору
    if (e.key === "ArrowLeft") showImg(PM.i - 1);
    if (e.key === "ArrowRight") showImg(PM.i + 1);
  });
  let sx = null;
  $(".pm__main").addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
  $(".pm__main").addEventListener("touchend", (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 40 && PM.p.images.length > 1) showImg(PM.i + (dx < 0 ? 1 : -1));
  });

  /* ---------- кошик ---------- */
  // старі позиції, яких більше немає (товар/колір/розмір видалено в адмінці), відкидаємо
  let cart = store.get("reptyry-cart", []).filter((it) => {
    const p = it && productOf(it.id);
    return p && !p.soldOut && p.colors[it.c] && sizesOf(p).includes(it.s) && it.q > 0;
  }).map((it) => ({ ...it, q: clamp(Math.floor(it.q), 1, MAX_QTY) }));
  let step = "list";
  const form = { name: "", phone: "", delivery: "", city: "", address: "", payment: "", comment: "", consent: false };
  const keyOf = (it) => `${it.id}|${it.c}|${it.s}`;
  const totalQty = () => cart.reduce((a, it) => a + it.q, 0);
  const totalSum = () => cart.reduce((a, it) => a + it.q * priceOf(productOf(it.id)), 0);
  const save = () => store.set("reptyry-cart", cart);

  function updateBadge(bump) {
    const n = totalQty(), b = $("#cartBtn");
    $("#cartCount").textContent = n;
    b.classList.toggle("has-items", n > 0);
    b.setAttribute("aria-label", `Кошик, товарів: ${n}`);
    if (bump) { b.classList.remove("is-bump"); void b.offsetWidth; b.classList.add("is-bump"); }
  }
  function flyTo(fromImg) {
    if (reduced || !fromImg || !fromImg.getBoundingClientRect) return;
    const a = fromImg.getBoundingClientRect(), t = $("#cartBtn").getBoundingClientRect();
    if (!a.width) return;
    const f = document.createElement("img");
    f.src = fromImg.currentSrc || fromImg.src; f.className = "fly"; f.alt = "";
    Object.assign(f.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
    document.body.appendChild(f);
    const dx = t.left + t.width / 2 - (a.left + a.width / 2), dy = t.top + t.height / 2 - (a.top + a.height / 2);
    const anim = f.animate([
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 80}px) scale(.45) rotate(-8deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(.06)`, opacity: 0.2 },
    ], { duration: 750, easing: "cubic-bezier(.5,0,.2,1)" });
    anim.onfinish = () => f.remove();
  }
  function burst(el) {
    if (reduced || !el) return;
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < 14; i++) {
      const s = document.createElement("i");
      s.className = "spark";
      s.style.left = `${cx}px`; s.style.top = `${cy}px`;
      document.body.appendChild(s);
      const ang = (Math.PI * 2 * i) / 14 + Math.random() * 0.4, dist = 40 + Math.random() * 50;
      s.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist}px)) scale(0)`, opacity: 0 }],
      { duration: 600 + Math.random() * 200, easing: "cubic-bezier(.2,.7,.1,1)" }).onfinish = () => s.remove();
    }
  }
  function addToCart(id, c, s, q, fromImg, btn) {
    const p = productOf(id);
    if (!p || p.soldOut) return;
    const it = cart.find((x) => keyOf(x) === `${id}|${c}|${s}`);
    if (it && it.q >= MAX_QTY) { toast(`Максимум ${MAX_QTY} шт. одного товару. Більше — через менеджера.`); return; }
    if (it) it.q = clamp(it.q + q, 1, MAX_QTY); else cart.push({ id, c, s, q: clamp(q, 1, MAX_QTY) });
    save(); flyTo(fromImg); burst(btn); updateBadge(true);
    toast(`${p.name} · ${p.colors[c].name} · ${s} — у кошику`, { label: "Відкрити кошик", fn: openCart });
    if (step === "done") step = "list";
  }
  function openCart() { if (step !== "done") step = "list"; renderCart(); openDialog($("#cartModal")); setHash("cart"); }
  $("#cartBtn").addEventListener("click", openCart);

  function itemHTML(it, idx) {
    const p = productOf(it.id), col = p.colors[it.c] || p.colors[0];
    return `
      <li class="ci">
        <img src="${imgOf(p, col.img, true)}" alt="">
        <div class="ci__info">
          <b>${esc(p.name)}</b>
          <span>${esc(col.name)} · розмір ${esc(it.s)}</span>
          <span>${money(priceOf(p))} / шт.${discountOf(p) ? ` <span class="sale">−${discountOf(p)}%</span>` : ""}</span>
          <div class="ci__row">
            <div class="qty qty--sm" aria-label="Кількість: ${esc(p.name)}">
              <button type="button" data-dec="${idx}" aria-label="Менше"${it.q <= 1 ? " disabled" : ""}>−</button>
              <output>${it.q}</output>
              <button type="button" data-inc="${idx}" aria-label="Більше"${it.q >= MAX_QTY ? " disabled" : ""}>+</button>
            </div>
            <button type="button" class="ci__del" data-del="${idx}">Видалити</button>
          </div>
        </div>
        <b class="ci__sum">${money(it.q * priceOf(p))}</b>
      </li>`;
  }
  const deliveryOf = (id) => D.delivery.find((d) => d.id === id);
  const paymentOf = (id) => D.payment.find((d) => d.id === id);

  function buildMessage() {
    const lines = ["Нове замовлення REPTYRY", ""];
    cart.forEach((it, i) => {
      const p = productOf(it.id), col = p.colors[it.c] || p.colors[0];
      const sale = discountOf(p) ? ` (знижка ${discountOf(p)}%)` : "";
      lines.push(`${i + 1}) ${p.name} (${p.type}) — колір: ${col.name}, розмір: ${it.s}, ${it.q} шт. × ${money(priceOf(p))}${sale} = ${money(it.q * priceOf(p))}`);
    });
    const d = deliveryOf(form.delivery), pay = paymentOf(form.payment);
    lines.push("", `Разом за товари: ${money(totalSum())}`, "Доставка: за тарифами перевізника (окремо)", "",
      `Ім'я: ${form.name.trim()}`, `Телефон: ${form.phone.trim()}`,
      `Доставка: ${d.carrier} — ${d.label.toLowerCase()}`, `Місто: ${form.city.trim()}`, `${d.field}: ${form.address.trim()}`,
      `Оплата: ${pay.label}`);
    if (form.comment.trim()) lines.push(`Коментар: ${form.comment.trim()}`);
    return lines.join("\n");
  }

  function renderCart() {
    const body = $("#cartBody");
    if (!cart.length && step !== "list") step = "list";
    $("#cartTitle").textContent = step === "form" ? "Оформлення" : step === "done" ? "Надіслати замовлення" : `Кошик${cart.length ? ` (${totalQty()})` : ""}`;
    if (step === "list") {
      body.innerHTML = cart.length ? `
        <ul class="cart-list">${cart.map(itemHTML).join("")}</ul>
        <div class="cart-total"><span>Разом за товари</span><b>${money(totalSum())}</b></div>
        <p class="cart-note">Доставка оплачується окремо за тарифами перевізника. Інших доплат немає.</p>
        <div class="drawer__actions">
          <button class="btn btn--red" type="button" data-step="form">Оформити замовлення</button>
          <button class="btn btn--ghost" type="button" data-close>Продовжити покупки</button>
        </div>` : `
        <div class="cart-empty">
          <p>Кошик порожній.</p>
          <button class="btn btn--red" type="button" data-tocatalog>До каталогу</button>
        </div>`;
    } else if (step === "form") {
      const dSel = deliveryOf(form.delivery);
      body.innerHTML = `
        <form class="order" id="orderForm" novalidate>
          <p class="cart-note">${totalQty()} шт. на суму <b>${money(totalSum())}</b> + доставка за тарифами перевізника.</p>
          <div class="f"><label for="fName">Ім'я та прізвище отримувача *</label>
            <input id="fName" name="name" autocomplete="name" required maxlength="80" value="${esc(form.name)}" aria-describedby="eName"><p class="err" id="eName"></p></div>
          <div class="f"><label for="fPhone">Телефон *</label>
            <input id="fPhone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="+380 XX XXX XX XX" required value="${esc(form.phone)}" aria-describedby="ePhone"><p class="err" id="ePhone"></p></div>
          <fieldset class="f"><legend>Спосіб доставки *</legend>
            <div class="radios">${D.delivery.map((d) => `
              <label class="rd"><input type="radio" name="delivery" value="${esc(d.id)}"${form.delivery === d.id ? " checked" : ""} required><span><b>${esc(d.carrier)}</b> — ${esc(d.label.toLowerCase())}</span></label>`).join("")}</div>
            <p class="err" id="eDelivery"></p></fieldset>
          <div class="f"><label for="fCity">Місто / населений пункт *</label>
            <input id="fCity" name="city" autocomplete="address-level2" required maxlength="80" value="${esc(form.city)}" aria-describedby="eCity"><p class="err" id="eCity"></p></div>
          <div class="f"><label for="fAddr" id="addrLbl">${esc(dSel ? dSel.field : "Відділення або адреса")} *</label>
            <input id="fAddr" name="address" required maxlength="160" value="${esc(form.address)}" aria-describedby="eAddr"><p class="err" id="eAddr"></p></div>
          <fieldset class="f"><legend>Спосіб оплати *</legend>
            <div class="radios">${D.payment.map((p) => `
              <label class="rd"><input type="radio" name="payment" value="${esc(p.id)}"${form.payment === p.id ? " checked" : ""} required><span><b>${esc(p.label)}</b><small>${esc(p.note)}</small></span></label>`).join("")}</div>
            <p class="err" id="ePayment"></p></fieldset>
          <div class="f"><label for="fComment">Коментар (необов'язково)</label>
            <textarea id="fComment" name="comment" rows="2" maxlength="500">${esc(form.comment)}</textarea></div>
          <label class="consent"><input type="checkbox" name="consent"${form.consent ? " checked" : ""} required aria-describedby="eConsent">
            <span>Я погоджуюсь з <a href="#terms">Умовами використання</a> та <a href="#privacy">Політикою конфіденційності</a> і даю згоду на обробку моїх персональних даних для виконання замовлення.</span></label>
          <p class="err" id="eConsent"></p>
          <p class="cart-note">Дані з форми не надсилаються автоматично: на наступному кроці ви самі відправите готове повідомлення менеджеру в Telegram.</p>
          <div class="drawer__actions">
            <button class="btn btn--red" type="submit">Далі</button>
            <button class="btn btn--ghost" type="button" data-step="list">← Назад до кошика</button>
          </div>
        </form>`;
      const f = $("#orderForm");
      f.addEventListener("input", (e) => {
        const el = e.target;
        if (el.name in form) form[el.name] = el.type === "checkbox" ? el.checked : el.value;
        if (el.name === "delivery") $("#addrLbl").textContent = `${deliveryOf(el.value).field} *`;
        const err = el.getAttribute("aria-describedby") || "";
        if (err && $(`#${err}`)) $(`#${err}`).textContent = "";
        el.removeAttribute("aria-invalid");
      });
      f.addEventListener("change", (e) => {
        if (e.target.name === "delivery" || e.target.name === "payment") {
          form[e.target.name] = e.target.value;
          $(`#e${e.target.name[0].toUpperCase()}${e.target.name.slice(1)}`).textContent = "";
          if (e.target.name === "delivery") $("#addrLbl").textContent = `${deliveryOf(e.target.value).field} *`;
        }
      });
      f.addEventListener("submit", (e) => { e.preventDefault(); if (validate()) { step = "done"; renderCart(); $("#cartBody").scrollTop = 0; } });
    } else {
      const msg = buildMessage();
      body.innerHTML = `
        <div class="done">
          <p>Залишився один крок: надішліть це повідомлення менеджеру <b>@${esc(C.managerUsername)}</b>. Замовлення прийняте після того, як менеджер його підтвердить.</p>
          <label for="msgBox" class="pm__label">Текст замовлення</label>
          <textarea id="msgBox" class="msg" readonly rows="12">${esc(msg)}</textarea>
          <div class="drawer__actions">
            <a class="btn btn--red" id="sendTg" href="${managerUrl(msg)}" target="_blank" rel="noopener">Надіслати менеджеру в Telegram</a>
            <button class="btn btn--ghost" type="button" id="copyMsg">Скопіювати текст</button>
          </div>
          <p class="cart-note">Якщо текст не з'явився в Telegram автоматично — натисніть «Скопіювати текст» і вставте його в чат з менеджером.</p>
          <div class="drawer__actions">
            <button class="btn btn--ghost btn--sm" type="button" data-step="form">← Змінити дані</button>
            <button class="btn btn--ghost btn--sm" type="button" id="clearCart">Очистити кошик</button>
          </div>
        </div>`;
      $("#copyMsg").addEventListener("click", async () => {
        const ta = $("#msgBox");
        try { await navigator.clipboard.writeText(ta.value); toast("Текст скопійовано"); }
        catch (e) { ta.focus(); ta.select(); try { document.execCommand("copy"); toast("Текст скопійовано"); } catch (e2) { toast("Виділіть текст і скопіюйте вручну"); } }
      });
      $("#clearCart").addEventListener("click", () => { cart = []; save(); updateBadge(); step = "list"; renderCart(); toast("Кошик очищено"); });
    }
  }

  function validate() {
    const f = $("#orderForm");
    const errs = [];
    const set = (id, field, msg) => { $(`#${id}`).textContent = msg; if (field) field.setAttribute("aria-invalid", "true"); errs.push(field || $(`#${id}`)); };
    if (form.name.trim().length < 2) set("eName", $("#fName"), "Вкажіть ім'я та прізвище");
    const digits = form.phone.replace(/[^\d+]/g, "");
    if (!/^(\+?38)?0\d{9}$/.test(digits)) set("ePhone", $("#fPhone"), "Вкажіть номер у форматі +380XXXXXXXXX");
    if (!deliveryOf(form.delivery)) set("eDelivery", $('input[name="delivery"]', f), "Оберіть спосіб доставки");
    if (form.city.trim().length < 2) set("eCity", $("#fCity"), "Вкажіть місто");
    if (form.address.trim().length < 1) set("eAddr", $("#fAddr"), "Заповніть це поле");
    if (!paymentOf(form.payment)) set("ePayment", $('input[name="payment"]', f), "Оберіть спосіб оплати");
    if (!form.consent) set("eConsent", $('input[name="consent"]', f), "Потрібна ваша згода");
    if (errs.length) { errs[0].focus(); return false; }
    return true;
  }

  $("#cartBody").addEventListener("click", (e) => {
    const t = e.target;
    const st = t.closest("[data-step]");
    if (st) { step = st.dataset.step; renderCart(); $("#cartBody").scrollTop = 0; return; }
    if (t.closest("[data-tocatalog]")) { closeDialog($("#cartModal")); scrollToEl($("#catalog")); return; }
    const inc = t.closest("[data-inc]"), dec = t.closest("[data-dec]"), del = t.closest("[data-del]");
    if (inc) cart[+inc.dataset.inc].q = clamp(cart[+inc.dataset.inc].q + 1, 1, MAX_QTY);
    else if (dec) cart[+dec.dataset.dec].q = clamp(cart[+dec.dataset.dec].q - 1, 1, MAX_QTY);
    else if (del) cart.splice(+del.dataset.del, 1);
    else return;
    save(); updateBadge(); renderCart();
    const again = inc ? `[data-inc="${inc.dataset.inc}"]` : dec ? `[data-dec="${dec.dataset.dec}"]` : null;
    const el = again && $(again);
    if (el && !el.disabled) el.focus({ preventScroll: true });
    else if (again) { const o = $(again.replace(/inc|dec/, (m) => (m === "inc" ? "dec" : "inc"))); if (o) o.focus({ preventScroll: true }); }
  });

  /* ---------- документи ---------- */
  const DOCS = window.REPTYRY_LEGAL(C);
  const LG = { cur: "" };
  function openLegal(id) {
    const doc = DOCS.find((d) => d.id === id);
    if (!doc) return;
    LG.cur = id;
    $("#legalTabs").innerHTML = DOCS.map((d) => `<a href="#${d.id}" class="${d.id === id ? "is-active" : ""}"${d.id === id ? ' aria-current="page"' : ""}>${esc(d.title)}</a>`).join("");
    $("#legalDoc").innerHTML = `<h3 id="legalTitle">${esc(doc.title)}</h3>${doc.html}`;
    wireLinks($("#legalDoc"));
    const m = $("#legalModal");
    openDialog(m);
    m.scrollTop = 0;
    setHash(id);
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (a && DOCS.some((d) => `#${d.id}` === a.getAttribute("href"))) { e.preventDefault(); openLegal(a.getAttribute("href").slice(1)); }
    if (e.target.closest("[data-wipe]")) {
      store.wipe(); cart = []; updateBadge(); step = "list";
      $("#cookie").hidden = false;
      toast("Дані сайту в цьому браузері видалено");
    }
  });

  /* ---------- реквізити ---------- */
  function renderRequisites() {
    const c = C.company || {}, v = (x) => (x ? esc(x) : '<span class="todo">[потрібно вказати]</span>');
    $("#requisites").innerHTML = `
      <div><dt>Продавець</dt><dd>${v(c.seller)}</dd></div>
      <div><dt>РНОКПП / ЄДРПОУ</dt><dd>${v(c.taxId)}</dd></div>
      <div><dt>Адреса</dt><dd>${v(c.address)}</dd></div>
      <div><dt>E-mail</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : v("")}</dd></div>
      <div><dt>Телефон</dt><dd>${v(c.phone)}</dd></div>
      <div><dt>Менеджер</dt><dd><a href="${managerUrl()}" target="_blank" rel="noopener">@${esc(C.managerUsername)}</a></dd></div>`;
  }

  /* ---------- доставка ---------- */
  function renderDelivery() {
    const carriers = [...new Set(D.delivery.map((d) => d.carrier))];
    $("#deliveryGrid").innerHTML = carriers.map((name) => `
      <article class="dcard reveal">
        <span class="dcard__plate" aria-hidden="true"></span>
        <h3>${esc(name)}</h3>
        <ul>${D.delivery.filter((d) => d.carrier === name).map((d) => `<li><span>${esc(d.label)}</span><b>за тарифом</b></li>`).join("")}</ul>
      </article>`).join("");
    $("#payment").innerHTML = D.payment.map((p) => `<div><b>${esc(p.label)}</b><span>${esc(p.note)}</span></div>`).join("");
  }

  /* ---------- вітрина (sticky-сцена з топ-товарами) ---------- */
  function renderShowcase() {
    let feat = shown().filter((p) => p.featured);
    if (!feat.length) feat = shown().slice(0, 3);
    const sc = $("#showcase");
    if (!feat.length) { sc.hidden = true; return; }
    sc.style.setProperty("--n", feat.length);
    $("#scSlides").innerHTML = feat.map((p, i) => `
      <article class="slide" data-i="${i}">
        <div class="slide__word" aria-hidden="true">${esc(p.name.split(/[\s·]+/)[0])}</div>
        <figure class="slide__img"><img src="${imgOf(p, p.colors[0].img)}" alt="${esc(p.name)}" loading="${i ? "lazy" : "eager"}" decoding="async"></figure>
        <div class="slide__info">
          <p class="slide__type">${esc(p.type)}</p>
          <h3 class="slide__name">${esc(p.name)}</h3>
          <p class="slide__price">${priceHTML(p)}</p>
          <button class="btn btn--red magnet" type="button" data-showcase="${esc(p.id)}">${p.soldOut ? "Детальніше" : "Обрати розмір"}</button>
        </div>
      </article>`).join("");
    $("#scDots").innerHTML = feat.map(() => "<i></i>").join("");
    sc.addEventListener("click", (e) => { const b = e.target.closest("[data-showcase]"); if (b) openProduct(b.dataset.showcase); });
  }
  function updateShowcase() {
    const sc = $("#showcase");
    if (sc.hidden || reduced) return;
    const r = sc.getBoundingClientRect(), vh = innerHeight;
    if (r.bottom < 0 || r.top > vh) return;
    const slides = $$(".slide", sc), n = slides.length;
    const raw = clamp(-r.top / Math.max(1, r.height - vh), 0, 1) * Math.max(0.0001, n - 1); // 0..n-1
    // слайд «тримається» більшу частину скролу, зміна — коротким ривком
    const f = Math.min(Math.floor(raw), n - 1), fr = raw - f;
    const e = clamp((fr - 0.32) / 0.36, 0, 1);
    const prog = f + e * e * (3 - 2 * e);
    slides.forEach((s, i) => {
      const t = clamp(i - prog, -1.2, 1.2), a = Math.abs(t);
      s.style.setProperty("--t", t.toFixed(3));
      // новий слайд проявляється раніше, ніж зникає старий, — посередині екран не порожній
      s.style.opacity = clamp(t >= 0 ? 1 - t * 1.25 : 1 - a * 2.6, 0, 1).toFixed(3);
      s.style.visibility = a > 0.6 ? "hidden" : "visible";
      s.style.pointerEvents = a > 0.3 ? "none" : "";
      s.style.zIndex = String(10 - Math.round(a * 5));
    });
    $$("#scDots i").forEach((d, i) => d.classList.toggle("is-on", Math.round(prog) === i));
    $("#scBar").style.transform = `scaleX(${(prog / Math.max(1, n - 1)).toFixed(3)})`;
  }

  /* ---------- стрічка фото ---------- */
  function renderStrip() {
    const items = shown().flatMap((p) => p.images.slice(0, 2).map((im) => ({ p, im })));
    if (items.length < 4) { $("#strip").hidden = true; return; }
    const half = Math.ceil(items.length / 2);
    const row = (list) => {
      const one = list.map(({ p, im }) => `<button class="strip__item" type="button" data-showcase="${esc(p.id)}" aria-label="${esc(p.name)}" tabindex="-1"><img src="${img(im, true)}" alt="" loading="lazy" decoding="async"></button>`).join("");
      return one + one; // дубль для безшовної петлі
    };
    $("#stripA").innerHTML = row(items.slice(0, half));
    $("#stripB").innerHTML = row(items.slice(half));
    $("#strip").addEventListener("click", (e) => { const b = e.target.closest("[data-showcase]"); if (b) openProduct(b.dataset.showcase); });
  }

  /* ---------- навігація ---------- */
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute("data-size") || a.classList.contains("skip")) return;
    const id = a.getAttribute("href").slice(1);
    const el = id && document.getElementById(id);
    if (!el || el.tagName === "DIALOG") return;
    e.preventDefault();
    closeMenu();
    $$("dialog[open]").forEach((d) => d.close()); afterClose();
    scrollToEl(el);
  });
  $(".skip").addEventListener("click", (e) => { e.preventDefault(); scrollToEl($("#catalog")); $("#catalog").focus({ preventScroll: true }); });
  const burger = $("#burger"), nav = $("#nav"), header = $("#header");
  function closeMenu() {
    if (!nav.classList.contains("is-open")) return;
    nav.classList.remove("is-open"); header.classList.remove("menu-open");
    burger.setAttribute("aria-expanded", "false"); lockState();
  }
  burger.addEventListener("click", () => {
    const open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open); header.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", String(open)); lockState();
    if (open) $("a", nav).focus();
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("is-open")) { closeMenu(); burger.focus(); } });

  /* ---------- cookie-банер ---------- */
  function initCookie() {
    const box = $("#cookie");
    box.hidden = !!store.get("reptyry-cookie-ack", false);
    $("#cookieOk").addEventListener("click", () => { store.set("reptyry-cookie-ack", true); box.hidden = true; });
  }

  /* ---------- анімації ---------- */
  function splitTitles() {
    $$("[data-split]").forEach((el) => {
      const t = el.textContent;
      el.setAttribute("aria-label", t);
      el.innerHTML = [...t].map((c, i) => `<span class="ch" aria-hidden="true" style="--i:${i}">${c === " " ? "&nbsp;" : esc(c)}</span>`).join("");
    });
  }
  let io, revealReady = false;
  function startReveal() {
    io = new IntersectionObserver((ents) => ents.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
    }), { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    $$(".reveal, [data-split]").forEach((el) => io.observe(el));
    revealReady = true;
    revealInView();
    addEventListener("scroll", revealInView, { passive: true });
  }
  // Страховка: після стрибка по #посиланню або швидкого скролу observer може запізнитись —
  // усе, що вже на екрані (або вище), показуємо примусово, щоб не було «порожнього» екрана.
  function revealInView() {
    if (!revealReady) return;
    const vh = innerHeight, atEnd = scrollY >= maxScroll() - 4;
    for (const el of $$(".reveal:not(.is-in), [data-split]:not(.is-in)")) {
      if (el.closest("[hidden]")) continue;
      if (atEnd || el.getBoundingClientRect().top < vh - 20) { el.classList.add("is-in"); if (io) io.unobserve(el); }
    }
  }
  function sparks() {
    if (reduced) return;
    $(".hero__sparks").innerHTML = Array.from({ length: 34 }, () => {
      const x = Math.random() * 100, d = 6 + Math.random() * 8, dl = -Math.random() * 14, s = 1 + Math.random() * 2.5;
      return `<i style="left:${x}%;width:${s}px;height:${s}px;animation-duration:${d}s;animation-delay:${dl}s"></i>`;
    }).join("");
  }
  // «скремблер» тексту: літери перебираються і складаються в слово
  function scramble(el, delay = 0) {
    if (reduced || !el) return;
    const nodes = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    const glyphs = "ABCDEFGHKMNPRSTVWXYZ#%&*+=<>/";
    nodes.forEach((n) => {
      const target = n.textContent;
      let frame = 0;
      const total = 22;
      let id = 0;
      const finish = () => { clearInterval(id); n.textContent = target; };
      // таймери, а не rAF: у фоновій вкладці rAF зупиняється, і текст лишився б «зашифрованим»
      setTimeout(() => {
        id = setInterval(() => {
          frame++;
          n.textContent = [...target].map((ch, i) => (ch === " " || i < (frame / total) * target.length ? ch : glyphs[(Math.random() * glyphs.length) | 0])).join("");
          if (frame >= total) finish();
        }, 35);
      }, delay);
      setTimeout(finish, delay + total * 35 + 500); // гарантований фінал
    });
  }
  function intro() {
    document.body.classList.add("intro");
    scramble($("#heroTag"), 650);
    setTimeout(() => document.body.classList.remove("intro"), 2200);
  }
  function pointerFx() {
    if (reduced || !finePointer) return;
    // курсор-кільце + червоне світло
    const ring = $("#cursor"), glow = $("#glow");
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, gx = mx, gy = my;
    document.body.classList.add("has-cursor");
    addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; ring.classList.add("is-on"); }, { passive: true });
    document.addEventListener("mouseleave", () => ring.classList.remove("is-on"));
    document.addEventListener("mouseover", (e) => {
      const t = e.target;
      ring.classList.toggle("is-link", !!t.closest("a, button, label, summary, input"));
      ring.classList.toggle("is-view", !!t.closest(".card__media, .strip__item, .slide__img"));
    });
    (function loop() {
      rx += (mx - rx) * 0.22; ry += (my - ry) * 0.22;
      gx += (mx - gx) * 0.07; gy += (my - gy) * 0.07;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
      requestAnimationFrame(loop);
    })();
    // магнітні кнопки
    document.addEventListener("mousemove", (e) => {
      const b = e.target.closest(".magnet");
      $$(".magnet.is-mag").forEach((m) => { if (m !== b) { m.style.transform = ""; m.classList.remove("is-mag"); } });
      if (!b) return;
      const r = b.getBoundingClientRect();
      b.classList.add("is-mag");
      b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
    });
    // нахил логотипа за курсором
    const logo = $("#heroLogo img"), hero = $("#hero");
    hero.addEventListener("mousemove", (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      logo.style.transform = `perspective(900px) rotateY(${x * 12}deg) rotateX(${-y * 9}deg)`;
      hero.style.setProperty("--mx", `${(x + 0.5) * 100}%`);
      hero.style.setProperty("--my", `${(y + 0.5) * 100}%`);
    });
    hero.addEventListener("mouseleave", () => { logo.style.transform = ""; });
    // 3D-нахил карток
    $("#groups").addEventListener("mousemove", (e) => {
      const m = e.target.closest(".card__media");
      if (!m) return;
      const card = m.closest(".card"), r = m.getBoundingClientRect();
      card.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 8}deg`);
      card.style.setProperty("--rx", `${-((e.clientY - r.top) / r.height - 0.5) * 8}deg`);
    });
    $("#groups").addEventListener("mouseout", (e) => {
      const m = e.target.closest(".card__media");
      if (m && !m.contains(e.relatedTarget)) { const c = m.closest(".card"); c.style.removeProperty("--rx"); c.style.removeProperty("--ry"); }
    });
  }

  const navLinks = $$('.nav a[href^="#"]');
  const spy = new IntersectionObserver((ents) => ents.forEach((en) => {
    if (en.isIntersecting) navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${en.target.id}`));
  }), { rootMargin: "-45% 0px -50% 0px" });
  ["catalog", "sizes", "delivery", "contacts"].forEach((id) => spy.observe(document.getElementById(id)));

  const par = $$("[data-speed]");
  const track = $("#marquee");
  const stripA = $("#stripA"), stripB = $("#stripB");
  let mxq = 0, sa = 0, lastY = scrollY, vel = 0, lastDir = 0, idle = 0;
  const loopX = (x, w) => (w ? ((x % w) + w) % w : 0);
  // цикл не повинен «вмирати» через помилку в одному кадрі — інакше зникають усі анімації
  function frame() {
    try { frameBody(); } catch (e) { document.documentElement.dataset.frameErr = String(e && e.stack || e).slice(0, 300); }
    requestAnimationFrame(frame);
  }
  function frameBody() {
    const y = scrollY;
    const dy = y - lastY; lastY = y;
    vel += (dy - vel) * 0.15;
    header.classList.toggle("is-scrolled", y > 60);
    if (!nav.classList.contains("is-open") && !Smooth.locked) {
      if (dy > 2 && y > 500) header.classList.add("is-hidden");
      else if (dy < -2 || y < 500) header.classList.remove("is-hidden");
    }
    $("#progress").style.transform = `scaleX(${maxScroll() > 0 ? y / maxScroll() : 0})`;
    if (dy !== 0 || ++idle % 30 === 0) revealInView();
    if (!reduced) {
      const vh = innerHeight;
      for (const el of par) {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        el.style.transform = `translate3d(0, ${((r.top + r.height / 2 - vh / 2) * -parseFloat(el.dataset.speed)).toFixed(1)}px, 0)`;
      }
      if (dy !== 0) lastDir = Math.sign(dy);
      const boost = Math.min(Math.abs(vel) * 0.35, 18);
      mxq += (0.6 + boost) * (lastDir < 0 ? -1 : 1);
      track.style.transform = `translate3d(${-loopX(mxq, track.scrollWidth / 2).toFixed(1)}px,0,0) skewX(${clamp(-vel * 0.25, -12, 12).toFixed(2)}deg)`;
      if (!$("#strip").hidden) {
        sa += 0.5 + boost * 0.6;
        stripA.style.transform = `translate3d(${-loopX(sa, stripA.scrollWidth / 2).toFixed(1)}px,0,0)`;
        stripB.style.transform = `translate3d(${(loopX(sa, stripB.scrollWidth / 2) - stripB.scrollWidth / 2).toFixed(1)}px,0,0)`;
      }
      updateShowcase();
    }
  }

  /* ---------- прелоадер ---------- */
  function runLoader(done) {
    const L = $("#loader"), kg = $("#loaderKg");
    if (reduced || preview) { L.style.transition = "none"; L.classList.add("is-done"); done(false); return; }
    const t0 = performance.now(), dur = 1000, goal = 220;
    let finished = false, loaded = document.readyState === "complete";
    addEventListener("load", () => { loaded = true; }, { once: true });
    const finish = () => { if (finished) return; finished = true; kg.textContent = goal; setTimeout(() => { L.classList.add("is-done"); done(true); }, 150); };
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      kg.textContent = Math.round(goal * (1 - Math.pow(1 - k, 3)));
      if ((k >= 1 && loaded) || t - t0 > 3000) finish(); else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(finish, 3500); // страховка: rAF може бути пригальмований
  }

  /* ---------- маршрути за #hash ---------- */
  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) return;
    if (h.startsWith("size-")) openSize(h.slice(5));
    else if (h.startsWith("p-")) openProduct(h.slice(2));
    else if (h === "cart") openCart();
    else if (DOCS.some((d) => d.id === h)) openLegal(h);
    else if (document.getElementById(h)) setTimeout(() => scrollToEl(document.getElementById(h)), 50);
  }
  addEventListener("hashchange", route);

  /* ---------- init ---------- */
  // емодзі-прапор Windows показує як «UA», тому малюємо прапор сам
  const flag = '<span class="flag" role="img" aria-label="Україна"></span>';
  const tag = (C.tagline || []).map((t) => esc(t).replace("🇺🇦", flag)).join("<i>·</i>");
  $("#heroTag").innerHTML = tag;
  $("#footerTag").innerHTML = tag;
  const words = (C.marquee && C.marquee.length ? C.marquee : ["Light weight baby", "Yeah buddy", "Heavy duty"]).map((w) => `<span>${esc(w)}</span><b>✕</b>`).join("");
  track.innerHTML = words + words;
  $("#mgrSub").textContent = `@${C.managerUsername} · замовлення`;
  $("#igSub").textContent = `@${C.instagramName}`;
  renderCatalog();
  renderShowcase();
  renderStrip();
  renderSizes();
  renderDelivery();
  renderRequisites();
  splitTitles();
  wireCatalog();
  wireLinks();
  updateBadge();
  initCookie();
  sparks();
  pointerFx();
  $("#year").textContent = new Date().getFullYear();
  requestAnimationFrame(frame);
  runLoader((animated) => { startReveal(); if (animated) intro(); route(); });
})();
