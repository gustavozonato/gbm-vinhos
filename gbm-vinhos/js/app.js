/* =====================================================================
   GBM VINHOS - Vitrine (o site que o cliente vê)

   Como funciona, em 3 passos:
   1. Lê os dados de dados/catalogo.json (loja + lista de produtos).
   2. Desenha o topo, os filtros, os cartões e o rodapé.
   3. Ao clicar em um vinho, abre a janela de detalhes com o carrossel.

   Para mudar vinhos, preços ou fotos NÃO mexa aqui: use o painel
   (veja o README.md). Aqui só fica a aparência e o comportamento.

   Índice deste arquivo:
     1. Configuração
     2. Funções de apoio
     3. WhatsApp e Instagram
     4. Topo e rodapé
     5. Filtros e lista de vinhos
     6. Janela de detalhes + carrossel
     7. Eventos e início
   ===================================================================== */

/* ---------- 1. Configuração ---------- */

const ARQUIVO_CATALOGO = "dados/catalogo.json";
const PASTA_FOTOS = "img/";

// Dados carregados do catalogo.json
let loja = {};
let produtos = [];

// O que o cliente escolheu nos filtros
const filtro = { busca: "", tipo: "Todos", ordem: "destaques" };

/* ---------- 2. Funções de apoio ---------- */

// Atalho para pegar um elemento da página pelo id
const el = (id) => document.getElementById(id);

// Deixa um texto seguro para colocar dentro do HTML
function seguro(texto) {
  const mapa = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(texto ?? "").replace(/[&<>"']/g, (letra) => mapa[letra]);
}

// Tira acentos e maiúsculas, para a busca achar "rose" em "Rosé"
function simplificar(texto) {
  return String(texto ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// 89.9 -> "R$ 89,90". Sem preço -> "Sob consulta"
function formatarPreco(preco) {
  if (preco == null || preco === "") return "Sob consulta";
  return Number(preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// "Malbec Reserva 2021"
function nomeCompleto(produto) {
  return produto.safra ? `${produto.nome} ${produto.safra}` : produto.nome;
}

// "Mendoza, Argentina"
function origem(produto) {
  return [produto.regiao, produto.pais].filter(Boolean).join(", ");
}

// Caminho completo da foto: "foto.jpg" -> "img/foto.jpg"
function caminhoFoto(arquivo) {
  return PASTA_FOTOS + encodeURIComponent(arquivo);
}

// Desenho de garrafa usado quando o vinho ainda não tem foto
const GARRAFA_SEM_FOTO = `
  <svg class="sem-foto" viewBox="0 0 120 300" role="img" aria-label="Foto em breve">
    <path d="M53 10h14v72c0 14 23 26 23 52v146c0 6-4 10-10 10H40c-6 0-10-4-10-10V134c0-26 23-38 23-52z"/>
  </svg>`;

const ICONE_WHATSAPP = `
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 21l1.6-4.6A8.5 8.5 0 1 1 8 19.5L3 21z"/>
    <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-.8.7c-.9-.4-1.7-1.2-2.1-2.1l.7-.8-1-2L9 9.5z" fill="currentColor" stroke="none"/>
  </svg>`;

/* ---------- 3. WhatsApp e Instagram ---------- */

// Monta o link do WhatsApp já com a mensagem escrita.
// Devolve "" se o número ainda não foi cadastrado no painel.
function linkWhatsApp(mensagem) {
  let numero = String(loja.whatsapp ?? "").replace(/\D/g, ""); // só os dígitos
  if (numero.length < 10) return "";
  if (numero.length <= 11) numero = "55" + numero; // coloca o código do Brasil
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

// Mensagem que chega no WhatsApp da loja quando o cliente clica em "Pedir"
function mensagemPedido(produto) {
  const nome = nomeCompleto(produto);
  if (!produto.disponivel) {
    return `Olá! Vi o vinho ${nome} no catálogo da ${loja.nome}. Podem me avisar quando chegar mais?`;
  }
  const preco = produto.preco != null ? ` (${formatarPreco(produto.preco)})` : "";
  return `Olá! Quero pedir o vinho ${nome}${preco}. Ainda está disponível?`;
}

function linkInstagram() {
  const usuario = String(loja.instagram ?? "").replace("@", "").trim();
  return usuario ? `https://instagram.com/${encodeURIComponent(usuario)}` : "";
}

// Botão verde de pedido. Sem WhatsApp cadastrado, não mostra nada.
function botaoPedir(produto, classeExtra = "") {
  const link = linkWhatsApp(mensagemPedido(produto));
  if (!link) return "";
  const texto = produto.disponivel ? "Pedir no WhatsApp" : "Avise-me quando chegar";
  return `<a class="botao botao-whatsapp ${classeExtra}" href="${link}" target="_blank" rel="noopener">
            ${ICONE_WHATSAPP}<span>${texto}</span>
          </a>`;
}

/* ---------- 4. Topo e rodapé ---------- */

function mostrarTopo() {
  el("loja-nome").textContent = loja.nome;
  el("loja-frase").textContent = loja.frase ?? "";
  document.title = `${loja.nome} | Catálogo de vinhos`;

  // Botões de contato
  const whats = linkWhatsApp(`Olá! Vim pelo catálogo da ${loja.nome}.`);
  const insta = linkInstagram();
  let botoes = "";
  if (whats) {
    botoes += `<a class="botao botao-claro" href="${whats}" target="_blank" rel="noopener">${ICONE_WHATSAPP}<span>Falar no WhatsApp</span></a>`;
  }
  if (insta) {
    botoes += `<a class="botao botao-contorno" href="${insta}" target="_blank" rel="noopener">@${seguro(loja.instagram.replace("@", ""))}</a>`;
  }
  el("topo-botoes").innerHTML = botoes;

  // Vinho em destaque: o primeiro marcado como destaque, disponível e com foto
  const destaque = produtos.find((p) => p.destaque && p.disponivel && p.fotos.length);
  if (!destaque) {
    el("destaque").innerHTML = "";
    return;
  }
  el("destaque").innerHTML = `
    <button class="destaque" type="button" data-abrir="${seguro(destaque.id)}">
      <img src="${caminhoFoto(destaque.fotos[0])}" alt="">
      <span class="destaque-texto">
        <span class="destaque-chamada">Destaque da casa</span>
        <span class="destaque-nome">${seguro(nomeCompleto(destaque))}</span>
        <span class="destaque-preco">${formatarPreco(destaque.preco)}</span>
      </span>
    </button>`;
}

function mostrarRodape() {
  const whats = linkWhatsApp(`Olá! Vim pelo catálogo da ${loja.nome}.`);
  const insta = linkInstagram();
  el("rodape").innerHTML = `
    <div class="rodape-conteudo">
      <p class="rodape-marca">${seguro(loja.nome)}</p>
      ${loja.rodape ? `<p>${seguro(loja.rodape).replace(/\n/g, "<br>")}</p>` : ""}
      <p class="rodape-links">
        ${whats ? `<a href="${whats}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
        ${insta ? `<a href="${insta}" target="_blank" rel="noopener">Instagram</a>` : ""}
      </p>
      <p>Venda proibida para menores de 18 anos. Beba com moderação.</p>
      <p>© ${new Date().getFullYear()} ${seguro(loja.nome)}</p>
    </div>`;
}

/* ---------- 5. Filtros e lista de vinhos ---------- */

// Botões de tipo (Todos, Tinto, Branco...) criados a partir dos produtos
function mostrarTipos() {
  const tipos = ["Todos", ...new Set(produtos.map((p) => p.tipo).filter(Boolean))];
  el("tipos").innerHTML = tipos
    .map((tipo) => `<button class="tipo" type="button" data-tipo="${seguro(tipo)}" aria-pressed="${tipo === filtro.tipo}">${seguro(tipo)}</button>`)
    .join("");
}

// Devolve os produtos que passam nos filtros, já na ordem escolhida
function produtosFiltrados() {
  const busca = simplificar(filtro.busca);

  const lista = produtos.filter((p) => {
    if (filtro.tipo !== "Todos" && p.tipo !== filtro.tipo) return false;
    if (!busca) return true;
    const textoDoProduto = simplificar([p.nome, p.uva, p.pais, p.regiao, p.produtor, p.tipo].join(" "));
    return textoDoProduto.includes(busca);
  });

  // Vinho sem preço ("Sob consulta") vai sempre para o fim
  if (filtro.ordem === "menor") lista.sort((a, b) => (a.preco ?? Infinity) - (b.preco ?? Infinity));
  if (filtro.ordem === "maior") lista.sort((a, b) => (b.preco ?? -1) - (a.preco ?? -1));
  if (filtro.ordem === "nome") lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  if (filtro.ordem === "destaques") {
    // Disponíveis primeiro; entre eles, os destaques primeiro
    const peso = (p) => (p.disponivel ? 0 : 2) + (p.destaque ? 0 : 1);
    lista.sort((a, b) => peso(a) - peso(b));
  }
  return lista;
}

// HTML de um cartão de vinho
function cartao(produto) {
  const foto = produto.fotos[0];
  const whats = linkWhatsApp(mensagemPedido(produto));

  return `
    <article class="cartao ${produto.disponivel ? "" : "esgotado"}">
      <button class="cartao-foto" type="button" data-abrir="${seguro(produto.id)}" aria-label="Ver detalhes de ${seguro(produto.nome)}">
        ${foto ? `<img src="${caminhoFoto(foto)}" alt="" loading="lazy">` : GARRAFA_SEM_FOTO}
        ${!produto.disponivel ? `<span class="selo selo-esgotado">Esgotado</span>` : produto.destaque ? `<span class="selo">Destaque</span>` : ""}
        ${produto.fotos.length > 1 ? `<span class="selo-fotos">${produto.fotos.length} fotos</span>` : ""}
      </button>
      <p class="cartao-tipo">${seguro([produto.tipo, produto.uva].filter(Boolean).join(", "))}</p>
      <h2 class="cartao-nome"><button type="button" data-abrir="${seguro(produto.id)}">${seguro(nomeCompleto(produto))}</button></h2>
      <p class="cartao-origem">${seguro(origem(produto))}</p>
      <div class="cartao-base">
        <span class="preco">${formatarPreco(produto.preco)}</span>
        ${whats ? `<a class="botao botao-whatsapp botao-pequeno" href="${whats}" target="_blank" rel="noopener">${ICONE_WHATSAPP}<span>${produto.disponivel ? "Pedir" : "Avise-me"}</span></a>` : ""}
      </div>
    </article>`;
}

function mostrarLista() {
  const lista = produtosFiltrados();
  el("lista").innerHTML = lista.map(cartao).join("");
  el("contagem").textContent = lista.length === 1 ? "1 vinho" : `${lista.length} vinhos`;

  const vazio = el("vazio");
  vazio.hidden = lista.length > 0;
  vazio.textContent = produtos.length
    ? "Nenhum vinho encontrado. Tente outra busca ou escolha “Todos”."
    : "O catálogo está sendo atualizado. Volte em breve.";
}

/* ---------- 6. Janela de detalhes + carrossel ---------- */

function abrirDetalhe(id) {
  const produto = produtos.find((p) => p.id === id);
  if (!produto) return;

  // Linhas da ficha (só aparecem as que foram preenchidas)
  const ficha = [
    ["Tipo", produto.tipo],
    ["Uva", produto.uva],
    ["Produtor", produto.produtor],
    ["País", produto.pais],
    ["Região", produto.regiao],
    ["Safra", produto.safra],
    ["Volume", produto.volume],
  ].filter(([, valor]) => valor);

  const janela = el("detalhe");
  janela.innerHTML = `
    <button class="fechar" type="button" data-fechar aria-label="Fechar">×</button>
    <div class="detalhe-conteudo">
      ${carrossel(produto)}
      <div class="detalhe-texto">
        <p class="cartao-tipo">${seguro([produto.tipo, origem(produto)].filter(Boolean).join(", "))}</p>
        <h2 class="detalhe-nome">${seguro(nomeCompleto(produto))}</h2>
        ${!produto.disponivel ? `<p class="aviso-esgotado">Esgotado no momento</p>` : ""}
        <p class="detalhe-descricao">${seguro(produto.descricao).replace(/\n/g, "<br>")}</p>
        <dl class="ficha">
          ${ficha.map(([nome, valor]) => `<dt>${nome}</dt><dd>${seguro(valor)}</dd>`).join("")}
        </dl>
        <div class="detalhe-compra">
          <span class="preco preco-grande">${formatarPreco(produto.preco)}</span>
          ${botaoPedir(produto)}
        </div>
      </div>
    </div>`;

  janela.showModal();
  ligarCarrossel(janela);
}

// HTML do carrossel: as fotos lado a lado, setas e miniaturas.
// Com 1 foto só, mostra a foto sem setas. Sem foto, mostra a garrafa.
function carrossel(produto) {
  const fotos = produto.fotos;
  if (!fotos.length) return `<div class="carrossel"><div class="carrossel-fotos">${GARRAFA_SEM_FOTO}</div></div>`;

  const nome = seguro(produto.nome);
  const varias = fotos.length > 1;

  return `
    <div class="carrossel">
      <div class="carrossel-fotos" ${varias ? 'tabindex="0" aria-label="Fotos do vinho. Use as setas para trocar."' : ""}>
        ${fotos.map((foto, i) => `<img src="${caminhoFoto(foto)}" alt="${nome}, foto ${i + 1} de ${fotos.length}">`).join("")}
      </div>
      ${varias ? `
        <button class="seta seta-voltar" type="button" data-passo="-1" aria-label="Foto anterior">‹</button>
        <button class="seta seta-avancar" type="button" data-passo="1" aria-label="Próxima foto">›</button>
        <div class="miniaturas">
          ${fotos.map((foto, i) => `<button type="button" data-foto="${i}" aria-label="Ver foto ${i + 1}"><img src="${caminhoFoto(foto)}" alt=""></button>`).join("")}
        </div>` : ""}
    </div>`;
}

// Faz o carrossel funcionar.
// A troca de foto é só uma rolagem horizontal (o CSS "scroll-snap" encaixa
// cada foto no lugar), por isso arrastar com o dedo já funciona sozinho.
function ligarCarrossel(janela) {
  const trilho = janela.querySelector(".carrossel-fotos");
  const miniaturas = [...janela.querySelectorAll(".miniaturas button")];
  if (!miniaturas.length) return;

  const total = miniaturas.length;
  const fotoAtual = () => Math.round(trilho.scrollLeft / trilho.clientWidth);

  function irPara(numero) {
    const destino = (numero + total) % total; // depois da última, volta à primeira
    trilho.scrollTo({ left: destino * trilho.clientWidth, behavior: "smooth" });
  }

  function marcarMiniatura() {
    miniaturas.forEach((botao, i) => botao.classList.toggle("ativa", i === fotoAtual()));
  }

  janela.querySelectorAll(".seta").forEach((seta) => {
    seta.addEventListener("click", () => irPara(fotoAtual() + Number(seta.dataset.passo)));
  });
  miniaturas.forEach((botao, i) => botao.addEventListener("click", () => irPara(i)));
  trilho.addEventListener("scroll", marcarMiniatura);
  trilho.addEventListener("keydown", (evento) => {
    if (evento.key === "ArrowRight") irPara(fotoAtual() + 1);
    if (evento.key === "ArrowLeft") irPara(fotoAtual() - 1);
  });

  marcarMiniatura();
}

/* ---------- 7. Eventos e início ---------- */

// Um único "ouvinte" de cliques para a página inteira
document.addEventListener("click", (evento) => {
  const alvo = evento.target;

  // Clicou em um vinho (cartão ou destaque)
  const abrir = alvo.closest("[data-abrir]");
  if (abrir) return abrirDetalhe(abrir.dataset.abrir);

  // Clicou no × ou fora da janela de detalhes
  if (alvo.closest("[data-fechar]") || alvo === el("detalhe")) return el("detalhe").close();

  // Clicou em um tipo de vinho
  const tipo = alvo.closest("[data-tipo]");
  if (tipo) {
    filtro.tipo = tipo.dataset.tipo;
    mostrarTipos();
    mostrarLista();
  }
});

el("busca").addEventListener("input", (evento) => {
  filtro.busca = evento.target.value;
  mostrarLista();
});

el("ordem").addEventListener("change", (evento) => {
  filtro.ordem = evento.target.value;
  mostrarLista();
});

// Carrega o catálogo e desenha a página
async function iniciar() {
  try {
    const resposta = await fetch(ARQUIVO_CATALOGO, { cache: "no-cache" });
    const catalogo = await resposta.json();
    loja = catalogo.loja ?? {};
    produtos = (catalogo.produtos ?? []).map((p) => ({ ...p, fotos: p.fotos ?? [] }));
  } catch (erro) {
    // Acontece ao abrir o index.html com dois cliques (endereço file://).
    // O site precisa ser aberto por um servidor: veja o README.md.
    el("vazio").hidden = false;
    el("vazio").textContent = "Não foi possível carregar o catálogo. Abra o site com “node servidor.js” (veja o README).";
    console.error("Erro ao carregar o catálogo:", erro);
    return;
  }

  mostrarTopo();
  mostrarTipos();
  mostrarLista();
  mostrarRodape();
}

iniciar();
