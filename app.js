(() => {
  const KEY_EVT = "agendagb.eventos.v1";
  const KEY_CFG = "agendagb.config.v1";
  const TZ = "America/Sao_Paulo";

  const DEFAULT_CFG = {
    nome: "",
    turno: "",
    whatsapp: "",
    outlook: "https://outlook.live.com/mail/",
    drive: "https://drive.google.com/",
    onedrive: "https://onedrive.live.com/"
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  let eventos = load(KEY_EVT, []);
  let cfg = { ...DEFAULT_CFG, ...load(KEY_CFG, {}) };
  let view = "painel";
  let diaAgenda = todayISO();
  let mesCursor = startOfMonth(todayISO());
  let diaMes = todayISO();
  let editId = null;

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }
  function save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function todayISO() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  }
  function nowHM() {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false
    }).format(new Date());
  }
  function parseISO(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function toISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function addDays(iso, n) {
    const d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }
  function startOfMonth(iso) {
    const d = parseISO(iso);
    d.setDate(1);
    return toISO(d);
  }
  function labelLong(iso) {
    return parseISO(iso).toLocaleDateString("pt-BR", {
      weekday: "long", day: "numeric", month: "long"
    });
  }
  function labelShort(iso) {
    return parseISO(iso).toLocaleDateString("pt-BR", {
      weekday: "short", day: "2-digit", month: "short"
    });
  }
  function labelMonth(iso) {
    const t = parseISO(iso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  }

  function go(name) {
    view = name;
    $$(".view").forEach((el) => el.classList.toggle("on", el.id === `view-${name}`));
    $$(".tabbar button").forEach((el) => el.classList.toggle("on", el.dataset.go === name));
    $("#viewTitle").textContent = $(`#view-${name}`).dataset.title;
    $("#btnNovo").hidden = name === "atalhos";
    render();
  }

  function eventosDoDia(iso) {
    return eventos
      .filter((e) => e.date === iso && !e.done)
      .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
  }
  function proximos() {
    const hoje = todayISO();
    return eventos
      .filter((e) => !e.done && e.date >= hoje)
      .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
      .slice(0, 6);
  }

  function cardHTML(ev, showDate) {
    const quando = showDate
      ? `${labelShort(ev.date)}${ev.time ? " · " + ev.time : ""}`
      : (ev.time || "Dia todo");
    return `
      <button class="card" data-id="${ev.id}" type="button">
        <span class="dot ${ev.tag || "outro"}"></span>
        <div>
          <h4>${escapeHtml(ev.title)}</h4>
          <p>${escapeHtml(ev.notes || ev.tag || "")}</p>
        </div>
        <span class="hora">${quando}</span>
      </button>`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function atalhoItems() {
    const wa = cfg.whatsapp
      ? `https://wa.me/${cfg.whatsapp.replace(/\D/g, "")}`
      : "https://web.whatsapp.com/";
    return [
      { cls: "wa", letra: "W", nome: "WhatsApp", href: wa },
      { cls: "hm", letra: "H", nome: "Hotmail", href: cfg.outlook || DEFAULT_CFG.outlook },
      { cls: "gd", letra: "D", nome: "Drive", href: cfg.drive || DEFAULT_CFG.drive },
      { cls: "od", letra: "O", nome: "OneDrive", href: cfg.onedrive || DEFAULT_CFG.onedrive }
    ];
  }
  function atalhosHTML() {
    return atalhoItems().map((a) => `
      <a class="atalho" href="${a.href}" target="_blank" rel="noopener">
        <span class="badge ${a.cls}">${a.letra}</span>
        <strong>${a.nome}</strong>
      </a>`).join("");
  }

  function renderPainel() {
    const hoje = todayISO();
    $("#hojeData").textContent = labelLong(hoje);
    $("#hojeTurno").textContent = cfg.turno || "Defina seu turno em Ajustes";
    const prox = proximos();
    $("#listaProximos").innerHTML = prox.length
      ? prox.map((e) => cardHTML(e, e.date !== hoje)).join("")
      : `<div class="empty">Nada marcado. Toque em + Novo.</div>`;
    $("#atalhosRapidos").innerHTML = atalhosHTML();
  }

  function renderAgenda() {
    $("#agendaDiaBtn").textContent = labelLong(diaAgenda);
    const list = eventosDoDia(diaAgenda);
    $("#listaDia").innerHTML = list.length
      ? list.map((e) => cardHTML(e, false)).join("")
      : `<div class="empty">Nenhum compromisso neste dia.</div>`;
  }

  function renderMes() {
    $("#mesLabel").textContent = labelMonth(mesCursor);
    const first = parseISO(mesCursor);
    const startWeek = first.getDay();
    const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const prevDays = new Date(first.getFullYear(), first.getMonth(), 0).getDate();
    const cells = [];
    for (let i = 0; i < 42; i++) {
      let d, off = false;
      if (i < startWeek) {
        d = new Date(first.getFullYear(), first.getMonth() - 1, prevDays - startWeek + i + 1);
        off = true;
      } else if (i >= startWeek + daysIn) {
        d = new Date(first.getFullYear(), first.getMonth() + 1, i - startWeek - daysIn + 1);
        off = true;
      } else {
        d = new Date(first.getFullYear(), first.getMonth(), i - startWeek + 1);
      }
      const iso = toISO(d);
      const count = eventos.filter((e) => e.date === iso && !e.done).length;
      const marks = count ? `<span class="marks">${"<i></i>".repeat(Math.min(count, 3))}</span>` : "";
      const cls = [
        "cel",
        off ? "off" : "",
        iso === todayISO() ? "hoje" : "",
        iso === diaMes ? "sel" : ""
      ].join(" ");
      cells.push(`<button type="button" class="${cls}" data-iso="${iso}"><span class="n">${d.getDate()}</span>${marks}</button>`);
    }
    $("#gradeMes").innerHTML = cells.join("");
    const list = eventosDoDia(diaMes);
    $("#listaMesDia").innerHTML = list.length
      ? list.map((e) => cardHTML(e, false)).join("")
      : `<div class="empty">${labelShort(diaMes)} — sem compromissos.</div>`;
  }

  function renderAtalhos() {
    $("#atalhosLista").innerHTML = atalhosHTML();
  }

  function renderClock() {
    const hoje = todayISO();
    const nome = cfg.nome ? `${cfg.nome} · ` : "";
    $("#clock").textContent = `${nome}${labelShort(hoje)} · ${nowHM()}`;
  }

  function render() {
    renderClock();
    if (view === "painel") renderPainel();
    if (view === "agenda") renderAgenda();
    if (view === "mes") renderMes();
    if (view === "atalhos") renderAtalhos();
  }

  function openEvento(ev) {
    editId = ev ? ev.id : null;
    const f = $("#formEvento");
    $("#dlgTitulo").textContent = ev ? "Editar" : "Novo compromisso";
    f.title.value = ev ? ev.title : "";
    f.date.value = ev ? ev.date : (view === "agenda" ? diaAgenda : view === "mes" ? diaMes : todayISO());
    f.time.value = ev && ev.time ? ev.time : "";
    f.tag.value = ev ? ev.tag : "pessoal";
    f.notes.value = ev ? ev.notes || "" : "";
    $("#btnApagar").hidden = !ev;
    $("#dlgEvento").showModal();
    f.title.focus();
  }

  function persist() {
    save(KEY_EVT, eventos);
    save(KEY_CFG, cfg);
  }

  $("#formEvento").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const data = {
      id: editId || uid(),
      title: f.title.value.trim(),
      date: f.date.value,
      time: f.time.value,
      tag: f.tag.value,
      notes: f.notes.value.trim(),
      done: false
    };
    if (!data.title) return;
    if (editId) {
      eventos = eventos.map((x) => (x.id === editId ? data : x));
    } else {
      eventos.push(data);
    }
    persist();
    $("#dlgEvento").close();
    if (view === "agenda") diaAgenda = data.date;
    if (view === "mes") {
      diaMes = data.date;
      mesCursor = startOfMonth(data.date);
    }
    render();
  });

  $("#btnApagar").addEventListener("click", () => {
    if (!editId) return;
    eventos = eventos.filter((x) => x.id !== editId);
    persist();
    $("#dlgEvento").close();
    render();
  });
  $("#btnCancelar").addEventListener("click", () => $("#dlgEvento").close());
  $("#btnNovo").addEventListener("click", () => openEvento(null));

  document.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (card && card.dataset.id) {
      const ev = eventos.find((x) => x.id === card.dataset.id);
      if (ev) openEvento(ev);
    }
    const goBtn = e.target.closest("[data-go]");
    if (goBtn) go(goBtn.dataset.go);
    const cel = e.target.closest(".cel");
    if (cel) {
      diaMes = cel.dataset.iso;
      renderMes();
    }
  });

  $("#prevDay").addEventListener("click", () => { diaAgenda = addDays(diaAgenda, -1); renderAgenda(); });
  $("#nextDay").addEventListener("click", () => { diaAgenda = addDays(diaAgenda, 1); renderAgenda(); });
  $("#agendaDiaBtn").addEventListener("click", () => {
    const p = $("#agendaDatePicker");
    p.value = diaAgenda;
    p.showPicker ? p.showPicker() : p.click();
  });
  $("#agendaDatePicker").addEventListener("change", (e) => {
    if (e.target.value) {
      diaAgenda = e.target.value;
      renderAgenda();
    }
  });
  $("#prevMonth").addEventListener("click", () => {
    const d = parseISO(mesCursor);
    d.setMonth(d.getMonth() - 1);
    mesCursor = toISO(d);
    renderMes();
  });
  $("#nextMonth").addEventListener("click", () => {
    const d = parseISO(mesCursor);
    d.setMonth(d.getMonth() + 1);
    mesCursor = toISO(d);
    renderMes();
  });

  $("#btnSettings").addEventListener("click", () => {
    const f = $("#formAjustes");
    f.nome.value = cfg.nome || "";
    f.turno.value = cfg.turno || "";
    f.whatsapp.value = cfg.whatsapp || "";
    f.outlook.value = cfg.outlook || DEFAULT_CFG.outlook;
    f.drive.value = cfg.drive || DEFAULT_CFG.drive;
    f.onedrive.value = cfg.onedrive || DEFAULT_CFG.onedrive;
    $("#dlgAjustes").showModal();
  });
  $("#btnFecharAjustes").addEventListener("click", () => $("#dlgAjustes").close());
  $("#formAjustes").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    cfg = {
      nome: f.nome.value.trim(),
      turno: f.turno.value.trim(),
      whatsapp: f.whatsapp.value.trim(),
      outlook: f.outlook.value.trim() || DEFAULT_CFG.outlook,
      drive: f.drive.value.trim() || DEFAULT_CFG.drive,
      onedrive: f.onedrive.value.trim() || DEFAULT_CFG.onedrive
    };
    persist();
    $("#dlgAjustes").close();
    render();
  });

  $("#btnExportar").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ cfg, eventos }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `agenda-gb-${todayISO()}.json`;
    a.click();
  });
  $("#btnImportar").addEventListener("click", () => $("#fileImport").click());
  $("#fileImport").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (Array.isArray(data.eventos)) eventos = data.eventos;
      if (data.cfg && typeof data.cfg === "object") cfg = { ...DEFAULT_CFG, ...data.cfg };
      persist();
      render();
    } catch {
      alert("Arquivo inválido.");
    }
    e.target.value = "";
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  setInterval(renderClock, 30000);
  go("painel");
})();
