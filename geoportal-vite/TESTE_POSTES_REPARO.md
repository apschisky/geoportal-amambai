## Instruções de Teste - Funcionalidade "Solicitar Reparo" para Postes

### Objetivo
Validar a implementação da funcionalidade de solicitação de reparo para a camada de postes, incluindo abertura de popup com botão que abre Google Forms pré-preenchido.

---

### Pré-requisitos
1. Projeto compilado com `npm run build`
2. Servidor de desenvolvimento rodando com `npm run dev` (ou arquivo `dist/index.html` servido em HTTP)
3. Console do navegador aberto (F12 > Abas "Console")
4. Camada "Postes da rede elétrica" ativada no painel de camadas

---

### Passos para Testar

#### 1. Iniciar o servidor
```bash
npm run dev
```
A aplicação estará disponível em `http://localhost:5173` (ou porta indicada no terminal).

#### 2. Ativar a camada de Postes
- Abra o painel de camadas (lado esquerdo do mapa)
- Procure por "Postes da rede elétrica"
- Marque a caixa de seleção para ativar

#### 3. Clicar em um poste visível
- Localize um poste no mapa na área urbana de Amambai
- Clique sobre o símbolo do poste
- Observar no console para os logs esperados

#### 4. Validação de Popup
Após o clique, você deve observar:
- **Popup aparece próximo ao clique** (posicionamento bottom-center)
- **Popup NÃO causa pan/zoom automático** no mapa
- **Título:** "Poste"
- **Conteúdo:**
  - "ID do Poste": valor do campo `IDs_coord` (ou "Não identificado")
  - "Coordenadas": latitude e longitude com 6 casas decimais (ex: "-23.470000, -55.160000")
- **Botão "Solicitar Reparo"** com ícone do WhatsApp (verde)

#### 5. Validação do Link
- Clique no botão "Solicitar Reparo"
- Deve abrir Google Forms em uma **nova aba** (`target="_blank"`)
- Verificar os campos pré-preenchidos na URL:
  - Campo 1 (ID do Poste): `entry.1055006444=<IDs_coord>`
  - Campo 2 (Coordenadas): `entry.2043543033=<lat>%2C%20<lon>`
  - Exemplo de URL: `https://docs.google.com/forms/d/e/1FAIpQLSfCB1x7yPaO_jDwqHhDjTi67JdTrMzTAZYxGQ_Vtyo7n9TSjQ/viewform?usp=pp_url&entry.1055006444=P_12345&entry.2043543033=-23.470000%2C%20-55.160000`

---

### Logs Esperados no Console

#### Sucesso Completo
```
[Postes] Consultando URL: https://geoserver.amambai.ms.gov.br/geoserver/wfs?...
[Postes] Resposta bruta: {type: "FeatureCollection", features: Array(1)}
[Postes] Features encontradas: [...]
[Postes] Popup gerado com sucesso
```

#### Poste não encontrado no clique
```
[Postes] Consultando URL: https://geoserver.amambai.ms.gov.br/geoserver/wfs?...
[Postes] Resposta bruta: {type: "FeatureCollection", features: Array(0)}
[Postes] Nenhuma feição encontrada
```

#### Erro ao consultar
```
[Postes] Consultando URL: https://geoserver.amambai.ms.gov.br/geoserver/wfs?...
[Postes] Erro ao consultar camada: Network error...
Erro ao buscar camada Poste: ...
```

---

### Casos de Teste

| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1 | Clicar em poste com ID | Popup com ID preenchido |
| 2 | Clicar em poste sem ID (raro) | Popup com "Não identificado" |
| 3 | Clicar fora de poste | Sem popup de poste, trata outras camadas |
| 4 | Camada desativada + clique | Nenhuma consulta, popup de outras camadas se houver |
| 5 | Abrir formulário | Abre em nova aba com campos preenchidos |
| 6 | Fechar popup | Popup desaparece, mapa segue normal |

---

### Verificação de Compatibilidade

✓ Não quebra popups existentes  
✓ Não interfere com zoom/pan de outras camadas  
✓ Postes isolados: sem zoom automático  
✓ Postes + outras camadas: comportamento normal das outras camadas  
✓ Estilo do link compatível com tema da aplicação  
✓ Font Awesome (WhatsApp) carregado via CDN em index.html  

---

### Debuging Avançado

#### Ver URL completa de GetFeatureInfo
Copie a URL do console e abra em nova aba para ver resposta bruta do GeoServer:
```
https://geoserver.amambai.ms.gov.br/geoserver/wfs?...&INFO_FORMAT=application/json
```

#### Ver estrutura completa da feature
No console, após o clique:
```javascript
console.log(JSON.stringify(data.features[0], null, 2))
```

#### Forçar teste com coordenada específica
Edite o arquivo `geoportal-postes-reparo.js`, função `formatPosteCoordinates()` para logs adicionais:
```javascript
console.log('Coordenada original:', coord);
console.log('Coordenada convertida:', lonlat);
```

---

### Limitações Conhecidas

1. **CRS EPSG:32721**: A camada usa esse CRS. Se GeoServer exigir parâmetro `CRS` ao invés de `SRS`, o código adapta automaticamente.
2. **GetFeatureInfo**: Requer que GeoServer esteja respondendo em JSON. Testar conectividade com `curl` se houver erro.
3. **Font Awesome CDN**: Depende de conexão com CDN. Se offline, ícone do WhatsApp não carrega (fallback: caractere 📲).

---

### Resolução de Problemas

#### Popup não aparece
- Verifique se camada "Postes" está ativada
- Verifique console para erros
- Clique diretamente em um símbolo de poste visível

#### Link não abre
- Verifique se `target="_blank"` está no HTML do popup
- Verifique se URL tem formato correto com `&` separando parâmetros
- Tente copiar a URL do console manualmente

#### Coordenadas incorretas
- Verifique se `ol.proj.toLonLat()` está convertendo corretamente
- Console deve mostrar: `Coordenada convertida: [lon, lat]`
- Validar manualmente em https://geohash.softeng.co/

#### Mapa fazendo zoom ao clicar em poste
- Confirmar que `posteHtml` é a primeira condição no if/else de exibição
- Verificar que loop de zoom não inclui condição de postes

---

### Arquivos Modificados

1. **geoportal-config.js**: Adicionadas constantes `POSTE_FORM_CONFIG`
2. **geoportal-postes-reparo.js**: Novo arquivo com funções de formatação e construção de URL
3. **geoportal-mapclick.js**: Adicionada consulta de postes com GetFeatureInfo
4. **geoportal-popup.js**: Ajustado posicionamento para `bottom-center` com offset `[0, -12]`
5. **index.html**: Já possui Font Awesome CDN (verificar linha com `cdnjs.cloudflare.com`)

---

### Checklist Final

- [ ] Projeto compila sem erros (`npm run build`)
- [ ] Dev server roda normalmente (`npm run dev`)
- [ ] Camada de postes ativa e visível no mapa
- [ ] Clique em poste abre popup próximo ao clique
- [ ] Popup não causa pan/zoom do mapa
- [ ] Botão "Solicitar Reparo" abre Google Forms em nova aba
- [ ] Formulário tem campos pré-preenchidos (ID + Coordenadas)
- [ ] Console mostra logs esperados
- [ ] Outras funcionalidades (zoom, medição, impressão) funcionam normalmente

---

### Resultado Final Esperado

Quando um usuário clica em um poste:
1. Popup aparece próximo ao clique (sem mover mapa)
2. Popup mostra ID do poste e coordenadas formatadas
3. Clique no botão abre Google Forms com:
   - `entry.1055006444` = ID do poste
   - `entry.2043543033` = "lat, lon" (com 6 casas decimais)
4. Console exibe logs detalhados para debugging
5. Todas as outras funcionalidades continuam operacionais
