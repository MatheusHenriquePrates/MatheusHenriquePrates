// Artes fixas do README do perfil, geradas uma vez e guardadas em assets/ (o cartão de números é
// outro script, que o Actions roda todo dia):
//   hero.svg        topo com nome, título e terminal, com uma rede de agentes animada ao fundo
//   card-*.svg      cartões dos sistemas em produção, cada um com o produto funcionando
//   stack.svg       faixa com os logotipos oficiais (Simple Icons, CC0) nas cores da marca
//   titulo-*.svg    títulos de seção em estilo terminal, datilografados ao abrir
// Uso: node .github/scripts/arte.mjs (grava em assets/). Fontes de assets/fontes: JetBrains Mono 400/700 e
// Inter 600/800 do Google Fonts, recortadas com fontTools no latim com acento. Ícones de icones.json.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const AQUI = dirname(fileURLToPath(import.meta.url)), RAIZ = join(AQUI, "..", "..");
const F = (n) => readFileSync(join(RAIZ, "assets", "fontes", `${n}.woff2`)).toString("base64");
const fonte = (fam, arq, peso) => `@font-face{font-family:'${fam}';src:url(data:font/woff2;base64,${F(arq)}) format('woff2');font-weight:${peso}}`;
const ICONES = JSON.parse(readFileSync(join(AQUI, "icones.json"), "utf8"));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r = (x) => Math.round(x * 10000) / 10000;
const OUT = process.argv[2] || join(RAIZ, "assets");
mkdirSync(OUT, { recursive: true });
const salva = (nome, svg) => { writeFileSync(`${OUT}/${nome}`, svg); console.log(nome, Math.round(svg.length / 1024), "KB"); };

// anima(attr, L, [[t, v], ...]): valores num laço de L segundos (completa t=0 e t=L).
function anima(attr, L, pares, { discreto = false, extra = "" } = {}) {
  const p = [...pares].sort((a, b) => a[0] - b[0]);
  if (p[0][0] > 0) p.unshift([0, p[0][1]]);
  if (p[p.length - 1][0] < L) p.push([L, p[p.length - 1][1]]);
  return `<animate attributeName="${attr}" dur="${L}s" repeatCount="indefinite" ${discreto ? 'calcMode="discrete" ' : ""}keyTimes="${p.map((x) => r(x[0] / L)).join(";")}" values="${p.map((x) => x[1]).join(";")}" ${extra}/>`;
}
function move(L, pares) { // translate por pares [t, "x y"]
  const p = [...pares].sort((a, b) => a[0] - b[0]);
  if (p[0][0] > 0) p.unshift([0, p[0][1]]);
  if (p[p.length - 1][0] < L) p.push([L, p[p.length - 1][1]]);
  return `<animateTransform attributeName="transform" type="translate" dur="${L}s" repeatCount="indefinite" keyTimes="${p.map((x) => r(x[0] / L)).join(";")}" values="${p.map((x) => x[1]).join(";")}"/>`;
}
const luminancia = (hex) => { const [a, b, c] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); return 0.2126 * a + 0.7152 * b + 0.0722 * c; };
const corDoIcone = (slug) => { const h = ICONES[slug]?.hex || "c9d1d9"; return luminancia(h) < 0.28 ? "#e6edf3" : "#" + h; };
const icone = (slug, x, y, tam) => ICONES[slug] ? `<g transform="translate(${x},${y}) scale(${tam / 24})"><path d="${ICONES[slug].path}" fill="${corDoIcone(slug)}"/></g>` : "";

// Datilografia em degraus (da v1).
let nClip = 0;
function datilografa({ texto, x, y, tam, classe, inicio, porChar, fim, T, cursor = false, apagaDeVolta = false }) {
  const cw = tam * 0.6, n = [...texto].length, id = "c" + nClip++;
  const tempos = [0], larguras = [0];
  for (let k = 1; k <= n; k++) { tempos.push((inicio + k * porChar) / T); larguras.push(k * cw); }
  if (apagaDeVolta) { const passo = 0.025; for (let k = n - 1; k >= 0; k--) { tempos.push((fim + (n - 1 - k) * passo) / T); larguras.push(k * cw); } }
  else { tempos.push(fim / T); larguras.push(0); }
  tempos.push(1); larguras.push(0);
  const kt = tempos.map(r).join(";"), vs = larguras.map((w) => r(w)).join(";");
  let s = `<clipPath id="${id}"><rect x="${x}" y="${y - tam * 1.05}" height="${tam * 1.4}" width="0"><animate attributeName="width" dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${kt}" values="${vs}"/></rect></clipPath>`;
  s += `<text x="${x}" y="${y}" class="${classe}" clip-path="url(#${id})">${esc(texto)}</text>`;
  if (cursor) {
    const xs = larguras.map((w) => r(x + w + 2)).join(";");
    const ops = larguras.map((w, i) => (i === 0 || i === larguras.length - 1 || i === larguras.length - 2 ? 0 : 1)).join(";");
    s += `<rect y="${y - tam * 0.95}" width="${tam * 0.55}" height="${tam * 1.15}" class="cursor" x="${x}"><animate attributeName="x" dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${kt}" values="${xs}"/><animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${kt}" values="${ops}"/></rect>`;
  }
  return s;
}
const aparece = (em, some, T) => `<animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="0;${r(em / T)};${r(some / T)};1" values="0;1;0;0"/>`;

// ================================================================ topo
{
  const T = 16, W = 1600, H = 440;
  // Rede de agentes: nós fixos (semente determinística), arestas entre vizinhos e pulsos correndo.
  let semente = 7; const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  const nos = []; for (let i = 0; i < 26; i++) nos.push([40 + rnd() * 900, 24 + rnd() * 392]);
  const arestas = [];
  nos.forEach((a, i) => nos.forEach((b, j) => { if (j > i && Math.hypot(a[0] - b[0], a[1] - b[1]) < 190) arestas.push([i, j]); }));
  let rede = arestas.map(([i, j]) => `<line x1="${r(nos[i][0])}" y1="${r(nos[i][1])}" x2="${r(nos[j][0])}" y2="${r(nos[j][1])}" class="aresta"/>`).join("");
  rede += nos.map(([x, y], i) => `<circle cx="${r(x)}" cy="${r(y)}" r="2.6" class="no">${anima("opacity", 5 + (i % 4), [[0, ".25"], [1.5 + (i % 3), ".8"], [3 + (i % 4), ".25"]])}</circle>`).join("");
  rede += arestas.filter((_, k) => k % 3 === 0).slice(0, 14).map(([i, j], k) => {
    const dur = 2.6 + (k % 4) * 0.7;
    return `<circle r="2.4" class="pulso"><animateMotion dur="${dur}s" begin="${(k * 0.45) % 5}s" repeatCount="indefinite" path="M${r(nos[i][0])} ${r(nos[i][1])} L${r(nos[j][0])} ${r(nos[j][1])}"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.15;.85;1" dur="${dur}s" begin="${(k * 0.45) % 5}s" repeatCount="indefinite"/></circle>`;
  }).join("");
  const frases = ["agentes de IA em produção", "atendimento com IA no WhatsApp", "automações com n8n", "do código ao servidor"];
  let tipos = "";
  frases.forEach((f, i) => { const ini = i * 4 + 0.4; tipos += datilografa({ texto: f, x: 96, y: 322, tam: 24, classe: "tipo", inicio: ini, porChar: 0.055, fim: ini + 3.0, T, cursor: true, apagaDeVolta: true }); });
  const L0 = 132, dy = 36, xt = 1034;
  let term = datilografa({ texto: "$ cat stack.yaml", x: xt, y: L0, tam: 19, classe: "cmd", inicio: 0.3, porChar: 0.05, fim: 15.2, T });
  [["ia:  ", "agentes, claude, openai, n8n, mcp"], ["dev: ", "node.js, typescript, python, java"], ["web: ", "react, next.js, react native"], ["ops: ", "docker, kubernetes, nginx, linux"]].forEach(([k, v], i) => {
    term += `<g opacity="0">${aparece(1.5 + i * 0.18, 15.2, T)}<text x="${xt}" y="${L0 + dy * (i + 1)}" class="mono" xml:space="preserve" style="white-space:pre"><tspan class="chave">${k}</tspan><tspan class="val">${v}</tspan></text></g>`;
  });
  term += datilografa({ texto: "$ systemctl list-units --state=running", x: xt, y: L0 + dy * 5, tam: 19, classe: "cmd", inicio: 2.6, porChar: 0.035, fim: 15.2, T });
  term += `<g opacity="0">${aparece(4.2, 15.2, T)}<circle cx="${xt + 7}" cy="${L0 + dy * 6 - 6}" r="6" class="ponto"><animate attributeName="r" values="5;8;5" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.45;1" dur="1.6s" repeatCount="indefinite"/></circle><text x="${xt + 24}" y="${L0 + dy * 6}" class="ok">6 sistemas em produção</text><rect x="${xt + 24 + 22 * 11.4 + 4}" y="${L0 + dy * 6 - 18}" width="11" height="22" class="cursor pisca"/></g>`;
  salva("hero.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${fonte("JBM", "mono400", 400)}${fonte("JBM", "mono700", 700)}${fonte("Inter", "inter600", 600)}${fonte("Inter", "inter800", 800)}
.mono,.cmd,.tipo,.tag,.ok{font-family:'JBM',ui-monospace,Menlo,Consolas,monospace}
.nome{font-family:'Inter',system-ui,'Segoe UI',sans-serif;font-weight:800;font-size:84px;letter-spacing:-2.5px}
.cargo{font-family:'Inter',system-ui,'Segoe UI',sans-serif;font-weight:600;font-size:34px;fill:#e6edf3;letter-spacing:-.4px}
.tag{font-size:18px;fill:#39d353;letter-spacing:4px}.tipo{font-size:24px;fill:#9da7b3}.cmd{font-size:19px;fill:#e6edf3}
.mono{font-size:19px}.chave{fill:#79c0ff}.val{fill:#c9d1d9}.ok{font-size:19px;fill:#f0b429;font-weight:700}
.ponto,.cursor{fill:#39d353}.pisca{animation:pisca 1.1s steps(1) infinite}@keyframes pisca{50%{opacity:0}}
.brilho{animation:pulsa 7s ease-in-out infinite}@keyframes pulsa{0%,100%{opacity:.55}50%{opacity:1}}
.aresta{stroke:#39d353;stroke-opacity:.09;stroke-width:1}.no{fill:#39d353}.pulso{fill:#7ee787}
</style>
<defs>
<pattern id="grade" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#39d353" stroke-opacity=".06"/></pattern>
<radialGradient id="luz" cx="78%" cy="18%" r="60%"><stop offset="0" stop-color="#39d353" stop-opacity=".22"/><stop offset="1" stop-color="#39d353" stop-opacity="0"/></radialGradient>
<radialGradient id="vinheta" cx="60%" cy="45%" r="75%"><stop offset=".55" stop-color="#0b0f14" stop-opacity="0"/><stop offset="1" stop-color="#0b0f14" stop-opacity=".9"/></radialGradient>
<radialGradient id="sobTexto" cx="28%" cy="52%" r="38%"><stop offset="0" stop-color="#0b0f14" stop-opacity=".85"/><stop offset="1" stop-color="#0b0f14" stop-opacity="0"/></radialGradient>
<linearGradient id="reflexo" gradientUnits="userSpaceOnUse" x1="-600" y1="0" x2="-100" y2="0">
<stop offset="0" stop-color="#f0f6fc"/><stop offset=".45" stop-color="#f0f6fc"/><stop offset=".5" stop-color="#7ee787"/><stop offset=".55" stop-color="#f0f6fc"/><stop offset="1" stop-color="#f0f6fc"/>
<animateTransform attributeName="gradientTransform" type="translate" values="0 0;1400 0;1400 0" keyTimes="0;.45;1" dur="6s" repeatCount="indefinite"/></linearGradient>
<clipPath id="moldura"><rect width="${W}" height="${H}" rx="18"/></clipPath>
</defs>
<g clip-path="url(#moldura)">
<rect width="${W}" height="${H}" fill="#0b0f14"/><rect width="${W}" height="${H}" fill="url(#grade)"/>
<g>${rede}</g>
<rect width="${W}" height="${H}" fill="url(#sobTexto)"/>
<rect width="${W}" height="${H}" fill="url(#luz)" class="brilho"/><rect width="${W}" height="${H}" fill="url(#vinheta)"/>
<text x="96" y="104" class="tag">&gt;_ IA · FULL STACK · DEVOPS</text>
<text x="92" y="196" class="nome" fill="url(#reflexo)">Matheus Prates</text>
<text x="96" y="254" class="cargo">Engenheiro de IA <tspan fill="#39d353">|</tspan> Full Stack e DevOps</text>
${tipos}
<rect x="1000" y="46" width="540" height="348" rx="14" fill="#0d1117" fill-opacity=".95" stroke="#39d353" stroke-opacity=".3"/>
<circle cx="1026" cy="72" r="6.5" fill="#ff5f56"/><circle cx="1048" cy="72" r="6.5" fill="#ffbd2e"/><circle cx="1070" cy="72" r="6.5" fill="#27c93f"/>
<text x="1094" y="77" class="mono" style="font-size:14px;fill:#6e7681">matheus@prod: ~</text><path d="M1000 94H1540" stroke="#ffffff" stroke-opacity=".06"/>
${term}
</g></svg>`);
}

// ================================================================ cartões com mini animação
// Painel da ilustração: x 452..756, y 24..220 (304 x 196).
const PX = 452, PY = 24, PW = 304, PH = 196;
const ilustra = {
  // Três agentes passando a peça: gera, edita, revisa; no fim, o selo de aprovado.
  agentes() {
    const L = 7, y = PY + 88, xs = [PX + 58, PX + 152, PX + 246];
    let s = `<path d="M${xs[0]} ${y}H${xs[2]}" stroke="#30363d" stroke-width="2"/>`;
    s += `<path d="M${xs[0]} ${y}H${xs[2]}" stroke="#39d353" stroke-width="2" stroke-dasharray="6 10" opacity=".7"><animate attributeName="stroke-dashoffset" values="0;-32" dur="1s" repeatCount="indefinite"/></path>`;
    const rot = ["gera", "edita", "revisa"], chega = [0.4, 2.4, 4.4];
    xs.forEach((x, i) => {
      s += `<circle cx="${x}" cy="${y}" r="26" fill="#161b22" stroke="#30363d" stroke-width="2"/>`;
      s += `<circle cx="${x}" cy="${y}" r="26" fill="none" stroke="#39d353" stroke-width="2.5" opacity="0">${anima("opacity", L, [[chega[i], "0"], [chega[i] + 0.1, "1"], [chega[i] + 1.4, "1"], [chega[i] + 1.9, "0"]])}</circle>`;
      s += `<text x="${x}" y="${y + 54}" class="rot" text-anchor="middle">${rot[i]}</text>`;
    });
    // ícones simples dentro dos nós
    s += `<path d="M${xs[0]} ${y - 11}l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#f0b429"/>`;
    s += `<g stroke="#79c0ff" stroke-width="2.5" stroke-linecap="round"><path d="M${xs[1] - 10} ${y - 6}h20M${xs[1] - 10} ${y + 6}h20"/><circle cx="${xs[1] - 3}" cy="${y - 6}" r="3.5" fill="#161b22"/><circle cx="${xs[1] + 4}" cy="${y + 6}" r="3.5" fill="#161b22"/></g>`;
    s += `<path d="M${xs[2] - 9} ${y}l6 6 12-12" fill="none" stroke="#39d353" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="30" stroke-dashoffset="30">${anima("stroke-dashoffset", L, [[4.6, "30"], [5.1, "0"], [6.5, "0"], [6.8, "30"]])}</path>`;
    // a peça viajando entre os agentes
    s += `<g>${move(L, [[0, `${xs[0] - 12} ${y - 70}`], [0.4, `${xs[0] - 12} ${y - 62}`], [1.9, `${xs[0] - 12} ${y - 62}`], [2.4, `${xs[1] - 12} ${y - 62}`], [3.9, `${xs[1] - 12} ${y - 62}`], [4.4, `${xs[2] - 12} ${y - 62}`], [6.4, `${xs[2] - 12} ${y - 62}`], [6.8, `${xs[2] - 12} ${y - 70}`]])}
      <rect width="24" height="24" rx="5" fill="url(#peca)">${anima("opacity", L, [[0, "0"], [0.35, "1"], [6.5, "1"], [6.8, "0"]])}</rect></g>`;
    return s;
  },
  // Lista de vagas rolando para cima, com o selo "nova" na primeira.
  vagas() {
    const cores = ["#39d353", "#79c0ff", "#f0b429", "#d2a8ff", "#ff7b72", "#56d4dd"];
    const linha = (i, y) => `<g transform="translate(${PX + 16},${y})"><rect width="${PW - 32}" height="36" rx="8" fill="#161b22"/><circle cx="20" cy="18" r="9" fill="${cores[i % 5]}" opacity=".85"/><rect x="38" y="9" width="${110 + ((i % 5) * 23) % 60}" height="7" rx="3.5" fill="#c9d1d9" opacity=".8"/><rect x="38" y="21" width="${70 + ((i % 5) * 17) % 40}" height="6" rx="3" fill="#6e7681"/><rect x="${PW - 32 - 64}" y="10" width="54" height="16" rx="8" fill="#0d1117" stroke="#30363d"/></g>`;
    let lista = ""; for (let i = 0; i < 10; i++) lista += linha(i, PY + 12 + i * 44);
    let s = `<clipPath id="cpv"><rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="12"/></clipPath><g clip-path="url(#cpv)"><g>${lista}<animateTransform attributeName="transform" type="translate" values="0 0;0 -220" dur="7s" repeatCount="indefinite"/></g></g>`;
    s += `<rect x="${PX}" y="${PY}" width="${PW}" height="34" rx="12" fill="url(#fadeTopo)"/><rect x="${PX}" y="${PY + PH - 34}" width="${PW}" height="34" rx="12" fill="url(#fadeBase)"/>`;
    s += `<g><rect x="${PX + PW - 84}" y="${PY + 14}" width="64" height="24" rx="12" fill="#39d353"/><text x="${PX + PW - 52}" y="${PY + 31}" class="selo" text-anchor="middle">nova</text>${anima("opacity", 2, [[0, "1"], [1, ".35"], [2, "1"]])}</g>`;
    return s;
  },
  // Conversa no WhatsApp que vira compromisso na agenda.
  chat() {
    const L = 8;
    let s = `<g opacity="0">${anima("opacity", L, [[0.4, "0"], [0.7, "1"], [6.8, "1"], [7.2, "0"]])}<rect x="${PX + 16}" y="${PY + 18}" width="170" height="44" rx="12" fill="#202c33"/><rect x="${PX + 30}" y="${PY + 31}" width="128" height="7" rx="3.5" fill="#c9d1d9" opacity=".8"/><rect x="${PX + 30}" y="${PY + 44}" width="84" height="6" rx="3" fill="#8696a0"/></g>`;
    s += `<g opacity="0">${anima("opacity", L, [[1.5, "0"], [1.8, "1"], [6.8, "1"], [7.2, "0"]])}<rect x="${PX + PW - 146}" y="${PY + 72}" width="130" height="38" rx="12" fill="#005c4b"/><rect x="${PX + PW - 132}" y="${PY + 87}" width="82" height="7" rx="3.5" fill="#e9edef" opacity=".85"/><path d="M${PX + PW - 42} ${PY + 99}l3 3 6-6M${PX + PW - 36} ${PY + 99}l3 3 6-6" stroke="#53bdeb" stroke-width="2" fill="none" stroke-linecap="round"/></g>`;
    s += `<g opacity="0">${anima("opacity", L, [[2.7, "0"], [3.0, "1"], [6.8, "1"], [7.2, "0"]])}${move(L, [[2.7, "0 18"], [3.2, "0 0"]])}
      <rect x="${PX + 16}" y="${PY + 124}" width="${PW - 32}" height="58" rx="12" fill="#161b22" stroke="#39d353" stroke-opacity=".6"/>
      <rect x="${PX + 30}" y="${PY + 137}" width="32" height="32" rx="7" fill="#0d1117" stroke="#79c0ff" stroke-width="2"/><rect x="${PX + 30}" y="${PY + 137}" width="32" height="10" rx="4" fill="#79c0ff"/>
      <text x="${PX + 76}" y="${PY + 160}" class="agenda">amanhã · 10:00</text>
      <circle cx="${PX + PW - 42}" cy="${PY + 153}" r="12" fill="#39d353"/><path d="M${PX + PW - 48} ${PY + 153}l4 4 8-8" stroke="#0d1117" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    return s;
  },
  // Nota fiscal saindo da impressora, com o selo de autorizada.
  nota() {
    const L = 7, x = PX + 86, w = 132;
    let s = `<rect x="${x - 18}" y="${PY + 14}" width="${w + 36}" height="16" rx="6" fill="#30363d"/><rect x="${x - 6}" y="${PY + 20}" width="${w + 12}" height="4" rx="2" fill="#0d1117"/>`;
    s += `<clipPath id="cpn"><rect x="${x}" y="${PY + 24}" width="${w}" height="0">${anima("height", L, [[0.3, "0"], [2.3, "158"], [6.4, "158"], [6.9, "0"]])}</rect></clipPath>`;
    let linhas = ""; for (let i = 0; i < 8; i++) linhas += `<rect x="${x + 14}" y="${PY + 40 + i * 14}" width="${i % 3 === 0 ? 70 : 96}" height="5" rx="2.5" fill="#9da7b3"/><rect x="${x + w - 38}" y="${PY + 40 + i * 14}" width="24" height="5" rx="2.5" fill="#9da7b3"/>`;
    s += `<g clip-path="url(#cpn)"><path d="M${x} ${PY + 24}h${w}v150l-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-4-3z" fill="#e6edf3"/>${linhas}</g>`;
    s += `<g opacity="0">${anima("opacity", L, [[2.5, "0"], [2.7, "1"], [6.4, "1"], [6.8, "0"]])}<g transform="rotate(-10 ${x + w / 2} ${PY + 128})"><rect x="${x + 10}" y="${PY + 108}" width="${w - 20}" height="40" rx="8" fill="none" stroke="#2da44e" stroke-width="3.5"/><text x="${x + w / 2 - 14}" y="${PY + 135}" class="carimbo" text-anchor="middle">NFC-e</text><path d="M${x + w / 2 + 24} ${PY + 128}l5 5 10-10" fill="none" stroke="#2da44e" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></g></g>`;
    return s;
  },
};
const cards = [
  { id: "marketing", titulo: ["Plataforma de", "marketing com IA"], linha: ["Agentes que criam e revisam", "peças para redes sociais"], chips: ["Node.js", "Next.js", "Claude", "OpenAI", "n8n"], atraso: 0, ilu: "agentes" },
  { id: "buscavagas", titulo: ["Busca Vagas"], linha: ["Milhares de vagas de TI,", "atualizadas todos os dias"], chips: ["Next.js", "Fastify", "TypeScript", "PostgreSQL"], atraso: 1.5, ilu: "vagas" },
  { id: "tenaz", titulo: ["Tenaz"], linha: ["Lê o WhatsApp e organiza", "os compromissos com IA"], chips: ["React Native", "Node.js", "Claude"], atraso: 3, ilu: "chat" },
  { id: "pdv", titulo: ["PDV com NFC-e"], linha: ["Ponto de venda em uso", "diário numa loja"], chips: ["React", "Node.js", "Prisma"], atraso: 4.5, ilu: "nota" },
];
for (const c of cards) {
  const W = 780, H = 300, per = 2 * (W - 4 + H - 4);
  let x = 36, chips = "";
  for (const ch of c.chips) { const w = ch.length * 9 + 28; chips += `<rect x="${x}" y="244" width="${w}" height="34" rx="17" fill="#161b22" stroke="#30363d"/><text x="${x + w / 2}" y="266" class="chip" text-anchor="middle">${esc(ch)}</text>`; x += w + 10; }
  let yt = 102, textos = "";
  c.titulo.forEach((t) => { textos += `<text x="36" y="${yt}" class="t">${esc(t)}</text>`; yt += 38; });
  yt += 4;
  c.linha.forEach((t) => { textos += `<text x="36" y="${yt}" class="l">${esc(t)}</text>`; yt += 26; });
  salva(`card-${c.id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${fonte("JBM", "mono400", 400)}${fonte("JBM", "mono700", 700)}${fonte("Inter", "inter600", 600)}${fonte("Inter", "inter800", 800)}
.t{font-family:'Inter',system-ui,'Segoe UI',sans-serif;font-weight:800;font-size:32px;fill:#f0f6fc;letter-spacing:-.6px}
.l{font-family:'Inter',system-ui,'Segoe UI',sans-serif;font-weight:600;font-size:19px;fill:#9da7b3}
.chip,.rot{font-family:'JBM',ui-monospace,Menlo,Consolas,monospace;font-size:15px;fill:#c9d1d9}
.rot{font-size:17px;fill:#9da7b3}
.st{font-family:'JBM',ui-monospace,Menlo,Consolas,monospace;font-size:14px;fill:#39d353;letter-spacing:1.5px}
.selo{font-family:'JBM',ui-monospace,monospace;font-size:14px;font-weight:700;fill:#0d1117}
.agenda{font-family:'Inter',system-ui,sans-serif;font-weight:600;font-size:20px;fill:#e6edf3}
.carimbo{font-family:'JBM',ui-monospace,monospace;font-size:20px;font-weight:700;fill:#2da44e}
</style>
<defs><linearGradient id="fundo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d1117"/><stop offset="1" stop-color="#0b0f14"/></linearGradient>
<radialGradient id="luz" cx="92%" cy="0%" r="70%"><stop offset="0" stop-color="#39d353" stop-opacity=".14"/><stop offset="1" stop-color="#39d353" stop-opacity="0"/></radialGradient>
<linearGradient id="peca" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d2a8ff"/><stop offset="1" stop-color="#f0b429"/></linearGradient>
<linearGradient id="fadeTopo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1117"/><stop offset="1" stop-color="#0d1117" stop-opacity="0"/></linearGradient>
<linearGradient id="fadeBase" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1117" stop-opacity="0"/><stop offset="1" stop-color="#0d1117"/></linearGradient></defs>
<rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="16" fill="url(#fundo)" stroke="#30363d"/>
<rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="16" fill="url(#luz)"/>
<rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="16" fill="none" stroke="#39d353" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="160 ${per}"><animate attributeName="stroke-dashoffset" values="0;-${per + 160}" dur="6s" begin="${c.atraso}s" repeatCount="indefinite"/></rect>
<circle cx="44" cy="44" r="6" fill="#39d353"><animate attributeName="opacity" values="1;.35;1" dur="1.8s" repeatCount="indefinite"/></circle>
<text x="60" y="49" class="st">EM PRODUÇÃO</text>
${textos}
<rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="12" fill="#0d1117" stroke="#30363d"/>
${ilustra[c.ilu]()}
${chips}
</svg>`);
}

// ================================================================ faixa da stack com logotipos
{
  const W = 1600, H = 170;
  const l1 = [["claude", "Claude"], ["openai", "OpenAI"], ["modelcontextprotocol", "MCP"], ["n8n", "n8n"], ["whatsapp", "WhatsApp"], ["langchain", "LangChain"], ["nodedotjs", "Node.js"], ["typescript", "TypeScript"], ["python", "Python"], ["openjdk", "Java"], ["springboot", "Spring Boot"], ["nestjs", "NestJS"], ["fastify", "Fastify"], ["dotnet", ".NET"]];
  const l2 = [["react", "React"], ["nextdotjs", "Next.js"], ["react", "React Native"], ["tailwindcss", "Tailwind"], ["postgresql", "PostgreSQL"], ["redis", "Redis"], ["duckdb", "DuckDB"], ["docker", "Docker"], ["kubernetes", "Kubernetes"], ["nginx", "Nginx"], ["linux", "Linux"], ["wireguard", "WireGuard"], ["cloudflare", "Cloudflare"], ["githubactions", "GitHub Actions"]];
  const pilulas = (lista, y) => {
    let x = 0, s = "";
    for (const [slug, nome] of lista) { const w = nome.length * 10.8 + 70; s += `<rect x="${x}" y="${y}" width="${w}" height="52" rx="26" fill="#161b22" stroke="#30363d"/>${icone(slug, x + 18, y + 14, 24)}<text x="${x + 52}" y="${y + 32}" class="p">${esc(nome)}</text>`; x += w + 14; }
    return { s, largura: x };
  };
  const a = pilulas(l1, 20), b = pilulas(l2, 96);
  const faixa = (p, dur, dir) => `<g><g>${p.s}</g><g transform="translate(${p.largura},0)">${p.s}</g><animateTransform attributeName="transform" type="translate" values="${dir > 0 ? `0 0;-${p.largura} 0` : `-${p.largura} 0;0 0`}" dur="${dur}s" repeatCount="indefinite"/></g>`;
  salva("stack.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${fonte("JBM", "mono400", 400)}.p{font-family:'JBM',ui-monospace,Menlo,Consolas,monospace;font-size:18px;fill:#e6edf3}</style>
<defs><linearGradient id="borda" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".07" stop-color="#fff"/><stop offset=".93" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="some"><rect width="${W}" height="${H}" fill="url(#borda)"/></mask></defs>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16" fill="#0b0f14" stroke="#30363d"/>
<g mask="url(#some)">${faixa(a, 42, 1)}${faixa(b, 48, -1)}</g>
</svg>`);
}

// ================================================================ títulos de seção
const titulos = [["producao", "ls ~/em-produção"], ["stack", "cat ~/stack"], ["numeros", "./numeros --ao-vivo"], ["contribuicoes", "git log --graph"]];
for (const [id, cmd] of titulos) {
  const W = 1600, H = 84, n = [...cmd].length, cw = 30 * 0.6, x0 = 96 + 12 * 30 * 0.6;
  const kt = [0], vs = [0]; for (let k = 1; k <= n; k++) { kt.push(r((0.5 + k * 0.06) / (0.5 + n * 0.06 + 0.01))); vs.push(r(k * cw)); }
  salva(`titulo-${id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${fonte("JBM", "mono400", 400)}${fonte("JBM", "mono700", 700)}
.pr{font-family:'JBM',ui-monospace,Menlo,Consolas,monospace;font-size:30px;fill:#39d353;font-weight:700}
.cm{font-family:'JBM',ui-monospace,Menlo,Consolas,monospace;font-size:30px;fill:#8b949e;font-weight:700}
.cur{fill:#39d353;animation:p 1.1s steps(1) infinite}@keyframes p{50%{opacity:0}}</style>
<defs><clipPath id="ct"><rect x="${x0 + 2 * cw}" y="10" height="60" width="0"><animate attributeName="width" dur="${r(0.5 + n * 0.06 + 0.01)}s" fill="freeze" calcMode="discrete" keyTimes="${kt.join(";")}" values="${vs.join(";")}"/></rect></clipPath>
<linearGradient id="ln" x1="0" x2="1"><stop offset="0" stop-color="#39d353" stop-opacity=".7"/><stop offset="1" stop-color="#39d353" stop-opacity="0"/></linearGradient></defs>
<text x="96" y="52" class="pr">matheus@prod</text><text x="${96 + 12 * cw}" y="52" class="pr" style="fill:#e6edf3">$ </text>
<text x="${x0 + 2 * cw}" y="52" class="cm" clip-path="url(#ct)">${esc(cmd)}</text>
<rect x="${x0 + 2 * cw + 4}" y="28" width="16" height="30" class="cur"><animate attributeName="x" dur="${r(0.5 + n * 0.06 + 0.01)}s" fill="freeze" calcMode="discrete" keyTimes="${kt.join(";")}" values="${vs.map((v) => r(x0 + 2 * cw + v + 4)).join(";")}"/></rect>
<rect x="96" y="74" width="1408" height="2" fill="url(#ln)"><animate attributeName="width" values="0;1408" dur="1.4s" fill="freeze"/></rect>
</svg>`);
}
