/* =====================================================================
   GBM VINHOS - Painel (cadastro de vinhos, fotos e dados da loja)

   Só funciona com o servidor ligado:  node servidor.js
   Depois abra:                        http://localhost:3000/admin

   Tudo o que é salvo aqui vai direto para os arquivos do projeto:
     - dados/catalogo.json  (textos, preços e nomes das fotos)
     - img/                 (as fotos)

   Índice deste arquivo:
     1. Estado e funções de apoio
     2. Conversa com o servidor
     3. Lista de vinhos
     4. Formulário do vinho
     5. Fotos (enviar, ordenar, remover)
     6. Dados da loja
     7. Eventos e início
   ===================================================================== */

/* ---------- 1. Estado e funções de apoio ---------- */

let catalogo = { loja: {}, produtos: [] }; // cópia do dados/catalogo.json
let fotosNaPasta = [];                     // nomes dos arquivos em img/

// Vinho que está aberto no formulário.
// id = null quer dizer "vinho novo". fotos = lista de nomes de arquivo.
let rascunho = { id: null, fotos: [] };

const el = (id) => document.getElementById(id);
const formVinho = el("form-vinho");
const formLoja = el("form-loja");

function seguro(texto) {
  const mapa = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(texto ?? "").replace(/[&<>"']/g, (letra) => mapa[letra]);
}

function formatarPreco(preco) {
  if (preco == null) return "Sob consulta";
  return Number(preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// "89,90" ou "R$ 1.289,90" -> 89.9 / 1289.9. Vazio ou inválido -> null
function lerPreco(texto) {
  let limpo = String(texto).replace(/[R$\s]/g, "");
  if (limpo.includes(",")) limpo = limpo.replace(/\./g, "").replace(",", ".");
  const numero = parseFloat(limpo);
  return Number.isFinite(numero) && numero >= 0 ? Math.round(numero * 100) / 100 : null;
}

const caminhoFoto = (arquivo) => "../img/" + encodeURIComponent(arquivo);

// Mensagem rápida no canto da tela
let relogioRecado;
function recado(texto) {
  el("recado").textContent = texto;
  el("recado").classList.add("visivel");
  clearTimeout(relogioRecado);
  relogioRecado = setTimeout(() => el("recado").classList.remove("visivel"), 3500);
}

/* ---------- 2. Conversa com o servidor ---------- */

// Faz um pedido ao servidor.js e devolve a resposta.
// Exemplo: await servidor("GET", "/api/fotos")
async function servidor(metodo, rota, corpo) {
  const ehArquivo = corpo instanceof Blob;
  const resposta = await fetch(rota, {
    method: metodo,
    body: corpo == null || ehArquivo ? corpo : JSON.stringify(corpo),
  });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro || "O servidor não conseguiu atender.");
  return dados;
}

// Grava o catálogo inteiro em dados/catalogo.json
async function salvarCatalogo(mensagem) {
  await servidor("PUT", "/api/catalogo", catalogo);
  mostrarAvisos();
  mostrarLista();
  recado(mensagem);
}

async function atualizarFotosDaPasta() {
  fotosNaPasta = await servidor("GET", "/api/fotos");
}

/* ---------- 3. Lista de vinhos ---------- */

function mostrarAvisos() {
  const semWhatsApp = String(catalogo.loja.whatsapp ?? "").replace(/\D/g, "").length < 10;
  el("avisos").innerHTML = semWhatsApp
    ? `<p class="aviso">Falta cadastrar o WhatsApp. Sem ele, o botão “Pedir” não aparece no site. Clique em <strong>Dados da loja</strong>.</p>`
    : "";
}

function mostrarLista() {
  if (!catalogo.produtos.length) {
    el("lista").innerHTML = `<p class="vazio">Nenhum vinho cadastrado. Clique em <strong>Novo vinho</strong> para começar.</p>`;
    return;
  }

  el("lista").innerHTML = catalogo.produtos
    .map((produto) => `
      <article class="item">
        ${produto.fotos[0]
          ? `<img class="item-foto" src="${caminhoFoto(produto.fotos[0])}" alt="">`
          : `<span class="item-foto item-sem-foto">sem foto</span>`}
        <div class="item-texto">
          <h2>${seguro(produto.nome)} ${seguro(produto.safra)}</h2>
          <p>${formatarPreco(produto.preco)} · ${produto.fotos.length} foto(s)${produto.destaque ? " · destaque" : ""}</p>
        </div>
        <div class="item-botoes">
          <button class="botao botao-pequeno ${produto.disponivel ? "botao-verde" : "botao-cinza"}" type="button" data-estoque="${seguro(produto.id)}">
            ${produto.disponivel ? "Disponível" : "Esgotado"}
          </button>
          <button class="botao botao-pequeno botao-contorno" type="button" data-editar="${seguro(produto.id)}">Editar</button>
          <button class="botao botao-pequeno botao-perigo" type="button" data-excluir="${seguro(produto.id)}">Excluir</button>
        </div>
      </article>`)
    .join("");
}

async function trocarEstoque(id) {
  const produto = catalogo.produtos.find((p) => p.id === id);
  produto.disponivel = !produto.disponivel;
  await salvarCatalogo(produto.disponivel ? "Marcado como disponível" : "Marcado como esgotado");
}

async function excluirVinho(id) {
  const produto = catalogo.produtos.find((p) => p.id === id);
  if (!confirm(`Excluir “${produto.nome}” do catálogo?\n\nAs fotos continuam na pasta img.`)) return;
  catalogo.produtos = catalogo.produtos.filter((p) => p.id !== id);
  await salvarCatalogo("Vinho excluído");
}

/* ---------- 4. Formulário do vinho ---------- */

const CAMPOS_DE_TEXTO = ["nome", "descricao", "tipo", "uva", "safra", "produtor", "volume", "pais", "regiao"];

// Abre o formulário. Com id = edita; sem id = vinho novo.
async function abrirVinho(id) {
  const produto = catalogo.produtos.find((p) => p.id === id);
  const valores = produto ?? { tipo: "Tinto", volume: "750 ml", disponivel: true, fotos: [] };

  rascunho = { id: produto ? produto.id : null, fotos: [...valores.fotos] };

  el("titulo-vinho").textContent = produto ? "Editar vinho" : "Novo vinho";
  el("erro-vinho").textContent = "";
  CAMPOS_DE_TEXTO.forEach((campo) => (formVinho.elements[campo].value = valores[campo] ?? ""));
  formVinho.elements.preco.value = valores.preco != null ? valores.preco.toFixed(2).replace(".", ",") : "";
  formVinho.elements.disponivel.checked = Boolean(valores.disponivel);
  formVinho.elements.destaque.checked = Boolean(valores.destaque);

  await atualizarFotosDaPasta();
  mostrarFotos();
  el("janela-vinho").showModal();
}

async function salvarVinho() {
  const campos = formVinho.elements;
  const nome = campos.nome.value.trim();
  if (!nome) {
    el("erro-vinho").textContent = "Escreva o nome do vinho.";
    campos.nome.focus();
    return;
  }

  // Pede ao servidor para renomear as fotos: nome-do-vinho-1, -2, -3...
  let fotos = rascunho.fotos;
  if (fotos.length) {
    const resposta = await servidor("POST", "/api/fotos/organizar", { vinho: nome, fotos });
    fotos = resposta.fotos;
  }

  const produto = {
    id: rascunho.id ?? "v" + Date.now(),
    nome,
    preco: lerPreco(campos.preco.value),
    fotos,
    disponivel: campos.disponivel.checked,
    destaque: campos.destaque.checked,
  };
  CAMPOS_DE_TEXTO.filter((campo) => campo !== "nome").forEach((campo) => (produto[campo] = campos[campo].value.trim()));

  // Troca o vinho antigo pelo novo, ou coloca no começo da lista
  const posicao = catalogo.produtos.findIndex((p) => p.id === produto.id);
  if (posicao >= 0) catalogo.produtos[posicao] = produto;
  else catalogo.produtos.unshift(produto);

  el("janela-vinho").close();
  await salvarCatalogo("Vinho salvo");
}

/* ---------- 5. Fotos ---------- */

// Desenha as fotos do vinho aberto e as fotos soltas da pasta img/
function mostrarFotos() {
  el("fotos").innerHTML = rascunho.fotos
    .map((foto, i) => `
      <figure class="foto">
        <img src="${caminhoFoto(foto)}" alt="">
        <figcaption>${i === 0 ? "Capa" : `Foto ${i + 1}`}</figcaption>
        <div class="foto-botoes">
          <button type="button" data-mover="${i}" data-passo="-1" aria-label="Mover para a esquerda" ${i === 0 ? "disabled" : ""}>←</button>
          <button type="button" data-mover="${i}" data-passo="1" aria-label="Mover para a direita" ${i === rascunho.fotos.length - 1 ? "disabled" : ""}>→</button>
          <button type="button" data-tirar="${i}" aria-label="Tirar esta foto do vinho">×</button>
        </div>
      </figure>`)
    .join("");

  // Fotos soltas: estão na pasta img/ mas nenhum vinho usa.
  // É aqui que aparecem as fotos coladas direto na pasta.
  const emUso = new Set(rascunho.fotos);
  catalogo.produtos.filter((p) => p.id !== rascunho.id).forEach((p) => p.fotos.forEach((foto) => emUso.add(foto)));
  const soltas = fotosNaPasta.filter((foto) => !emUso.has(foto));

  el("soltas").innerHTML = soltas.length
    ? `<p class="soltas-titulo">Fotos na pasta img que nenhum vinho usa. Clique para usar neste vinho.</p>
       <div class="fotos">
         ${soltas.map((foto) => `
           <figure class="foto foto-solta">
             <button type="button" data-usar="${seguro(foto)}" aria-label="Usar ${seguro(foto)} neste vinho"><img src="${caminhoFoto(foto)}" alt=""></button>
             <figcaption title="${seguro(foto)}">${seguro(foto)}</figcaption>
             <div class="foto-botoes"><button type="button" data-apagar="${seguro(foto)}">Apagar arquivo</button></div>
           </figure>`).join("")}
       </div>`
    : "";
}

// Diminui a foto para no máximo 1200px e converte para JPG.
// Assim o site carrega rápido mesmo com foto tirada no celular.
function reduzirFoto(arquivo) {
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    imagem.onerror = () => reject(new Error(`“${arquivo.name}” não é uma imagem válida.`));
    imagem.onload = () => {
      const escala = Math.min(1, 1200 / Math.max(imagem.width, imagem.height));
      const tela = document.createElement("canvas");
      tela.width = Math.round(imagem.width * escala);
      tela.height = Math.round(imagem.height * escala);
      const pincel = tela.getContext("2d");
      pincel.fillStyle = "#fff"; // fundo branco para PNG transparente
      pincel.fillRect(0, 0, tela.width, tela.height);
      pincel.drawImage(imagem, 0, 0, tela.width, tela.height);
      URL.revokeObjectURL(imagem.src);
      tela.toBlob(resolve, "image/jpeg", 0.85);
    };
    imagem.src = URL.createObjectURL(arquivo);
  });
}

// Envia as fotos escolhidas (ou arrastadas) para a pasta img/
async function enviarFotos(arquivos) {
  const nomeDoVinho = formVinho.elements.nome.value.trim() || "vinho";
  el("soltar").classList.add("enviando");

  for (const arquivo of arquivos) {
    try {
      const fotoReduzida = await reduzirFoto(arquivo);
      const rota = `/api/fotos?vinho=${encodeURIComponent(nomeDoVinho)}&extensao=.jpg`;
      const resposta = await servidor("POST", rota, fotoReduzida);
      rascunho.fotos.push(resposta.nome);
    } catch (erro) {
      el("erro-vinho").textContent = erro.message;
    }
  }

  el("soltar").classList.remove("enviando");
  await atualizarFotosDaPasta();
  mostrarFotos();
}

function moverFoto(posicao, passo) {
  const [foto] = rascunho.fotos.splice(posicao, 1);
  rascunho.fotos.splice(posicao + passo, 0, foto);
  mostrarFotos();
}

async function apagarArquivo(foto) {
  if (!confirm(`Apagar o arquivo “${foto}” da pasta img?\n\nNão dá para desfazer.`)) return;
  await servidor("DELETE", `/api/fotos?nome=${encodeURIComponent(foto)}`);

  // Se algum vinho ainda apontava para este arquivo, tira o nome dele do catálogo
  catalogo.produtos.forEach((p) => (p.fotos = p.fotos.filter((nome) => nome !== foto)));
  await salvarCatalogo("Arquivo apagado");

  await atualizarFotosDaPasta();
  mostrarFotos();
}

/* ---------- 6. Dados da loja ---------- */

const CAMPOS_DA_LOJA = ["nome", "whatsapp", "instagram", "frase", "rodape"];

function abrirLoja() {
  CAMPOS_DA_LOJA.forEach((campo) => (formLoja.elements[campo].value = catalogo.loja[campo] ?? ""));
  el("janela-loja").showModal();
}

async function salvarLoja() {
  CAMPOS_DA_LOJA.forEach((campo) => (catalogo.loja[campo] = formLoja.elements[campo].value.trim()));
  catalogo.loja.instagram = catalogo.loja.instagram.replace("@", "");
  if (!catalogo.loja.nome) catalogo.loja.nome = "GBM Vinhos";
  el("janela-loja").close();
  await salvarCatalogo("Dados da loja salvos");
}

/* ---------- 7. Eventos e início ---------- */

el("botao-novo").addEventListener("click", () => abrirVinho(null));
el("botao-loja").addEventListener("click", abrirLoja);

formVinho.addEventListener("submit", (evento) => {
  evento.preventDefault();
  salvarVinho().catch((erro) => (el("erro-vinho").textContent = erro.message));
});
formLoja.addEventListener("submit", (evento) => {
  evento.preventDefault();
  salvarLoja().catch((erro) => recado(erro.message));
});

// Um único "ouvinte" para todos os botões criados pelo JavaScript
document.addEventListener("click", (evento) => {
  const botao = evento.target.closest("button");
  if (!botao) return;
  const dados = botao.dataset;

  if ("fechar" in dados) botao.closest("dialog").close();
  if (dados.editar) abrirVinho(dados.editar);
  if (dados.estoque) trocarEstoque(dados.estoque);
  if (dados.excluir) excluirVinho(dados.excluir);
  if (dados.mover) moverFoto(Number(dados.mover), Number(dados.passo));
  if (dados.apagar) apagarArquivo(dados.apagar);
  if (dados.tirar) {
    rascunho.fotos.splice(Number(dados.tirar), 1);
    mostrarFotos();
  }
  if (dados.usar) {
    rascunho.fotos.push(dados.usar);
    mostrarFotos();
  }
});

// Área de fotos: clicar abre a escolha de arquivos; arrastar e soltar envia
const areaSoltar = el("soltar");
areaSoltar.addEventListener("click", () => el("arquivos").click());
el("arquivos").addEventListener("change", (evento) => {
  enviarFotos([...evento.target.files]);
  evento.target.value = ""; // permite escolher o mesmo arquivo de novo
});
areaSoltar.addEventListener("dragover", (evento) => {
  evento.preventDefault(); // sem isto o navegador abriria a foto em vez de enviar
  areaSoltar.classList.add("por-cima");
});
areaSoltar.addEventListener("dragleave", () => areaSoltar.classList.remove("por-cima"));
areaSoltar.addEventListener("drop", (evento) => {
  evento.preventDefault();
  areaSoltar.classList.remove("por-cima");
  enviarFotos([...evento.dataTransfer.files]);
});

async function iniciar() {
  try {
    catalogo = await servidor("GET", "/api/catalogo");
    catalogo.produtos.forEach((produto) => (produto.fotos = produto.fotos ?? []));
  } catch (erro) {
    el("avisos").innerHTML = `<p class="aviso">O painel só funciona com o servidor ligado. No terminal, dentro da pasta do projeto, rode <code>node servidor.js</code> e abra <code>http://localhost:3000/admin</code>.</p>`;
    el("botao-novo").disabled = true;
    el("botao-loja").disabled = true;
    return;
  }
  mostrarAvisos();
  mostrarLista();
}

iniciar();
