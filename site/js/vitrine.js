/* =========================================================
   VITRINE IMÔ — página das clientes
   Uma página por vez, navegação só pelos botões.
   Lê os produtos do Supabase e se atualiza sozinha.
   ========================================================= */
(function () {
  const { esc, brl, catOf, ordenar, whatsLink, directLink, perfilLink, instaUser, canalAtivo, rowToPeca, rowToConfig, fotoURL, configurado, criarCliente, pagamento, slug, pesoTxt } = IM;
  const PW = 405, PH = 720;
  const C = { lilas: "#ECE4F3", areia: "#F6F1EA", linha: "#C9B8DD", roxo: "#5A3F80", tinta: "#2E2240", suave: "#776A88", papel: "#FDFBF8", cat: "#6A4C94", ouro: "#CBB593", esg: "#8C8396" };
  const app = document.getElementById("app");
  const V = { pecas: [], cfg: {}, novDesde: 0, pronto: false, desejadas: new Set() };
  const n2 = v => Math.round(v * 100) / 100;
  const U = v => `calc(var(--u)*${n2(v)})`;
  const NOME_LOJA = "Imô Cosméticos";

  /* ---------- medida de texto ----------
     Duas fontes: serifada (nomes, títulos, preços) e sem serifa (rótulos em caixa alta).
     Texto com espaçamento entre letras (cs >= 1) usa a sem serifa. */
  const ctx = document.createElement("canvas").getContext("2d");
  const SERIF = '"IM Serif","Cormorant Garamond",Garamond,Georgia,serif', SANS = '"IM Sans",Jost,"Avenir Next","Segoe UI",sans-serif';
  const SK = 1.12; // a serifada é mais miúda: aumenta um pouco para equilibrar
  const ehSans = (o, cs) => o.sans != null ? o.sans : cs >= 1;
  function fonte(size, o = {}, cs = 0) {
    const sans = ehSans(o, cs);
    return `${o.italic ? "italic " : ""}${sans ? (o.bold ? 500 : 400) : 500} ${n2(sans ? size : size * SK)}px ${sans ? SANS : SERIF}`;
  }
  function largura(s, size, cs = 0, o = {}) { ctx.font = fonte(size, o, cs); return ctx.measureText(s).width + cs * Math.max(0, s.length - 1); }
  function linhas(texto, size, maxW, maxL, o = {}) {
    const out = [];
    for (const par of String(texto || "").split(/\n/)) {
      let linha = "";
      for (const w of par.split(/\s+/).filter(Boolean)) {
        const t = linha ? linha + " " + w : w;
        if (largura(t, size, 0, o) <= maxW || !linha) linha = t; else { out.push(linha); linha = w; }
      }
      out.push(linha);
    }
    while (out.length > 1 && out[out.length - 1] === "") out.pop();
    if (maxL && out.length > maxL) {
      const ls = out.slice(0, maxL); let last = ls[maxL - 1];
      while (last.length && largura(last + "…", size, 0, o) > maxW) last = last.slice(0, -1);
      ls[maxL - 1] = last.replace(/[\s,.;:]+$/, "") + "…";
      return ls;
    }
    return out;
  }

  /* ---------- peças de desenho ---------- */
  // texto posicionado pela linha de base (y)
  function estiloTexto(size, o, cs) {
    const sans = ehSans(o, cs), sz = sans ? size : size * SK;
    return `font-family:var(${sans ? "--sans" : "--serif"});font-size:${U(sz)};font-weight:${sans ? (o.bold ? 500 : 400) : 500};${o.italic ? "font-style:italic;" : ""}${cs ? `letter-spacing:${U(cs)};` : ""}${!sans && o.bold ? `-webkit-text-stroke:${U(sz * 0.03)} currentColor;` : ""}`;
  }
  function T(s, x, y, o = {}) {
    const { size = 10, color = C.tinta, cs = 0, align = "left", href = null, ext = false, nav = null, cls = "", attrs = "" } = o;
    const top = y - 0.91 * (ehSans(o, cs) ? size : size * SK);
    let pos;
    if (align === "center") pos = `left:0;width:${U(PW)};text-align:center`;
    else if (align === "right") pos = `right:${U(PW - x)};text-align:right`;
    else pos = `left:${U(x)}`;
    const st = estiloTexto(size, o, cs) + `color:${color};`;
    const c = `t${href ? " nav" : ""} ${cls}`;
    if (href) {
      if (align === "center") {
        const w = largura(s, size, cs, o) + 8;
        pos = `left:${U((PW - w) / 2)};width:${U(w)};text-align:center`;
      }
      return `<a class="${c}" style="${pos};top:${U(top)};${st}" href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ""}${nav ? ` data-nav="${nav}"` : ""} ${attrs}>${esc(s)}</a>`;
    }
    return `<div class="${c}" style="${pos};top:${U(top)};${st}pointer-events:none">${esc(s)}</div>`;
  }
  const box = (x, y, w, h) => `left:${U(x)};top:${U(y)};width:${U(w)};height:${U(h)}`;
  const rect = (x, y, w, h, { fill = null, stroke = null, lw = 0.5, r = 0 } = {}) =>
    `<div style="${box(x - (stroke ? lw / 2 : 0), y - (stroke ? lw / 2 : 0), w + (stroke ? lw : 0), h + (stroke ? lw : 0))};${fill ? `background:${fill};` : ""}${stroke ? `border:max(${U(lw)},.5px) solid ${stroke};` : ""}${r ? `border-radius:${U(r)};` : ""}pointer-events:none"></div>`;
  const hline = (x1, x2, y, cor, lw = 0.4) => `<div style="${box(Math.min(x1, x2), y - lw / 2, Math.abs(x2 - x1), lw)};min-height:.5px;background:${cor};pointer-events:none"></div>`;
  // gotinha (o mesmo desenho do logo, simplificado) no meio dos divisores
  const gota = (cx, cy, r, cor) => `<svg viewBox="0 0 ${PW} ${PH}" style="left:0;top:0;width:100%;height:100%;pointer-events:none"><path d="M${n2(cx)} ${n2(cy - r * 1.25)} C ${n2(cx + r * 0.35)} ${n2(cy - r * 0.55)}, ${n2(cx + r)} ${n2(cy - r * 0.1)}, ${n2(cx + r)} ${n2(cy + r * 0.35)} A ${n2(r)} ${n2(r)} 0 0 1 ${n2(cx - r)} ${n2(cy + r * 0.35)} C ${n2(cx - r)} ${n2(cy - r * 0.1)}, ${n2(cx - r * 0.35)} ${n2(cy - r * 0.55)}, ${n2(cx)} ${n2(cy - r * 1.25)} Z" fill="${cor}"/></svg>`;
  const divisor = (cx, y, w, cor = C.roxo) => hline(cx - w / 2, cx - 9, y, C.linha) + hline(cx + 9, cx + w / 2, y, C.linha) + gota(cx, y, 3.4, cor);
  const moldura = (cor = C.linha) => rect(14, 14, PW - 28, PH - 28, { stroke: cor, lw: 0.6 }) + rect(18, 18, PW - 36, PH - 36, { stroke: C.ouro, lw: 0.3 });
  const link = (x, y, w, h, href, o = {}) => `<a class="hit" style="${box(x, y, w, h)}" href="${esc(href)}"${o.ext ? ' target="_blank" rel="noopener"' : ""}${o.nav ? ` data-nav="${o.nav}"` : ""} aria-label="${esc(o.label || "")}"></a>`;
  const botaoAcao = (x, y, w, h, dados, label) => `<button type="button" class="hit" style="${box(x, y, w, h)}" ${dados} aria-label="${esc(label)}"></button>`;
  const img = (src, x, y, w, h, cls = "im", extra = "") => `<img class="${cls}" src="${esc(src)}" alt="" style="${box(x, y, w, h)};${extra}" loading="eager" decoding="async">`;
  // emblema (gota na folha) dentro de um círculo
  const selo_logo = (cx, cy, d = 66) => rect(cx - d / 2, cy - d / 2, d, d, { fill: C.papel, stroke: C.linha, lw: 0.6, r: d / 2 }) + img("assets/emblema.svg", cx - d * 0.36, cy - d * 0.33, d * 0.72, d * 0.64, "ct");
  const SELOS = { novidade: ["NOVIDADE", C.roxo, C.papel], oferta: ["OFERTA", C.tinta, C.papel], desejada: ["MAIS DESEJADO", C.ouro, C.tinta], esgotado: ["ESGOTADO", C.esg, C.papel] };
  const selo = (x, y, tipo = "novidade") => { const [t, bg, cor] = SELOS[tipo]; const w = largura(t, 6, 1.6, { bold: true }) + 16;
    return `<div class="pill t" style="${box(x, y, w, 13)};background:${bg};color:${cor};${estiloTexto(6, { bold: true }, 1.6)}z-index:2">${t}</div>`; };
  const emOferta = p => p.valorAntigo != null && p.valor != null && p.valorAntigo > p.valor;
  // até "max" selos empilhados no canto da foto
  function selosDe(p, x, y, { novidade = true, max = 2 } = {}) {
    if (p.esgotada) return selo(x, y, "esgotado");
    const l = [];
    if (emOferta(p)) l.push("oferta");
    if (novidade && ehNova(p)) l.push("novidade");
    if (V.desejadas.has(p.id)) l.push("desejada");
    return l.slice(0, max).map((t, i) => selo(x, y + i * 16, t)).join("");
  }

  // botão de navegação em pílula (passar página). lado: "esq" | "dir" | "centro"; cheio = roxo preenchido
  const NAV_S = 9, NAV_CS = 1.8, NAV_H = 30, NAV_PAD = 15;
  function botao(rotulo, x, yMeio, { lado = "esq", href, nav = null, cheio = false, label = "" } = {}) {
    const w = largura(rotulo, NAV_S, NAV_CS, { bold: true }) + NAV_PAD * 2;
    const x0 = lado === "dir" ? x - w : lado === "centro" ? (PW - w) / 2 : x, y0 = yMeio - NAV_H / 2;
    let h = rect(x0, y0, w, NAV_H, cheio ? { fill: C.roxo, r: NAV_H / 2 } : { fill: C.papel, stroke: C.roxo, lw: 0.9, r: NAV_H / 2 });
    h += T(rotulo, x0 + NAV_PAD, yMeio + 0.36 * NAV_S, { size: NAV_S, color: cheio ? C.papel : C.tinta, cs: NAV_CS, bold: true });
    h += link(x0 - 4, y0 - 6, w + 8, NAV_H + 12, href, { nav, label: label || rotulo.replace(/[‹›]/g, "").trim() });
    return { h, x0, w };
  }

  /* ---------- sacola (fica guardada só neste aparelho) ---------- */
  const SAC_KEY = "imo-sacola";
  let sacMem = [];
  function sacola() {
    let l = sacMem;
    try { const t = localStorage.getItem(SAC_KEY); if (t) l = JSON.parse(t); } catch (e) { }
    if (!Array.isArray(l)) l = [];
    const ok = new Set(ativas().filter(p => !p.esgotada).map(p => p.id));
    return l.filter(i => i && ok.has(i.id)).map(i => ({ id: i.id, q: Math.max(1, Math.min(20, i.q | 0 || 1)) }));
  }
  function salvarSacola(l) { sacMem = l; try { localStorage.setItem(SAC_KEY, JSON.stringify(l)); } catch (e) { } }
  const canal = () => canalAtivo(V.cfg);
  const usaSacola = () => !!canal();
  const qtdSacola = () => sacola().reduce((s, i) => s + i.q, 0);
  const naSacola = id => sacola().some(i => i.id === id);
  function mudarSacola(id, delta, zerar = false) {
    let l = sacola(); const i = l.find(x => x.id === id);
    if (i) { i.q = zerar ? 0 : i.q + delta; l = l.filter(x => x.q > 0); }
    else if (delta > 0) l.push({ id, q: delta });
    salvarSacola(l.map(x => ({ id: x.id, q: Math.min(20, x.q) })));
  }
  const iconeSacola = (x, y, w, cor) => `<svg viewBox="0 0 24 24" style="${box(x, y, w, w)};pointer-events:none" fill="none" stroke="${cor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/></svg>`;
  // botão redondo da sacola com o número de produtos (canto de cima, à direita)
  function botaoSacola(x, y, D = 34) {
    const n = qtdSacola();
    if (!usaSacola() || !n) return "";
    let h = rect(x, y, D, D, { fill: C.roxo, r: D / 2 }) + iconeSacola(x + D * 0.24, y + D * 0.2, D * 0.52, C.papel);
    const bd = 15, bx = x + D - bd + 3, by = y - 3;
    h += rect(bx, by, bd, bd, { fill: C.tinta, r: bd / 2 });
    h += `<div class="t" style="${box(bx, by + 0.5, bd, bd)};display:flex;align-items:center;justify-content:center;${estiloTexto(7.5, { bold: true, sans: true }, 0)}color:${C.papel};pointer-events:none">${n > 9 ? "9+" : n}</div>`;
    h += link(x - 6, y - 6, D + 12, D + 12, "#sacola", { label: `Ver sacola (${n} ${n === 1 ? "produto" : "produtos"})` });
    return h;
  }
  // linha com Pix e parcelas para um valor
  function linhaPagamento(valor) {
    const pg = pagamento(V.cfg, valor);
    if (!pg) return "";
    const partes = [];
    if (pg.pix != null) partes.push(`${brl(pg.pix)} NO PIX`);
    if (pg.parcelas) partes.push(`${partes.length ? "OU " : ""}${pg.parcelas}X DE ${brl(pg.parcela)} SEM JUROS`);
    return partes.join("  ·  ");
  }
  const T_CENTRO_AJUSTADO = (txt, y, size, cor, maxW = 340, cs = 1.4) => { let sz = size; while (sz > 5.5 && largura(txt, sz, cs) > maxW) sz -= 0.25; return T(txt, PW / 2, y, { size: sz, color: cor, cs, align: "center" }); };

  /* ---------- dados ---------- */
  const nomeCat = p => catOf(p) || "Outros";
  // produtos à venda, na ordem das categorias; os esgotados vão para o fim de cada categoria
  function ativas() {
    const base = ordenar(V.cfg, V.pecas.filter(p => !p.arquivada)), out = [];
    for (const c of categorias(base)) { const g = base.filter(p => nomeCat(p) === c); out.push(...g.filter(p => !p.esgotada), ...g.filter(p => p.esgotada)); }
    return out;
  }
  function categorias(lista) { const cs = []; for (const p of lista) { const c = nomeCat(p); if (!cs.includes(c)) cs.push(c); } return cs; }
  const daCat = s => ativas().filter(p => slug(nomeCat(p)) === s);
  const catPorSlug = s => categorias(ativas()).find(c => slug(c) === s);
  const ehNova = p => p.criadoEm > V.novDesde;
  const thumbDe = p => { const f = p.fotos[0]; return f ? fotoURL(f.thumb || f.full) : ""; };

  /* ---------- plano do índice ---------- */
  const M = 31.5, GAP = 14, colW = (PW - 2 * M - GAP) / 2, cardH = colW + 46, ROWGAP = 16, LIM = PH - 60;
  function planoIndice(lista, comCats) {
    const cats = categorias(lista);
    const usar = comCats && cats.length > 1, CATH = 30;
    const pags = []; let pg = { items: [] }, y = usar ? 176 : 184; pags.push(pg);
    const onde = new Map();
    const nova = () => { pg = { items: [] }; pags.push(pg); y = 74; };
    for (const c of cats) {
      const grupo = lista.filter(p => nomeCat(p) === c);
      for (let i = 0; i < grupo.length; i += 2) {
        const row = grupo.slice(i, i + 2), cab = usar && i === 0;
        if (y + (cab ? CATH : 0) + cardH > LIM) nova();
        if (cab) { pg.items.push({ type: "cat", nome: c, y }); y += CATH; }
        else if (usar && pg.items.length === 0) { pg.items.push({ type: "cat", nome: c + " (cont.)", y }); y += CATH; }
        row.forEach((p, k) => { pg.items.push({ type: "peca", p, x: M + k * (colW + GAP), y }); onde.set(p.id, pags.length); });
        y += cardH + ROWGAP;
      }
    }
    return { pags, onde };
  }

  /* ---------- páginas ---------- */
  // bolhas de sabão bem suaves no fundo da capa
  const BOLHAS = [[50, 116, 22], [354, 94, 14], [370, 168, 8], [36, 420, 10], [374, 470, 15], [38, 612, 11], [372, 646, 8]];
  const bolhas = () => `<svg viewBox="0 0 ${PW} ${PH}" style="left:0;top:0;width:100%;height:100%;pointer-events:none">${BOLHAS.map(([x, y, r]) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,255,255,.32)" stroke="rgba(255,255,255,.85)" stroke-width=".7"/><path d="M${x - r * 0.55} ${y - r * 0.2} A ${r * 0.6} ${r * 0.6} 0 0 1 ${x - r * 0.15} ${y - r * 0.58}" fill="none" stroke="#fff" stroke-width="${n2(Math.max(0.6, r / 14))}" stroke-linecap="round"/>`).join("")}</svg>`;

  function paginaCapa() {
    const lista = ativas(), cfg = V.cfg, novas = lista.filter(ehNova);
    let h = bolhas() + moldura(C.roxo);
    h += T("VITRINE VIRTUAL", PW / 2, 62, { size: 8, color: C.roxo, cs: 4, align: "center" });
    h += divisor(PW / 2, 78, 120);
    const lh = 318, lw = lh * 374 / 518;
    h += img("assets/logo.svg", (PW - lw) / 2, 104, lw, lh, "ct");
    let yc = 104 + lh + 34;
    if (cfg.colecao) { h += T(cfg.colecao, PW / 2, yc, { size: 19, color: C.tinta, align: "center", italic: true }); yc += 20; }
    h += T(IM.mesAno(), PW / 2, yc, { size: 7.5, color: C.roxo, cs: 3, align: "center" });
    h += T(lista.length ? `${lista.length} ${lista.length === 1 ? "PRODUTO" : "PRODUTOS"} À SUA ESPERA` : "EM BREVE, NOVIDADES", PW / 2, yc + 15, { size: 7, color: C.suave, cs: 2.5, align: "center" });
    if (novas.length && novas.length < lista.length) {
      const s = `${novas.length} ${novas.length === 1 ? "NOVIDADE" : "NOVIDADES"} PARA VOCÊ  ›`;
      const w = largura(s, 8.5, 2, { bold: true }) + 34, x = (PW - w) / 2, yb = PH - 154;
      h += rect(x, yb, w, 26, { fill: C.papel, stroke: C.roxo, lw: 0.8, r: 13 });
      h += gota(x + 14, yb + 13.5, 3.4, C.roxo);
      h += T(s, x + 24, yb + 16.5, { size: 8.5, color: C.roxo, cs: 2, bold: true });
      h += link(x, yb, w, 26, "#novidades-1", { label: "Ver novidades" });
    }
    // botão principal: roxo cheio, maior, com um brilho suave pulsando
    const bw = 262, bh = 48, bx = (PW - bw) / 2, by = PH - 112;
    h += `<div class="cta" style="${box(bx, by, bw, bh)};background:${C.roxo};border-radius:${U(bh / 2)};pointer-events:none"></div>`;
    h += T("ENTRAR NA VITRINE  ›", PW / 2, by + bh / 2 + 0.36 * 12, { size: 12, color: C.papel, cs: 3, align: "center", bold: true });
    h += link(bx, by, bw, bh, "#categorias", { label: "Entrar na vitrine", nav: "next" });
    return { bg: C.lilas, html: h };
  }

  // escolha da categoria (Oval, Barra, Massageador…)
  const CAT_TOP = 180, CAT_FIM = PH - 68;
  function planoCategorias(cats) {
    if (cats.length <= 4) return [cats];
    const pags = []; for (let i = 0; i < cats.length; i += 6) pags.push(cats.slice(i, i + 6)); return pags;
  }
  function capaDaCat(c, itens) {
    const escolhida = V.cfg.destaques && V.cfg.destaques[c];
    const comFoto = itens.filter(p => p.fotos[0]);
    return comFoto.find(p => p.id === escolhida) || comFoto.filter(p => !p.esgotada).sort((a, b) => b.criadoEm - a.criadoEm)[0] || comFoto[0];
  }
  function paginaCategorias(m) {
    const cfg = V.cfg, cats = categorias(ativas()), pags = planoCategorias(cats);
    m = Math.max(0, Math.min(m, pags.length - 1));
    let h = moldura();
    h += selo_logo(PW / 2, 61);
    h += T("Vitrine", PW / 2, 128, { size: 30, color: C.tinta, align: "center", italic: true });
    h += T(cats.length > 1 ? "ESCOLHA UMA CATEGORIA" : NOME_LOJA.toUpperCase(), PW / 2, 145, { size: 7.5, color: C.roxo, cs: 3, align: "center" });
    h += botaoSacola(PW - 30 - 34, 30);
    h += divisor(PW / 2, 159, 150);
    const lista = pags[m] || [], cw = PW - 2 * M;
    if (!cats.length) h += T("Em breve, novos produtos.", PW / 2, 360, { size: 16, color: C.suave, align: "center", italic: true });
    if (cats.length <= 4) {
      // cartões deitados: foto quadrada à esquerda, nome à direita
      const n = Math.max(1, lista.length), gap = 14, ch = Math.min(150, (CAT_FIM - CAT_TOP - (n - 1) * gap) / n);
      const y0 = CAT_TOP + Math.max(0, (CAT_FIM - CAT_TOP - (n * ch + (n - 1) * gap)) / 2.6);
      lista.forEach((c, i) => {
        const y = y0 + i * (ch + gap), itens = daCat(slug(c)), capa = capaDaCat(c, itens), f = capa && capa.fotos[0];
        h += rect(M, y, cw, ch, { fill: C.papel });
        if (f) h += img(fotoURL(f.full || f.thumb), M, y, ch, ch, "im", `background:${C.lilas}`);
        else { h += rect(M, y, ch, ch, { fill: C.lilas }); h += img("assets/emblema.svg", M + ch * 0.22, y + ch * 0.24, ch * 0.56, ch * 0.5, "ct", "opacity:.5"); }
        h += rect(M + 5, y + 5, ch - 10, ch - 10, { stroke: "#FFFFFF", lw: 0.4 });
        h += rect(M, y, cw, ch, { stroke: C.linha, lw: 0.6 });
        if (itens.some(p => ehNova(p) && !p.esgotada)) h += selo(M + 8, y + 8, "novidade");
        const tx = M + ch + 20, tw = cw - ch - 34;
        let sz = 25; while (sz > 15 && largura(c, sz) > tw) sz -= 1;
        h += T(c, tx, y + ch / 2 + 1, { size: sz, color: C.tinta });
        const disp = itens.filter(p => !p.esgotada).length;
        h += T(`${itens.length} ${itens.length === 1 ? "PRODUTO" : "PRODUTOS"}  ›`, tx, y + ch / 2 + 22, { size: 7.5, color: C.roxo, cs: 2.4, bold: true });
        if (disp < itens.length) h += T(disp ? `${itens.length - disp} ESGOTADO${itens.length - disp === 1 ? "" : "S"}` : "ESGOTADOS", tx, y + ch / 2 + 37, { size: 6.5, color: C.suave, cs: 1.6 });
        h += link(M, y, cw, ch, `#cat-${slug(c)}-1`, { label: `Ver ${c}` });
      });
    } else {
      // grade de 2 colunas (até 6 por página)
      const gw = (cw - GAP) / 2, gh = 142, fh = 100;
      lista.forEach((c, i) => {
        const x = M + (i % 2) * (gw + GAP), y = CAT_TOP + Math.floor(i / 2) * (gh + 12), itens = daCat(slug(c)), capa = capaDaCat(c, itens), f = capa && capa.fotos[0];
        h += rect(x, y, gw, gh, { fill: C.papel });
        if (f) h += img(fotoURL(f.thumb || f.full), x, y, gw, fh, "im", `background:${C.lilas}`);
        else { h += rect(x, y, gw, fh, { fill: C.lilas }); h += img("assets/emblema.svg", x + gw / 2 - 28, y + fh / 2 - 25, 56, 50, "ct", "opacity:.5"); }
        h += rect(x, y, gw, gh, { stroke: C.linha, lw: 0.6 }) + hline(x, x + gw, y + fh, C.linha, 0.4);
        const nm = linhas(c, 15, gw - 10, 1)[0];
        h += `<div class="t" style="left:${U(x)};width:${U(gw)};text-align:center;top:${U(y + fh + 20 - 0.91 * 15 * SK)};${estiloTexto(15, {}, 0)}color:${C.tinta};pointer-events:none">${esc(nm)}</div>`;
        h += `<div class="t" style="left:${U(x)};width:${U(gw)};text-align:center;top:${U(y + fh + 34 - 0.91 * 6.5)};${estiloTexto(6.5, { bold: true }, 1.8)}color:${C.roxo};pointer-events:none">${itens.length} ${itens.length === 1 ? "PRODUTO" : "PRODUTOS"}  ›</div>`;
        h += link(x, y, gw, gh, `#cat-${slug(c)}-1`, { label: `Ver ${c}` });
      });
    }
    const FY = PH - 38;
    const esq = m === 0 ? ["‹  CAPA", "#capa"] : ["‹  ANTERIOR", `#categorias-${m}`];
    const bE = botao(esq[0], M, FY, { href: esq[1], nav: "prev" }); h += bE.h;
    let dir = null;
    if (m < pags.length - 1) dir = ["PRÓXIMA  ›", `#categorias-${m + 2}`, true];
    else if (canal() || cfg.instagram) dir = ["ATENDIMENTO  ›", "#atendimento", false];
    if (dir) h += botao(dir[0], PW - M, FY, { lado: "dir", href: dir[1], nav: dir[2] ? "next" : null, cheio: dir[2] }).h;
    return { bg: C.areia, html: h };
  }

  // modo = "novidades" ou o endereço da categoria
  function paginaIndice(m, modo) {
    const lista = modo === "novidades" ? ativas().filter(p => ehNova(p)) : daCat(modo);
    const { pags } = planoIndice(lista, modo === "novidades");
    m = Math.max(0, Math.min(m, pags.length - 1));
    const base = modo === "novidades" ? "#novidades-" : `#cat-${modo}-`;
    const titulo = modo === "novidades" ? "Novidades" : (catPorSlug(modo) || "Produtos");
    const cfg = V.cfg;
    let h = moldura();
    if (m === 0) {
      h += selo_logo(PW / 2, 61);
      let sz = 30; while (sz > 18 && largura(titulo, sz) > 320) sz -= 1;
      h += T(titulo, PW / 2, 128, { size: sz, color: C.tinta, align: "center", italic: true });
      h += T(modo === "novidades" ? "CHEGARAM DESDE A SUA ÚLTIMA VISITA" : (cfg.colecao || NOME_LOJA).toUpperCase(), PW / 2, 145, { size: 7.5, color: C.roxo, cs: 3, align: "center" });
      h += divisor(PW / 2, 159, 150);
      h += T("TOQUE EM UM PRODUTO PARA VER OS DETALHES", PW / 2, 174, { size: 5.8, color: C.suave, cs: 2, align: "center" });
      h += botaoSacola(PW - 30 - 34, 30);
    } else {
      h += T(titulo.toUpperCase(), M, 46, { size: 8, color: C.roxo, cs: 3.5 });
      const ns = qtdSacola();
      if (usaSacola() && ns) h += T(`SACOLA (${ns})  ›`, PW - M, 46, { size: 8.5, color: C.roxo, cs: 2.5, align: "right", bold: true, href: "#sacola" });
      else h += T("IMÔ", PW - M, 46, { size: 8, color: C.roxo, cs: 3.5, align: "right" });
      h += hline(M, PW - M, 54, C.linha, 0.3);
    }
    if (!lista.length) h += T("Em breve, novos produtos.", PW / 2, 330, { size: 16, color: C.suave, align: "center", italic: true });
    for (const it of (pags[m] || { items: [] }).items) {
      if (it.type === "cat") {
        const nome = it.nome.toUpperCase(), w = largura(nome, 10, 3);
        h += T(nome, PW / 2, it.y + 15, { size: 10, color: C.cat, cs: 3, align: "center" });
        h += hline(M, PW / 2 - w / 2 - 12, it.y + 11.5, C.linha, 0.35) + hline(PW / 2 + w / 2 + 12, PW - M, it.y + 11.5, C.linha, 0.35);
        continue;
      }
      const p = it.p, src = thumbDe(p), apaga = p.esgotada ? "opacity:.55;filter:grayscale(.35);" : "";
      h += src ? img(src, it.x, it.y, colW, colW, "im", `background:${C.lilas};${apaga}`) : rect(it.x, it.y, colW, colW, { fill: C.lilas });
      h += rect(it.x, it.y, colW, colW, { stroke: C.linha, lw: 0.5 }) + rect(it.x + 5, it.y + 5, colW - 10, colW - 10, { stroke: "#FFFFFF", lw: 0.4 });
      h += selosDe(p, it.x + 9, it.y + 9, { novidade: modo !== "novidades" });
      const nl = linhas(p.nome, 11.5, colW - 6, 2);
      nl.forEach((l, i) => { h += `<div class="t" style="left:${U(it.x)};width:${U(colW)};text-align:center;top:${U(it.y + colW + 16 + i * 13 - 0.91 * 11.5 * SK)};${estiloTexto(11.5, {}, 0)}color:${p.esgotada ? C.suave : C.tinta}">${esc(l)}</div>`; });
      const sub = [p.valor != null ? brl(p.valor) : "", p.codigo ? p.codigo.toUpperCase() : ""].filter(Boolean).join("  ·  ");
      if (sub) h += `<div class="t" style="left:${U(it.x)};width:${U(colW)};text-align:center;top:${U(it.y + colW + 16 + nl.length * 13 + 1 - 0.91 * 6.5)};${estiloTexto(6.5, {}, 1.6)}color:${C.roxo}">${esc(sub)}</div>`;
      h += link(it.x, it.y, colW, cardH - 4, `#produto-${p.id}`, { label: p.nome + (p.esgotada ? " (esgotado)" : "") });
    }
    const FY = PH - 38;
    const esq = m === 0 ? (modo === "novidades" ? ["‹  CAPA", "#capa"] : ["‹  CATEGORIAS", "#categorias"]) : ["‹  ANTERIOR", base + m];
    const bE = botao(esq[0], M, FY, { href: esq[1], nav: "prev" }); h += bE.h;
    const cats = categorias(ativas()), iCat = cats.findIndex(c => slug(c) === modo), outra = modo === "novidades" ? null : cats[iCat + 1];
    let dir = null;
    if (m < pags.length - 1) dir = ["PRÓXIMA  ›", base + (m + 2)];
    else if (modo === "novidades") dir = ["VITRINE COMPLETA  ›", "#categorias"];
    else if (outra) dir = [outra.toUpperCase() + "  ›", `#cat-${slug(outra)}-1`];
    else if (canal() || cfg.instagram) dir = ["ATENDIMENTO  ›", "#atendimento"];
    let bD = null;
    if (dir) {
      const rot = largura(dir[0], NAV_S, NAV_CS, { bold: true }) > 170 ? "PRÓXIMA  ›" : dir[0];
      bD = botao(rot, PW - M, FY, { lado: "dir", href: dir[1], nav: "next", cheio: true }); h += bD.h;
    }
    const num = `${m + 1} / ${pags.length}`, nw = largura(num, 8, 1.5) / 2 + 6;
    if (pags.length > 1 && bE.x0 + bE.w < PW / 2 - nw && (!bD || bD.x0 > PW / 2 + nw)) h += T(num, PW / 2, FY + 3, { size: 8, color: C.suave, cs: 1.5, align: "center" });
    return { bg: C.areia, html: h };
  }

  // etiquetas (tags) em pílulas centralizadas, até 2 fileiras
  function pilulasTags(tags, y) {
    if (!tags.length) return { h: "", alt: 0 };
    const S = 7, CS = 0.6, PAD = 8, HH = 15, G = 5, MAXW = 320, fileiras = [[]];
    let w = 0;
    for (const t of tags) {
      const txt = "#" + t.toLowerCase(), tw = largura(txt, S, CS, { sans: true }) + PAD * 2;
      if (w && w + G + tw > MAXW) { if (fileiras.length === 2) break; fileiras.push([]); w = 0; }
      fileiras[fileiras.length - 1].push({ txt, tw }); w += (w ? G : 0) + tw;
    }
    let h = "";
    fileiras.forEach((f, i) => {
      const tot = f.reduce((s, x) => s + x.tw, 0) + G * (f.length - 1); let x = (PW - tot) / 2; const yy = y + i * (HH + 5);
      f.forEach(p => { h += rect(x, yy, p.tw, HH, { fill: C.lilas, r: HH / 2 }) + T(p.txt, x + PAD, yy + HH / 2 + 2.6, { size: S, color: C.roxo, cs: CS, sans: true }); x += p.tw + G; });
    });
    return { h, alt: fileiras.length * (HH + 5) - 5 };
  }

  function paginaPeca(id) {
    const alvo = ativas().find(p => p.id === id);
    if (!alvo) return null;
    const s = slug(nomeCat(alvo)), lista = daCat(s), idx = lista.findIndex(p => p.id === id);
    const p = lista[idx], fotos = p.fotos, cfg = V.cfg;
    const { onde } = planoIndice(lista, false);
    let h = moldura();
    h += T("‹  VOLTAR", 30, 44, { size: 10, color: C.roxo, cs: 2.2, bold: true, href: `#cat-${s}-${onde.get(p.id) || 1}` });
    h += T(`${String(idx + 1).padStart(2, "0")} / ${String(lista.length).padStart(2, "0")}`, PW / 2, 44, { size: 7.5, color: C.suave, cs: 1.5, align: "center" });
    const ant = lista[idx - 1], seg = lista[idx + 1];
    const D = 34, cy = 40, xS = PW - 28 - D, xA = xS - 10 - D;
    const seta = (x, ativo, ch) => rect(x, cy - D / 2, D, D, ativo ? { fill: C.roxo, r: D / 2 } : { stroke: C.linha, lw: 0.8, r: D / 2 }) +
      `<svg viewBox="0 0 24 24" style="${box(x + D * 0.27, cy - D * 0.23, D * 0.46, D * 0.46)};pointer-events:none" fill="none" stroke="${ativo ? C.papel : C.linha}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="${ch === ">" ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"}"/></svg>`;
    h += seta(xA, !!ant, "<") + seta(xS, !!seg, ">");
    if (seg) h += link(xS - 4, cy - D / 2 - 4, D + 8, D + 8, `#produto-${seg.id}`, { label: "Próximo produto", nav: "next" });
    if (ant) h += link(xA - 4, cy - D / 2 - 4, D + 8, D + 8, `#produto-${ant.id}`, { label: "Produto anterior", nav: "prev" });

    // textos que vão abaixo da foto (para calcular quanto espaço sobra para ela)
    const DESC_W = 300, DESC_S = 10, DESC_LH = 14.5;
    const descLs = p.descricao ? linhas(p.descricao, DESC_S, DESC_W) : [];
    const compLs = p.composicao ? linhas("Composição: " + p.composicao, 8.8, DESC_W, 0, { italic: true }) : [];
    const nomeLs = linhas(p.nome, 22, 320, 2);
    const lp = linhaPagamento(p.valor), peso = pesoTxt(p.peso);
    const tg = pilulasTags(p.tags, 0);
    const temCompra = !!canal();
    const temThumbs = fotos.length > 1;
    const precisa = 5 + (temThumbs ? 62 : 0) + 26 + (catOf(p) ? 26 : 6) + (nomeLs.length - 1) * 25 + 16 + (p.codigo ? 14 : 0) + 26 + 17 + (lp ? 15 : 0) + (peso ? 17 : 0) + (tg.alt ? tg.alt + 12 : 0) + 12 + Math.min(3, descLs.length + compLs.length) * DESC_LH;
    const top = 64, limiteTexto = temCompra ? PH - 118 : PH - 44;
    const fotoMax = Math.max(170, Math.min(292, limiteTexto - top - precisa));
    const boxW = PW - 72, f0 = fotos[0];
    let fw = boxW, fh = fotoMax, conhecido = false;
    if (f0 && f0.w && f0.h) { const k = Math.min(boxW / f0.w, fotoMax / f0.h); fw = f0.w * k; fh = f0.h * k; conhecido = true; }
    const fx = (PW - fw) / 2;
    if (f0) {
      h += img(fotoURL(f0.full), fx, top, fw, fh, "ct", `background:transparent;${p.esgotada ? "opacity:.7;filter:grayscale(.3);" : ""}`);
      h += `<button type="button" class="hit" style="${box(fx, top, fw, fh)}" data-zoom="${esc(fotoURL(f0.full))}" aria-label="Ampliar foto"></button>`;
      const sd = 30, sx = fx + fw - sd - 7, sy = top + 7;
      h += rect(sx, sy, sd, sd, { fill: "rgba(253,251,248,.92)", r: sd / 2 });
      h += `<svg viewBox="0 0 24 24" style="${box(sx + 7, sy + 7, sd - 14, sd - 14)};pointer-events:none" fill="none" stroke="${C.tinta}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>`;
      h += `<button type="button" class="hit" style="${box(sx - 5, sy - 5, sd + 10, sd + 10)};z-index:4" data-share="${esc(p.id)}" aria-label="Compartilhar este produto"></button>`;
      h += `<div class="fr-foto" data-auto="${conhecido ? 0 : 1}" style="${box(fx - 5, top - 5, fw + 10, fh + 10)};border:max(${U(0.5)},.5px) solid ${C.linha};pointer-events:none"></div>`;
    } else { h += rect(fx, top, fw, fh, { fill: C.lilas }); h += img("assets/emblema.svg", PW / 2 - 40, top + fh / 2 - 36, 80, 71, "ct", "opacity:.45"); }
    h += selosDe(p, fx + 6, top + 6, { max: 3 });
    let yy = top + fh + 5;
    if (temThumbs) {
      const n = Math.min(fotos.length, 7), sz = 36, g = 8, tw = n * sz + (n - 1) * g; let tx = (PW - tw) / 2; const ty = yy + 12;
      for (let i = 0; i < n; i++) {
        h += img(fotoURL(fotos[i].thumb || fotos[i].full), tx, ty, sz, sz, "im", `background:${C.lilas}`);
        h += rect(tx, ty, sz, sz, { stroke: i === 0 ? C.roxo : C.linha, lw: i === 0 ? 1 : 0.4 });
        if (i > 0) h += link(tx, ty, sz, sz, `#produto-${p.id}-foto-${i + 1}`, { label: `Ampliar foto ${i + 1}` });
        tx += sz + g;
      }
      yy = ty + sz + 4;
      h += T("TOQUE NA FOTO OU NAS MINIATURAS PARA AMPLIAR", PW / 2, yy + 8, { size: 5.5, color: C.suave, cs: 1.6, align: "center" });
      yy += 10;
    }
    let ty = yy + 26;
    if (catOf(p)) { h += T(catOf(p).toUpperCase(), PW / 2, ty, { size: 9, color: C.cat, cs: 3, align: "center" }); ty += 26; } else ty += 6;
    nomeLs.forEach((l, i) => { h += T(l, PW / 2, ty + i * 25, { size: 22, color: C.tinta, align: "center" }); });
    ty += (nomeLs.length - 1) * 25 + 16;
    if (p.codigo) { h += T("REF. " + p.codigo.toUpperCase(), PW / 2, ty, { size: 7, color: C.suave, cs: 2, align: "center" }); ty += 14; }
    h += divisor(PW / 2, ty, 110); ty += 26;
    if (emOferta(p)) {
      const de = brl(p.valorAntigo), por = brl(p.valor), wd = largura(de, 12), wp = largura(por, 21), x0 = (PW - (wd + 12 + wp)) / 2;
      h += T(de, x0, ty - 1, { size: 12, color: C.suave });
      h += hline(x0 - 1, x0 + wd + 1, ty - 5, C.suave, 0.8);
      h += T(por, x0 + wd + 12, ty, { size: 21, color: C.roxo });
    } else h += T(brl(p.valor) || "Sob consulta", PW / 2, ty, { size: p.valor != null ? 21 : 15, color: p.esgotada ? C.suave : C.roxo, align: "center" });
    ty += 17;
    if (lp) { h += T_CENTRO_AJUSTADO(lp, ty + 1, 7.5, C.tinta); ty += 15; }
    if (peso) { h += T("PESO · " + peso, PW / 2, ty + 2, { size: 8.5, color: C.tinta, cs: 2, align: "center" }); ty += 17; }
    if (tg.alt) { h += pilulasTags(p.tags, ty - 4).h; ty += tg.alt + 12; }
    ty += 12;
    const cabem = Math.max(0, Math.floor((limiteTexto - ty) / DESC_LH) + 1);
    if (cabem) {
      const dl = descLs.length > cabem ? linhas(p.descricao, DESC_S, DESC_W, cabem) : descLs;
      dl.forEach((l, i) => { h += T(l, PW / 2, ty + i * DESC_LH, { size: DESC_S, color: C.tinta, align: "center" }); });
      const sobra = cabem - dl.length;
      if (compLs.length && sobra > 0) {
        const yc = ty + dl.length * DESC_LH + (dl.length ? 2 : 0);
        const cl = compLs.length > sobra ? linhas("Composição: " + p.composicao, 8.8, DESC_W, sobra, { italic: true }) : compLs;
        cl.forEach((l, i) => { h += T(l, PW / 2, yc + i * 13, { size: 8.8, color: C.suave, align: "center", italic: true }); });
      }
    }
    if (temCompra) {
      const w = 250, hh = 42, x = (PW - w) / 2, yb = PH - 104;
      if (p.esgotada) {
        h += rect(x, yb, w, hh, { fill: C.papel, stroke: C.esg, lw: 0.9, r: hh / 2 });
        h += T("ESGOTADO NO MOMENTO", PW / 2, yb + hh / 2 + 3.6, { size: 10, color: C.esg, cs: 2.4, align: "center", bold: true });
        const a = "AVISE-ME QUANDO VOLTAR  ›";
        h += T(a, PW / 2, yb + hh + 22, { size: 7.5, color: C.roxo, cs: 1.6, bold: true, align: "center" });
        h += botaoAcao((PW - 200) / 2, yb + hh + 8, 200, 22, `data-aviseme="${esc(p.id)}"`, "Pedir para avisar quando voltar");
      } else {
        h += `<div class="cta" style="${box(x, yb, w, hh)};background:${C.roxo};border-radius:${U(hh / 2)};pointer-events:none"></div>`;
        h += iconeSacola(x + 24, yb + 11, 20, C.papel);
        h += T("COMPRAR", PW / 2 + 8, yb + hh / 2 + 4, { size: 11.5, color: C.papel, cs: 3.2, align: "center", bold: true });
        h += botaoAcao(x, yb, w, hh, `data-comprar="${esc(p.id)}"`, `Comprar ${p.nome}`);
        // linha de baixo: juntar vários produtos na sacola
        const n = qtdSacola(), dentro = naSacola(p.id), yl = yb + hh + 22;
        if (dentro) h += T(`✓  NA SACOLA · VER SACOLA (${n})  ›`, PW / 2, yl, { size: 7.5, color: C.roxo, cs: 1.6, bold: true, align: "center", href: "#sacola" });
        else {
          const a = "+  ADICIONAR À SACOLA", b = `VER SACOLA (${n})  ›`;
          const wa = largura(a, 7.5, 1.6, { bold: true }), wb = n ? largura(b, 7.5, 1.6, { bold: true }) : 0, gapL = wb ? 26 : 0, x0 = (PW - wa - wb - gapL) / 2;
          h += T(a, x0, yl, { size: 7.5, color: C.tinta, cs: 1.6, bold: true });
          h += botaoAcao(x0 - 6, yl - 15, wa + 12, 22, `data-add="${esc(p.id)}"`, "Adicionar à sacola");
          if (wb) { h += T("·", x0 + wa + gapL / 2 - 2, yl, { size: 7.5, color: C.suave, sans: true }); h += T(b, x0 + wa + gapL, yl, { size: 7.5, color: C.roxo, cs: 1.6, bold: true, href: "#sacola" }); }
        }
      }
    }
    if (seg && seg.fotos[0]) { const i = new Image(); i.src = fotoURL(seg.fotos[0].full); }
    return { bg: C.areia, html: h };
  }

  function paginaFoto(id, k) {
    const p = ativas().find(x => x.id === id);
    if (!p || k < 2 || k > p.fotos.length) return null;
    const f = p.fotos[k - 1];
    let h = moldura(C.roxo);
    h += T("‹  VOLTAR AO PRODUTO", 30, 43, { size: 9, color: C.tinta, cs: 2, bold: true, href: `#produto-${p.id}` });
    h += T(`FOTO ${k} DE ${p.fotos.length}`, PW - 30, 42, { size: 7, color: C.tinta, cs: 1.8, align: "right" });
    h += T("TOQUE NA FOTO E USE DOIS DEDOS PARA APROXIMAR", PW / 2, PH - 74, { size: 5.5, color: C.tinta, cs: 1.6, align: "center" });
    h += T(linhas(p.nome, 17, 320, 1)[0], PW / 2, 80, { size: 17, color: C.tinta, align: "center" });
    h += divisor(PW / 2, 94, 90);
    const maxW = PW - 64, maxH = PH - 118 - 92;
    let gw = maxW, gh = maxH, conhecido = false;
    if (f.w && f.h) { const kk = Math.min(maxW / f.w, maxH / f.h); gw = f.w * kk; gh = f.h * kk; conhecido = true; }
    const gx = (PW - gw) / 2, gy = 118 + (maxH - gh) / 2;
    h += img(fotoURL(f.full), gx, gy, gw, gh, "ct");
    h += `<button type="button" class="hit" style="${box(gx, gy, gw, gh)}" data-zoom="${esc(fotoURL(f.full))}" aria-label="Ampliar foto"></button>`;
    h += `<div class="fr-foto" data-auto="${conhecido ? 0 : 1}" style="${box(gx - 5, gy - 5, gw + 10, gh + 10)};border:max(${U(0.6)},.5px) solid ${C.papel};pointer-events:none"></div>`;
    const prev = k === 2 ? `#produto-${p.id}` : `#produto-${p.id}-foto-${k - 1}`;
    h += botao("‹  ANTERIOR", 30, PH - 46, { href: prev, nav: "prev" }).h;
    if (k < p.fotos.length) h += botao("PRÓXIMA  ›", PW - 30, PH - 46, { lado: "dir", href: `#produto-${p.id}-foto-${k + 1}`, nav: "next", cheio: true }).h;
    else h += botao("VOLTAR AO PRODUTO  ›", PW - 30, PH - 46, { lado: "dir", href: `#produto-${p.id}`, nav: "next", cheio: true }).h;
    return { bg: C.lilas, html: h };
  }

  function paginaAtendimento() {
    const cfg = V.cfg;
    let h = bolhas() + moldura(C.roxo);
    h += img("assets/emblema.svg", PW / 2 - 46, 62, 92, 81, "ct");
    h += T("Atendimento", PW / 2, 190, { size: 28, color: C.tinta, align: "center", italic: true });
    h += divisor(PW / 2, 208, 130);
    // blocos: rótulo pequeno + conteúdo (o espaço se ajusta à quantidade de blocos)
    const blocos = [];
    const ig = instaUser(cfg.instagram);
    if (ig) blocos.push({ rot: "INSTAGRAM", val: "@" + ig, href: perfilLink(ig), extra: canal() === "instagram" ? ["CHAME NO DIRECT  ›", directLink(ig)] : null });
    if (String(cfg.whatsapp || "").replace(/\D/g, "")) blocos.push({ rot: "WHATSAPP", val: cfg.whatsapp, href: whatsLink(cfg.whatsapp, `Olá! Vi a vitrine ${NOME_LOJA} e gostaria de atendimento.`) });
    if (cfg.entrega) blocos.push({ rot: "ENTREGA", txt: cfg.entrega });
    if (cfg.pagamentoInfo) blocos.push({ rot: "PAGAMENTO", txt: cfg.pagamentoInfo });
    if (cfg.horario) blocos.push({ rot: "HORÁRIO", txt: cfg.horario });
    const alturas = blocos.map(b => b.txt ? 22 + linhas(b.txt, 13, 300, 3).length * 17 : b.extra ? 54 : 40);
    const total = alturas.reduce((s, a) => s + a, 0), livre = PH - 160 - 246;
    const gap = Math.max(10, Math.min(26, (livre - total) / Math.max(1, blocos.length - 1)));
    let yk = 246 + Math.max(0, (livre - total - gap * (blocos.length - 1)) / 2);
    blocos.forEach((b, i) => {
      h += T(b.rot, PW / 2, yk, { size: 7.5, color: C.roxo, cs: 3, align: "center" });
      if (b.txt) linhas(b.txt, 13, 300, 3).forEach((l, k) => { h += T(l, PW / 2, yk + 21 + k * 17, { size: 13, color: C.tinta, align: "center" }); });
      else {
        h += T(b.val, PW / 2, yk + 23, { size: 17, color: C.tinta, align: "center", href: b.href, ext: true });
        if (b.extra) h += T(b.extra[0], PW / 2, yk + 42, { size: 7.5, color: C.roxo, cs: 1.8, bold: true, align: "center", href: b.extra[1], ext: true });
      }
      yk += alturas[i] + gap;
    });
    h += T(cfg.slogan || "Com amor, Imô.", PW / 2, PH - 112, { size: 16, color: C.roxo, align: "center", italic: true });
    h += botao("‹  VOLTAR À VITRINE", 0, PH - 62, { lado: "centro", href: "#categorias", nav: "prev" }).h;
    return { bg: C.lilas, html: h };
  }

  function paginaSacola(m) {
    const cfg = V.cfg, l = sacola(), por = 5;
    const pags = Math.max(1, Math.ceil(l.length / por)); m = Math.max(0, Math.min(m, pags - 1));
    let h = moldura();
    h += iconeSacola(PW / 2 - 13, 34, 26, C.roxo);
    h += T("Sua sacola", PW / 2, 92, { size: 28, color: C.tinta, align: "center", italic: true });
    h += divisor(PW / 2, 108, 130);
    const voltar = V.ultimaLista || "#categorias";
    if (!l.length) {
      h += T("Sua sacola está vazia.", PW / 2, 300, { size: 16, color: C.suave, align: "center", italic: true });
      h += T("TOQUE EM “ADICIONAR À SACOLA” NOS PRODUTOS QUE GOSTAR", PW / 2, 324, { size: 6.2, color: C.suave, cs: 1.4, align: "center" });
      h += botao("VER A VITRINE  ›", 0, PH - 62, { lado: "centro", href: voltar, cheio: true }).h;
      return { bg: C.areia, html: h };
    }
    const itens = l.map(i => ({ ...i, p: ativas().find(p => p.id === i.id) }));
    let y = 126; const RH = 70;
    for (const it of itens.slice(m * por, m * por + por)) {
      const p = it.p, src = thumbDe(p), sx = M;
      h += src ? img(src, sx, y, 56, 56, "im", `background:${C.lilas}`) : rect(sx, y, 56, 56, { fill: C.lilas });
      h += rect(sx, y, 56, 56, { stroke: C.linha, lw: 0.5 });
      h += link(sx, y, 56, 56, `#produto-${p.id}`, { label: p.nome });
      const nl = linhas(p.nome, 10.5, 170, 2);
      nl.forEach((t, i) => { h += T(t, sx + 66, y + 13 + i * 12.5, { size: 10.5, color: C.tinta }); });
      const sub = [p.codigo ? "REF. " + p.codigo.toUpperCase() : "", p.valor != null ? brl(p.valor) + " CADA" : "SOB CONSULTA"].filter(Boolean).join("  ·  ");
      const ySub = y + 13 + nl.length * 12.5 + 3;
      h += T(sub, sx + 66, ySub, { size: 6.5, color: C.suave, cs: 1.2 });
      if (p.valor != null) h += T(brl(p.valor * it.q), PW - M, y + 14, { size: 13, color: C.roxo, align: "right" });
      const qy = y + 32, qd = 22, qx = PW - M - 3 * qd - 4;
      h += rect(qx, qy, qd, qd, { stroke: C.roxo, lw: 0.8, r: qd / 2 }) + T("−", qx + qd / 2 - 3.3, qy + 15.5, { size: 13, color: C.tinta, sans: true });
      h += T(String(it.q), qx + qd + 2 + (qd - largura(String(it.q), 11, 0, { sans: true })) / 2, qy + 15, { size: 11, color: C.tinta, sans: true });
      h += rect(qx + 2 * qd + 4, qy, qd, qd, { fill: C.roxo, r: qd / 2 }) + T("+", qx + 2 * qd + 4 + qd / 2 - 3.6, qy + 15.5, { size: 13, color: C.papel, sans: true });
      h += botaoAcao(qx - 4, qy - 4, qd + 6, qd + 8, `data-menos="${esc(p.id)}"`, "Tirar um");
      h += botaoAcao(qx + 2 * qd + 2, qy - 4, qd + 6, qd + 8, `data-mais="${esc(p.id)}"`, "Mais um");
      h += `<button type="button" class="hit t" style="${box(sx + 66, ySub + 4, 60, 14)};${estiloTexto(6.5, {}, 1.4)}color:${C.suave};text-align:left;text-decoration:underline" data-tirar="${esc(p.id)}">REMOVER</button>`;
      y += RH;
      h += hline(M, PW - M, y - 7, C.linha, 0.3);
    }
    if (pags > 1) {
      if (m > 0) h += T("‹  ANTERIORES", M, y + 8, { size: 7.5, color: C.roxo, cs: 1.6, bold: true, href: `#sacola-${m}` });
      if (m < pags - 1) h += T("MAIS PRODUTOS  ›", PW - M, y + 8, { size: 7.5, color: C.roxo, cs: 1.6, bold: true, align: "right", href: `#sacola-${m + 2}` });
    }
    const n = l.reduce((s, i) => s + i.q, 0), semPreco = itens.some(i => i.p.valor == null);
    const total = itens.reduce((s, i) => s + (i.p.valor || 0) * i.q, 0);
    const yt = PH - 168;
    h += hline(M, PW - M, yt - 18, C.roxo, 0.5);
    h += T(`TOTAL · ${n} ${n === 1 ? "PRODUTO" : "PRODUTOS"}`, M, yt, { size: 8, color: C.tinta, cs: 2.2, bold: true });
    h += T(brl(total) + (semPreco ? " +" : ""), PW - M, yt + 2, { size: 19, color: C.roxo, align: "right" });
    const lp = linhaPagamento(total);
    if (lp) h += T_CENTRO_AJUSTADO(lp, yt + 22, 7.5, C.tinta);
    if (semPreco) h += T("ALGUNS PRODUTOS SÃO SOB CONSULTA", PW / 2, yt + 36, { size: 6, color: C.suave, cs: 1.4, align: "center" });
    const w = 286, hh = 44, x = (PW - w) / 2, yb = PH - 110;
    h += `<div class="cta" style="${box(x, yb, w, hh)};background:${C.roxo};border-radius:${U(hh / 2)};pointer-events:none"></div>`;
    h += T(canal() === "whatsapp" ? "ENVIAR PEDIDO NO WHATSAPP  ›" : "ENVIAR PEDIDO NO DIRECT  ›", PW / 2, yb + hh / 2 + 4, { size: 10.5, color: C.papel, cs: 2.2, align: "center", bold: true });
    h += botaoAcao(x, yb, w, hh, `data-pedido="1"`, "Enviar pedido");
    h += botao("‹  CONTINUAR VENDO", M, PH - 40, { href: voltar, nav: "prev" }).h;
    h += `<button type="button" class="hit t" style="${box(PW - M - 90, PH - 50, 90, 20)};${estiloTexto(7, {}, 1.6)}color:${C.suave};text-align:right;text-decoration:underline" data-esvaziar="1">ESVAZIAR SACOLA</button>`;
    return { bg: C.areia, html: h };
  }

  /* ---------- mensagens de pedido ---------- */
  const linhaItem = (p, q = 1) => `• ${q > 1 ? q + "× " : ""}${p.nome}${p.codigo ? " (" + p.codigo + ")" : ""} — ${p.valor != null ? brl(p.valor * q) : "sob consulta"}`;
  function msgProduto(p) { return [V.cfg.msgPedido || IM.MSG_PADRAO, "", linhaItem(p)].join("\n"); }
  function msgSacola() {
    const itens = sacola().map(i => ({ ...i, p: ativas().find(p => p.id === i.id) }));
    const total = itens.reduce((s, i) => s + (i.p.valor || 0) * i.q, 0), semPreco = itens.some(i => i.p.valor == null);
    const pg = pagamento(V.cfg, total);
    return [V.cfg.msgPedido || IM.MSG_PADRAO, "", ...itens.map(i => linhaItem(i.p, i.q)), "",
      `Total: ${brl(total)}${semPreco ? " + produtos sob consulta" : ""}`,
      ...(pg && pg.pix != null ? [`No Pix: ${brl(pg.pix)} (${IM.pctTxt(pg.pixPct)} de desconto)`] : []),
      ...(pg && pg.parcelas ? [`Ou ${pg.parcelas}x de ${brl(pg.parcela)} sem juros`] : [])].join("\n");
  }
  // copia um texto (com reserva para aparelhos que não deixam usar a área de transferência)
  async function copiar(texto) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(texto); return true; } } catch (e) { }
    try {
      const ta = document.createElement("textarea"); ta.value = texto; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, texto.length);
      const ok = document.execCommand("copy"); ta.remove(); return ok;
    } catch (e) { return false; }
  }
  // WhatsApp abre com a mensagem pronta; o Direct do Instagram não aceita texto pronto,
  // então a mensagem é copiada e a cliente só cola na conversa.
  function enviarPedido(msg, titulo = "Seu pedido") {
    const c = canal();
    if (c === "whatsapp") { window.open(whatsLink(V.cfg.whatsapp, msg), "_blank", "noopener"); return; }
    if (c !== "instagram") return;
    const copiou = copiar(msg);
    document.getElementById("aviso").hidden = true;
    const ov = document.createElement("div");
    ov.className = "ped"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-labelledby", "pedT");
    ov.innerHTML = `<div class="ped-box">
      <button type="button" class="ped-x" aria-label="Fechar">×</button>
      <img src="assets/emblema.svg" alt="" class="ped-logo">
      <h2 id="pedT">${esc(titulo)}</h2>
      <p class="ped-ok" id="pedOk">Copiando a mensagem…</p>
      <pre class="ped-msg">${esc(msg)}</pre>
      <ol class="ped-passos"><li><span>Toque em <b>Abrir o Direct</b></span></li><li><span>Na conversa, toque e segure e escolha <b>Colar</b></span></li><li><span>Envie a mensagem</span></li></ol>
      <a class="ped-btn" href="${esc(directLink(V.cfg.instagram))}" target="_blank" rel="noopener">Abrir o Direct  ›</a>
      <button type="button" class="ped-copiar">Copiar a mensagem de novo</button>
    </div>`;
    document.body.appendChild(ov);
    const ok = v => { const e = ov.querySelector("#pedOk"); e.textContent = v ? "✓  Mensagem copiada" : "Toque e segure a mensagem abaixo para copiar"; e.classList.toggle("falhou", !v); };
    copiou.then(ok);
    const fechar = () => { ov.remove(); document.removeEventListener("keydown", tecla, true); };
    const tecla = e => { if (e.key === "Escape") { e.stopPropagation(); fechar(); } };
    document.addEventListener("keydown", tecla, true);
    ov.querySelector(".ped-x").onclick = fechar;
    ov.addEventListener("click", e => { if (e.target === ov) fechar(); });
    ov.querySelector(".ped-copiar").onclick = () => copiar(msg).then(v => { ok(v); if (v) avisar("Mensagem copiada"); });
    ov.querySelector(".ped-btn").addEventListener("click", () => { copiar(msg); });
    setTimeout(() => ov.querySelector(".ped-btn").focus(), 50);
  }

  /* ---------- ampliar foto com dois dedos ---------- */
  function abrirZoom(src) {
    const ov = document.createElement("div");
    ov.className = "zoom";
    ov.innerHTML = `<img alt="" src="${esc(src)}" draggable="false"><button type="button" class="zoom-x" aria-label="Fechar">×</button><p class="zoom-dica">Use dois dedos para aproximar · toque duas vezes para ampliar</p>`;
    document.body.appendChild(ov);
    const im = ov.querySelector("img"), pts = new Map();
    let s = 1, tx = 0, ty = 0, base = null, ultimoToque = 0;
    const limitar = () => {
      s = Math.min(5, Math.max(1, s));
      const r = ov.getBoundingClientRect(), mw = (im.offsetWidth * s - r.width) / 2, mh = (im.offsetHeight * s - r.height) / 2;
      tx = Math.max(-Math.max(0, mw), Math.min(Math.max(0, mw), tx)); ty = Math.max(-Math.max(0, mh), Math.min(Math.max(0, mh), ty));
      if (s === 1) { tx = 0; ty = 0; }
    };
    const aplicar = () => { limitar(); im.style.transform = `translate(${tx}px,${ty}px) scale(${s})`; };
    const fechar = () => { ov.remove(); document.removeEventListener("keydown", tecla, true); };
    const tecla = e => { if (e.key === "Escape") { e.stopPropagation(); fechar(); } else if (e.key.startsWith("Arrow")) e.stopPropagation(); };
    document.addEventListener("keydown", tecla, true);
    ov.querySelector(".zoom-x").onclick = fechar;
    const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    const meio = () => { const [a, b] = [...pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
    im.addEventListener("pointerdown", e => {
      im.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) base = { d: dist(), s, tx, ty, m: meio() };
      else if (pts.size === 1) {
        const agora = Date.now();
        if (agora - ultimoToque < 300) {
          if (s > 1) { s = 1; } else { const r = ov.getBoundingClientRect(); s = 2.5; tx = (r.width / 2 - e.clientX) * 1.5; ty = (r.height / 2 - e.clientY) * 1.5; }
          aplicar(); ultimoToque = 0; return;
        }
        ultimoToque = agora; base = { x: e.clientX, y: e.clientY, tx, ty };
      }
    });
    im.addEventListener("pointermove", e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && base && base.d) { const m2 = meio(); s = base.s * dist() / base.d; tx = base.tx + (m2.x - base.m.x); ty = base.ty + (m2.y - base.m.y); aplicar(); }
      else if (pts.size === 1 && base && s > 1) { tx = base.tx + (e.clientX - base.x); ty = base.ty + (e.clientY - base.y); aplicar(); }
    });
    const solta = e => { pts.delete(e.pointerId); if (pts.size === 1) { const [p] = [...pts.values()]; base = { x: p.x, y: p.y, tx, ty }; } else if (!pts.size) base = null; };
    im.addEventListener("pointerup", solta); im.addEventListener("pointercancel", solta);
    ov.addEventListener("wheel", e => { e.preventDefault(); s *= e.deltaY < 0 ? 1.15 : 1 / 1.15; aplicar(); }, { passive: false });
  }

  /* ---------- compartilhar o produto com a foto ---------- */
  const fotoPronta = new Map();
  function prepararFoto(p) {
    if (!p || !p.fotos[0] || fotoPronta.has(p.id) || !navigator.canShare) return;
    fotoPronta.set(p.id, null);
    fetch(fotoURL(p.fotos[0].full)).then(r => r.ok ? r.blob() : null).then(b => {
      if (!b) return;
      const nome = (p.nome || "produto").normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40) || "produto";
      fotoPronta.set(p.id, new File([b], `imo-${nome}.jpg`, { type: b.type || "image/jpeg" }));
    }).catch(() => { });
  }
  async function compartilhar(id) {
    const p = ativas().find(x => x.id === id); if (!p) return;
    const url = location.href.split("#")[0] + "#produto-" + id;
    const texto = `${p.nome}${p.valor != null ? " — " + brl(p.valor) : ""}\n${NOME_LOJA}: ${url}`;
    const f = fotoPronta.get(id);
    try {
      if (f && navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], text: texto }); return; }
      if (navigator.share) { await navigator.share({ title: p.nome, text: texto, url }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    if (await copiar(texto)) avisar("Link do produto copiado. É só colar na conversa."); else avisar(url);
  }

  /* ---------- rotas ---------- */
  function rota() {
    const hsh = decodeURIComponent(location.hash.replace(/^#/, ""));
    let m;
    if (!hsh || hsh === "capa") return { tipo: "capa" };
    if (hsh === "categorias" || hsh === "linhas") return { tipo: "categorias", n: 0 };
    if ((m = hsh.match(/^categorias-(\d+)$/))) return { tipo: "categorias", n: +m[1] - 1 };
    if ((m = hsh.match(/^cat-(.+)-(\d+)$/))) return { tipo: "indice", cat: m[1], n: +m[2] - 1 };
    if ((m = hsh.match(/^novidades-(\d+)$/))) return { tipo: "novidades", n: +m[1] - 1 };
    if ((m = hsh.match(/^(?:produto|peca)-(.+)-foto-(\d+)$/))) return { tipo: "foto", id: m[1], k: +m[2] };
    if ((m = hsh.match(/^(?:produto|peca)-(.+)$/))) return { tipo: "peca", id: m[1] };
    if (hsh === "atendimento") return { tipo: "atendimento" };
    if ((m = hsh.match(/^sacola(?:-(\d+))?$/))) return { tipo: "sacola", n: m[1] ? +m[1] - 1 : 0 };
    return { tipo: "capa" };
  }
  function desenhar() {
    if (!V.pronto) return;
    const r = rota();
    let pg = null;
    if (r.tipo === "capa") pg = paginaCapa();
    else if (r.tipo === "categorias") pg = paginaCategorias(r.n);
    else if (r.tipo === "indice") pg = daCat(r.cat).length ? paginaIndice(r.n, r.cat) : null;
    else if (r.tipo === "novidades") pg = ativas().some(ehNova) ? paginaIndice(r.n, "novidades") : null;
    else if (r.tipo === "peca") { pg = paginaPeca(r.id); if (pg) registrar("peca", r.id); }
    else if (r.tipo === "foto") pg = paginaFoto(r.id, r.k);
    else if (r.tipo === "atendimento") pg = paginaAtendimento();
    else if (r.tipo === "sacola") pg = usaSacola() ? paginaSacola(r.n) : null;
    if (r.tipo === "indice" || r.tipo === "novidades") V.ultimaLista = location.hash;
    if (r.tipo === "peca") prepararFoto(ativas().find(p => p.id === r.id));
    if (!pg) { location.replace("#categorias"); return; }
    app.style.background = pg.bg;
    document.querySelector('meta[name="theme-color"]').setAttribute("content", pg.bg);
    app.innerHTML = `<div class="st" style="background:${pg.bg}">${pg.html}</div>`;
    ajustarMolduras();
  }
  // moldura justa em volta da foto quando o tamanho dela ainda não era conhecido
  function ajustarMolduras() {
    app.querySelectorAll('.fr-foto[data-auto="1"]').forEach(fr => {
      let im = fr.previousElementSibling;
      while (im && im.tagName !== "IMG") im = im.previousElementSibling;
      if (!im) return;
      const aplicar = () => {
        if (!im.naturalWidth) return;
        const bw = parseFloat(im.style.width.match(/\*([\d.]+)/)[1]), bh = parseFloat(im.style.height.match(/\*([\d.]+)/)[1]);
        const bx = parseFloat(im.style.left.match(/\*(-?[\d.]+)/)[1]), by = parseFloat(im.style.top.match(/\*(-?[\d.]+)/)[1]);
        const k = Math.min(bw / im.naturalWidth, bh / im.naturalHeight), w = im.naturalWidth * k, hh = im.naturalHeight * k;
        const x = bx + (bw - w) / 2, y = by + (bh - hh) / 2;
        fr.style.left = U(x - 5); fr.style.top = U(y - 5); fr.style.width = U(w + 10); fr.style.height = U(hh + 10);
      };
      if (im.complete) aplicar(); else im.addEventListener("load", aplicar, { once: true });
    });
  }
  window.addEventListener("hashchange", desenhar);
  document.addEventListener("keydown", e => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    if (document.querySelector(".ped,.zoom")) return;
    const a = app.querySelector(`[data-nav="${e.key === "ArrowRight" ? "next" : "prev"}"]`);
    if (a) location.hash = a.getAttribute("href");
  });

  /* ---------- aviso ---------- */
  let avisoT;
  function avisar(msg) { const a = document.getElementById("aviso"); a.textContent = msg; a.hidden = false; clearTimeout(avisoT); avisoT = setTimeout(() => a.hidden = true, 4000); }

  /* ---------- carregar e acompanhar mudanças ---------- */
  let sb = null;

  /* ---------- contador de acessos ----------
     Anota: abriu a vitrine, abriu um produto, tocou em "Comprar".
     Não conta o dono (aparelho com o painel conectado) e não repete a mesma
     anotação em menos de 30 minutos. O visitante é só um código aleatório do aparelho. */
  function visitante() {
    try {
      let v = localStorage.getItem("imo-visitante");
      if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/-/g, ""); localStorage.setItem("imo-visitante", v); }
      return v;
    } catch (e) { return "semlocal" + Math.random().toString(36).slice(2, 12); }
  }
  function ehDaLoja() {
    try {
      const tem = st => Object.keys(st).some(k => /^sb-.+-auth-token$/.test(k));
      return tem(localStorage) || tem(sessionStorage);
    } catch (e) { return false; }
  }
  function registrar(tipo, pecaId) {
    if (!sb || ehDaLoja()) return;
    const chave = "imo-reg-" + tipo + "-" + (pecaId || "");
    try { const t = +sessionStorage.getItem(chave) || 0; if (Date.now() - t < 30 * 60e3) return; sessionStorage.setItem(chave, String(Date.now())); } catch (e) { }
    try { sb.from("acessos").insert({ tipo, visitante: visitante(), peca_id: pecaId || null }).then(() => { }, () => { }); } catch (e) { }
  }
  app.addEventListener("click", e => {
    const b = e.target.closest("button[data-add],button[data-mais],button[data-menos],button[data-tirar],button[data-esvaziar],button[data-zoom],button[data-share],button[data-comprar],button[data-aviseme],button[data-pedido]");
    if (!b) return;
    const d = b.dataset;
    if (d.zoom) { abrirZoom(d.zoom); return; }
    if (d.share) { compartilhar(d.share); return; }
    if (d.comprar) { const p = ativas().find(x => x.id === d.comprar); if (p) { registrar("zap", p.id); enviarPedido(msgProduto(p)); } return; }
    if (d.aviseme) { const p = ativas().find(x => x.id === d.aviseme); if (p) enviarPedido(`Olá! Tenho interesse no ${p.nome}${p.codigo ? " (" + p.codigo + ")" : ""}. Pode me avisar quando voltar?`, "Avise-me quando voltar"); return; }
    if (d.pedido) { sacola().forEach(i => registrar("zap", i.id)); enviarPedido(msgSacola()); return; }
    if (d.add) { mudarSacola(d.add, 1); const n = qtdSacola(); avisar(`Adicionado à sacola · ${n} ${n === 1 ? "produto" : "produtos"}`); }
    else if (d.mais) mudarSacola(d.mais, 1);
    else if (d.menos) mudarSacola(d.menos, -1);
    else if (d.tirar) mudarSacola(d.tirar, 0, true);
    else if (d.esvaziar) salvarSacola([]);
    desenhar();
  });
  async function carregar() {
    const [r1, r2] = await Promise.all([
      sb.from("pecas").select("*").eq("arquivada", false).order("criado_em", { ascending: true }),
      sb.from("config").select("*").eq("id", 1).maybeSingle()
    ]);
    if (r1.error) throw r1.error;
    if (r2.error) throw r2.error;
    let desejadas = [];
    try { const r3 = await sb.rpc("mais_desejadas", { qtd: 3 }); if (!r3.error && Array.isArray(r3.data)) desejadas = r3.data.map(x => typeof x === "object" && x ? Object.values(x)[0] : x); } catch (e) { }
    return { pecas: (r1.data || []).map(rowToPeca), cfg: rowToConfig(r2.data), desejadas };
  }
  let recT;
  function recarregar() {
    clearTimeout(recT);
    recT = setTimeout(async () => {
      try {
        const antes = new Set(V.pecas.map(p => p.id));
        const d = await carregar();
        const chave = x => JSON.stringify([x.pecas, x.cfg, [...x.desejadas].sort()]);
        const mudou = chave({ ...d, desejadas: new Set(d.desejadas) }) !== chave(V);
        V.pecas = d.pecas; V.cfg = d.cfg; V.desejadas = new Set(d.desejadas);
        if (mudou && !document.querySelector(".ped")) {
          const novas = d.pecas.filter(p => !antes.has(p.id)).length;
          desenhar();
          avisar(novas ? `Vitrine atualizada · ${novas} ${novas === 1 ? "produto novo" : "produtos novos"}` : "Vitrine atualizada");
        }
      } catch (e) { /* tenta de novo na próxima mudança */ }
    }, 500);
  }

  function erro(msg, retry) {
    app.style.background = C.lilas;
    app.innerHTML = `<div class="msg"><div><img src="assets/emblema.svg" alt=""><h1>Imô</h1><p>${esc(msg)}</p>${retry ? '<button type="button" id="tentar">Tentar de novo</button>' : ""}</div></div>`;
    const b = document.getElementById("tentar"); if (b) b.onclick = () => location.reload();
  }

  async function iniciar() {
    if (!configurado()) { erro("A vitrine está sendo preparada. Volte em instantes.", false); return; }
    // novidades: produtos cadastrados depois da última visita (na primeira visita, os dos últimos 30 dias)
    const agora = Date.now();
    try {
      const ult = +localStorage.getItem("imo-ultima-visita") || 0;
      V.novDesde = ult || agora - 30 * 864e5;
      localStorage.setItem("imo-ultima-visita", String(agora));
    } catch (e) { V.novDesde = agora - 30 * 864e5; }
    try { await Promise.all([document.fonts.load(`500 10px "IM Serif"`), document.fonts.load(`italic 500 10px "IM Serif"`), document.fonts.load(`400 10px "IM Sans"`), document.fonts.load(`500 10px "IM Sans"`)]); } catch (e) { }
    try {
      sb = criarCliente();
      const d = await carregar();
      V.pecas = d.pecas; V.cfg = d.cfg; V.desejadas = new Set(d.desejadas); V.pronto = true;
      registrar("visita");
      desenhar();
    } catch (e) {
      console.error(e);
      erro("Não foi possível abrir a vitrine agora. Verifique a internet e tente de novo.", true);
      return;
    }
    try {
      sb.channel("vitrine-publica")
        .on("postgres_changes", { event: "*", schema: "public", table: "config" }, recarregar)
        .subscribe();
    } catch (e) { }
    document.addEventListener("visibilitychange", () => { if (!document.hidden) recarregar(); });
    setInterval(() => { if (!document.hidden) recarregar(); }, 5 * 60 * 1000);
  }
  window.__vitrine = { recarregar, V };
  iniciar();
})();
