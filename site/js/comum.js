/* Vitrine Imô — funções usadas pela vitrine, pelo painel e pela gestão */
(function () {
  const CFG = window.IMO || {};

  const configurado = () =>
    !!window.__MOCK_SUPABASE ||
    (!!CFG.SUPABASE_URL && !/SEU-PROJETO/.test(CFG.SUPABASE_URL) &&
     !!CFG.SUPABASE_ANON_KEY && !/COLE-AQUI/.test(CFG.SUPABASE_ANON_KEY));

  // "Manter conectado": com a opção ligada a sessão fica guardada no aparelho (localStorage);
  // desligada, só vale enquanto a página estiver aberta (sessionStorage).
  const manterConectado = () => { try { return localStorage.getItem("imo-manter") !== "0"; } catch (e) { return true; } };
  const armazenamento = {
    getItem: k => { try { const v = localStorage.getItem(k); return v != null ? v : sessionStorage.getItem(k); } catch (e) { return null; } },
    setItem: (k, v) => {
      try {
        if (manterConectado()) { localStorage.setItem(k, v); sessionStorage.removeItem(k); }
        else { sessionStorage.setItem(k, v); localStorage.removeItem(k); }
      } catch (e) { }
    },
    removeItem: k => { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) { } }
  };
  let cliente = null;
  function criarCliente() {
    if (cliente) return cliente;
    cliente = window.__MOCK_SUPABASE ||
      window.supabase.createClient(String(CFG.SUPABASE_URL).replace(/\/(rest|auth)\/v1\/?$/, "").replace(/\/+$/, ""), CFG.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: armazenamento }
      });
    return cliente;
  }

  const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  // formato brasileiro sem depender do idioma do aparelho: R$ 1.234,50
  const brl = c => {
    if (c == null || c === "" || isNaN(c)) return "";
    const v = Math.round(Number(c)), neg = v < 0, a = Math.abs(v);
    const int = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg ? "-" : "") + "R$ " + int + "," + String(a % 100).padStart(2, "0");
  };
  const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
  const mesAno = (d = new Date()) => `${MESES[d.getMonth()]} · ${d.getFullYear()}`;
  const catOf = p => (p.categoria || "").trim();
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  // endereço curto de uma categoria (ex.: "Massageador" -> "massageador")
  const slug = s => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "outros";
  // peso em gramas: 90 -> "90 g"; 1250 -> "1,25 kg"
  const pesoTxt = g => g == null || g === "" || isNaN(g) ? "" : (g >= 1000 ? String(+(g / 1000).toFixed(2)).replace(".", ",") + " kg" : Math.round(g) + " g");

  function rankCat(cfg, c) {
    if (!c) return Infinity;
    const i = ((cfg && cfg.ordemCats) || []).findIndex(x => norm(x) === norm(c));
    return i >= 0 ? i : 100000;
  }
  const ordenarCats = (cfg, cats) => [...cats].sort((a, b) => (rankCat(cfg, a) - rankCat(cfg, b)) || a.localeCompare(b, "pt-BR"));
  function ordenar(cfg, pecas) {
    return [...pecas].sort((a, b) => {
      const ca = catOf(a), cb = catOf(b);
      const r = rankCat(cfg, ca) - rankCat(cfg, cb);
      if (r) return r;
      return (ca || "￿").localeCompare(cb || "￿", "pt-BR") || (a.criadoEm || 0) - (b.criadoEm || 0);
    });
  }

  function whatsLink(num, msg) {
    let d = String(num || "").replace(/\D/g, "");
    if (!d) return null;
    if (d.length <= 11) d = "55" + d;
    return `https://wa.me/${d}?text=${encodeURIComponent(msg)}`;
  }
  // Direct do Instagram: abre a conversa com a loja (o Instagram não aceita mensagem pronta)
  const instaUser = s => String(s || "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@+/, "").replace(/[/?#].*$/, "");
  const directLink = ig => instaUser(ig) ? `https://ig.me/m/${encodeURIComponent(instaUser(ig))}` : null;
  const perfilLink = ig => instaUser(ig) ? `https://instagram.com/${encodeURIComponent(instaUser(ig))}` : null;

  const lerTags = t => (Array.isArray(t) ? t : String(t || "").split(/[,;\n#]+/)).map(x => String(x).trim().replace(/^#+/, "")).filter((x, i, a) => x && a.findIndex(y => norm(y) === norm(x)) === i).slice(0, 12);

  const rowToPeca = r => ({
    id: r.id, nome: r.nome || "", codigo: r.codigo || "", categoria: r.categoria || "",
    peso: r.peso == null ? null : Number(r.peso), composicao: r.composicao || "", tags: lerTags(r.tags),
    valor: r.valor == null ? null : Number(r.valor), descricao: r.descricao || "",
    valorAntigo: r.valor_antigo == null ? null : Number(r.valor_antigo),
    fotos: Array.isArray(r.fotos) ? r.fotos.filter(f => f && (f.full || f.thumb)) : [],
    arquivada: !!r.arquivada, esgotada: !!r.esgotada,
    criadoEm: Date.parse(r.criado_em) || 0, atualizadoEm: Date.parse(r.atualizado_em) || 0
  });
  const pecaToRow = d => ({
    nome: d.nome, codigo: d.codigo || "", categoria: d.categoria || "",
    peso: d.peso == null ? null : Math.round(d.peso), composicao: d.composicao || "", tags: lerTags(d.tags),
    valor: d.valor == null ? null : Math.round(d.valor), descricao: d.descricao || "",
    valor_antigo: d.valorAntigo == null ? null : Math.round(d.valorAntigo),
    fotos: (d.fotos || []).map(f => Object.assign({ full: f.full, thumb: f.thumb || f.full }, f.w && f.h ? { w: f.w, h: f.h } : {})),
    arquivada: !!d.arquivada, esgotada: !!d.esgotada,
    criado_em: new Date(d.criadoEm || Date.now()).toISOString(),
    atualizado_em: new Date().toISOString()
  });

  const MSG_PADRAO = "Gostaria de fazer meu pedido agora.";
  const rowToConfig = r => {
    r = r || {};
    return {
      colecao: r.colecao || "", whatsapp: r.whatsapp || "", instagram: r.instagram || "",
      ordemCats: Array.isArray(r.ordem_cats) ? r.ordem_cats : [], atualizadoEm: Date.parse(r.atualizado_em) || 0,
      // produto escolhido como foto de cada categoria (null = automático)
      destaques: (r.destaques && typeof r.destaques === "object") ? r.destaques : {},
      // pagamento mostrado na vitrine (Pix com desconto e parcelas sem juros)
      pixDesconto: r.pix_desconto != null ? Number(r.pix_desconto) : 0,
      parcelasMax: r.parcelas_max != null ? Number(r.parcelas_max) : 0,
      parcelaMin: r.parcela_min != null ? Number(r.parcela_min) : 0,
      // pedidos: "instagram" (Direct) ou "whatsapp"
      canal: r.canal_pedido === "whatsapp" ? "whatsapp" : "instagram",
      msgPedido: r.msg_pedido || MSG_PADRAO,
      entrega: r.entrega || "", pagamentoInfo: r.pagamento_info || "", horario: r.horario || "",
      slogan: r.slogan || ""
    };
  };
  const configToRow = c => ({
    colecao: c.colecao || "", whatsapp: c.whatsapp || "", instagram: c.instagram || "",
    ordem_cats: c.ordemCats || [], destaques: c.destaques || {},
    pix_desconto: Number(c.pixDesconto) || 0, parcelas_max: Math.max(0, Math.round(c.parcelasMax || 0)), parcela_min: Math.max(0, Math.round(c.parcelaMin || 0)),
    canal_pedido: c.canal === "whatsapp" ? "whatsapp" : "instagram", msg_pedido: (c.msgPedido || "").trim() || MSG_PADRAO,
    entrega: c.entrega || "", pagamento_info: c.pagamentoInfo || "", horario: c.horario || "", slogan: c.slogan || "",
    atualizado_em: new Date().toISOString()
  });
  // canal de pedidos que está funcionando de verdade (precisa do contato preenchido)
  function canalAtivo(cfg) {
    if (!cfg) return null;
    if (cfg.canal === "whatsapp" && String(cfg.whatsapp || "").replace(/\D/g, "")) return "whatsapp";
    if (instaUser(cfg.instagram)) return "instagram";
    if (String(cfg.whatsapp || "").replace(/\D/g, "")) return "whatsapp";
    return null;
  }

  // preço no Pix e parcelas sem juros, conforme os Ajustes
  function pagamento(cfg, valor) {
    if (valor == null) return null;
    const pix = cfg && cfg.pixDesconto > 0 ? Math.round(valor * (1 - cfg.pixDesconto)) : null;
    let n = 0;
    if (cfg && cfg.parcelasMax > 1) {
      n = cfg.parcelaMin > 0 ? Math.min(cfg.parcelasMax, Math.floor(valor / cfg.parcelaMin)) : cfg.parcelasMax;
      if (n < 2) n = 0;
    }
    return { pix, pixPct: cfg ? cfg.pixDesconto : 0, parcelas: n, parcela: n ? Math.ceil(valor / n) : null };
  }
  const pctTxt = x => String(+(x * 100).toFixed(1)).replace(".", ",") + "%";

  // próximo código livre: IMO-001, IMO-002…
  function proximoCodigo(pecas, prefixo = "IMO-") {
    let max = 0;
    const re = new RegExp("^" + prefixo.replace(/[-]/g, "\\-") + "(\\d+)$", "i");
    (pecas || []).forEach(p => { const m = String(p.codigo || "").trim().match(re); if (m) max = Math.max(max, +m[1]); });
    return prefixo + String(max + 1).padStart(3, "0");
  }

  function fotoURL(path) {
    if (!path) return "";
    return criarCliente().storage.from("fotos").getPublicUrl(path).data.publicUrl;
  }

  window.IM = { pagamento, pctTxt, CFG, configurado, criarCliente, manterConectado, esc, brl, mesAno, catOf, norm, slug, pesoTxt, rankCat, ordenarCats, ordenar, whatsLink, directLink, perfilLink, instaUser, canalAtivo, lerTags, rowToPeca, pecaToRow, rowToConfig, configToRow, proximoCodigo, fotoURL, MSG_PADRAO };
})();
