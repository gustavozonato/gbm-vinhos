# GBM Vinhos

Vitrine de vinhos para o link da bio do Instagram. O cliente escolhe o vinho e pede pelo WhatsApp.

Feito com HTML, CSS e JavaScript puros. Não tem framework nem `npm install`.

## Como usar no dia a dia

Você precisa do [Node.js](https://nodejs.org) instalado (versão 18 ou mais nova).

1. Abra o terminal na pasta do projeto e ligue o servidor:

   ```
   node servidor.js
   ```

2. Abra no navegador:
   - Site: http://localhost:3000
   - Painel: http://localhost:3000/admin

3. No painel, cadastre ou edite os vinhos. Tudo é salvo na hora, direto nos arquivos do projeto.

4. Para publicar, envie para a hospedagem estes itens:

   ```
   index.html
   css/
   js/
   dados/
   img/
   ```

   Não envie `admin/` nem `servidor.js`. Eles só servem no seu computador.

Para desligar o servidor: `Ctrl + C` no terminal.

## O painel

| Quero... | Como fazer |
|---|---|
| Cadastrar um vinho | Botão **Novo vinho**. Só o nome é obrigatório. |
| Mudar nome, descrição ou preço | **Editar** no vinho, altere e **Salvar vinho**. |
| Colocar fotos | Arraste as fotos para a área tracejada (ou clique nela). |
| Usar fotos que colei na pasta `img` | Abra o vinho: elas aparecem em "Fotos na pasta img que nenhum vinho usa". Clique para usar. |
| Escolher a foto de capa | A primeira foto é a capa. Use as setas ← → para trocar a ordem. |
| Marcar como esgotado | Clique no botão **Disponível** da lista. |
| Mudar WhatsApp, Instagram, frase | Botão **Dados da loja**. |

Sobre as fotos:

- São reduzidas (1200px no máximo) e renomeadas sozinhas ao salvar: `malbec-reserva-1.jpg`, `malbec-reserva-2.jpg`...
- Vinho com mais de uma foto ganha o carrossel na janela de detalhes, sem configurar nada.
- O botão "Pedir" só aparece no site depois que o WhatsApp for cadastrado.

## Onde fica cada coisa

```
index.html           A página do site (a estrutura)
css/styles.css       O visual do site. Cores e fontes ficam no topo do arquivo
js/app.js            O comportamento do site: filtros, cartões, carrossel, WhatsApp
dados/catalogo.json  Os dados: loja e vinhos. O painel grava aqui
img/                 As fotos dos vinhos
admin/               O painel (index.html, admin.css, admin.js)
servidor.js          O servidor local que faz o painel conseguir salvar
```

Cada arquivo começa com um comentário explicando o que ele faz e um índice das partes.

## Mudanças comuns no código

- **Trocar cores ou fontes:** `css/styles.css`, bloco `:root` no topo. Mude o valor da variável e o site inteiro acompanha.
- **Mudar o texto da mensagem do WhatsApp:** `js/app.js`, função `mensagemPedido`.
- **Novo tipo de vinho (ex.: Laranja):** `admin/index.html`, adicione um `<option>` no campo "Tipo". O filtro do site aparece sozinho.
- **Novo campo no vinho:** adicione o campo no formulário de `admin/index.html`, o nome dele na lista `CAMPOS_DE_TEXTO` de `admin/admin.js`, e mostre em `js/app.js` (lista `ficha` da função `abrirDetalhe`).

## Formato de um vinho no catalogo.json

O painel cuida disso, mas dá para editar à mão:

```json
{
  "id": "malbec-reserva",
  "nome": "Malbec Reserva",
  "tipo": "Tinto",
  "uva": "Malbec",
  "produtor": "Vinícola Exemplo",
  "pais": "Argentina",
  "regiao": "Mendoza",
  "safra": "2021",
  "volume": "750 ml",
  "preco": 89.9,
  "descricao": "Tinto encorpado...",
  "fotos": ["malbec-reserva-1.jpg", "malbec-reserva-2.jpg"],
  "disponivel": true,
  "destaque": true
}
```

`preco` usa ponto (89.9) e sem aspas. Use `null` para aparecer "Sob consulta". Cada `id` precisa ser único.

## Problemas comuns

- **"Não foi possível carregar o catálogo":** o site foi aberto com dois cliques no `index.html`. Abra por `http://localhost:3000` com o servidor ligado (o Live Server do VS Code também serve para ver o site, mas não para o painel).
- **O painel avisa que o servidor não está ligado:** rode `node servidor.js` e abra `http://localhost:3000/admin`.
- **Porta 3000 ocupada:** use outra, por exemplo `PORT=3001 node servidor.js`.
- **Mudei no painel e o site publicado não mudou:** falta enviar `dados/` e `img/` de novo para a hospedagem.
