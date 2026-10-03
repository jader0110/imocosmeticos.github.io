/* =========================================================
   PAINEL IMÔ — cadastro dos produtos da vitrine (com login)
   ========================================================= */
const $ = s => document.querySelector(s);
const CATS_BASE = ["Oval", "Barra", "Massageador"];

const S = { pecas: [], config: {}, filtro: "", busca: "", canWrite: false, ready: false, email: "" };
let store = null;

/* ---------- utilidades ---------- */
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/-/g, "");
const brl = IM.brl, esc = IM.esc, catOf = IM.catOf, norm = IM.norm;
function parseValor(s) {
  s = String(s || "").replace(/[^\d,.]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
  const n = Math.round(parseFloat(s) * 100);
  return isFinite(n) ? n : null;
}
const parseNum = s => { s = String(s ?? "").replace(",", ".").replace(/[^\d.]/g, ""); if (!s) return null; const n = parseFloat(s); return isFinite(n) ? n : null; };
const fmtValorInput = c => c == null ? "" : (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let toastT;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3200); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ordenarCats = cats => IM.ordenarCats(S.config, cats);
const ordenar = pecas => IM.ordenar(S.config, pecas);

function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("imagem")); i.src = src; });
}
async function comprimir(file, max = 1600, q = 0.86) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, "image/jpeg", q));
  } finally { URL.revokeObjectURL(url); }
}
async function medir(blob) {
  const url = URL.createObjectURL(blob);
  try { const i = await loadImg(url); return { w: i.naturalWidth, h: i.naturalHeight }; } catch (e) { return { w: 0, h: 0 }; } finally { URL.revokeObjectURL(url); }
}

/* ---------- armazenamento: Supabase ---------- */
function SupaStore(sb) {
  const B = sb.storage.from("fotos");
  let onP = () => { }, onC = () => { }, t = null;
  const pub = p => p ? B.getPublicUrl(p).data.publicUrl : "";
  async function carregar() {
    const [r1, r2] = await Promise.all([
      sb.from("pecas").select("*").order("criado_em", { ascending: true }),
      sb.from("config").select("*").eq("id", 1).maybeSingle()
    ]);
    if (r1.error) throw r1.error;
    if (r2.error) throw r2.error;
    onC(IM.rowToConfig(r2.data)); onP((r1.data || []).map(IM.rowToPeca));
  }
  const agendar = () => { clearTimeout(t); t = setTimeout(() => carregar().catch(() => { }), 300); };
  return {
    async init(p, c) {
      onP = p; onC = c; await carregar();
      try { sb.channel("painel").on("postgres_changes", { event: "*", schema: "public", table: "config" }, agendar).subscribe(); } catch (e) { }
      document.addEventListener("visibilitychange", () => { if (!document.hidden) agendar(); });
    },
    recarregar: carregar,
    async savePeca(id, d) {
      const row = IM.pecaToRow(d);
      if (id) { const { error } = await sb.from("pecas").update(row).eq("id", id); if (error) throw error; }
      else { const { data, error } = await sb.from("pecas").insert(row).select("id").single(); if (error) throw error; id = data.id; }
      agendar(); return id;
    },
    async deletePeca(id) { const { error } = await sb.from("pecas").delete().eq("id", id); if (error) throw error; agendar(); },
    async saveConfig(c) { const { error } = await sb.from("config").update(IM.configToRow(c)).eq("id", 1); if (error) throw error; agendar(); },
    async upload(file) {
      const base = "pecas/" + uid();
      const full = await comprimir(file, 1600, 0.85), thumb = await comprimir(file, 600, 0.8);
      const dim = await medir(full);
      for (const [path, blob] of [[base + "-full.jpg", full], [base + "-thumb.jpg", thumb]]) {
        const { error } = await B.upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
        if (error) throw error;
      }
      return { full: base + "-full.jpg", thumb: base + "-thumb.jpg", w: dim.w, h: dim.h };
    },
    async removeFoto(ref) { try { await B.remove([ref.full, ref.thumb].filter((x, i, a) => x && a.indexOf(x) === i)); } catch (e) { } },
    url: ref => ref ? pub(ref.thumb || ref.full) : "",
    async blob(ref) { const r = await fetch(pub(ref.full || ref.thumb)); if (!r.ok) throw new Error("foto indisponível"); return r.blob(); }
  };
}

/* ---------- inicialização e login ---------- */
let sb = null;
function mostrarGate(qual) {
  $("#gate").hidden = !qual;
  ["gateCarregando", "gateConfig", "gateLogin", "gateNovaSenha", "gateSemAcesso", "gateErro"].forEach(id => $("#" + id).hidden = id !== qual);
  if (qual === "gateLogin") setTimeout(() => $("#lEmail").focus(), 50);
}
function setStatus() {
  $("#status").innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z"/><path d="M9.5 13.5l2 2 3.5-4"/></svg><b>Vitrine online</b>';
}
const siteURL = () => (IM.CFG.SITE_URL || new URL(".", location.href).href);
function prepararCompartilhar() {
  const url = siteURL();
  $("#shareBox").hidden = false;
  $("#linkVitrine").href = url; $("#linkVitrine").textContent = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  $("#btnCopiar").onclick = async () => {
    try { await navigator.clipboard.writeText(url); toast("Link copiado"); }
    catch (e) { const r = document.createRange(); r.selectNodeContents($("#linkVitrine")); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast("Link selecionado. Copie e cole onde quiser."); }
  };
  $("#btnZap").onclick = () => { window.open("https://wa.me/?text=" + encodeURIComponent(`Conheça os sabonetes artesanais da Imô 💜 ${url}`), "_blank", "noopener"); };
}
let iniciado = false;
async function entrarNoPainel(session) {
  S.email = (session && session.user && session.user.email) || "";
  let r = await sb.rpc("is_admin");
  if (r.error) { await sleep(1500); r = await sb.rpc("is_admin"); }
  if (r.error) { console.error(r.error); mostrarGate("gateErro"); return; }
  if (!r.data) { mostrarGate("gateSemAcesso"); return; }
  if (IM.manterConectado() && navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) { } }
  mostrarGate(null);
  $("#btnSair").hidden = false; $("#btnAjustes").hidden = false;
  $("#contaEmail").textContent = S.email ? "Conectado como " + S.email : "";
  S.canWrite = true;
  $("#abas").hidden = false;
  setStatus(); prepararCompartilhar();
  if (iniciado) return;
  iniciado = true;
  try {
    store = SupaStore(sb);
    await store.init(pecas => { S.pecas = pecas; S.ready = true; render(); }, cfg => { S.config = cfg || {}; if (S.ready) render(); });
    if (location.hash === "#acessos") mostrarAba("acessos");   // vindo da Gestão
  } catch (e) {
    console.error(e);
    $("#lista").innerHTML = '<div class="empty"><h3>Não foi possível carregar</h3><p class="hint">Verifique a internet e se o arquivo <b>banco.sql</b> foi executado no Supabase (guia, passo 2).</p></div>';
  }
}
const faltaColuna = e => /column|coluna|schema cache|does not exist/i.test(((e && (e.message || "")) + " " + (e && (e.details || e.hint || ""))));

/* ---------- abas e acessos ---------- */
const AC = { dias: 7, pedido: 0, verTodas: false };
function mostrarAba(qual) {
  const ac = qual === "acessos";
  $("#abaPecas").hidden = ac; $("#abaAcessos").hidden = !ac;
  $("#tabPecas").setAttribute("aria-selected", String(!ac)); $("#tabAcessos").setAttribute("aria-selected", String(ac));
  $(".dock").hidden = ac;
  document.body.style.paddingBottom = ac ? "24px" : "";
  window.scrollTo(0, 0);
  if (ac) carregarAcessos();
}
$("#tabPecas").onclick = () => mostrarAba("pecas");
$("#tabAcessos").onclick = () => mostrarAba("acessos");
$("#acAtualizar").onclick = () => carregarAcessos();
document.querySelectorAll(".periodo button").forEach(b => b.onclick = () => {
  document.querySelectorAll(".periodo button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  AC.dias = b.dataset.dias ? +b.dataset.dias : null; AC.verTodas = false;
  carregarAcessos();
});
const milhar = n => String(n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const dataBR = iso => { const d = new Date(iso); return isNaN(d) ? "" : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; };
async function carregarAcessos() {
  const box = $("#acConteudo"), meu = ++AC.pedido;
  if (!box.innerHTML) box.innerHTML = '<div class="loading">CARREGANDO ACESSOS…</div>';
  box.style.opacity = ".55";
  const { data, error } = await sb.rpc("resumo_acessos", { dias: AC.dias });
  if (meu !== AC.pedido) return;
  box.style.opacity = "";
  if (error) {
    console.error(error);
    box.innerHTML = '<div class="empty"><h3>Não foi possível carregar</h3><p class="hint">Verifique a internet e toque em Atualizar.</p></div>';
    return;
  }
  renderAcessos(data || {});
}
function renderAcessos(d) {
  const periodo = AC.dias ? `nos últimos ${AC.dias} dias` : "desde o início";
  const lista = (d.pecas || []).filter(x => x.aberturas > 0 || x.zap > 0);
  const porId = new Map(S.pecas.map(p => [p.id, p]));
  const max = Math.max(1, ...lista.map(x => x.aberturas));
  const mostrar = AC.verTodas ? lista : lista.slice(0, 10);
  const itens = mostrar.map((x, i) => {
    const p = porId.get(x.peca_id), f = p && p.fotos[0];
    return `<li class="${!p || p.arquivada ? "fora" : ""}">
      <span class="pos">${i + 1}</span>
      ${f ? `<img src="${esc(store.url(f))}" alt="" loading="lazy">` : '<span class="semfoto"></span>'}
      <div><div class="nm">${esc(p ? p.nome : "Produto excluído")}</div>
        <div class="sub">${esc([p && p.codigo, p && catOf(p), p && p.arquivada ? "arquivado" : ""].filter(Boolean).join(" · "))}</div>
        <div class="barra"><i style="width:${Math.round(x.aberturas / max * 100)}%"></i></div></div>
      <div class="num">${milhar(x.aberturas)}<small>${x.aberturas === 1 ? "visualização" : "visualizações"}</small>${x.zap ? `<em>${milhar(x.zap)} ${x.zap === 1 ? "toque" : "toques"} em Comprar</em>` : ""}</div>
    </li>`;
  }).join("");
  $("#acConteudo").innerHTML = `
    <div class="kpis">
      <div class="kpi"><span class="lbl">Visitas</span><b>${milhar(d.visitas)}</b><small>vezes que a vitrine foi aberta ${periodo}</small></div>
      <div class="kpi"><span class="lbl">Clientes diferentes</span><b>${milhar(d.visitantes)}</b><small>aparelhos diferentes ${periodo}</small></div>
    </div>
    <p class="nota">${d.primeiro ? `Contando desde ${dataBR(d.primeiro)}. ` : ""}Aberturas do mesmo aparelho em menos de 30 minutos contam uma vez. Aparelhos com o painel conectado não entram na conta.</p>
    <div class="sec-t"><h3>Produtos mais vistos</h3><span>${lista.length ? `${lista.length} ${lista.length === 1 ? "produto" : "produtos"}` : ""}</span></div>
    ${lista.length ? `<ol class="ranking">${itens}</ol>${lista.length > 10 ? `<p style="text-align:center;margin:14px 0 0"><button class="btn sm" type="button" id="acTodas">${AC.verTodas ? "Mostrar só os 10 primeiros" : `Ver todos (${lista.length})`}</button></p>` : ""}`
      : `<div class="empty"><h3>${d.visitas ? "Nenhum produto aberto" : "Nenhuma visita"} ${periodo}</h3><p class="hint">Assim que as clientes abrirem a vitrine, os números aparecem aqui. Envie o link pelo botão “Enviar no WhatsApp” na aba Produtos.</p></div>`}`;
  const t = $("#acTodas"); if (t) t.onclick = () => { AC.verTodas = !AC.verTodas; renderAcessos(d); };
}

async function boot() {
  if (!IM.configurado()) { mostrarGate("gateConfig"); return; }
  sb = IM.criarCliente();
  let recuperando = /type=recovery/.test(location.hash);
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === "PASSWORD_RECOVERY") { recuperando = true; mostrarGate("gateNovaSenha"); return; }
    if (ev === "SIGNED_IN" && session && !recuperando) entrarNoPainel(session);
    if (ev === "SIGNED_OUT") location.reload();
  });
  const { data } = await sb.auth.getSession();
  if (recuperando) { mostrarGate("gateNovaSenha"); return; }
  if (data && data.session) entrarNoPainel(data.session); else mostrarGate("gateLogin");
}
$("#fLogin").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("#lEmail").value.trim(), senha = $("#lSenha").value;
  $("#lErro").textContent = "";
  if (!email || !senha) { $("#lErro").textContent = "Preencha e-mail e senha."; return; }
  const b = $("#lEntrar"); b.disabled = true; b.textContent = "Entrando…";
  try { localStorage.setItem("imo-manter", $("#lManter").checked ? "1" : "0"); } catch (err) { }
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  b.disabled = false; b.textContent = "Entrar";
  if (!error && window.PasswordCredential && navigator.credentials) {
    try { navigator.credentials.store(new PasswordCredential({ id: email, password: senha, name: email })).catch(() => { }); } catch (err) { }
  }
  if (error) $("#lErro").textContent = /invalid/i.test(error.message || "") ? "E-mail ou senha incorretos." : "Não foi possível entrar. Verifique a internet.";
});
$("#lEsqueci").onclick = async () => {
  const email = $("#lEmail").value.trim();
  if (!email) { $("#lErro").textContent = "Digite seu e-mail acima e toque de novo em “Esqueci minha senha”."; return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: new URL("painel.html", siteURL()).href });
  $("#lErro").textContent = error ? "Não foi possível enviar agora. Tente de novo em alguns minutos." : "Enviamos um link para " + email + ". Abra o e-mail para criar a nova senha.";
};
$("#fNovaSenha").addEventListener("submit", async e => {
  e.preventDefault();
  const senha = $("#nSenha").value;
  if (senha.length < 6) { $("#nErro").textContent = "Use pelo menos 6 caracteres."; return; }
  const { error } = await sb.auth.updateUser({ password: senha });
  if (error) { $("#nErro").textContent = "Não foi possível salvar. Peça um novo link."; return; }
  history.replaceState(null, "", location.pathname);
  const { data } = await sb.auth.getSession();
  toast("Senha alterada"); entrarNoPainel(data.session);
});
$("#btnSair").onclick = () => sb.auth.signOut();
$("#gTentar").onclick = () => location.reload();
try { $("#lManter").checked = localStorage.getItem("imo-manter") !== "0"; } catch (e) { }
$("#gSair").onclick = () => sb.auth.signOut();

/* ---------- lista ---------- */
const nomeFiltro = f => f === "__sem" ? "Sem categoria" : f === "__arq" ? "Arquivados" : f === "__esg" ? "Esgotados" : f;
function render() {
  const todas = ordenar(S.pecas);
  const pecas = [...todas.filter(p => !p.arquivada), ...todas.filter(p => p.arquivada)];
  const nArq = pecas.filter(p => p.arquivada).length, nEsg = pecas.filter(p => p.esgotada && !p.arquivada).length;
  const cats = [...new Set(pecas.map(catOf).filter(Boolean))];
  if (S.filtro && !["__sem", "__arq", "__esg"].includes(S.filtro) && !cats.includes(S.filtro)) S.filtro = "";
  if ((S.filtro === "__arq" && !nArq) || (S.filtro === "__esg" && !nEsg)) S.filtro = "";
  $("#resumo").textContent = pecas.length ? `${pecas.length} ${pecas.length === 1 ? "produto" : "produtos"}${cats.length ? " · " + cats.length + (cats.length === 1 ? " categoria" : " categorias") : ""}${nEsg ? " · " + nEsg + (nEsg === 1 ? " esgotado" : " esgotados") : ""}${nArq ? " · " + nArq + (nArq === 1 ? " arquivado" : " arquivados") : ""}` : "";
  $("#tools").hidden = !pecas.length;
  $("#atalhoOrdem").hidden = !S.canWrite || cats.length < 2;
  $("#filtroCat").innerHTML = `<option value="">Todas as categorias</option>` + cats.map(c => `<option value="${esc(c)}" ${c === S.filtro ? "selected" : ""}>${esc(c)}</option>`).join("") + (pecas.some(p => !catOf(p)) ? `<option value="__sem">Sem categoria</option>` : "") + (nEsg ? `<option value="__esg">Esgotados</option>` : "") + (nArq ? `<option value="__arq">Arquivados</option>` : "");
  if (S.filtro === "__sem" && !pecas.some(p => !catOf(p))) S.filtro = "";
  $("#filtroCat").value = S.filtro;
  $("#filtroBox").classList.toggle("on", !!S.filtro);
  $("#buscaLimpar").hidden = !S.busca;
  $("#btnAdd").disabled = !S.ready;
  $("#dlCategorias").innerHTML = [...new Set([...cats, ...CATS_BASE])].map(c => `<option value="${esc(c)}">`).join("");

  if (!pecas.length) {
    $("#mostrando").hidden = true;
    $("#lista").innerHTML = `<div class="empty"><img src="assets/emblema.svg" alt="">
      <h3>Sua vitrine começa aqui</h3>
      <ol><li>Toque em Adicionar produto e escolha as fotos.</li><li>Preencha nome, preço, categoria e o resto. Tudo fica salvo na hora.</li><li>Pronto: o produto aparece na vitrine online das suas clientes.</li></ol>
      ${S.canWrite ? '<button class="btn primary" id="btnAddVazio">Adicionar o primeiro produto</button>' : ""}</div>`;
    const b = $("#btnAddVazio"); if (b) b.onclick = () => abrirEditor(null);
    return;
  }
  const q = norm(S.busca), qc = q.replace(/[^a-z0-9]/g, "");
  const vis = pecas.filter(p => {
    if (S.filtro === "__arq") { if (!p.arquivada) return false; }
    else if (S.filtro === "__esg") { if (!p.esgotada || p.arquivada) return false; }
    else if (S.filtro === "__sem" ? catOf(p) : (S.filtro && catOf(p) !== S.filtro)) return false;
    if (!q) return true;
    const cod = norm(p.codigo);
    return norm(p.nome).includes(q) || cod.includes(q) || (qc && cod.replace(/[^a-z0-9]/g, "").includes(qc)) || p.tags.some(t => norm(t).includes(q.replace(/^#/, "")));
  });
  const filtrando = !!(q || S.filtro), nomeCat = nomeFiltro(S.filtro);
  $("#mostrando").hidden = !filtrando;
  $("#mostrando").innerHTML = filtrando ? `<span>Mostrando ${vis.length} de ${pecas.length} ${pecas.length === 1 ? "produto" : "produtos"}${nomeCat ? " em " + esc(nomeCat) : ""}</span><button class="linkbtn" type="button" data-limpar>Limpar filtros</button>` : "";
  if (!vis.length) {
    $("#lista").innerHTML = `<div class="empty"><h3>Nenhum produto encontrado</h3><p class="hint">${q ? `Nada com “${esc(S.busca.trim())}” no nome, no código ou nas tags` : "Nenhum produto aqui"}${nomeCat && q ? " em " + esc(nomeCat) : ""}.</p><p style="margin:16px 0 0"><button class="btn" type="button" data-limpar>Limpar filtros</button></p></div>`;
    return;
  }
  $("#lista").innerHTML = `<div class="grid">${vis.map(p => {
    const f = (p.fotos || [])[0], arq = !!p.arquivada, esg = !!p.esgotada && !arq;
    return `<div class="card${arq ? " arq" : ""}${esg ? " esg" : ""}" data-id="${esc(p.id)}">
      <button class="open" type="button" ${S.canWrite ? "" : "tabindex='-1'"} aria-label="${S.canWrite ? "Editar " : ""}${esc(p.nome)}${arq ? " (arquivado)" : esg ? " (esgotado)" : ""}">
      <div class="ph">${f ? `<img loading="lazy" alt="" src="${esc(store.url(f))}">` : ""}${arq ? `<span class="flag">Arquivado</span>` : esg ? `<span class="flag esg">Esgotado</span>` : ""}${(p.fotos || []).length > 1 ? `<span class="count">${p.fotos.length} fotos</span>` : ""}</div>
      <div class="meta">${catOf(p) ? `<span class="cat">${esc(catOf(p))}</span>` : ""}<span class="nm">${esc(p.nome)}</span>
      <div class="row"><span class="ref">${esc([p.codigo, IM.pesoTxt(p.peso)].filter(Boolean).join(" · "))}</span><span class="pr">${p.valorAntigo > p.valor ? `<s>${esc(brl(p.valorAntigo))}</s> ` : ""}${esc(brl(p.valor) || "Sob consulta")}</span></div>
      ${p.tags.length ? `<div class="tags">${p.tags.slice(0, 3).map(t => `<span>#${esc(t)}</span>`).join("")}</div>` : ""}</div></button>
      ${S.canWrite ? `<button class="arch" type="button" data-arq="${esc(p.id)}" aria-label="${arq ? "Reativar" : "Arquivar"} ${esc(p.nome)}">${arq
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/></svg>Reativar'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="4.5" rx="1"/><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4"/></svg>Arquivar'}</button>` : ""}
      </div>`;
  }).join("")}</div>`;
}

let buscaT;
$("#busca").addEventListener("input", e => { S.busca = e.target.value; clearTimeout(buscaT); buscaT = setTimeout(render, 120); });
$("#buscaLimpar").onclick = () => { S.busca = ""; $("#busca").value = ""; render(); $("#busca").focus(); };
$("#filtroCat").addEventListener("change", e => { S.filtro = e.target.value; try { localStorage.setItem("imo-filtro", S.filtro); } catch (err) { } render(); });
const limparFiltros = () => { S.busca = ""; S.filtro = ""; $("#busca").value = ""; try { localStorage.removeItem("imo-filtro"); } catch (err) { } render(); };
document.addEventListener("click", e => { if (e.target.closest("[data-limpar]")) limparFiltros(); });
try { S.filtro = localStorage.getItem("imo-filtro") || ""; } catch (err) { }
$("#lista").addEventListener("click", e => {
  if (!S.canWrite) return;
  const a = e.target.closest("[data-arq]"); if (a) return alternarArquivo(a.dataset.arq, a);
  const c = e.target.closest(".open"); if (!c) return;
  abrirEditor(S.pecas.find(p => p.id === c.closest(".card").dataset.id));
});
async function alternarArquivo(id, btn) {
  const p = S.pecas.find(x => x.id === id); if (!p) return;
  const { id: _id, ...data } = p;
  const arquivar = !p.arquivada;
  btn.disabled = true;
  try {
    await store.savePeca(id, { ...data, arquivada: arquivar, atualizadoEm: Date.now() });
    toast(arquivar ? "Produto arquivado. Ele saiu da vitrine." : "Produto reativado. Ele voltou para a vitrine.");
  } catch (e) { btn.disabled = false; toast("Não foi possível arquivar. Verifique a conexão e tente de novo."); }
}
$("#btnAdd").onclick = () => abrirEditor(null);

/* ---------- editor ---------- */
let D = null; // rascunho
function abrirEditor(p) {
  D = { id: p ? p.id : null, original: p ? [...(p.fotos || [])] : [], fotos: p ? [...(p.fotos || [])] : [], novas: [], enviando: 0, criadoEm: p ? p.criadoEm : null, arquivada: !!(p && p.arquivada), valorAntigo: p ? p.valorAntigo : null, confirmando: false };
  $("#edTitulo").textContent = p ? "Editar produto" : "Novo produto";
  $("#fNome").value = p?.nome || "";
  $("#fCodigo").value = p ? (p.codigo || "") : IM.proximoCodigo(S.pecas);
  $("#fValor").value = fmtValorInput(p?.valor ?? null);
  let catIni = p?.categoria || "";
  if (!p) { try { catIni = localStorage.getItem("imo-ultima-cat") || ""; } catch (e) { } }
  $("#fCategoria").value = catIni;
  $("#fPeso").value = p && p.peso != null ? String(p.peso).replace(".", ",") : "";
  $("#fTags").value = p ? p.tags.join(", ") : "";
  $("#fDescricao").value = p?.descricao || ""; $("#fComposicao").value = p?.composicao || "";
  document.querySelectorAll('input[name="fDisp"]').forEach(r => r.checked = r.value === (p && p.esgotada ? "esg" : "disp"));
  renderCatsEditor(); renderTagsPrev();
  resetRodape();
  renderFotos();
  $("#editor").hidden = false;
  document.body.style.overflow = "hidden";
  $("#edForm").scrollTop = 0;
  if (!p) $("#edArquivo").click();
}
// atalhos de categoria (as que já existem + Oval, Barra, Massageador)
function renderCatsEditor() {
  const atual = $("#fCategoria").value.trim();
  const cats = ordenarCats([...new Set([...S.pecas.map(catOf).filter(Boolean), ...CATS_BASE])]);
  $("#edCats").innerHTML = cats.map(c => `<button type="button" data-cat="${esc(c)}" aria-pressed="${norm(c) === norm(atual)}">${esc(c)}</button>`).join("");
}
$("#edCats").addEventListener("click", e => { const b = e.target.closest("[data-cat]"); if (!b) return; $("#fCategoria").value = b.dataset.cat; renderCatsEditor(); });
$("#fCategoria").addEventListener("input", renderCatsEditor);
function renderTagsPrev() { $("#edTagsPrev").innerHTML = IM.lerTags($("#fTags").value).map(t => `<span>#${esc(t)}</span>`).join(""); }
$("#fTags").addEventListener("input", renderTagsPrev);
function resetRodape() {
  D && (D.confirmando = false);
  $("#edRodape").innerHTML = `<button class="btn danger" id="edExcluir" type="button" ${D && D.id ? "" : "hidden"}>Excluir</button><button class="btn primary" id="edSalvar" type="button">Salvar produto</button>`;
  $("#edExcluir").onclick = pedirExclusao; $("#edSalvar").onclick = salvarPeca;
}
async function fecharEditor(descartar = true) {
  if (descartar && D) for (const id of D.novas) store.removeFoto(id);
  D = null; $("#editor").hidden = true; document.body.style.overflow = "";
}
$("#edFechar").onclick = () => fecharEditor(true);

function renderFotos() {
  const tiles = D.fotos.map((id, i) => `<div class="ptile"><img alt="Foto ${i + 1}" src="${esc(store.url(id))}">
    ${i === 0 ? '<span class="tag">Capa</span>' : ""}
    <div class="act">${i > 0 ? `<button type="button" data-capa="${i}" aria-label="Usar como capa"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg></button>` : ""}
    <button type="button" data-rm="${i}" aria-label="Remover foto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>`);
  for (let i = 0; i < D.enviando; i++) tiles.push('<div class="ptile busy">Enviando…</div>');
  tiles.push(`<button type="button" class="addph" id="edAddFoto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 5l1.5-2h5L16 5"/></svg>${D.fotos.length ? "Mais fotos" : "Escolher fotos"}</button>`);
  $("#edFotos").innerHTML = tiles.join("");
  $("#edAddFoto").onclick = () => $("#edArquivo").click();
}
$("#edFotos").addEventListener("click", e => {
  const c = e.target.closest("[data-capa]"), r = e.target.closest("[data-rm]");
  if (c) { const i = +c.dataset.capa; const [f] = D.fotos.splice(i, 1); D.fotos.unshift(f); renderFotos(); }
  if (r) { D.fotos.splice(+r.dataset.rm, 1); renderFotos(); }
});
$("#edArquivo").addEventListener("change", async e => {
  const files = [...e.target.files].filter(f => f.type.startsWith("image/") || /\.(jpe?g|png|heic|webp)$/i.test(f.name));
  e.target.value = "";
  if (!files.length || !D) return;
  const alvo = D;
  alvo.enviando += files.length; renderFotos();
  for (const f of files) {
    try {
      const id = await store.upload(f);
      if (D !== alvo) { store.removeFoto(id); continue; }
      alvo.fotos.push(id); alvo.novas.push(id);
    } catch (err) {
      console.error(err); toast(/quota|exceed|size/i.test((err && (err.message || err.error)) || "") ? "O espaço de fotos está cheio. Exclua produtos antigos para liberar." : "Não foi possível enviar uma das fotos. Tente novamente.");
    } finally { alvo.enviando--; if (D === alvo) renderFotos(); }
  }
});
$("#fValor").addEventListener("blur", e => { const v = parseValor(e.target.value); e.target.value = v == null ? "" : fmtValorInput(v); });

async function salvarPeca() {
  if (!D) return;
  const nome = $("#fNome").value.trim();
  if (D.enviando) return toast("Aguarde as fotos terminarem de enviar.");
  if (!D.fotos.length) return toast("Adicione pelo menos uma foto do produto.");
  if (!nome) { $("#fNome").focus(); return toast("Dê um nome ao produto."); }
  const codigo = $("#fCodigo").value.trim().toUpperCase();
  if (codigo && S.pecas.some(p => p.id !== D.id && norm(p.codigo) === norm(codigo))) { $("#fCodigo").focus(); return toast(`O código ${codigo} já está em outro produto.`); }
  const peso = parseNum($("#fPeso").value);
  const data = {
    nome, codigo, valor: parseValor($("#fValor").value), valorAntigo: D.valorAntigo,
    categoria: $("#fCategoria").value.trim(), peso: peso == null ? null : Math.round(peso),
    tags: IM.lerTags($("#fTags").value), descricao: $("#fDescricao").value.trim(), composicao: $("#fComposicao").value.trim(),
    esgotada: (document.querySelector('input[name="fDisp"]:checked') || {}).value === "esg",
    fotos: D.fotos, criadoEm: D.criadoEm || Date.now(), atualizadoEm: Date.now(), arquivada: !!D.arquivada
  };
  if (data.valorAntigo != null && (data.valor == null || data.valorAntigo <= data.valor)) data.valorAntigo = null;
  try { if (data.categoria) localStorage.setItem("imo-ultima-cat", data.categoria); } catch (e) { }
  const btn = $("#edSalvar"); btn.disabled = true; btn.textContent = "Salvando…";
  try {
    await store.savePeca(D.id, data);
    const removidas = D.original.filter(id => !D.fotos.includes(id));
    for (const id of removidas) store.removeFoto(id);
    const novo = !D.id;
    await fecharEditor(false);
    toast(novo ? "Produto publicado na vitrine" : "Alterações publicadas na vitrine");
  } catch (e) {
    btn.disabled = false; btn.textContent = "Salvar produto";
    console.error(e); toast(faltaColuna(e) ? "Falta rodar o arquivo banco.sql no Supabase (SQL Editor). Depois tente salvar de novo." : "Não foi possível salvar. Verifique a conexão e tente de novo.");
  }
}
function pedirExclusao() {
  D.confirmando = true;
  $("#edRodape").innerHTML = `<div class="confirm" style="flex:1">Excluir este produto e as fotos dele?</div><button class="btn ghost" id="edNao" type="button">Manter</button><button class="btn primary" id="edSim" type="button" style="flex:none;background:var(--danger);border-color:var(--danger);color:#fff">Excluir</button>`;
  $("#edNao").onclick = resetRodape;
  $("#edSim").onclick = async () => {
    try {
      await store.deletePeca(D.id);
      for (const id of new Set([...D.original, ...D.fotos])) store.removeFoto(id);
      await fecharEditor(true);
      toast("Produto excluído");
    } catch (e) { toast("Não foi possível excluir. Tente de novo."); resetRodape(); }
  };
}

/* ---------- ajustes ---------- */
let ORDEM = [];
function renderOrdem() {
  const n = ORDEM.length, cont = c => S.pecas.filter(p => catOf(p) === c && !p.arquivada).length;
  $("#ordemBox").hidden = n < 2;
  $("#ordemLista").innerHTML = ORDEM.map((c, i) => `<li>
    <select data-pos="${i}" aria-label="Posição de ${esc(c)}">${ORDEM.map((_, k) => `<option value="${k}" ${k === i ? "selected" : ""}>${k + 1}</option>`).join("")}</select>
    <span class="nm">${esc(c)}</span><span class="qt">${cont(c)} ${cont(c) === 1 ? "produto" : "produtos"}</span>
    <button type="button" data-mv="${i}" data-d="-1" aria-label="Subir ${esc(c)}" ${i === 0 ? "disabled" : ""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 15l6-6 6 6"/></svg></button>
    <button type="button" data-mv="${i}" data-d="1" aria-label="Descer ${esc(c)}" ${i === n - 1 ? "disabled" : ""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9l6 6 6-6"/></svg></button></li>`).join("");
}
const mover = (de, para) => { if (para < 0 || para >= ORDEM.length || de === para) return; const [c] = ORDEM.splice(de, 1); ORDEM.splice(para, 0, c); renderOrdem(); };
$("#ordemLista").addEventListener("click", e => { const b = e.target.closest("[data-mv]"); if (b) mover(+b.dataset.mv, +b.dataset.mv + +b.dataset.d); });
$("#ordemLista").addEventListener("change", e => { const sl = e.target.closest("select[data-pos]"); if (sl) mover(+sl.dataset.pos, +sl.value); });
let DEST = {};
function renderDestaques() {
  const cats = ordenarCats([...new Set(S.pecas.filter(p => !p.arquivada).map(p => catOf(p) || "Outros"))]);
  $("#destBox").hidden = !cats.length;
  $("#destLista").innerHTML = cats.map(c => {
    const itens = ordenar(S.pecas.filter(p => !p.arquivada && (catOf(p) || "Outros") === c && p.fotos[0]));
    const auto = itens.filter(p => !p.esgotada).sort((a, b) => b.criadoEm - a.criadoEm)[0] || itens[0];
    const escolhido = itens.find(p => p.id === DEST[c]);
    const mostra = escolhido || auto, f = mostra && mostra.fotos[0];
    return `<div class="dest-item">
      ${f ? `<img src="${esc(store.url(f))}" alt="">` : '<span class="vazio"></span>'}
      <div><b>${esc(c)}</b>
        <select data-cat="${esc(c)}" aria-label="Foto de ${esc(c)}" ${itens.length ? "" : "disabled"}>
          <option value="">${itens.length ? "Automático (mais recente)" : "Nenhum produto com foto"}</option>
          ${itens.map(p => `<option value="${esc(p.id)}" ${p.id === DEST[c] ? "selected" : ""}>${esc(p.nome)}${p.codigo ? " · " + esc(p.codigo) : ""}</option>`).join("")}
        </select></div></div>`;
  }).join("");
}
$("#destLista").addEventListener("change", e => { const sl = e.target.closest("select[data-cat]"); if (!sl) return; DEST[sl.dataset.cat] = sl.value || null; if (!sl.value) delete DEST[sl.dataset.cat]; renderDestaques(); });
const pctIn = x => x ? String(+(x * 100).toFixed(2)).replace(".", ",") : "0";
function lerPagamento() {
  const pix = parseFloat(String($("#aPix").value).replace(",", ".").replace(/[^\d.]/g, "")) || 0;
  const parc = parseInt(String($("#aParc").value).replace(/\D/g, ""), 10) || 0;
  return { pixDesconto: Math.min(90, Math.max(0, pix)) / 100, parcelasMax: Math.min(24, parc), parcelaMin: parseValor($("#aParcMin").value) || 0 };
}
function canalEscolhido() { return (document.querySelector('input[name="aCanal"]:checked') || {}).value || "instagram"; }
function dicaCanal() {
  const c = canalEscolhido(), ig = IM.instaUser($("#aInsta").value), zap = $("#aWhats").value.replace(/\D/g, "");
  $("#canalHint").textContent = c === "instagram"
    ? (ig ? `A mensagem do pedido é copiada e a cliente cola no Direct de @${ig}. O Instagram não deixa abrir a conversa com o texto já escrito.` : "Preencha o Instagram abaixo para o botão Comprar funcionar.")
    : (zap ? "Abre o WhatsApp com a mensagem do pedido já escrita." : "Preencha o WhatsApp abaixo para o botão Comprar funcionar.");
}
["aInsta", "aWhats"].forEach(i => $("#" + i).addEventListener("input", dicaCanal));
document.querySelectorAll('input[name="aCanal"]').forEach(r => r.addEventListener("change", dicaCanal));
function abrirAjustes() {
  const c = S.config;
  document.querySelectorAll('input[name="aCanal"]').forEach(r => r.checked = r.value === (c.canal || "instagram"));
  $("#aInsta").value = c.instagram || ""; $("#aWhats").value = c.whatsapp || ""; $("#aMsg").value = c.msgPedido || IM.MSG_PADRAO;
  $("#aEntrega").value = c.entrega || ""; $("#aPagInfo").value = c.pagamentoInfo || ""; $("#aHorario").value = c.horario || ""; $("#aSlogan").value = c.slogan || "";
  $("#aPix").value = pctIn(c.pixDesconto); $("#aParc").value = c.parcelasMax || 0; $("#aParcMin").value = fmtValorInput(c.parcelaMin || 0);
  $("#aColecao").value = c.colecao || "";
  ORDEM = ordenarCats([...new Set(S.pecas.map(catOf).filter(Boolean))]);
  renderOrdem();
  DEST = Object.assign({}, c.destaques || {});
  renderDestaques(); dicaCanal();
  $("#ajustes").hidden = false; document.body.style.overflow = "hidden";
  $("#ajForm").scrollTop = 0;
}
$("#btnAjustes").onclick = () => abrirAjustes();
$("#btnOrdem").onclick = () => { abrirAjustes(); setTimeout(() => $("#ordemBox").scrollIntoView({ block: "start" }), 60); };
const fecharAjustes = () => { $("#ajustes").hidden = true; document.body.style.overflow = ""; };
$("#ajFechar").onclick = fecharAjustes;
$("#ajSalvar").onclick = async () => {
  const ig = IM.instaUser($("#aInsta").value);
  const antigas = (S.config.ordemCats || []).filter(x => !ORDEM.some(c => norm(c) === norm(x)));
  const c = Object.assign({}, S.config, {
    canal: canalEscolhido(), instagram: ig ? "@" + ig : "", whatsapp: $("#aWhats").value.trim(), msgPedido: $("#aMsg").value.trim() || IM.MSG_PADRAO,
    entrega: $("#aEntrega").value.trim(), pagamentoInfo: $("#aPagInfo").value.trim(), horario: $("#aHorario").value.trim(), slogan: $("#aSlogan").value.trim(),
    colecao: $("#aColecao").value.trim(), ordemCats: [...ORDEM, ...antigas], destaques: DEST
  }, lerPagamento());
  if (!IM.canalAtivo(c)) toast("Atenção: sem Instagram nem WhatsApp, o botão Comprar não aparece.");
  try { await store.saveConfig(c); S.config = c; fecharAjustes(); render(); if (IM.canalAtivo(c)) toast("Ajustes salvos"); }
  catch (e) { console.error(e); toast(faltaColuna(e) ? "Falta rodar o arquivo banco.sql no Supabase." : "Não foi possível salvar os ajustes."); }
};
document.addEventListener("keydown", e => { if (e.key === "Escape") { if (!$("#editor").hidden) fecharEditor(true); if (!$("#ajustes").hidden) fecharAjustes(); } });

/* ---------- cópia de segurança ---------- */
function mostrarBotoes(lista) {
  const b = $("#gBtns"); b.innerHTML = ""; b.hidden = false;
  lista.forEach(([t, fn, prim]) => { const x = document.createElement("button"); x.className = "btn" + (prim ? " primary" : ""); x.textContent = t; x.onclick = fn; b.appendChild(x); });
}
function baixar(blob, nome) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function compartilharOuBaixar(blob, nome, tipo) {
  const f = new File([blob], nome, { type: tipo });
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    try { await navigator.share({ files: [f], title: nome }); return "compartilhado"; }
    catch (e) { if (e && e.name === "AbortError") return "cancelado"; }
  }
  baixar(blob, nome); return "baixado";
}
const blobParaDataURL = blob => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
async function dataURLParaBlob(d) { return (await fetch(d)).blob(); }
function progresso(titulo, texto, pct) {
  $("#gerando").hidden = false; $("#gBtns").hidden = true;
  $("#gTitulo").textContent = titulo; $("#gTexto").textContent = texto; $("#gBarra").style.width = Math.round(pct * 100) + "%";
}
$("#btnBackup").onclick = async () => {
  fecharAjustes();
  try {
    const pecas = ordenar(S.pecas), total = pecas.reduce((n, p) => n + p.fotos.length, 0) || 1; let k = 0;
    const out = { formato: "imo-backup", versao: 1, geradoEm: new Date().toISOString(), config: IM.configToRow(S.config), pecas: [] };
    for (const p of pecas) {
      const fotos = [];
      for (const f of p.fotos) { progresso("Preparando a cópia", `${p.nome} · foto ${fotos.length + 1}`, k++ / total); try { fotos.push(await blobParaDataURL(await store.blob(f))); } catch (e) { } }
      out.pecas.push({ nome: p.nome, codigo: p.codigo, categoria: p.categoria, peso: p.peso, composicao: p.composicao, tags: p.tags, valor: p.valor, valorAntigo: p.valorAntigo ?? null, descricao: p.descricao, arquivada: p.arquivada, esgotada: p.esgotada, criadoEm: p.criadoEm, atualizadoEm: p.atualizadoEm, fotos });
    }
    const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
    const nome = `imo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    progresso("Cópia pronta", `${pecas.length} produtos · ${(blob.size / 1048576).toFixed(1).replace(".", ",")} MB. Guarde este arquivo em lugar seguro.`, 1);
    mostrarBotoes([["Salvar cópia", () => compartilharOuBaixar(blob, nome, "application/json"), true], ["Fechar", () => $("#gerando").hidden = true, false]]);
  } catch (e) { console.error(e); progresso("Não deu certo", "A cópia não pôde ser criada. Tente de novo.", 0); mostrarBotoes([["Fechar", () => $("#gerando").hidden = true, false]]); }
};
$("#btnImportar").onclick = () => $("#arqImport").click();
$("#arqImport").addEventListener("change", async e => {
  const file = e.target.files[0]; e.target.value = "";
  if (!file) return;
  fecharAjustes();
  let dados;
  try { dados = JSON.parse(await file.text()); if (dados.formato !== "imo-backup" || !Array.isArray(dados.pecas)) throw new Error("formato"); }
  catch (err) { toast("Este arquivo não é uma cópia da vitrine Imô."); return; }
  const chave = p => norm(p.nome) + "|" + norm(p.codigo);
  const existentes = new Set(S.pecas.map(chave));
  const novas = dados.pecas.filter(p => p && p.nome && !existentes.has(chave(p)));
  const total = novas.reduce((n, p) => n + (p.fotos || []).length, 0) || 1; let k = 0, ok = 0, falhas = 0;
  try {
    for (const p of novas) {
      const refs = [];
      for (const d of (p.fotos || [])) {
        progresso("Importando produtos", `${p.nome} · foto ${refs.length + 1}`, k++ / total);
        try { refs.push(await store.upload(await dataURLParaBlob(d))); } catch (err) { falhas++; }
      }
      if (!refs.length) { falhas++; continue; }
      await store.savePeca(null, Object.assign({}, p, { fotos: refs, criadoEm: p.criadoEm || Date.now() }));
      ok++;
    }
    if (dados.config && !IM.canalAtivo(S.config)) { const c = IM.rowToConfig(Object.assign({}, dados.config)); await store.saveConfig(c); S.config = c; }
    await store.recarregar();
    const pulei = dados.pecas.length - novas.length;
    progresso("Importação concluída", `${ok} ${ok === 1 ? "produto importado" : "produtos importados"}${pulei ? `, ${pulei} já existiam` : ""}${falhas ? `, ${falhas} com problema` : ""}.`, 1);
  } catch (err) {
    console.error(err);
    progresso("Importação interrompida", `${ok} produtos importados antes do problema. Rode de novo: os que já entraram serão pulados.`, k / total);
  }
  mostrarBotoes([["Fechar", () => $("#gerando").hidden = true, true]]);
});

boot();
