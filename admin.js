/* ================= REPTYRY — адмінка =================
   Редагує дані сайту (data.js).
   - Кожна зміна одразу зберігається як чернетка в браузері (localStorage "reptyry-draft"),
     її видно на сайті за адресою index.html?draft.
   - Без GitHub: «Зберегти data.js» записує файл у підключену папку сайту (Chrome/Edge)
     або завантажує його, щоб замінити data.js вручну.
   - З GitHub (розділ «Сайт в інтернеті»): «Опублікувати зміни» комітить data.js і нові фото
     в репозиторій, GitHub Pages оновлює сайт. На сайті адмінка закрита, поки не введено ключ.
   ===================================================== */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const img = (name, small) => (!name ? "" : /^(data:|https?:|assets\/|\.\/)/.test(name) ? name : `assets/img/${name}${small ? "-sm" : ""}.jpg`);
  const TR = { а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh", з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia", ё: "e", ы: "y", э: "e", ъ: "", "'": "", "’": "" };
  const slug = (s) => [...String(s || "").toLowerCase()].map((c) => (TR[c] ?? c)).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
  const money = (n, cur) => `${String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ${cur || "грн"}`;

  const DRAFT_KEY = "reptyry-draft";
  const GH_KEY = "reptyry-gh";
  let ORIGINAL = clone(window.REPTYRY || {});
  let S;
  let draft = null;
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch (e) { /* немає */ }
  const hasDraft = !!(draft && draft.products) && JSON.stringify(draft) !== JSON.stringify(ORIGINAL);
  S = hasDraft ? draft : clone(ORIGINAL);
  normalize(S);
  let dirty = hasDraft;
  let dir = null; // папка сайту (File System Access API)
  let tab = "products";
  let sel = 0;

  function normalize(s) {
    s.config = s.config || {};
    const c = s.config;
    c.company = c.company || {};
    c.tagline = c.tagline || ["", ""];
    c.marquee = c.marquee || [];
    c.globalDiscount = +c.globalDiscount || 0;
    c.currency = c.currency || "грн";
    s.groups = s.groups || [];
    s.sizes = s.sizes || {};
    s.delivery = s.delivery || [];
    s.payment = s.payment || [];
    s.techInfo = s.techInfo || {};
    s.products = s.products || [];
    s.products.forEach((p) => { p.images = p.images || []; p.colors = p.colors || []; p.sizes = p.sizes || []; });
  }

  /* ---------- статус / тост ---------- */
  let toastT;
  function toast(msg, err) {
    const t = $("#toast");
    t.textContent = msg; t.classList.toggle("is-err", !!err); t.classList.add("is-on");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("is-on"), err ? 5000 : 2600);
  }
  function setStatus(msg, kind) {
    const st = $("#status");
    st.className = "top__status" + (kind ? ` is-${kind}` : "");
    st.textContent = msg || (dirty ? "● Є незбережені зміни (видно на «Переглянути сайт»). Натисніть «Зберегти data.js»." : "Усі зміни збережено.");
  }
  function commit() {
    dirty = true;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(S)); }
    catch (e) { toast("Браузер не вміщує чернетку (забагато фото як data:URL). Підключіть папку сайту — тоді фото зберігаються файлами.", true); }
    setStatus();
  }
  addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- шляхи для прив'язки полів ---------- */
  function getPath(path) { return path.split(".").reduce((o, k) => (o == null ? o : o[k]), S); }
  function setPath(path, val) {
    const keys = path.split(".");
    const last = keys.pop();
    const obj = keys.reduce((o, k) => (o[k] == null ? (o[k] = {}) : o[k]), S);
    if (val === undefined) delete obj[last]; else obj[last] = val;
  }
  function readInput(el) {
    const k = el.dataset.k || "s";
    if (el.type === "checkbox") return el.checked;
    if (k === "n") return el.value === "" ? 0 : +el.value;
    if (k === "on") return el.value === "" || +el.value === 0 ? undefined : +el.value; // необов'язкове число
    if (k === "lines") return el.value.split("\n").map((x) => x.trim()).filter(Boolean);
    if (k === "os") return el.value.trim() === "" ? undefined : el.value; // необов'язковий текст
    return el.value;
  }

  /* ---------- підтвердження без confirm(): друге натискання ---------- */
  function armed(btn) {
    if (btn.classList.contains("is-armed")) return true;
    $$(".is-armed").forEach((b) => { b.classList.remove("is-armed"); b.textContent = b.dataset.label; });
    btn.dataset.label = btn.textContent;
    btn.classList.add("is-armed");
    btn.textContent = "Точно? Натисніть ще раз";
    setTimeout(() => { if (btn.isConnected && btn.classList.contains("is-armed")) { btn.classList.remove("is-armed"); btn.textContent = btn.dataset.label; } }, 3500);
    return false;
  }

  /* ---------- перевірки ---------- */
  function issues() {
    const out = [];
    const ids = new Map();
    S.products.forEach((p, i) => {
      const nm = p.name || `товар №${i + 1}`;
      if (!p.name) out.push([i, `Товар №${i + 1}: немає назви`]);
      if (!p.id) out.push([i, `${nm}: немає ID (посилання)`]);
      else if (ids.has(p.id)) out.push([i, `${nm}: ID «${p.id}» вже є в іншого товару`]);
      ids.set(p.id, i);
      if (!/^[a-z0-9-]*$/.test(p.id || "")) out.push([i, `${nm}: ID має бути латиницею, цифрами і дефісами`]);
      if (!p.images.length) out.push([i, `${nm}: немає жодного фото — на сайті товар не показується`]);
      const g = S.groups.find((x) => x.id === p.group);
      if (!g) out.push([i, `${nm}: не вибрана група`]);
      if (!p.colors.length) out.push([i, `${nm}: немає кольорів (буде «Базовий»)`]);
      p.colors.forEach((c, ci) => {
        if (!c.name) out.push([i, `${nm}: колір №${ci + 1} без назви`]);
        if (+c.img >= p.images.length && p.images.length) out.push([i, `${nm}: колір «${c.name}» посилається на фото, якого немає`]);
      });
      const d = +(p.discount || 0);
      if (d < 0 || d > 90) out.push([i, `${nm}: знижка має бути від 0 до 90%`]);
      if (g && !(+p.price || +g.price)) out.push([i, `${nm}: немає ціни (ні в товарі, ні в групі)`]);
    });
    S.groups.forEach((g) => {
      if (!S.sizes[g.size]) out.push([null, `Група «${g.title}»: не вибрана розмірна сітка`]);
      if (!+g.price) out.push([null, `Група «${g.title}»: не вказана ціна`]);
    });
    if (!S.config.managerUsername) out.push([null, "Не вказаний Telegram менеджера — замовлення нікуди не підуть"]);
    if (!S.delivery.length) out.push([null, "Немає жодного способу доставки"]);
    if (!S.payment.length) out.push([null, "Немає жодного способу оплати"]);
    return out;
  }
  function issuesHTML() {
    const list = issues();
    if (!list.length) return '<p class="ok-line">✓ Помилок не знайдено.</p>';
    return `<ul class="issues">${list.map(([i, t]) => `<li>⚠ ${esc(t)}${i !== null ? ` <button class="b b--sm" data-a="prod-sel" data-i="${i}" type="button">Відкрити</button>` : ""}</li>`).join("")}</ul>`;
  }

  /* ---------- рендер ---------- */
  const groupOptions = (cur) => S.groups.map((g) => `<option value="${esc(g.id)}"${g.id === cur ? " selected" : ""}>${esc(g.title)}</option>`).join("");
  const field = (label, path, opts = {}) => {
    const v = getPath(path);
    const attrs = `data-b="${esc(path)}" data-k="${opts.k || "s"}"${opts.ph ? ` placeholder="${esc(opts.ph)}"` : ""}${opts.min !== undefined ? ` min="${opts.min}"` : ""}${opts.max !== undefined ? ` max="${opts.max}"` : ""}`;
    let input;
    if (opts.area) input = `<textarea ${attrs} rows="${opts.rows || 3}">${esc(opts.k === "lines" ? (v || []).join("\n") : v)}</textarea>`;
    else input = `<input type="${opts.type || "text"}" ${attrs} value="${esc(v ?? "")}">`;
    return `<label class="f"><span>${esc(label)}</span>${input}${opts.help ? `<small>${esc(opts.help)}</small>` : ""}</label>`;
  };
  const check = (label, path) => `<label class="chk"><input type="checkbox" data-b="${esc(path)}"${getPath(path) ? " checked" : ""}> ${esc(label)}</label>`;
  const finalPrice = (p) => {
    const g = S.groups.find((x) => x.id === p.group) || {};
    const base = +(p.price || g.price || 0);
    const d = clamp(+(p.discount || g.discount || S.config.globalDiscount || 0), 0, 90);
    return { base, d, final: Math.round(base * (1 - d / 100)) };
  };
  const priceText = (p) => { const x = finalPrice(p); return x.d ? `<span class="price-old">${money(x.base, S.config.currency)}</span>${money(x.final, S.config.currency)} (−${x.d}%)` : money(x.final, S.config.currency); };

  function render() {
    $$("#tabs button").forEach((b) => b.classList.toggle("is-on", b.dataset.tab === tab));
    const locked = needLogin();
    document.body.classList.toggle("is-locked", locked);
    if (locked) tab = "online";
    const R = { products: rProducts, prices: rPrices, groups: rGroups, sizes: rSizes, delivery: rDelivery, texts: rTexts, company: rCompany, online: rOnline, help: rHelp };
    $("#main").innerHTML = R[tab]();
    $("#btnSave").textContent = gh.ok ? "🚀 Опублікувати зміни" : "💾 Зберегти data.js";
    setStatus();
  }

  function listHTML() {
    return S.products.map((p, i) => {
      const g = S.groups.find((x) => x.id === p.group);
      const fp = finalPrice(p);
      return `<button class="pitem${i === sel ? " is-on" : ""}" data-a="prod-sel" data-i="${i}" type="button">
        ${p.images[0] ? `<img src="${esc(img(p.images[0], true))}" alt="">` : '<span style="width:48px;height:60px;background:#222"></span>'}
        <span><b>${esc(p.name || "Без назви")}</b><small>${esc(g ? g.title : "без групи")} · ${money(fp.final, S.config.currency)}</small></span>
        <span class="tags">${p.hidden ? '<span class="tag">прихований</span>' : ""}${p.soldOut ? '<span class="tag tag--warn">немає</span>' : ""}${fp.d ? `<span class="tag tag--red">−${fp.d}%</span>` : ""}${p.featured ? '<span class="tag">топ</span>' : ""}</span>
      </button>`;
    }).join("");
  }

  function rProducts() {
    sel = clamp(sel, 0, Math.max(0, S.products.length - 1));
    const p = S.products[sel];
    return `
      <h1>Товари</h1>
      <p class="hint">Додавайте, змінюйте, приховуйте товари. Порядок у списку = порядок на сайті. Усі зміни одразу видно на «Переглянути сайт».</p>
      ${issuesHTML()}
      <div class="prod">
        <div>
          <div class="row" style="margin-bottom:10px"><button class="b b--red" data-a="prod-add" type="button">＋ Новий товар</button></div>
          <div class="plist" id="plist">${listHTML()}</div>
        </div>
        <div>${p ? editorHTML(p, sel) : '<div class="empty">Немає товарів. Натисніть «Новий товар».</div>'}</div>
      </div>`;
  }

  function editorHTML(p, i) {
    const P = `products.${i}`;
    const g = S.groups.find((x) => x.id === p.group);
    const chart = g && S.sizes[g.size];
    const all = chart ? chart.rows.map((r) => String(r[0])) : [];
    const own = p.sizes.map(String);
    const techs = Object.keys(S.techInfo);
    return `
      <div class="panel">
        <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:14px">
          <h2 style="margin:0">${esc(p.name || "Новий товар")}</h2>
          <div class="ord">
            <button class="b b--sm" data-a="prod-up" type="button" ${i === 0 ? "disabled" : ""} title="Вище">↑</button>
            <button class="b b--sm" data-a="prod-down" type="button" ${i === S.products.length - 1 ? "disabled" : ""} title="Нижче">↓</button>
            <button class="b b--sm" data-a="prod-dup" type="button">Дублювати</button>
            <a class="b b--sm" href="index.html?draft#p-${esc(p.id)}" target="_blank" rel="noopener">Відкрити на сайті</a>
            <button class="b b--sm b--danger" data-a="prod-del" type="button">Видалити</button>
          </div>
        </div>
        <div class="row">
          ${field("Назва", `${P}.name`)}
          <label class="f"><span>Група</span><select data-b="${P}.group">${groupOptions(p.group)}</select></label>
        </div>
        <div class="row">
          ${field("ID для посилання (латиниця)", `${P}.id`, { help: `Адреса товару: index.html#p-${p.id || "…"}. Якщо змінити — старі посилання перестануть працювати.` })}
          ${field("Тип (підпис)", `${P}.type`, { ph: "Худі оверсайз" })}
        </div>
        ${field("Опис", `${P}.desc`, { area: true })}
        <div class="row">
          <label class="f"><span>Нанесення</span><select data-b="${P}.tech">${["", ...techs].map((t) => `<option value="${esc(t)}"${t === (p.tech || "") ? " selected" : ""}>${esc(t || "— не вказано —")}</option>`).join("")}</select><small>Варіанти редагуються в «Контакти і тексти».</small></label>
          ${field("Матеріал (необов'язково)", `${P}.material`, { k: "os", ph: g && g.material ? g.material : "як у групі / уточнюйте у менеджера" })}
        </div>
      </div>

      <div class="panel">
        <h2>Ціна і наявність</h2>
        <div class="row">
          ${field("Власна ціна, грн", `${P}.price`, { type: "number", k: "on", min: 0, ph: g ? `${g.price} (ціна групи)` : "", help: "Порожньо = ціна групи" })}
          ${field("Знижка, %", `${P}.discount`, { type: "number", k: "on", min: 0, max: 90, ph: "0", help: "Порожньо = знижка групи/магазину" })}
          <div class="f"><span>Ціна на сайті</span><div class="num" id="pfinal" style="font:600 18px var(--display);padding:8px 0">${priceText(p)}</div></div>
        </div>
        <div class="chips">${check("Показувати у вітрині «The drop»", `${P}.featured`)}${check("Немає в наявності", `${P}.soldOut`)}${check("Приховати з сайту", `${P}.hidden`)}</div>
      </div>

      <div class="panel">
        <h2>Розміри</h2>
        <p class="hint">Зніміть галочку з розміру, якого немає для цього товару. Самі розміри (S, M…) і заміри — у «Розмірні сітки».</p>
        ${all.length ? `<div class="chips">${all.map((s) => `<label class="chk"><input type="checkbox" data-a="size" value="${esc(s)}"${!own.length || own.includes(s) ? " checked" : ""}> ${esc(s)}</label>`).join("")}</div>` : '<p class="hint">Для групи цього товару не вибрана розмірна сітка.</p>'}
      </div>

      <div class="panel">
        <h2>Фото</h2>
        <p class="hint">Перше фото — головне в каталозі, друге показується при наведенні. Перетягніть файли на «＋» або натисніть на нього.${dir ? " Фото зберігаються у папку assets/img." : " ⚠ Папка сайту не підключена — нові фото вбудовуються в data.js (файл стає важчим). Краще натисніть «Підключити папку сайту»."}</p>
        <div class="imgs">
          ${p.images.map((n, k) => `
            <div class="im"><span class="im__n">${k + 1}</span><img src="${esc(img(n, true))}" alt="">
              <div class="im__bar">
                <button type="button" data-a="img-left" data-k="${k}" title="Лівіше" ${k === 0 ? "disabled" : ""}>←</button>
                <button type="button" data-a="img-right" data-k="${k}" title="Правіше" ${k === p.images.length - 1 ? "disabled" : ""}>→</button>
                <button type="button" data-a="img-del" data-k="${k}" title="Прибрати">✕</button>
              </div></div>`).join("")}
          <label class="drop" id="drop">＋<br>Додати фото<input type="file" accept="image/*" multiple data-a="img-upload"></label>
        </div>
        <div class="row" style="margin-top:12px">
          <label class="f"><span>Або додати фото, що вже є на сайті</span>
            <select data-a="img-existing"><option value="">— вибрати —</option>${library().map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("")}</select></label>
        </div>
      </div>

      <div class="panel">
        <h2>Кольори</h2>
        <p class="hint">Кружечок на сайті: основний колір = тканина, акцент = колір малюнка (необов'язково). «Фото» — яке фото показати, коли обрано цей колір.</p>
        <div class="colors">
          ${p.colors.map((c, k) => `
            <div class="crow">
              <input type="text" data-b="${P}.colors.${k}.name" value="${esc(c.name)}" placeholder="Назва кольору" aria-label="Назва кольору">
              <label>тканина <input type="color" data-b="${P}.colors.${k}.hex" value="${esc(toHex(c.hex))}"></label>
              <label><input type="checkbox" data-a="accent" data-k="${k}"${c.accent ? " checked" : ""}> акцент</label>
              ${c.accent ? `<input type="color" data-b="${P}.colors.${k}.accent" value="${esc(toHex(c.accent))}" aria-label="Колір акценту">` : "<span></span>"}
              <label>фото <select data-b="${P}.colors.${k}.img" data-k="n">${p.images.map((_, m) => `<option value="${m}"${+c.img === m ? " selected" : ""}>№${m + 1}</option>`).join("") || '<option value="0">немає фото</option>'}</select></label>
              <span style="display:flex;gap:6px;align-items:center"><span class="cprev" style="background:${esc(c.hex)};${c.accent ? `--a:${esc(c.accent)}` : ""}"></span><button class="b b--sm b--danger" type="button" data-a="color-del" data-k="${k}">✕</button></span>
            </div>`).join("")}
        </div>
        <button class="b" style="margin-top:10px" type="button" data-a="color-add">＋ Колір</button>
      </div>`;
  }
  function toHex(c) {
    if (/^#[0-9a-f]{6}$/i.test(c || "")) return c;
    if (/^#[0-9a-f]{3}$/i.test(c || "")) return "#" + c.slice(1).split("").map((x) => x + x).join("");
    return "#111111";
  }
  function library() {
    const set = new Set();
    [...ORIGINAL.products || [], ...S.products].forEach((p) => (p.images || []).forEach((n) => { if (!/^data:/.test(n)) set.add(n); }));
    return [...set].sort();
  }

  function rPrices() {
    const C = S.config;
    return `
      <h1>Ціни і знижки</h1>
      <p class="hint">Ціна товару береться так: власна ціна товару, а якщо її немає — ціна групи. Знижка: знижка товару → знижка групи → знижка на весь магазин (перша, що не 0). На сайті показується стара ціна закресленою і бейдж «−N%».</p>
      <div class="panel"><div class="row">
        ${field("Знижка на ВЕСЬ магазин, %", "config.globalDiscount", { type: "number", k: "n", min: 0, max: 90, help: "0 = без знижки" })}
        ${field("Валюта", "config.currency")}
      </div></div>
      <div class="panel"><h2>Групи</h2>
        <table class="t"><thead><tr><th>Група</th><th>Ціна, грн</th><th>Знижка групи, %</th></tr></thead><tbody>
        ${S.groups.map((g, i) => `<tr><td>${esc(g.title)}</td>
          <td><input type="number" min="0" data-b="groups.${i}.price" data-k="n" value="${esc(g.price)}"></td>
          <td><input type="number" min="0" max="90" data-b="groups.${i}.discount" data-k="on" value="${esc(g.discount || "")}" placeholder="0"></td></tr>`).join("")}
        </tbody></table></div>
      <div class="panel"><h2>Товари</h2>
        <table class="t"><thead><tr><th>Товар</th><th>Власна ціна</th><th>Знижка, %</th><th>На сайті</th></tr></thead><tbody>
        ${S.products.map((p, i) => `<tr><td>${esc(p.name)}</td>
          <td><input type="number" min="0" data-b="products.${i}.price" data-k="on" value="${esc(p.price || "")}" placeholder="як у групі"></td>
          <td><input type="number" min="0" max="90" data-b="products.${i}.discount" data-k="on" value="${esc(p.discount || "")}" placeholder="—"></td>
          <td class="num" data-final="${i}">${priceText(p)}</td></tr>`).join("")}
        </tbody></table></div>`;
  }

  function rGroups() {
    const charts = Object.keys(S.sizes);
    return `
      <h1>Групи каталогу</h1>
      <p class="hint">Групи — це розділи каталогу (Футболки, Світшоти, Худі). Кожна група має ціну за замовчуванням і свою розмірну сітку.</p>
      ${S.groups.map((g, i) => {
        const used = S.products.filter((p) => p.group === g.id).length;
        return `<div class="panel">
          <div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">${esc(g.title || "Нова група")}</h2>
            <div class="ord"><button class="b b--sm" data-a="group-up" data-i="${i}" type="button" ${i ? "" : "disabled"}>↑</button><button class="b b--sm" data-a="group-down" data-i="${i}" type="button" ${i < S.groups.length - 1 ? "" : "disabled"}>↓</button>
            <button class="b b--sm b--danger" data-a="group-del" data-i="${i}" type="button" ${used ? `disabled title="У групі ${used} товар(ів)"` : ""}>Видалити</button></div></div>
          <div class="row" style="margin-top:12px">
            ${field("Назва", `groups.${i}.title`)}
            ${field("Підпис латиницею", `groups.${i}.latin`)}
            ${field("Ціна, грн", `groups.${i}.price`, { type: "number", k: "n", min: 0 })}
          </div>
          <div class="row">
            <label class="f"><span>Розмірна сітка</span><select data-b="groups.${i}.size">${charts.map((k) => `<option value="${esc(k)}"${k === g.size ? " selected" : ""}>${esc(S.sizes[k].ua || k)}</option>`).join("")}</select></label>
            ${field("Матеріал (для всіх товарів групи)", `groups.${i}.material`, { ph: "напр. 100% бавовна, 320 г/м²" })}
          </div>
          <p class="hint" style="margin:0">ID: ${esc(g.id)} · товарів: ${used}</p>
        </div>`;
      }).join("")}
      <button class="b b--red" data-a="group-add" type="button">＋ Нова група</button>`;
  }

  function rSizes() {
    return `
      <h1>Розмірні сітки</h1>
      <p class="hint">Перша колонка — назва розміру (S, M…). Якщо видалити рядок, цей розмір зникне з усіх товарів групи. Щоб прибрати розмір лише в одного товару — зніміть галочку в «Товари → Розміри».</p>
      ${Object.entries(S.sizes).map(([key, s]) => `
        <div class="panel">
          <div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">${esc(s.ua || key)}</h2>
            <button class="b b--sm b--danger" data-a="chart-del" data-key="${esc(key)}" type="button" ${S.groups.some((g) => g.size === key) ? 'disabled title="Сітка використовується групою"' : ""}>Видалити сітку</button></div>
          <div class="row" style="margin-top:12px">
            ${field("Назва (укр.)", `sizes.${key}.ua`)}
            ${field("Заголовок (англ.)", `sizes.${key}.title`)}
            ${field("Картинка-схема (шлях)", `sizes.${key}.image`, { ph: "assets/img/size-hoodie.jpg" })}
          </div>
          <table class="t"><thead><tr>${s.cols.map((c, ci) => `<th><input type="text" data-b="sizes.${key}.cols.${ci}" value="${esc(c)}">${ci ? `<button class="b b--sm b--ghost" data-a="col-del" data-key="${esc(key)}" data-ci="${ci}" type="button" title="Видалити колонку">✕</button>` : ""}</th>`).join("")}<th><button class="b b--sm" data-a="col-add" data-key="${esc(key)}" type="button">＋ колонка</button></th></tr></thead>
          <tbody>${s.rows.map((r, ri) => `<tr>${s.cols.map((_, ci) => `<td><input type="text" data-b="sizes.${key}.rows.${ri}.${ci}" value="${esc(r[ci] ?? "")}"></td>`).join("")}
            <td class="ord"><button class="b b--sm" data-a="row-up" data-key="${esc(key)}" data-ri="${ri}" type="button" ${ri ? "" : "disabled"}>↑</button><button class="b b--sm b--danger" data-a="row-del" data-key="${esc(key)}" data-ri="${ri}" type="button">✕</button></td></tr>`).join("")}</tbody></table>
          <button class="b" style="margin-top:10px" data-a="row-add" data-key="${esc(key)}" type="button">＋ Розмір</button>
          ${field("Примітка під таблицею", `sizes.${key}.note`, { area: true, rows: 2 })}
        </div>`).join("")}
      <button class="b b--red" data-a="chart-add" type="button">＋ Нова розмірна сітка</button>`;
  }

  function rDelivery() {
    return `
      <h1>Доставка і оплата</h1>
      <p class="hint">Ці варіанти покупець бачить у формі замовлення, і вони потрапляють у повідомлення менеджеру.</p>
      <div class="panel"><h2>Доставка</h2>
        <table class="t"><thead><tr><th>Перевізник</th><th>Спосіб</th><th>Що просимо вказати</th><th></th></tr></thead><tbody>
        ${S.delivery.map((d, i) => `<tr>
          <td><input type="text" data-b="delivery.${i}.carrier" value="${esc(d.carrier)}"></td>
          <td><input type="text" data-b="delivery.${i}.label" value="${esc(d.label)}"></td>
          <td><input type="text" data-b="delivery.${i}.field" value="${esc(d.field)}"></td>
          <td><button class="b b--sm b--danger" data-a="deliv-del" data-i="${i}" type="button">✕</button></td></tr>`).join("")}
        </tbody></table>
        <button class="b" style="margin-top:10px" data-a="deliv-add" type="button">＋ Спосіб доставки</button></div>
      <div class="panel"><h2>Оплата</h2>
        ${S.payment.map((p, i) => `<div class="row">${field("Назва", `payment.${i}.label`)}${field("Пояснення для покупця", `payment.${i}.note`)}<div style="flex:0 0 auto"><button class="b b--sm b--danger" data-a="pay-del" data-i="${i}" type="button" style="margin-bottom:12px">✕</button></div></div>`).join("")}
        <button class="b" data-a="pay-add" type="button">＋ Спосіб оплати</button></div>`;
  }

  function rTexts() {
    return `
      <h1>Контакти і тексти</h1>
      <div class="panel"><h2>Контакти</h2><div class="row">
        ${field("Telegram-канал (посилання)", "config.telegramChannel", { type: "url" })}
        ${field("Telegram менеджера (без @)", "config.managerUsername", { help: "Сюди приходять замовлення з кошика" })}
      </div><div class="row">
        ${field("Instagram (посилання)", "config.instagram", { type: "url" })}
        ${field("Instagram (нік для підпису)", "config.instagramName")}
      </div></div>
      <div class="panel"><h2>Тексти на сайті</h2>
        ${field("Слоган під логотипом (кожен рядок — окрема частина; 🇺🇦 замінюється на прапор)", "config.tagline", { area: true, k: "lines", rows: 2 })}
        ${field("Бігучий рядок (кожна фраза з нового рядка)", "config.marquee", { area: true, k: "lines", rows: 5 })}
      </div>
      <div class="panel"><h2>Види нанесення</h2>
        <p class="hint">Показуються в картці товару в блоці «З чого зроблено».</p>
        ${Object.entries(S.techInfo).map(([k, v], i) => `<div class="row">
          <label class="f" style="flex:0 1 220px"><span>Назва</span><input type="text" data-a="tech-key" data-old="${esc(k)}" value="${esc(k)}"></label>
          <label class="f"><span>Пояснення</span><input type="text" data-b="techInfo.${esc(k)}" value="${esc(v)}"></label>
          <div style="flex:0 0 auto"><button class="b b--sm b--danger" data-a="tech-del" data-key="${esc(k)}" type="button" style="margin-bottom:12px">✕</button></div></div>`).join("")}
        <button class="b" data-a="tech-add" type="button">＋ Вид нанесення</button>
      </div>`;
  }

  function rCompany() {
    return `
      <h1>Реквізити продавця</h1>
      <p class="hint">Показуються внизу сайту та в Політиці конфіденційності / Умовах. Для інтернет-продажу в Україні їх треба заповнити.</p>
      <div class="panel">
        ${field("Продавець (напр. ФОП Прізвище Ім'я По батькові)", "config.company.seller")}
        <div class="row">${field("РНОКПП / ЄДРПОУ", "config.company.taxId")}${field("Телефон", "config.company.phone")}</div>
        <div class="row">${field("E-mail", "config.company.email", { type: "text" })}${field("Адреса", "config.company.address")}</div>
        ${field("Дата редакції документів", "config.policyUpdated", { ph: "28.10.2026" })}
      </div>`;
  }

  function rHelp() {
    return `
      <div class="help">
      <h1>Як це працює</h1>
      <ol>
        <li>Змінюйте що завгодно в розділах ліворуч. Кожна зміна одразу зберігається як <b>чернетка</b> у цьому браузері.</li>
        <li>Кнопка <b>«Переглянути сайт»</b> відкриває сайт з вашими змінами (адреса <code>index.html?draft</code>). Звичайні відвідувачі чернетку не бачать.</li>
        <li>Коли все готово — <b>«Зберегти data.js»</b>.
          <ul>
            <li>У Chrome / Edge спочатку натисніть <b>«Підключити папку сайту»</b> і виберіть папку <code>reptyry</code> (де лежать index.html і data.js). Тоді файл і нові фото записуються туди самі.</li>
            <li>Інакше браузер завантажить файл <code>data.js</code> — покладіть його в папку сайту замість старого.</li>
          </ul></li>
        <li>Якщо адмінка підключена до GitHub (розділ <b>«Сайт в інтернеті»</b>), кнопка вгорі називається <b>«Опублікувати зміни»</b>: зміни потрапляють на сайт самі, покупці бачать їх за кілька хвилин.</li>
      </ol>
      <h2>Резервна копія</h2>
      <p>Перед великими змінами збережіть копію поточного файлу.</p>
      <div class="row" style="max-width:700px">
        <button class="b" data-a="backup" type="button">⬇ Завантажити копію data.js</button>
        <button class="b b--danger" data-a="reset" type="button">Відкинути чернетку (повернути як у data.js)</button>
      </div>
      <h2 style="margin-top:24px">Безпека</h2>
      <p>Змінювати сайт може лише той, у кого є ваш ключ GitHub. Без ключа адмінка в інтернеті нічого не відкриває і нічого не зберігає. Ключ зберігається тільки в браузері, де ви увійшли; на чужому комп'ютері натисніть «Вийти і забути ключ».</p>
      </div>`;
  }

  /* ---------- сайт в інтернеті (GitHub Pages) ---------- */
  function rOnline() {
    const lock = needLogin();
    const site = siteURL();
    const gf = (label, k, ph) => `<label class="f"><span>${label}</span><input type="text" data-gh="${k}" value="${esc(gh[k])}" placeholder="${esc(ph)}" autocomplete="off" spellcheck="false"></label>`;
    const dis = gh.busy ? " disabled" : "";
    return `
      <h1>${lock ? "Вхід для власника" : "Сайт в інтернеті"}</h1>
      ${lock ? '<p class="lock">🔒 Редагувати магазин може тільки власник. Увійдіть своїм ключем GitHub.</p>' : '<p class="hint">Сайт лежить на GitHub Pages (безкоштовно). Адмінка зберігає зміни прямо туди, сайт оновлюється сам.</p>'}
      <div class="panel">
        <h2>${gh.ok ? "✓ Підключено до GitHub" : "Підключення"}</h2>
        <div class="row">${gf("Логін GitHub", "owner", "напр. reptyry")}${gf("Репозиторій", "repo", "reptyry")}${gf("Гілка", "branch", "main")}</div>
        <label class="f"><span>Ключ доступу (token)</span><input type="password" data-gh="token" value="${esc(gh.token)}" placeholder="github_pat_…" autocomplete="off"><small>Зберігається тільки в цьому браузері. Нікому не пересилайте його, навіть Claude.</small></label>
        <div class="row" style="max-width:640px">
          <button class="b b--red" data-a="gh-connect" type="button"${dis}>${gh.busy ? "Зачекайте…" : gh.ok ? "Перепідключити" : "Увійти"}</button>
          ${gh.token ? '<button class="b b--danger" data-a="gh-logout" type="button">Вийти і забути ключ</button>' : ""}
        </div>
        ${!gh.ok && /^✗/.test(gh.log) ? `<p class="err-line" role="alert">${esc(gh.log)}</p>` : ""}
        ${gh.ok ? `<p class="ok-line" style="margin:14px 0 0">Сайт для покупців: ${site ? `<a href="${esc(site)}" target="_blank" rel="noopener">${esc(site)}</a>` : "—"}<br>Адмінка: ${site ? `<a href="${esc(site)}admin.html" target="_blank" rel="noopener">${esc(site)}admin.html</a>` : "—"}<br>${gh.remoteSha ? "Дані завантажено з GitHub." : "На GitHub ще немає файлів сайту — розмістіть їх нижче."}</p>` : ""}
      </div>
      ${gh.ok ? `
      <div class="panel">
        <h2>Файли сайту</h2>
        <p class="hint">Перший раз, а також коли Claude оновив дизайн чи код: натисніть угорі «📁 Підключити папку сайту», виберіть папку <code>reptyry</code> і натисніть «Розмістити». Завантажуються лише змінені файли. Тестові файли (<code>_…</code>) не публікуються.</p>
        <div class="row" style="max-width:900px">
          <button class="b b--red" data-a="gh-deploy" type="button"${dis}>⬆ Розмістити / оновити файли</button>
          <button class="b" data-a="gh-pages" type="button"${dis}>🌐 Увімкнути GitHub Pages</button>
          <button class="b" data-a="gh-pull" type="button"${dis}>⟳ Завантажити актуальні дані</button>
        </div>
        <pre class="log" id="ghLog">${esc(gh.log)}</pre>
      </div>` : ""}
      <div class="panel help">
        <h2>Як підключити (один раз)</h2>
        <ol>
          <li>Зареєструйтесь на <a href="https://github.com/signup" target="_blank" rel="noopener">github.com</a>.</li>
          <li>Створіть репозиторій: <a href="https://github.com/new" target="_blank" rel="noopener">github.com/new</a> → назва <code>reptyry</code> → <b>Public</b> → Create repository.</li>
          <li>Створіть ключ: <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Fine-grained token</a> → Repository access: <b>Only select repositories → reptyry</b> → Permissions: <b>Contents — Read and write</b> і <b>Pages — Read and write</b> → Generate. Скопіюйте ключ.</li>
          <li>Тут: впишіть логін, <code>reptyry</code>, ключ → <b>Увійти</b>.</li>
          <li>«📁 Підключити папку сайту» → <b>Розмістити</b> → <b>Увімкнути GitHub Pages</b>. За 1–2 хвилини сайт відкриється за адресою <code>https://логін.github.io/reptyry/</code>.</li>
          <li>Далі редагуйте з будь-якого пристрою за адресою <code>…/reptyry/admin.html</code>. Покупці адмінку не бачать: без ключа вона закрита.</li>
        </ol>
      </div>`;
  }

  /* ---------- події ---------- */
  $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) { tab = b.dataset.tab; render(); scrollTo(0, 0); } });

  const main = $("#main");
  function onField(e) {
    const el = e.target;
    if (!el.dataset.b) return;
    const path = el.dataset.b;
    setPath(path, readInput(el));
    // ID товару: тільки латиниця
    if (/^products\.\d+\.id$/.test(path)) { const v = slug(el.value); if (v !== el.value && e.type === "change") { el.value = v; setPath(path, v); } }
    commit();
    // точкові оновлення без перерисовки (щоб не губився фокус)
    if (tab === "products") {
      $("#plist").innerHTML = listHTML();
      const p = S.products[sel];
      if (p && $("#pfinal")) $("#pfinal").innerHTML = priceText(p);
      if (e.type === "change" && /\.(group|hex|accent|img|featured|soldOut|hidden)$/.test(path)) render();
    }
    if (tab === "prices") $$("[data-final]").forEach((td) => { td.innerHTML = priceText(S.products[+td.dataset.final]); });
    if (e.type === "change" && tab === "groups" && /\.title$/.test(path)) render();
  }
  main.addEventListener("input", onField);
  main.addEventListener("input", (e) => {
    const k = e.target.dataset.gh;
    if (!k) return;
    gh[k] = e.target.value.trim();
    if (gh.ok) { gh.ok = false; gh.remoteSha = undefined; } // змінили підключення — треба увійти знову
    saveGh();
  });
  main.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.dataset.gh) connect(); });
  main.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.b) { if (el.type === "checkbox" || el.tagName === "SELECT" || el.type === "color" || /\.id$/.test(el.dataset.b)) onField(e); return; }
    const a = el.dataset.a, p = S.products[sel];
    if (a === "size") {
      const boxes = $$('input[data-a="size"]', main);
      const on = boxes.filter((b) => b.checked).map((b) => b.value);
      if (!on.length) { el.checked = true; toast("Має залишитися хоча б один розмір", true); return; }
      p.sizes = on.length === boxes.length ? [] : on;
      commit();
    } else if (a === "accent") {
      const c = p.colors[+el.dataset.k];
      if (el.checked) c.accent = "#c8102e"; else delete c.accent;
      commit(); render();
    } else if (a === "img-existing" && el.value) {
      p.images.push(el.value); commit(); render();
    } else if (a === "img-upload") {
      upload([...el.files]);
    } else if (a === "tech-key") {
      const old = el.dataset.old, nk = el.value.trim();
      if (!nk || nk === old) return;
      if (S.techInfo[nk] !== undefined) { toast("Така назва вже є", true); el.value = old; return; }
      S.techInfo = Object.fromEntries(Object.entries(S.techInfo).map(([k, v]) => [k === old ? nk : k, v]));
      S.products.forEach((x) => { if (x.tech === old) x.tech = nk; });
      commit(); render();
    }
  });

  const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return false; [arr[i], arr[j]] = [arr[j], arr[i]]; return true; };
  main.addEventListener("click", (e) => {
    const b = e.target.closest("[data-a]");
    if (!b || b.tagName === "INPUT" || b.tagName === "SELECT") return;
    const a = b.dataset.a, p = S.products[sel];
    const i = +b.dataset.i, k = +b.dataset.k, key = b.dataset.key;
    const done = () => { commit(); render(); };
    switch (a) {
      case "prod-sel": sel = i; tab = "products"; render(); scrollTo(0, 0); return;
      case "prod-add": {
        const g = S.groups[0];
        let id = "new-item", n = 1;
        while (S.products.some((x) => x.id === id)) id = `new-item-${++n}`;
        S.products.unshift({ id, group: g ? g.id : "", name: "Новий товар", type: "", tech: "", desc: "", images: [], colors: [{ name: "Чорний", hex: "#111111", img: 0 }], sizes: [] });
        sel = 0; done(); toast("Додано новий товар — заповніть назву, ID і фото");
        return;
      }
      case "prod-dup": {
        const c = clone(p); let id = `${p.id}-copy`, n = 1;
        while (S.products.some((x) => x.id === id)) id = `${p.id}-copy-${++n}`;
        c.id = id; c.name = `${p.name} (копія)`;
        S.products.splice(sel + 1, 0, c); sel++; done(); return;
      }
      case "prod-del": if (!armed(b)) return; S.products.splice(sel, 1); sel = Math.max(0, sel - 1); done(); toast("Товар видалено"); return;
      case "prod-up": if (move(S.products, sel, -1)) { sel--; done(); } return;
      case "prod-down": if (move(S.products, sel, 1)) { sel++; done(); } return;
      case "img-left": case "img-right": {
        const d = a === "img-left" ? -1 : 1;
        if (move(p.images, k, d)) p.colors.forEach((c) => { if (+c.img === k) c.img = k + d; else if (+c.img === k + d) c.img = k; });
        done(); return;
      }
      case "img-del":
        p.images.splice(k, 1);
        p.colors.forEach((c) => { if (+c.img === k) c.img = 0; else if (+c.img > k) c.img = +c.img - 1; });
        done(); return;
      case "color-add": p.colors.push({ name: "Новий колір", hex: "#111111", img: 0 }); done(); return;
      case "color-del": p.colors.splice(k, 1); done(); return;
      case "group-add": {
        let id = "group", n = 1; while (S.groups.some((g) => g.id === id)) id = `group-${++n}`;
        S.groups.push({ id, title: "Нова група", latin: "", size: Object.keys(S.sizes)[0] || "", price: 0, material: "" }); done(); return;
      }
      case "group-del": if (!armed(b)) return; S.groups.splice(i, 1); done(); return;
      case "group-up": move(S.groups, i, -1); done(); return;
      case "group-down": move(S.groups, i, 1); done(); return;
      case "chart-add": {
        let id = "chart", n = 1; while (S.sizes[id]) id = `chart-${++n}`;
        S.sizes[id] = { title: "Size chart", ua: "Нова сітка", image: "", cols: ["Розмір", "A — довжина, см", "B — ширина, см"], rows: [["S", "", ""], ["M", "", ""], ["L", "", ""]], note: "" };
        done(); return;
      }
      case "chart-del": if (!armed(b)) return; delete S.sizes[key]; done(); return;
      case "row-add": { const s = S.sizes[key]; s.rows.push(s.cols.map((_, ci) => (ci ? "" : "?"))); done(); return; }
      case "row-del": {
        const s = S.sizes[key]; if (s.rows.length <= 1) { toast("Має залишитися хоча б один розмір", true); return; }
        const gone = String(s.rows[+b.dataset.ri][0]);
        s.rows.splice(+b.dataset.ri, 1);
        S.products.forEach((x) => { x.sizes = (x.sizes || []).filter((z) => String(z) !== gone); });
        done(); return;
      }
      case "row-up": move(S.sizes[key].rows, +b.dataset.ri, -1); done(); return;
      case "col-add": { const s = S.sizes[key]; s.cols.push("Нова колонка"); s.rows.forEach((r) => r.push("")); done(); return; }
      case "col-del": { const s = S.sizes[key], ci = +b.dataset.ci; s.cols.splice(ci, 1); s.rows.forEach((r) => r.splice(ci, 1)); done(); return; }
      case "deliv-add": {
        let id = "delivery", n = 1; while (S.delivery.some((d) => d.id === id)) id = `delivery-${++n}`;
        S.delivery.push({ id, carrier: "Нова Пошта", label: "У відділення", field: "Номер відділення" }); done(); return;
      }
      case "deliv-del": S.delivery.splice(i, 1); done(); return;
      case "pay-add": {
        let id = "pay", n = 1; while (S.payment.some((d) => d.id === id)) id = `pay-${++n}`;
        S.payment.push({ id, label: "Новий спосіб", note: "" }); done(); return;
      }
      case "pay-del": S.payment.splice(i, 1); done(); return;
      case "tech-add": { let nk = "Нове нанесення", n = 1; while (S.techInfo[nk] !== undefined) nk = `Нове нанесення ${++n}`; S.techInfo[nk] = ""; done(); return; }
      case "tech-del": delete S.techInfo[key]; S.products.forEach((x) => { if (x.tech === key) x.tech = ""; }); done(); return;
      case "gh-connect": connect(); return;
      case "gh-logout":
        gh.token = ""; gh.ok = false; gh.remoteSha = undefined; saveGh(); render(); toast("Ключ видалено з цього браузера"); return;
      case "gh-deploy": deploy(); return;
      case "gh-pages": run(async () => { await enablePages(); toast(gh.pages ? "GitHub Pages увімкнено" : "Pages не відповідає"); }); return;
      case "gh-pull":
        if (dirty && !armed(b)) { toast("Незбережена чернетка буде замінена даними з сайту. Натисніть ще раз, щоб підтвердити.", true); return; }
        run(async () => { await pull(false); toast(gh.remoteSha ? "Дані з сайту завантажено" : "На GitHub ще немає data.js"); }); return;
      case "backup": download(serialize(ORIGINAL), "data-backup.js"); return;
      case "reset":
        if (!armed(b)) return;
        S = clone(ORIGINAL); normalize(S); dirty = false;
        try { localStorage.removeItem(DRAFT_KEY); } catch (err) { /* */ }
        sel = 0; render(); toast("Чернетку відкинуто"); return;
      default:
    }
  });

  // перетягування фото
  main.addEventListener("dragover", (e) => { const d = e.target.closest("#drop"); if (d) { e.preventDefault(); d.classList.add("is-over"); } });
  main.addEventListener("dragleave", (e) => { const d = e.target.closest("#drop"); if (d) d.classList.remove("is-over"); });
  main.addEventListener("drop", (e) => {
    const d = e.target.closest("#drop");
    if (!d) return;
    e.preventDefault(); d.classList.remove("is-over");
    upload([...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")));
  });

  /* ---------- фото: стискаємо і зберігаємо ---------- */
  // через <img>, а не createImageBitmap: так враховується поворот фото з телефона (EXIF)
  function decode(blob) {
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(blob), i = new Image();
      i.onload = () => { URL.revokeObjectURL(u); res(i); };
      i.onerror = () => { URL.revokeObjectURL(u); rej(new Error("це не схоже на зображення")); };
      i.src = u;
    });
  }
  function scaled(im, max) {
    const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height, s = Math.min(1, max / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    return c;
  }
  const toBlob = (im, max, q) => new Promise((r) => scaled(im, max).toBlob(r, "image/jpeg", q));
  async function upload(files) {
    const p = S.products[sel];
    if (!p || !files.length) return;
    setStatus(`Обробляю фото (${files.length})…`);
    let ok = 0;
    for (const file of files) {
      try {
        const bmp = await decode(file);
        if (dir && !gh.ok) {
          const base = `${slug(p.id || p.name)}-${Date.now().toString(36)}${ok}`;
          const imgDir = await (await dir.getDirectoryHandle("assets", { create: true })).getDirectoryHandle("img", { create: true });
          for (const [suffix, max, q] of [["", 1600, 0.82], ["-sm", 720, 0.8]]) {
            const fh = await imgDir.getFileHandle(`${base}${suffix}.jpg`, { create: true });
            const w = await fh.createWritable(); await w.write(await toBlob(bmp, max, q)); await w.close();
          }
          p.images.push(base);
        } else {
          p.images.push(scaled(bmp, 1200).toDataURL("image/jpeg", 0.78));
        }
        ok++;
      } catch (err) { toast(`Не вдалося обробити «${file.name}»: ${err.message}`, true); }
    }
    commit(); render();
    if (ok) toast(`Додано фото: ${ok}`);
  }

  /* ---------- збереження ---------- */
  function serialize(data) {
    const d = clone(data);
    (d.products || []).forEach((p) => {
      ["price", "discount", "material"].forEach((k) => { if (p[k] === "" || p[k] === 0 || p[k] == null) delete p[k]; });
      ["featured", "soldOut", "hidden"].forEach((k) => { if (!p[k]) delete p[k]; });
      if (p.sizes && !p.sizes.length) delete p.sizes;
    });
    (d.groups || []).forEach((g) => { if (!g.discount) delete g.discount; });
    return `/* =========================================================
   REPTYRY — дані сайту. Згенеровано адмінкою (admin.html).
   Редагуйте через admin.html, щоб не зламати формат.
   ========================================================= */

window.REPTYRY = ${JSON.stringify(d, null, 2)};
`;
  }
  function download(text, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/javascript;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  $("#btnSave").addEventListener("click", async () => {
    if (gh.ok) { saveOnline(); return; }
    const list = issues();
    const text = serialize(S);
    if (dir) {
      try {
        const fh = await dir.getFileHandle("data.js", { create: false });
        const w = await fh.createWritable(); await w.write(text); await w.close();
        dirty = false;
        try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* */ }
        Object.assign(ORIGINAL, clone(S));
        setStatus(`✓ Збережено в папку сайту о ${new Date().toLocaleTimeString("uk-UA")}${list.length ? ` (попереджень: ${list.length})` : ""}`, "ok");
        toast("data.js збережено");
        return;
      } catch (e) { toast(`Не вдалося записати у папку: ${e.message}. Завантажую файл.`, true); }
    }
    download(text, "data.js");
    setStatus("⬇ Файл data.js завантажено — покладіть його в папку сайту замість старого. Чернетка залишається, поки ви її не відкинете.", "dirty");
  });
  $("#btnFolder").addEventListener("click", async () => {
    if (!window.showDirectoryPicker) { toast("Цей браузер не вміє записувати в папку. Відкрийте адмінку в Chrome або Edge — або зберігайте через завантаження файлу.", true); return; }
    try {
      const h = await window.showDirectoryPicker({ id: "reptyry", mode: "readwrite" });
      await h.getFileHandle("data.js");
      await h.getFileHandle("index.html");
      dir = h;
      $("#btnFolder").textContent = `📁 Папка: ${h.name}`;
      toast("Папку сайту підключено");
      render();
    } catch (e) {
      if (e.name !== "AbortError") toast("Оберіть саме папку сайту — ту, де лежать index.html і data.js", true);
    }
  });

  /* ================= GitHub: публікація сайту і збереження змін =================
     Сайт лежить у репозиторії GitHub і показується через GitHub Pages.
     Кожне збереження = один коміт (Git Data API): data.js + нові фото разом. */
  const API = "https://api.github.com";
  const gh = Object.assign({ owner: "", repo: "", branch: "", token: "" }, (() => { try { return JSON.parse(localStorage.getItem(GH_KEY)) || {}; } catch (e) { return {}; } })());
  Object.assign(gh, { ok: false, busy: false, pages: "", remoteSha: undefined, log: "", pace: 800, watch: true });
  if (!gh.owner && /\.github\.io$/i.test(location.hostname)) { // адмінка відкрита на самому сайті — підставляємо адресу
    gh.owner = location.hostname.split(".")[0];
    const seg = location.pathname.split("/").filter(Boolean)[0];
    gh.repo = seg && !/\.html?$/.test(seg) ? seg : location.hostname;
  }
  gh.repo = gh.repo || "reptyry";
  function saveGh() { try { localStorage.setItem(GH_KEY, JSON.stringify({ owner: gh.owner, repo: gh.repo, branch: gh.branch, token: gh.token })); } catch (e) { /* */ } }
  function needLogin() { return (/^https?:$/.test(location.protocol) || /[?&]lock\b/.test(location.search)) && !gh.ok; }
  const repoPath = () => `/repos/${encodeURIComponent(gh.owner)}/${encodeURIComponent(gh.repo)}`;
  function siteURL() {
    if (gh.pages) return gh.pages.replace(/\/?$/, "/");
    if (!gh.owner) return "";
    const root = gh.repo.toLowerCase() === `${gh.owner}.github.io`.toLowerCase();
    return `https://${gh.owner.toLowerCase()}.github.io/${root ? "" : gh.repo + "/"}`;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const enc = (s) => new TextEncoder().encode(s);
  function toB64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const fromB64 = (b) => new TextDecoder().decode(Uint8Array.from(atob(String(b).replace(/\s/g, "")), (c) => c.charCodeAt(0)));
  function ghMessage(status, j) {
    const m = (j && j.message) || "";
    if (status === 401) return "Ключ недійсний або прострочений. Створіть новий і увійдіть знову.";
    if (status === 403 && /rate limit/i.test(m)) return "GitHub тимчасово обмежив запити. Зачекайте хвилину і повторіть.";
    if (status === 403) return "Ключу бракує прав. Потрібні дозволи Contents: Read and write і Pages: Read and write для цього репозиторію.";
    if (status === 404) return `Не знайдено «${gh.owner}/${gh.repo}». Перевірте логін і назву репозиторію та що ключ має до нього доступ.`;
    return `GitHub: ${m || "помилка " + status}`;
  }
  async function api(path, opt = {}, tries = 0) {
    let r;
    try {
      r = await fetch(API + path, {
        method: opt.method || "GET", cache: "no-store",
        headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${gh.token}`, "X-GitHub-Api-Version": "2022-11-28", ...(opt.body ? { "Content-Type": "application/json" } : {}) },
        body: opt.body ? JSON.stringify(opt.body) : undefined,
      });
    } catch (e) { throw new Error("Немає зв'язку з GitHub. Перевірте інтернет."); }
    const j = r.status === 204 ? null : await r.json().catch(() => null);
    if ((r.status === 403 || r.status === 429) && /rate limit/i.test((j && j.message) || "") && tries < 3) {
      const wait = (+r.headers.get("retry-after") || 60) * 1000;
      logLine(`GitHub просить паузу ${Math.round(wait / 1000)} с…`);
      await sleep(wait);
      return api(path, opt, tries + 1);
    }
    if (!r.ok) { const e = new Error(ghMessage(r.status, j)); e.status = r.status; e.raw = j; throw e; }
    return j;
  }
  function logLine(t) {
    gh.log = t;
    const el = $("#ghLog"); if (el) el.textContent = t;
    setStatus(t);
  }
  async function run(fn) {
    if (gh.busy) return;
    gh.busy = true; gh.log = ""; render();
    try { await fn(); } catch (e) { setStatus(`✗ ${e.message}`, "err"); toast(e.message, true); gh.log = `✗ ${e.message}`; }
    gh.busy = false; render();
    if (/^✗/.test(gh.log)) setStatus(gh.log, "err");
    else if (/^✓/.test(gh.log)) setStatus(gh.log, "ok");
  }
  function parseData(text) {
    const box = {};
    new Function("window", text)(box);
    if (!box.REPTYRY || !Array.isArray(box.REPTYRY.products)) throw new Error("data.js на GitHub пошкоджений");
    return box.REPTYRY;
  }

  // прощаємо типові помилки введення: email/@/посилання замість логіна, пробіли в ключі
  function tidy() {
    let o = gh.owner.trim().replace(/^@/, "").replace(/^https?:\/\//i, "").replace(/^(www\.)?github\.com\//i, "");
    const parts = o.split("/").filter(Boolean);
    o = (parts[0] || "").replace(/\.github\.io$/i, "");
    if (parts[1] && (!gh.repo || gh.repo === "reptyry")) gh.repo = parts[1];
    gh.owner = o;
    gh.repo = gh.repo.trim().replace(/^https?:\/\/(www\.)?github\.com\/[^/]+\//i, "").replace(/\/.*$/, "").replace(/\.git$/i, "");
    gh.token = gh.token.replace(/\s+/g, "").replace(/^["'«]+|["'»]+$/g, "");
    gh.branch = gh.branch.trim();
  }
  // репозиторій не знайдено — з'ясовуємо, чий це ключ і які репозиторії він бачить
  async function diagnose() {
    const me = await api("/user");
    const fixed = [];
    if (me.login && me.login.toLowerCase() !== gh.owner.toLowerCase()) {
      fixed.push(`логін «${gh.owner}» → «${me.login}»`);
      gh.owner = me.login;
      try { const r = await api(repoPath()); return { r, fixed }; } catch (e) { if (e.status !== 404) throw e; }
    }
    let list = [];
    try { list = (await api("/user/repos?per_page=100&sort=updated")) || []; } catch (e) { /* */ }
    const want = gh.repo.toLowerCase();
    const cand = list.find((x) => x.name.toLowerCase() === want) || list.find((x) => /rept/i.test(x.name)) || (list.length === 1 ? list[0] : null);
    if (cand) {
      if (cand.owner.login !== gh.owner) fixed.push(`логін → «${cand.owner.login}»`);
      if (cand.name !== gh.repo) fixed.push(`репозиторій «${gh.repo}» → «${cand.name}»`);
      gh.owner = cand.owner.login; gh.repo = cand.name;
      return { r: await api(repoPath()), fixed };
    }
    const who = `Ключ належить акаунту «${me.login}».`;
    throw new Error(list.length
      ? `${who} Репозиторію «${gh.repo}» серед доступних йому немає. Ключ бачить: ${list.map((x) => x.name).join(", ")}. Впишіть правильну назву або створіть ключ з доступом до reptyry.`
      : `${who} Але він не має доступу до жодного репозиторію. Якщо репозиторію ще немає — створіть його (github.com/new, назва reptyry, Public). Потім створіть ключ заново: Repository access → Only select repositories → reptyry.`);
  }

  async function connect(silent) {
    tidy(); saveGh();
    if (!gh.owner || !gh.repo || !gh.token) { toast("Заповніть логін, репозиторій і ключ", true); return; }
    const wasLocked = needLogin();
    let fixed = [];
    await run(async () => {
      gh.ok = false;
      let repo;
      try { repo = await api(repoPath()); }
      catch (e) {
        if (e.status === 401) { gh.token = ""; saveGh(); throw e; }
        if (e.status !== 404) throw e;
        ({ r: repo, fixed } = await diagnose());
        saveGh();
      }
      if (repo.permissions && !repo.permissions.push) throw new Error("У цього акаунта немає права змінювати репозиторій.");
      gh.branch = gh.branch || repo.default_branch || "main";
      gh.ok = true; saveGh();
      try { gh.pages = (await api(`${repoPath()}/pages`)).html_url || ""; } catch (e) { gh.pages = ""; }
      await pull(true);
      gh.log = (gh.remoteSha ? "Підключено. Дані сайту завантажено з GitHub." : "Підключено. Репозиторій порожній — розмістіть файли сайту.")
        + (fixed.length ? ` Виправлено: ${fixed.join(", ")}.` : "");
      if (!silent) toast("Підключено до GitHub");
      if (wasLocked && gh.remoteSha) tab = "products"; // увійшли на сайті — одразу до товарів
    });
  }

  // свіжий data.js з GitHub (Pages кешує файли до 10 хв, тому беремо не з сайту, а з репозиторію)
  async function pull(keepDraft) {
    let j;
    try { j = await api(`${repoPath()}/contents/data.js?ref=${encodeURIComponent(gh.branch)}`); }
    catch (e) { if (e.status === 404) { gh.remoteSha = null; return; } throw e; }
    const data = parseData(fromB64(j.content));
    gh.remoteSha = j.sha;
    ORIGINAL = clone(data);
    if (keepDraft && dirty) { setStatus("● Ваша незбережена чернетка залишилась. Опублікуйте її або відкиньте.", "dirty"); return; }
    S = clone(data); normalize(S); dirty = false;
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* */ }
    sel = Math.min(sel, Math.max(0, S.products.length - 1));
  }

  async function initRepo() { // порожній репозиторій: Git API не працює, поки немає першого коміту
    await api(`${repoPath()}/contents/README.md`, { method: "PUT", body: { message: "REPTYRY: початок", content: toB64(enc("# REPTYRY\n\nСайт магазину. Редагується через admin.html.\n")) } });
    const repo = await api(repoPath());
    gh.branch = repo.default_branch || gh.branch || "main"; saveGh();
  }
  async function gitSha(bytes) {
    if (!(window.crypto && crypto.subtle)) return "";
    const head = enc(`blob ${bytes.length}\0`), all = new Uint8Array(head.length + bytes.length);
    all.set(head); all.set(bytes, head.length);
    return [...new Uint8Array(await crypto.subtle.digest("SHA-1", all))].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // files: [{path, bytes}] → один коміт; незмінені файли пропускаються
  async function commitFiles(files, message) {
    const B = encodeURIComponent(gh.branch);
    let ref;
    try { ref = await api(`${repoPath()}/git/ref/heads/${B}`); }
    catch (e) {
      if (e.status !== 409 && e.status !== 404) throw e;
      logLine("Репозиторій порожній — створюю перший коміт…");
      await initRepo();
      ref = await api(`${repoPath()}/git/ref/heads/${encodeURIComponent(gh.branch)}`);
    }
    const head = await api(`${repoPath()}/git/commits/${ref.object.sha}`);
    const remote = new Map(((await api(`${repoPath()}/git/trees/${head.tree.sha}?recursive=1`)).tree || []).map((t) => [t.path, t.sha]));
    const shas = {}, todo = [];
    for (const f of files) {
      const s = await gitSha(f.bytes);
      shas[f.path] = s;
      if (!s || remote.get(f.path) !== s) todo.push(f);
    }
    if (!todo.length) return { sha: null, shas, changed: 0 };
    const tree = [];
    for (const [n, f] of todo.entries()) {
      logLine(`Завантажую ${n + 1} з ${todo.length}: ${f.path}`);
      const b = await api(`${repoPath()}/git/blobs`, { method: "POST", body: { content: toB64(f.bytes), encoding: "base64" } });
      shas[f.path] = b.sha;
      tree.push({ path: f.path, mode: "100644", type: "blob", sha: b.sha });
      if (todo.length > 20 && gh.pace) await sleep(gh.pace); // GitHub не любить >80 запитів на хвилину
    }
    logLine("Створюю оновлення…");
    const t = await api(`${repoPath()}/git/trees`, { method: "POST", body: { base_tree: head.tree.sha, tree } });
    const c = await api(`${repoPath()}/git/commits`, { method: "POST", body: { message, tree: t.sha, parents: [ref.object.sha] } });
    try { await api(`${repoPath()}/git/refs/heads/${encodeURIComponent(gh.branch)}`, { method: "PATCH", body: { sha: c.sha } }); }
    catch (e) { if (e.status === 422) throw new Error("Поки ви зберігали, сайт змінили з іншого пристрою. Натисніть ще раз."); throw e; }
    return { sha: c.sha, shas, changed: todo.length };
  }

  // нові фото (data:URL у чернетці) → файли assets/img/*.jpg і *-sm.jpg
  async function prepare(src) {
    const data = clone(src), files = [];
    let n = 0;
    for (const p of data.products || []) {
      for (let i = 0; i < (p.images || []).length; i++) {
        const u = p.images[i];
        if (!/^data:image\//.test(u)) continue;
        const base = `${slug(p.id || p.name)}-${Date.now().toString(36)}${n++}`;
        const blob = await (await fetch(u)).blob();
        const small = await toBlob(await decode(blob), 720, 0.8);
        files.push({ path: `assets/img/${base}.jpg`, bytes: new Uint8Array(await blob.arrayBuffer()) });
        files.push({ path: `assets/img/${base}-sm.jpg`, bytes: new Uint8Array(await small.arrayBuffer()) });
        p.images[i] = base;
      }
    }
    return { data, files };
  }
  async function writeLocal(files) { // тримаємо папку на комп'ютері в синхроні з сайтом
    if (!dir) return;
    for (const f of files) {
      const parts = f.path.split("/"), name = parts.pop();
      let d = dir;
      for (const p of parts) d = await d.getDirectoryHandle(p, { create: true });
      const w = await (await d.getFileHandle(name, { create: true })).createWritable();
      await w.write(f.bytes); await w.close();
    }
  }
  function published(data, res) {
    S = data; normalize(S); ORIGINAL = clone(data); dirty = false;
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* */ }
    if (res.shas["data.js"]) gh.remoteSha = res.shas["data.js"];
  }
  async function watchBuild(sha) { // показуємо, коли GitHub Pages перебудував сайт
    for (let i = 0; i < 30 && sha && gh.watch; i++) {
      await sleep(i ? 8000 : 15000);
      let b; try { b = await api(`${repoPath()}/pages/builds/latest`); } catch (e) { return; }
      if (b.commit !== sha) continue;
      if (b.status === "built") { setStatus(`✓ Сайт оновлено о ${new Date().toLocaleTimeString("uk-UA")}. Якщо бачите старе — оновіть сторінку (браузер кешує до 10 хв).`, "ok"); return; }
      if (b.status === "errored") { setStatus("✗ GitHub Pages не зміг зібрати сайт. Спробуйте опублікувати ще раз.", "err"); return; }
    }
  }

  async function saveOnline() {
    const btn = $("#btnSave");
    if (gh.busy) return;
    let conflict = false;
    try {
      let cur = null;
      try { cur = (await api(`${repoPath()}/contents/data.js?ref=${encodeURIComponent(gh.branch)}`)).sha; } catch (e) { if (e.status !== 404) throw e; }
      conflict = cur !== (gh.remoteSha ?? null);
    } catch (e) { toast(e.message, true); return; }
    if (conflict && !armed(btn)) {
      toast("На сайті є новіші зміни (з іншого пристрою). Натисніть ще раз, щоб замінити їх своїми, або «Завантажити актуальні дані» у розділі «Сайт в інтернеті».", true);
      return;
    }
    btn.classList.remove("is-armed");
    const warn = issues().length;
    await run(async () => {
      logLine("Готую зміни…");
      const { data, files } = await prepare(S);
      files.push({ path: "data.js", bytes: enc(serialize(data)) });
      const res = await commitFiles(files, `Адмінка: зміни ${new Date().toLocaleString("uk-UA")}`);
      published(data, res);
      await writeLocal(files).catch(() => {});
      gh.log = res.changed ? `✓ Опубліковано о ${new Date().toLocaleTimeString("uk-UA")}. Покупці побачать зміни за 1–3 хвилини.${warn ? ` Попереджень: ${warn}.` : ""}` : "✓ Змін немає — на сайті вже все актуально.";
      toast(res.changed ? "Зміни опубліковано" : "Змін немає");
      if (res.sha) watchBuild(res.sha);
    });
  }

  async function* walk(h, pre = "") {
    for await (const [name, e] of h.entries()) {
      if (/^[._]/.test(name) || /^(thumbs\.db|desktop\.ini)$/i.test(name)) continue; // тести і службові файли не публікуємо
      if (e.kind === "directory") yield* walk(e, `${pre}${name}/`);
      else yield [`${pre}${name}`, e];
    }
  }
  async function deploy() {
    if (!dir) { toast("Спочатку натисніть угорі «📁 Підключити папку сайту» і виберіть папку reptyry", true); return; }
    await run(async () => {
      logLine("Читаю файли з папки…");
      const files = [];
      for await (const [path, h] of walk(dir)) {
        if (path === "data.js") continue; // дані беремо з адмінки (вони найсвіжіші)
        files.push({ path, bytes: new Uint8Array(await (await h.getFile()).arrayBuffer()) });
      }
      if (!files.some((f) => f.path === "index.html")) throw new Error("У папці немає index.html — це не папка сайту");
      const { data, files: imgs } = await prepare(S);
      const dataFile = { path: "data.js", bytes: enc(serialize(data)) };
      files.push(...imgs, dataFile, { path: ".nojekyll", bytes: new Uint8Array(0) });
      const res = await commitFiles(files, `Розміщення сайту REPTYRY ${new Date().toLocaleString("uk-UA")}`);
      published(data, res);
      await writeLocal([...imgs, dataFile]).catch(() => {});
      if (!gh.pages) await enablePages().catch(() => {});
      gh.log = res.changed ? `✓ Розміщено файлів: ${res.changed}. ${gh.pages ? "Сайт оновиться за 1–3 хвилини." : "Тепер натисніть «Увімкнути GitHub Pages»."}` : "✓ Усі файли вже на сайті, нічого не змінилось.";
      toast(res.changed ? "Сайт розміщено" : "Усе вже актуально");
      if (res.sha) watchBuild(res.sha);
    });
  }
  async function enablePages() {
    try { gh.pages = (await api(`${repoPath()}/pages`)).html_url || ""; return; }
    catch (e) { if (e.status !== 404) throw e; }
    try {
      const p = await api(`${repoPath()}/pages`, { method: "POST", body: { build_type: "legacy", source: { branch: gh.branch, path: "/" } } });
      gh.pages = p.html_url || siteURL();
    } catch (e) {
      if (e.status === 409) { gh.pages = siteURL(); return; } // вже увімкнено
      if (e.status === 422) throw new Error("Спочатку розмістіть файли сайту, потім вмикайте Pages.");
      if (e.status === 403) throw new Error("Ключу бракує дозволу Pages. Або увімкніть вручну: репозиторій → Settings → Pages → Deploy from a branch → main / (root) → Save.");
      throw e;
    }
  }

  window.__admin = { serialize: () => serialize(S), state: () => S, gh, setDir: (h) => { dir = h; render(); }, upload }; // для автотестів
  render();
  if (hasDraft) setStatus("● Відновлено незбережену чернетку з минулого разу. Збережіть її або відкиньте в «Як це працює».", "dirty");
  if (gh.token && gh.owner && gh.repo) connect(true); // увійти автоматично збереженим ключем
})();
