function NewsIframe() {
  return (
    <div style={{ marginTop: "30px" }}>
      <h2>Notícias da Subprefeitura</h2>

      <iframe
        src="https://www.prefeitura.sp.gov.br/cidade/secretarias/subprefeituras/sao_miguel_paulista/"
        width="100%"
        height="500px"
        style={{ border: "none", borderRadius: "10px" }}
        title="Noticias São Miguel"
      />
    </div>
  );
}

export default NewsIframe;