from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class TipoProblemaIluminacao(str, Enum):
    lampada_apagada = "lampada_apagada"
    lampada_piscando = "lampada_piscando"
    lampada_acesa_dia = "lampada_acesa_dia"
    poste_danificado = "poste_danificado"
    braco_luminaria_danificada = "braco_luminaria_danificada"
    fiacao_aparente = "fiacao_aparente"
    outro = "outro"


class TipoLocalizacaoIluminacao(str, Enum):
    poste_mapa = "poste_mapa"
    ponto_manual = "ponto_manual"


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

    localizacao_tipo: TipoLocalizacaoIluminacao
    poste_id: str | None = Field(default=None, max_length=80)
    coordenada: Coordenada
    tipo_problema: TipoProblemaIluminacao
    descricao: str = Field(min_length=5, max_length=1000)
    ponto_referencia: str | None = Field(default=None, max_length=300)
    observacoes_localizacao: str | None = Field(default=None, max_length=500)
    poste_proximo_informado: str | None = Field(default=None, max_length=120)
    nome_solicitante: str | None = Field(default=None, max_length=120)
    contato_solicitante: str | None = Field(default=None, max_length=120)

    @field_validator(
        "poste_id",
        "descricao",
        "ponto_referencia",
        "observacoes_localizacao",
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

    @model_validator(mode="after")
    def validate_localizacao(self) -> "IluminacaoSolicitacaoCreate":
        if self.localizacao_tipo == TipoLocalizacaoIluminacao.poste_mapa:
            if not self.poste_id:
                raise ValueError("poste_id is required when localizacao_tipo is poste_mapa")

        if self.localizacao_tipo == TipoLocalizacaoIluminacao.ponto_manual:
            if not self.observacoes_localizacao and not self.ponto_referencia:
                raise ValueError(
                    "observacoes_localizacao or ponto_referencia is required "
                    "when localizacao_tipo is ponto_manual"
                )

        return self


class IluminacaoSolicitacaoResponse(BaseModel):
    protocolo: str
    status: StatusSolicitacaoIluminacao
    message: str
