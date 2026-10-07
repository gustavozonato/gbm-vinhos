/* =====================================================================
   GBM VINHOS - Servidor local (só para usar no seu computador)

   Para ligar:   node servidor.js
   Site:         http://localhost:3000
   Painel:       http://localhost:3000/admin

   O que ele faz:
   1. Mostra o site e o painel no navegador.
   2. Recebe o que o painel manda e grava nos arquivos do projeto:
        - dados/catalogo.json  (loja e produtos)
        - img/                 (fotos, já com o nome arrumado)

   Não precisa instalar nada (sem "npm install"): usa só o Node.
   Este arquivo NÃO vai para a hospedagem. Veja o README.md.
   ===================================================================== */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORTA = process.env.PORT || 3000;
const RAIZ = __dirname;
const ARQUIVO_CATALOGO = path.join(RAIZ, "dados", "catalogo.json");
const PASTA_FOTOS = path.join(RAIZ, "img");

const EXTENSOES_DE_FOTO = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"];
const TAMANHO_MAXIMO = 15 * 1024 * 1024; // 15 MB por envio

// Tipo de cada arquivo, para o navegador saber o que está recebendo
const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};

/* ---------- Funções de apoio ---------- */

// "Malbec Reserva 2021" -> "malbec-reserva-2021" (nome bom para arquivo)
function nomeDeArquivo(texto) {
  const limpo = String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira acentos
    .replace(/[^a-z0-9]+/g, "-")     // o resto vira hífen
    .replace(/^-+|-+$/g, "");        // sem hífen nas pontas
  return limpo || "vinho";
}

function ehFoto(arquivo) {
  return EXTENSOES_DE_FOTO.includes(path.extname(arquivo).toLowerCase());
}

// Procura o próximo nome livre: malbec-1.jpg, malbec-2.jpg, ...
function proximoNomeLivre(base, extensao) {
  let numero = 1;
  while (fs.existsSync(path.join(PASTA_FOTOS, `${base}-${numero}${extensao}`))) numero++;
  return `${base}-${numero}${extensao}`;
}

// Junta os pedaços que chegam do navegador em um bloco só
function lerCorpo(pedido) {
  return new Promise((resolve, reject) => {
    const pedacos = [];
    let tamanho = 0;
    pedido.on("data", (pedaco) => {
      tamanho += pedaco.length;
      if (tamanho > TAMANHO_MAXIMO) return reject(new Error("Arquivo grande demais (máximo 15 MB)."));
      pedacos.push(pedaco);
    });
    pedido.on("end", () => resolve(Buffer.concat(pedacos)));
    pedido.on("error", reject);
  });
}

function responderJSON(resposta, dados, codigo = 200) {
  resposta.writeHead(codigo, { "Content-Type": TIPOS[".json"], "Cache-Control": "no-store" });
  resposta.end(JSON.stringify(dados));
}

/* ---------- O que o painel pode pedir (API) ---------- */

async function atenderPainel(pedido, resposta, url) {
  const rota = `${pedido.method} ${url.pathname}`;

  // Segurança: só aceita pedidos vindos do próprio painel, não de outros sites
  const origem = pedido.headers.origin;
  if (origem && new URL(origem).host !== pedido.headers.host) throw new Error("Origem não permitida.");

  // Lê o catálogo
  if (rota === "GET /api/catalogo") {
    return responderJSON(resposta, JSON.parse(fs.readFileSync(ARQUIVO_CATALOGO, "utf8")));
  }

  // Grava o catálogo inteiro
  if (rota === "PUT /api/catalogo") {
    const catalogo = JSON.parse((await lerCorpo(pedido)).toString("utf8"));
    if (!catalogo.loja || !Array.isArray(catalogo.produtos)) throw new Error("Catálogo em formato inválido.");
    fs.writeFileSync(ARQUIVO_CATALOGO, JSON.stringify(catalogo, null, 2) + "\n");
    return responderJSON(resposta, { ok: true });
  }

  // Lista as fotos que estão na pasta img/
  if (rota === "GET /api/fotos") {
    return responderJSON(resposta, fs.readdirSync(PASTA_FOTOS).filter(ehFoto).sort());
  }

  // Recebe uma foto nova e grava com o nome arrumado.
  // Exemplo: POST /api/fotos?vinho=Malbec Reserva&extensao=.jpg
  if (rota === "POST /api/fotos") {
    const extensao = String(url.searchParams.get("extensao") || "").toLowerCase();
    if (!EXTENSOES_DE_FOTO.includes(extensao)) throw new Error("Tipo de imagem não aceito.");
    const nome = proximoNomeLivre(nomeDeArquivo(url.searchParams.get("vinho")), extensao);
    fs.writeFileSync(path.join(PASTA_FOTOS, nome), await lerCorpo(pedido));
    return responderJSON(resposta, { nome });
  }

  // Renomeia as fotos de um vinho para o padrão nome-do-vinho-1, -2, -3...
  // Recebe { vinho: "Malbec Reserva", fotos: ["a.jpg", "b.jpg"] } e devolve os nomes novos.
  if (rota === "POST /api/fotos/organizar") {
    const { vinho, fotos } = JSON.parse((await lerCorpo(pedido)).toString("utf8"));
    const base = nomeDeArquivo(vinho);
    const existentes = fotos.map((foto) => path.basename(foto)).filter((foto) => fs.existsSync(path.join(PASTA_FOTOS, foto)));

    // 1º passo: nomes provisórios, para uma foto não passar por cima da outra
    const provisorios = existentes.map((foto, i) => {
      const provisorio = `provisorio-${Date.now()}-${i}${path.extname(foto).toLowerCase()}`;
      fs.renameSync(path.join(PASTA_FOTOS, foto), path.join(PASTA_FOTOS, provisorio));
      return provisorio;
    });
    // 2º passo: nomes definitivos, na ordem
    const novos = provisorios.map((provisorio) => {
      const nome = proximoNomeLivre(base, path.extname(provisorio));
      fs.renameSync(path.join(PASTA_FOTOS, provisorio), path.join(PASTA_FOTOS, nome));
      return nome;
    });
    return responderJSON(resposta, { fotos: novos });
  }

  // Apaga uma foto da pasta img/
  if (rota === "DELETE /api/fotos") {
    const nome = path.basename(url.searchParams.get("nome") || "");
    if (!ehFoto(nome)) throw new Error("Arquivo inválido.");
    fs.rmSync(path.join(PASTA_FOTOS, nome), { force: true });
    return responderJSON(resposta, { ok: true });
  }

  responderJSON(resposta, { erro: "Rota não encontrada." }, 404);
}

/* ---------- Entrega dos arquivos do site ---------- */

function entregarArquivo(resposta, url) {
  let caminho = path.join(RAIZ, decodeURIComponent(url.pathname));

  // Segurança: só entrega arquivos de dentro da pasta do projeto
  if (caminho !== RAIZ && !caminho.startsWith(RAIZ + path.sep)) {
    resposta.writeHead(403);
    return resposta.end("Acesso negado");
  }

  // Pasta -> mostra o index.html dela (ex.: /admin -> admin/index.html)
  if (fs.existsSync(caminho) && fs.statSync(caminho).isDirectory()) {
    if (!url.pathname.endsWith("/")) {
      resposta.writeHead(302, { Location: url.pathname + "/" });
      return resposta.end();
    }
    caminho = path.join(caminho, "index.html");
  }

  if (!fs.existsSync(caminho)) {
    resposta.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return resposta.end("Página não encontrada");
  }

  const tipo = TIPOS[path.extname(caminho).toLowerCase()] || "application/octet-stream";
  resposta.writeHead(200, { "Content-Type": tipo, "Cache-Control": "no-store" });
  fs.createReadStream(caminho).pipe(resposta);
}

/* ---------- Liga o servidor ---------- */

const servidor = http.createServer(async (pedido, resposta) => {
  const url = new URL(pedido.url, `http://${pedido.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) await atenderPainel(pedido, resposta, url);
    else entregarArquivo(resposta, url);
  } catch (erro) {
    console.error("Erro:", erro.message);
    responderJSON(resposta, { erro: erro.message }, 500);
  }
});

// "127.0.0.1" = só o seu computador acessa. Ninguém da rede consegue mexer no catálogo.
servidor.listen(PORTA, "127.0.0.1", () => {
  console.log("");
  console.log("  GBM Vinhos ligado!");
  console.log(`  Site:    http://localhost:${PORTA}`);
  console.log(`  Painel:  http://localhost:${PORTA}/admin`);
  console.log("");
  console.log("  Para desligar: Ctrl + C");
});
