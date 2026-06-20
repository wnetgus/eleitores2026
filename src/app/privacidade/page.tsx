"use client";

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Política de Privacidade</h1>
          <p className="text-white/40 text-sm">Eleitores 2026 — vigente a partir de junho de 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white/90">1. Responsável pelo Tratamento</h2>
          <p className="text-white/60 text-sm leading-relaxed">
            A plataforma <strong className="text-white/80">Eleitores 2026</strong> é operada pela equipe do mandato responsável pelo cadastro. O tratamento dos dados pessoais segue as diretrizes da Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white/90">2. Dados Coletados</h2>
          <p className="text-white/60 text-sm leading-relaxed">São coletados os seguintes dados dos eleitores cadastrados:</p>
          <ul className="list-disc list-inside text-white/60 text-sm space-y-1 ml-2">
            <li>Nome completo</li>
            <li>Número do título de eleitor ou CPF</li>
            <li>Telefone (opcional)</li>
            <li>Endereço residencial (opcional)</li>
            <li>Município e bairro</li>
            <li>Grau de apoio declarado à campanha</li>
            <li>Observações registradas pelo mobilizador</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white/90">3. Finalidade do Tratamento</h2>
          <p className="text-white/60 text-sm leading-relaxed">
            Os dados são utilizados exclusivamente para fins de mobilização eleitoral, organização da base de apoio do mandato e planejamento estratégico territorial. Não são compartilhados com terceiros, vendidos ou utilizados para fins comerciais.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white/90">4. Base Legal</h2>
          <p className="text-white/60 text-sm leading-relaxed">
            O tratamento é fundamentado no <strong className="text-white/80">consentimento expresso do titular</strong> (art. 7º, I da LGPD), registrado no momento do cadastro pelo mobilizador responsável.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white/90">5. Direitos do Titular</h2>
          <p className="text-white/60 text-sm leading-relaxed">O eleitor tem direito a, a qualquer momento:</p>
          <ul className="list-disc list-inside text-white/60 text-sm space-y-1 ml-2">
            <li>Confirmar a existência do tratamento de seus dados</li>
            <li>Acessar os dados armazenados</li>
            <li>Solicitar a correção de dados incompletos ou incorretos</li>
            <li>Solicitar a exclusão dos dados cadastrados</li>
            <li>Revogar o consentimento a qualquer momento</li>
          </ul>
          <p className="text-white/60 text-sm leading-relaxed">
            Para exercer esses direitos, o eleitor deve entrar em contato diretamente com o mobilizador responsável pelo seu cadastro ou com o gabinete do mandato.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white/90">6. Retenção e Eliminação</h2>
          <p className="text-white/60 text-sm leading-relaxed">
            Os dados serão mantidos durante o período do mandato e eliminados após o encerramento da campanha eleitoral correspondente, salvo obrigação legal de guarda.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white/90">7. Segurança</h2>
          <p className="text-white/60 text-sm leading-relaxed">
            Os dados são armazenados em servidores com criptografia em repouso e em trânsito. O acesso é restrito a membros autorizados da equipe de campanha, identificados por autenticação individual.
          </p>
        </section>

        <div className="pt-4 border-t border-white/10">
          <a href="/" className="text-sm text-white/40 hover:text-white/60 transition-colors underline">
            ← Voltar
          </a>
        </div>
      </div>
    </div>
  );
}
