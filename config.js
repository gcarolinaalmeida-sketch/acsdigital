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
