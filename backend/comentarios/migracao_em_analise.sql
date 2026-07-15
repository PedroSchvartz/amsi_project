-- ============================================================================
-- Migracao: portao de aprovacao do lancamento -- estado "Em analise"
-- Plano: docs/planos/fluxo-aprovacao-lancamento.md
--
-- A FASE 1 (ALTER + backfill + indice) ja roda SOZINHA, em main._aplicar_migracoes(),
-- no startup de todo deploy -- mesmo caminho da coluna `lote`. Nao rode nada a mao
-- para criar as colunas: o startup e idempotente (so age se data_efetivacao falta).
--
-- Este arquivo guarda o que o startup NAO faz: a verificacao e o endurecimento
-- opcional por CHECK constraints.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- [RENOMEACAO] id_Usuario_FK_Fechamento -> id_Usuario_FK_Aprovacao.
-- Tambem ja roda sozinha no startup, ANTES da FASE 1 (que le esta coluna no
-- backfill). Reproduzida aqui so como referencia -- nao rode a mao.
--
-- RENAME COLUMN preserva a FK, mas o nome dela continuaria dizendo "fechamento";
-- por isso o segundo ALTER.
-- ----------------------------------------------------------------------------
-- ALTER TABLE Lancamento
--     RENAME COLUMN id_Usuario_FK_Fechamento TO id_Usuario_FK_Aprovacao;
-- ALTER TABLE Lancamento
--     RENAME CONSTRAINT lancamento_id_usuario_fk_fechamento_fkey
--                    TO lancamento_id_usuario_fk_aprovacao_fkey;


-- ----------------------------------------------------------------------------
-- [VERIFICACAO] Rodar depois do deploy do backend. Esperado: 0 em todas as linhas.
--
-- Se `pago_sem_efetivacao` > 0, o backfill nao rodou e esses lancamentos aparecem
-- como "Aberto" na tela -- o pagamento sumiu. Reaplique o backfill em [REPARO].
-- ----------------------------------------------------------------------------
-- SELECT
--     COUNT(*) FILTER (WHERE data_pagamento IS NOT NULL AND data_efetivacao IS NULL) AS pago_sem_efetivacao,
--     COUNT(*) FILTER (WHERE data_pagamento IS NOT NULL AND data_aprovacao  IS NULL) AS pago_sem_aprovacao,
--     COUNT(*) FILTER (WHERE data_aprovacao  IS NOT NULL AND data_efetivacao IS NULL) AS aprovado_sem_efetivacao
--   FROM Lancamento;


-- ----------------------------------------------------------------------------
-- [REPARO] So se a VERIFICACAO acima nao deu 0. Idempotente.
-- ----------------------------------------------------------------------------
-- UPDATE Lancamento
--    SET data_efetivacao = data_pagamento,
--        data_aprovacao  = data_pagamento,
--        id_Usuario_FK_Efetivacao = id_Usuario_FK_Aprovacao
--  WHERE data_pagamento IS NOT NULL AND data_efetivacao IS NULL;


-- ----------------------------------------------------------------------------
-- [OPCIONAL] Endurecimento por CHECK. O backend ja garante estas invariantes;
-- os CHECKs so impedem que um UPDATE manual no banco crie um estado impossivel.
--
-- Rodar DEPOIS da verificacao dar 0, senao o ALTER falha nas linhas ruins.
-- ----------------------------------------------------------------------------
-- ALTER TABLE Lancamento
--     ADD CONSTRAINT ck_lancamento_aprovacao_exige_efetivacao
--         CHECK (data_aprovacao IS NULL OR data_efetivacao IS NOT NULL),
--     ADD CONSTRAINT ck_lancamento_efetivacao_exige_pagamento
--         CHECK (data_efetivacao IS NULL OR data_pagamento IS NOT NULL);


-- ----------------------------------------------------------------------------
-- [OPCIONAL 2] Amarra aprovacao <-> aprovador. So aplique se esta contagem der 0:
--
-- SELECT COUNT(*) FROM Lancamento
--  WHERE data_aprovacao IS NOT NULL AND id_Usuario_FK_Aprovacao IS NULL;
--
-- Pode haver linha antiga paga sem aprovador (seed.py, dados_demo.py, ou admin que
-- setou data_pagamento pelo PATCH /editar). Se houver, NAO amarre -- o ALTER quebra.
-- ----------------------------------------------------------------------------
-- ALTER TABLE Lancamento
--     ADD CONSTRAINT ck_lancamento_aprovacao_exige_aprovador
--         CHECK ((data_aprovacao IS NULL) = (id_Usuario_FK_Aprovacao IS NULL));
