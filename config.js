// Configuração da conexão com o Supabase — compartilhada por todas as páginas.
// NÃO compartilhe a URL deste app publicamente: a chave abaixo é a chave
// "publishable" (somente leitura/escrita conforme as regras do banco),
// mas como o app não tem login, qualquer pessoa com a URL pode acessar os dados.
const SUPABASE_URL = 'https://axpldyfajvhimugwjmrf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zxhd5gfj4dEmcx0lS-5hFg_PWdq63Tj';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Helpers usados em várias páginas ---

function calcularIdade(dataNascimentoISO) {
    if (!dataNascimentoISO) return null;
    const nasc = new Date(dataNascimentoISO);
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const aindaNaoFezAniversario =
        hoje.getMonth() < nasc.getMonth() ||
        (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate());
    if (aindaNaoFezAniversario) idade--;
    return idade;
}

function formatarDataBR(dataISO) {
    if (!dataISO) return '-';
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
}

function diasDesde(dataISO) {
    if (!dataISO) return null;
    const data = new Date(dataISO);
    const hoje = new Date();
    return Math.floor((hoje - data) / (1000 * 60 * 60 * 24));
}

// --- Helpers de Receitas (renovação de medicamentos de uso contínuo) ---

const DIAS_POR_TIPO_RECEITA = { '30_dias': 30, '60_dias': 60, '6_meses': 180 };

function labelTipoReceita(tipo) {
    return { '30_dias': 'A cada 30 dias', '60_dias': 'A cada 60 dias', '6_meses': 'A cada 6 meses' }[tipo] || tipo;
}

// Calcula a data (ISO) em que a receita precisa ser renovada, a partir da
// última renovação e do tipo de periodicidade.
function calcularProximaRenovacao(dataUltimaRenovacaoISO, tipo) {
    if (!dataUltimaRenovacaoISO) return null;
    const dias = DIAS_POR_TIPO_RECEITA[tipo] || 30;
    const d = new Date(dataUltimaRenovacaoISO + 'T00:00:00');
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
}

// Quantos dias faltam até a data informada (negativo = já venceu).
function diasParaData(dataISO) {
    if (!dataISO) return null;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const alvo = new Date(dataISO + 'T00:00:00');
    return Math.round((alvo - hoje) / (1000 * 60 * 60 * 24));
}

// Início (segunda-feira) e fim (domingo) da semana atual, como datas ISO.
function limitesSemanaAtual() {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const diaSemana = hoje.getDay(); // 0 = domingo
    const deslocamentoSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
    const segunda = new Date(hoje); segunda.setDate(hoje.getDate() + deslocamentoSegunda);
    const domingo = new Date(segunda); domingo.setDate(segunda.getDate() + 6);
    return { inicio: segunda.toISOString().slice(0, 10), fim: domingo.toISOString().slice(0, 10) };
}
