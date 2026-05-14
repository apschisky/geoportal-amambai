from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TipoProblemaIluminacao(str, Enum):
    lampada_apagada = "lampada_apagada"
    lampada_piscando = "lampada_piscando"
    lampada_acesa_dia = "lampada_acesa_dia"
    poste_danificado = "poste_danificado"
    braco_luminaria_danificada = "braco_luminaria_danificada"
    fiacao_aparente = "fiacao_aparente"
    outro = "outro"


class StatusSolicitacaoIluminacao(str, Enum):
    aberta = "aberta"
    em_triagem = "em_triagem"
    encaminhada = "encaminhada"
    em_execucao = "em_execucao"
    aguardando_material = "aguardando_material"
    nao_localizado = "nao_localizado"
    resolvida = "resolvida"
    indeferida = "indeferida"
    cancelada = "cancelada"


class Coordenada(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class IluminacaoSolicitacaoCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    poste_id: str = Field(min_length=1, max_length=80)
    coordenada: Coordenada
    tipo_problema: TipoProblemaIluminacao
    descricao: str = Field(min_length=5, max_length=1000)
    ponto_referencia: str | None = Field(default=None, max_length=300)
    poste_proximo_informado: str | None = Field(default=None, max_length=120)
    nome_solicitante: str | None = Field(default=None, max_length=120)
    contato_solicitante: str | None = Field(default=None, max_length=120)

    @field_validator(
        "poste_id",
        "descricao",
        "ponto_referencia",
        "poste_proximo_informado",
        "nome_solicitante",
        "contato_solicitante",
        mode="before",
    )
    @classmethod
    def strip_strings(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class IluminacaoSolicitacaoResponse(BaseModel):
    protocolo: str
    status: StatusSolicitacaoIluminacao
    message: str
