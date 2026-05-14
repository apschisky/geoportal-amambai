# Geoportal Backend

Prova de conceito local e segura da futura API do Geoportal de Amambai, iniciando pelo modulo de Iluminacao Publica / Manutencao de Postes.

Esta etapa nao conecta banco de dados, nao implementa autenticacao real, nao usa dados de producao e nao integra com o Geoportal publico em producao.

## Como preparar o ambiente

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
```

## Como rodar localmente

```powershell
uvicorn app.main:app --reload
```

## Como executar testes

```powershell
pytest
```

## Endpoints disponiveis

- `GET /api/health`
- `GET /api/public/iluminacao/health`

## Seguranca

- Nao criar `.env` com credenciais no Git.
- Nao incluir senha, token, IP interno, usuario de banco ou dados reais.
- Usar `.env.example` apenas como referencia segura.
- Esta prova de conceito e local/homologacao e nao deve ser apontada para producao.
