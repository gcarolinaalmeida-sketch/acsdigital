-- Execute no SQL Editor do Supabase (depois do schema.sql original)
alter table familias
    add column if not exists tipo_imovel text,
    add column if not exists abastecimento_agua text,
    add column if not exists destino_lixo text,
    add column if not exists animais text[];
