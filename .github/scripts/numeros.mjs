// Cartão "números ao vivo" do perfil: lê o calendário de contribuições pela API do GitHub e gera
// dist/numeros.svg, animado e com as fontes do repositório embutidas. Roda todo dia no GitHub Actions.
// Uso: GITHUB_TOKEN=... node .github/scripts/numeros.mjs [saida.svg]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SAIDA = process.argv[2] || join(RAIZ, "dist", "numeros.svg");
const USUARIO = process.env.USUARIO || "MatheusHenriquePrates";

const consulta = `query($u:String!){user(login:$u){contributionsCollection{contributionCalendar{
  totalContributions weeks{contributionDays{date contributionCount}}}}}}`;
const resp = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "Content-Type": "application/json", "User-Agent": "numeros-do-perfil" },
  body: JSON.stringify({ query: consulta, variables: { u: USUARIO } }),
});
const json = await resp.json();
if (!json.data?.user) {
  console.error("resposta sem dados:", JSON.stringify(json).slice(0, 300));
  process.exit(1);
}
const cal = json.data.user.contributionsCollection.contributionCalendar;
const hoje = new Date().toISOString().slice(0, 10);
// O calendário vem até hoje; hoje sem contribuição ainda não quebra a sequência.
const dias = cal.weeks.flatMap((w) => w.contributionDays).filter((d) => d.date <= hoje).sort((a, b) => a.date.localeCompare(b.date));
const soma = (lista) => lista.reduce((s, d) => s + d.contributionCount, 0);

let maior = 0, corrida = 0;
for (const d of dias) {
  corrida = d.contributionCount > 0 ? corrida + 1 : 0;
  maior = Math.max(maior, corrida);
}
let atual = 0;
for (let i = dias.length - 1; i >= 0; i--) {
  if (dias[i].contributionCount > 0) atual++;
  else if (i === dias.length - 1) continue;
  else break;
}
const ativos = dias.filter((d) => d.contributionCount > 0);
const n = {
  total: cal.totalContributions,
  mes: soma(dias.slice(-30)),
  maior,
  atual,
  media: ativos.length ? Math.round(soma(ativos) / ativos.length) : 0,
};
// Ritmo dos últimos 90 dias: média móvel de 7 dias, para a curva não serrilhar nos fins de semana.
const JANELA = 90;
const ritmo = [];
for (let i = Math.max(6, dias.length - JANELA); i < dias.length; i++) {
  ritmo.push({ date: dias[i].date, valor: soma(dias.slice(i - 6, i + 1)) / 7 });
}
const semana = soma(dias.slice(-7));
console.log("números:", JSON.stringify(n), "pontos:", ritmo.length, "semana:", semana);

// ------------------------------------------------------------------------------------------ SVG
const fonteB64 = (arq) => readFileSync(join(RAIZ, "assets", "fontes", arq)).toString("base64");
const fonte = (fam, arq, peso) =>
  `@font-face{font-family:'${fam}';src:url(data:font/woff2;base64,${fonteB64(arq)}) format('woff2');font-weight:${peso}}`;
const br = (x) => x.toLocaleString("pt-BR");
const W = 1200, H = 404, VERDE = "#39d353";

// Número que sobe de zero até o valor em 1,5 s ao abrir e fica parado no valor.
function contador(valor, unidade, x, y, atraso) {
  const passos = 15;
  let s = "";
  for (let k = 0; k <= passos; k++) {
    const v = k === passos ? valor : Math.round(valor * (1 - Math.pow(1 - k / passos, 3)));
    const ini = (atraso + k * 0.1).toFixed(2), fim = (atraso + (k + 1) * 0.1).toFixed(2);
    const un = unidade ? `<tspan class="un" dx="10">${unidade}</tspan>` : "";
    s += `<text x="${x}" y="${y}" class="num" opacity="${k === 0 ? 1 : 0}"><set attributeName="opacity" to="1" begin="${ini}s"/>` +
      (k < passos ? `<set attributeName="opacity" to="0" begin="${fim}s"/>` : "") + `${br(v)}${un}</text>`;
  }
  return s;
}

// Sequência atual igual à maior vira um quadro só, com o selo de recorde; a vaga fica com a média por
// dia ativo. Sequência atual curta também cede o lugar para a média, que não oscila.
const media = [n.media, "por dia", "média nos dias ativos"];
const quadros = [
  [n.total, "", "contribuições no ano"],
  [n.mes, "", "nos últimos 30 dias"],
  ...(n.atual === n.maior
    ? [[n.atual, "dias", "sequência atual", "recorde"], media]
    : [[n.maior, "dias", "maior sequência"], n.atual >= 3 ? [n.atual, "dias", "sequência atual"] : media]),
];
let tiles = "";
quadros.forEach(([v, un, rot, selo], i) => {
  const x = 24 + i * 292, a = (i * 0.12).toFixed(2);
  const fimConta = (i * 0.12 + 1.6).toFixed(2);
  tiles += `<g><rect x="${x}" y="24" width="276" height="150" rx="14" fill="#161b22" stroke="#30363d"/>` +
    `<rect x="${x + 24}" y="24" width="0" height="3" fill="${VERDE}"><animate attributeName="width" from="0" to="48" begin="${a}s" dur=".6s" fill="freeze"/></rect>` +
    contador(v, un, x + 24, 108, i * 0.12) + `<text x="${x + 24}" y="148" class="rot">${rot}</text>` +
    (selo
      ? `<g opacity="0"><animate attributeName="opacity" from="0" to="1" begin="${fimConta}s" dur=".4s" fill="freeze"/>` +
        `<rect x="${x + 166}" y="44" width="86" height="26" rx="13" fill="${VERDE}" fill-opacity=".12" stroke="${VERDE}" stroke-opacity=".55"/>` +
        `<text x="${x + 209}" y="62" class="selo" text-anchor="middle">${selo}</text></g>`
      : "") + `</g>`;
});

// Curva do ritmo: área + linha, reveladas da esquerda para a direita, com um ponto que percorre a curva.
const px0 = 56, px1 = 1144, py0 = 246, py1 = 330, DUR = 2.4, INI = 0.4;
const maxS = Math.max(0.1, ...ritmo.map((r) => r.valor));
const pts = ritmo.map((r, i) => [px0 + (i * (px1 - px0)) / Math.max(1, ritmo.length - 1), py1 - (r.valor / maxS) * (py1 - py0)]);
function curva(p) { // Catmull-Rom convertido em Bézier, sem passar abaixo da linha de base
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
    const c1 = [b[0] + (c[0] - a[0]) / 6, Math.min(py1, b[1] + (c[1] - a[1]) / 6)];
    const c2 = [c[0] - (e[0] - b[0]) / 6, Math.min(py1, c[1] - (e[1] - b[1]) / 6)];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${c[0].toFixed(1)},${c[1].toFixed(1)}`;
  }
  return d;
}
const linha = curva(pts);
const area = `${linha} L${px1},${py1} L${px0},${py1} Z`;
const [ux, uy] = pts[pts.length - 1];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
let meses = "";
ritmo.forEach((r, i) => {
  if (r.date.endsWith("-01") && i < ritmo.length - 4) {
    meses += `<line x1="${pts[i][0].toFixed(1)}" y1="${py1 + 1}" x2="${pts[i][0].toFixed(1)}" y2="${py1 + 7}" stroke="#30363d"/>` +
      `<text x="${pts[i][0].toFixed(1)}" y="354" class="mes" text-anchor="middle">${MESES[Number(r.date.slice(5, 7)) - 1]}</text>`;
  }
});
const fimAnim = (INI + DUR).toFixed(2);
const grafico = `
<rect x="24" y="190" width="1152" height="180" rx="14" fill="#161b22" stroke="#30363d"/>
<text x="48" y="222" class="tit">ritmo diário, últimos 90 dias (média de 7 dias)</text>
<line x1="${px0}" y1="${py1 + 0.5}" x2="${px1}" y2="${py1 + 0.5}" stroke="#30363d"/>
<clipPath id="revela"><rect x="${px0 - 4}" y="${py0 - 16}" width="0" height="${py1 - py0 + 20}">
  <animate attributeName="width" from="0" to="${px1 - px0 + 8}" begin="${INI}s" dur="${DUR}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".45 0 .25 1"/></rect></clipPath>
<g clip-path="url(#revela)">
  <path d="${area}" fill="url(#degrade)"/>
  <path d="${linha}" fill="none" stroke="${VERDE}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
</g>
<circle r="5" fill="${VERDE}" opacity="0"><set attributeName="opacity" to="1" begin="${INI}s"/>
  <animateMotion path="${linha}" begin="${INI}s" dur="${DUR}s" fill="freeze" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines=".45 0 .25 1"/></circle>
<circle cx="${ux.toFixed(1)}" cy="${uy.toFixed(1)}" r="5" fill="none" stroke="${VERDE}" stroke-width="2" opacity="0">
  <animate attributeName="r" values="5;16" dur="1.8s" begin="${fimAnim}s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values=".8;0" dur="1.8s" begin="${fimAnim}s" repeatCount="indefinite"/></circle>
<text x="${(ux - 16).toFixed(1)}" y="${Math.max(py0 - 2, uy - 14).toFixed(1)}" class="ult" text-anchor="end" opacity="0">
  <animate attributeName="opacity" from="0" to="1" begin="${fimAnim}s" dur=".4s" fill="freeze"/>${br(semana)} nos últimos 7 dias</text>
${meses}`;

const [a, m, d] = hoje.split("-");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${fonte("JBM", "mono400.woff2", 400)}${fonte("Inter", "inter600.woff2", 600)}${fonte("Inter", "inter800.woff2", 800)}
.num{font-family:'Inter',system-ui,'Segoe UI',sans-serif;font-weight:800;font-size:60px;fill:#f0f6fc;letter-spacing:-1.5px}
.un{font-family:'Inter',system-ui,'Segoe UI',sans-serif;font-weight:600;font-size:22px;fill:#7d8590;letter-spacing:0}
.rot{font-family:'Inter',system-ui,'Segoe UI',sans-serif;font-weight:600;font-size:19px;fill:#9da7b3}
.selo{font-family:'Inter',system-ui,'Segoe UI',sans-serif;font-weight:600;font-size:14px;fill:${VERDE}}
.tit,.mes,.rod,.ult{font-family:'JBM',ui-monospace,Menlo,Consolas,monospace}
.tit{font-size:16px;fill:#9da7b3}.mes{font-size:14px;fill:#6e7681}.rod{font-size:14px;fill:#6e7681}.ult{font-size:15px;fill:${VERDE}}
</style>
<defs><linearGradient id="degrade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${VERDE}" stop-opacity=".32"/><stop offset="1" stop-color="${VERDE}" stop-opacity="0"/></linearGradient></defs>
<rect width="${W}" height="${H}" rx="18" fill="#0b0f14"/>
${tiles}
${grafico}
<circle cx="30" cy="389" r="4.5" fill="${VERDE}"><animate attributeName="opacity" values="1;.25;1" dur="1.8s" repeatCount="indefinite"/></circle>
<text x="44" y="394" class="rod">ao vivo · atualizado em ${d}/${m}/${a} pelo GitHub Actions</text>
</svg>`;
mkdirSync(dirname(SAIDA), { recursive: true });
writeFileSync(SAIDA, svg);
console.log("gerado:", SAIDA, Math.round(svg.length / 1024), "KB");
