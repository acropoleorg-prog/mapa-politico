# Mapa Político — Rio de Janeiro

App web privado com autenticação, mapa interativo e dados em tempo real do Google Sheets.

---

## Pré-requisitos

- Conta no [Railway](https://railway.app)
- Conta no [Google Cloud Console](https://console.cloud.google.com)
- Node.js 18+ instalado localmente (só pra testar)

---

## 1. Configurar o Google Cloud (fazer uma vez só)

### 1.1 Criar projeto e ativar a API

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um novo projeto (ex: `mapa-politico`)
3. No menu lateral: **APIs e Serviços → Biblioteca**
4. Busque **Google Sheets API** e clique em **Ativar**

### 1.2 Criar chave de serviço

1. No menu lateral: **APIs e Serviços → Credenciais**
2. Clique em **+ Criar credenciais → Conta de serviço**
3. Dê um nome (ex: `mapa-leitor`) e clique em **Criar e continuar**
4. Pule as etapas opcionais e clique em **Concluído**
5. Clique na conta de serviço criada → aba **Chaves**
6. Clique em **Adicionar chave → Criar nova chave → JSON**
7. Um arquivo `.json` será baixado — **guarde bem esse arquivo**

### 1.3 Compartilhar a planilha com a conta de serviço

1. Abra o arquivo `.json` baixado e copie o campo `"client_email"` (algo como `mapa-leitor@mapa-politico.iam.gserviceaccount.com`)
2. Abra sua planilha no Google Sheets
3. Clique em **Compartilhar** (canto superior direito)
4. Cole o e-mail da conta de serviço, permissão **Leitor**, e clique em **Enviar**

---

## 2. Deploy no Railway

### 2.1 Subir o código

1. Crie um repositório no GitHub e suba esta pasta
   ```bash
   git init
   git add .
   git commit -m "inicial"
   git remote add origin https://github.com/SEU_USUARIO/mapa-politico.git
   git push -u origin main
   ```

2. No Railway: **New Project → Deploy from GitHub repo**
3. Selecione o repositório

### 2.2 Configurar variáveis de ambiente

No painel do Railway, vá em **Variables** e adicione:

| Variável | Valor |
|---|---|
| `APP_PASSWORD` | A senha que você quer usar pra acessar o mapa |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | O conteúdo **completo** do arquivo `.json` baixado (em uma linha só) |

**Dica:** Para copiar o JSON em uma linha, rode no terminal:
```bash
cat sua-chave.json | tr -d '\n'
```

### 2.3 Gerar domínio público

No Railway: **Settings → Domains → Generate Domain**

Pronto — seu mapa estará disponível no link gerado.

---

## 3. Atualizar os dados

Basta editar a planilha no Google Sheets. Na próxima vez que abrir o mapa, os dados serão carregados automaticamente — sem necessidade de redeploy.

---

## 4. Testar localmente

```bash
# Instalar dependências
npm install

# Criar arquivo de ambiente
cp .env.example .env
# Editar .env com sua senha e o JSON da chave

# Rodar
npm run dev
# Acesse http://localhost:3000
```

---

## Estrutura do projeto

```
mapa-politico/
├── server.js          ← servidor Express + leitura do Sheets
├── package.json
├── .env.example       ← modelo de variáveis de ambiente
└── public/
    └── index.html     ← mapa interativo completo
```

---

## Adicionar instituições parceiras

Edite o array `INSTITUTIONS` no arquivo `server.js`. Cada entrada tem:
```js
{
  nome: "Nome da instituição",
  tipo: "Tipo (ex: Espaço Cultural)",
  bairro: "Bairro",
  lat: -22.9999,
  lng: -43.9999,
  conexao: "Nome do contato que conecta"
}
```

---

## Adicionar novos bairros ao mapa

Se aparecer um bairro novo na planilha que não está no mapa, adicione as coordenadas no objeto `BAIRRO_COORDS` do `server.js`:
```js
"Nome do Bairro": [-22.XXXX, -43.XXXX],
```
