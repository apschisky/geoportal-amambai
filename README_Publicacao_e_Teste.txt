
==========================
📘 INSTRUÇÕES PARA A TI E TESTE LOCAL
==========================

✅ SOBRE O PROJETO
Este site utiliza JavaScript moderno com Módulos ES6 (ECMAScript Modules) e a biblioteca OpenLayers via CDN.
Todos os scripts JavaScript são importados como módulos usando: <script type="module" src="main.js"></script>

Para funcionar corretamente, os arquivos .js devem ser servidos via HTTP(S) com o tipo MIME adequado.

--------------------------
🔧 INSTRUÇÕES PARA A TI (Publicação no domínio)
--------------------------

1. Faça upload de todos os arquivos (HTML, JS, CSS, imagens) via FileZilla.
2. Verifique se o navegador está conseguindo carregar os arquivos JS sem erros.
3. Para isso, abra o navegador, acesse o site e pressione F12 para abrir o DevTools:
   - Vá até a aba "Console" e veja se há erros.
   - Vá até a aba "Network", filtre por ".js" e confira:
     • Status: 200 OK
     • Type: application/javascript

4. Caso ocorra erro como:
   - "Refused to execute script from ... because its MIME type is ...":
     ➤ O servidor deve configurar o tipo MIME correto para .js:
        Content-Type: application/javascript

5. NÃO é necessário instalar Apache ou Node.js no servidor de produção.

--------------------------
🧪 COMO TESTAR LOCALMENTE (Opção 1 - via Node.js + npx serve)
--------------------------

1. Instale o Node.js em https://nodejs.org (se ainda não tiver).
2. Abra o terminal (Prompt de Comando ou PowerShell no Windows).
3. Navegue até a pasta do projeto:
   cd C:\Caminho\Para\Seu\Projeto

4. Rode o comando:
   npx serve

5. Acesse no navegador:
   http://localhost:3000

6. O site deverá carregar normalmente. Use F12 para depurar caso algo não funcione.

--------------------------
🧪 COMO TESTAR LOCALMENTE (Opção 2 - via Visual Studio Code)
--------------------------

1. Abra o projeto no VS Code.
2. Instale a extensão "Live Server" (Ritwick Dey).
3. Clique com o botão direito no index.html > "Open with Live Server".
4. O navegador será aberto automaticamente em http://127.0.0.1:5500
5. Pressione F12 para depurar qualquer problema.

--------------------------
✅ OBSERVAÇÃO
--------------------------
Evite abrir o arquivo index.html diretamente com duplo clique (file://), pois os imports ES Modules não funcionam neste contexto.
Use sempre um servidor local para testes ou hospede em um servidor web.
