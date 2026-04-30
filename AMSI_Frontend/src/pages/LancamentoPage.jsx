import "../styles/lancamento.css";

function LancamentoPage() {
  return (
    <div className="container">
      <div className="box">
        <h2>Cadastro de Lançamentos</h2>

        <h4>INFORMAÇÕES BÁSICAS</h4>

        <div className="row">
          <div className="field">
            <label>Cliente / Fornecedor</label>
            <input />
          </div>

          <div className="field">
            <label>Data do Lançamento</label>
            <input type="date" />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label>Tipo de Lançamento</label>
            <input />
          </div>

          <button className="novo-tipo">+ Novo Tipo</button>
        </div>

        <div className="field">
          <label>Categoria</label>
          <input />
        </div>

        <div className="field">
          <label>Descrição</label>
          <textarea rows="3" />
        </div>

        <h4>INFORMAÇÕES DO PAGAMENTO</h4>

        <div className="row">
          <div className="field">
            <label>Data de Vencimento</label>
            <input type="date" />
          </div>

          <div className="field valor">
            <label>Valor</label>
            <div className="input-valor">
              <span>R$</span>
              <input type="number" />
            </div>
          </div>
        </div>

        <div className="buttons">
          <button className="cancel">CANCELAR</button>
          <button className="save">SALVAR</button>
        </div>
      </div>
    </div>
  );
}

export default LancamentoPage;