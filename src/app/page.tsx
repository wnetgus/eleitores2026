"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, ChevronRight, Menu, X, TrendingUp, Users, Target, FileSpreadsheet, Smartphone, Map, BarChart3, Crown, Zap, Eye, MessageSquare, Mail, ExternalLink, Check } from "lucide-react";

const roles = [
  {
    papel: "Deputado", icon: "🎤", cor: "from-amber-500 to-amber-700", destaque: "Estratégico",
    items: ["Crescimento político e expansão", "Panorama da coalizão", "Relatórios executivos"],
  },
  {
    papel: "Assessor", icon: "🏛️", cor: "from-purple-500 to-purple-700", destaque: "Gestão",
    items: ["Supervisão de coordenadores", "Aprovação de colaboradores", "Metas e produtividade"],
  },
  {
    papel: "Coordenador", icon: "🎯", cor: "from-blue-500 to-blue-700", destaque: "Supervisão",
    items: ["Gestão de equipe local", "Acompanhamento de metas", "Produtividade dos colaboradores"],
  },
  {
    papel: "Colaborador", icon: "⚡", cor: "from-emerald-500 to-emerald-700", destaque: "Operação",
    items: ["Cadastro rápido de eleitores", "Meta pessoal", "Operação de campo mobile"],
  },
];

const diferenciais = [
  { icon: Map, titulo: "Gestão de Coalizão", desc: "Visão estratégica de todos os gabinetes aliados em um só lugar" },
  { icon: BarChart3, titulo: "Dashboards Inteligentes", desc: "Cada papel enxerga exatamente o que precisa para sua função" },
  { icon: FileSpreadsheet, titulo: "Relatórios Executivos", desc: "PDF premium de 1 página com identidade visual do partido" },
  { icon: Target, titulo: "Hierarquia Política", desc: "8 níveis hierárquicos com permissões e escopo bem definidos" },
  { icon: TrendingUp, titulo: "Metas e Produtividade", desc: "Acompanhamento de metas individuais e desempenho da equipe" },
  { icon: Users, titulo: "Operação Centralizada", desc: "Cadastro, aprovação e gestão de colaboradores em fluxo contínuo" },
];

const passos = [
  { num: "01", titulo: "Crie o Gabinete", desc: "Cadastre o político e o assessor principal. A estrutura nasce pronta para operar." },
  { num: "02", titulo: "Monte a Equipe", desc: "Assessores aprovam coordenadores e colaboradores. Cada nível com seu escopo." },
  { num: "03", titulo: "Opere em Campo", desc: "Colaboradores cadastram eleitores. Coordenadores acompanham em tempo real." },
  { num: "04", titulo: "Acompanhe a Estratégia", desc: "Deputados e assessores acompanham crescimento, coalizão e relatórios executivos." },
];

export default function LandingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (user) router.push("/dashboard");
  }, [user, router]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  }

  const navLinks = [
    { label: "Funcionalidades", id: "diferenciais" },
    { label: "Como Funciona", id: "como-funciona" },
    { label: "Coalizão", id: "coalizao" },
    { label: "Relatórios", id: "relatorios" },
    { label: "Suporte", id: "suporte" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* NAVBAR */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/[0.06]" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center">
                <Shield size={16} className="text-white" />
              </div>
              <span className="text-white font-bold text-lg">Eleitores 2026</span>
            </div>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <button key={link.id} onClick={() => scrollTo(link.id)} className="text-sm text-white/50 hover:text-white transition-colors">
                  {link.label}
                </button>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <button onClick={() => router.push("/login")} className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors">
                Entrar
              </button>
              <button onClick={() => scrollTo("suporte")} className="px-4 py-2 text-sm bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 hover:bg-rose-500/30 transition-all font-medium">
                Solicitar Demonstração
              </button>
            </div>

            {/* Mobile hamburger */}
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-white/50 hover:text-white">
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <div className="md:hidden pb-4 space-y-2">
              {navLinks.map((link) => (
                <button key={link.id} onClick={() => scrollTo(link.id)} className="block w-full text-left px-3 py-2 text-sm text-white/50 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                  {link.label}
                </button>
              ))}
              <div className="pt-2 space-y-2">
                <button onClick={() => router.push("/login")} className="w-full px-4 py-2.5 text-sm bg-white/5 text-white rounded-xl hover:bg-white/10 transition-all">
                  Entrar
                </button>
                <button onClick={() => scrollTo("suporte")} className="w-full px-4 py-2.5 text-sm bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 transition-all font-medium">
                  Solicitar Demonstração
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-rose-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-20 md:py-32">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium mb-6">
              <Zap size={12} /> Plataforma de Gestão Política
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6 animate-in">
              A plataforma inteligente para<br />
              <span className="bg-gradient-to-r from-rose-400 to-rose-600 bg-clip-text text-transparent">gestão política e eleitoral</span>
            </h1>
            <p className="text-lg md:text-xl text-white/50 max-w-2xl mb-10 animate-in" style={{ animationDelay: "100ms" }}>
              Coalizão política, dashboards estratégicos, gestão de equipes e relatórios executivos em uma plataforma centralizada e premium.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-in" style={{ animationDelay: "200ms" }}>
              <button onClick={() => scrollTo("suporte")} className="px-6 py-3 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 hover:bg-rose-500/30 transition-all font-medium flex items-center gap-2">
                Solicitar Demonstração <ChevronRight size={16} />
              </button>
              <button onClick={() => router.push("/login")} className="px-6 py-3 bg-white/5 text-white rounded-xl border border-white/10 hover:bg-white/10 transition-all flex items-center gap-2">
                Entrar na Plataforma <ExternalLink size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* VEJA A PLATAFORMA EM AÇÃO */}
      <section className="py-20 md:py-28 px-4 md:px-8 bg-white/[0.01] border-y border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Veja a Plataforma em Ação</h2>
            <p className="text-white/50 max-w-xl mx-auto">Previews reais do sistema com dados simulados da plataforma.</p>
          </div>

          {/* 1. Central de Comando */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center mb-20">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium mb-4">
                <BarChart3 size={12} /> Central de Comando
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Dashboard Executivo</h3>
              <p className="text-white/50 text-sm leading-relaxed mb-4">
                O Super Admin tem alertas inteligentes, panorama executivo e ações rápidas em um único lugar. Problemas identificados antes de virarem gargalos.
              </p>
              <ul className="space-y-2 text-sm text-white/50">
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Alertas automáticos de inatividade</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Panorama com 8 indicadores-chave</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Ações rápidas para resolver problemas</li>
              </ul>
            </div>
            <div className="p-4 md:p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-[10px]">🔱</div>
                  <span className="text-white font-semibold text-sm">Central de Comando</span>
                </div>
                <span className="text-[10px] text-white/20">Preview</span>
              </div>
              <div className="space-y-2 mb-4">
                {["🔴 1 gabinete inativo — precisa de atenção", "🟡 3 solicitações de colaboradores pendentes", "🔵 2 coordenadores sem equipe vinculada"].map((a, i) => (
                  <div key={i} className={`p-2 rounded-lg text-xs ${i === 0 ? "bg-red-500/10 border border-red-500/20 text-red-300" : i === 1 ? "bg-amber-500/10 border border-amber-500/20 text-amber-300" : "bg-blue-500/10 border border-blue-500/20 text-blue-300"}`}>
                    {a}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {["4 ativos", "6 colab.", "49 total", "3 pend."].map((label, i) => (
                  <div key={i} className="p-2 rounded-lg bg-white/[0.02] text-center">
                    <p className="text-white font-bold text-sm">{["4", "6", "49", "3"][i]}</p>
                    <p className="text-[10px] text-white/30">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Panorama da Coalizão */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center mb-20">
            <div className="order-2 lg:order-1">
              <div className="p-4 md:p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-[10px]">🌐</div>
                    <span className="text-white font-semibold text-sm">Panorama da Coalizão</span>
                  </div>
                  <span className="text-[10px] text-white/20">Preview</span>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {["3", "37", "12.3", "+5"].map((val, i) => (
                    <div key={i} className="p-2 rounded-lg bg-white/[0.02] text-center">
                      <p className="text-white font-bold text-sm">{val}</p>
                      <p className="text-[10px] text-white/30">{["Aliados", "Eleitores", "Média", "Hoje"][i]}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {[
                    { n: "João Santos", c: "Prefeito", e: "15", s: "🟢" },
                    { n: "Marcos Silva", c: "Dep. Estadual", e: "10", s: "🟢" },
                    { n: "Lucas Oliveira", c: "Vereador", e: "12", s: "🟡" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] text-xs">
                      <div className="flex items-center gap-2">
                        <span>{item.s}</span>
                        <div>
                          <p className="text-white/70 font-medium">{item.n}</p>
                          <p className="text-white/30">{item.c}</p>
                        </div>
                      </div>
                      <span className="text-white/50">{item.e} eleitores</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium mb-4">
                <Map size={12} /> Coalizão
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Visão Estratégica dos Aliados</h3>
              <p className="text-white/50 text-sm leading-relaxed mb-4">
                Deputados e assessores acompanham todos os gabinetes aliados em métricas consolidadas — sem acessar dados operacionais de cada um.
              </p>
              <ul className="space-y-2 text-sm text-white/50">
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Crescimento agregado da coalizão</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Ranking de produtividade por aliado</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Autonomia operacional preservada</li>
              </ul>
            </div>
          </div>

          {/* 3. Relatório Executivo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center mb-20">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
                <FileSpreadsheet size={12} /> PDF Executivo
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Relatório de 1 Página</h3>
              <p className="text-white/50 text-sm leading-relaxed mb-4">
                PDF com identidade visual do partido, indicadores estratégicos e penetração territorial. Gerado em segundos dentro da plataforma.
              </p>
              <ul className="space-y-2 text-sm text-white/50">
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Cores e identidade do partido</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Indicadores de crescimento e penetração</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Pronto para apresentar e compartilhar</li>
              </ul>
            </div>
            <div>
              <div className="p-4 md:p-6 rounded-2xl bg-white rounded-lg shadow-xl max-w-sm mx-auto">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="h-1.5 w-16 rounded-full mb-2" style={{ background: "#CC2936" }} />
                    <p className="text-gray-800 font-bold text-sm">RELATÓRIO EXECUTIVO</p>
                  </div>
                  <span className="text-[10px] text-gray-300">Preview</span>
                </div>
                <p className="text-gray-400 text-xs mb-3">PT • Carlos Mendes • 12 eleitores</p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {["12", "7", "3"].map((val, i) => (
                    <div key={i} className="p-1.5 rounded bg-gray-50 text-center">
                      <p className="text-gray-800 font-bold text-xs">{val}</p>
                      <p className="text-gray-400 text-[9px]">{["Total", "Fortes", "Médios"][i]}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 text-[10px] font-medium">Penetração por cidade</p>
                  {["Recife — 5 (42%)", "Olinda — 3 (25%)", "Jaboatão — 2 (17%)"].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] text-gray-600">
                      <div className="w-1 h-1 rounded-full bg-gray-300" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Dashboards por Role */}
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-white mb-2">Experiência por Perfil</h3>
            <p className="text-white/50 text-sm">Cada papel enxerga exatamente o que precisa — nem mais, nem menos.</p>
          </div>

          {/* Liderança Política */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="text-xs text-white/30 font-medium tracking-wider uppercase">Liderança Política</span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {[
              { icon: "🎤", nome: "Deputado", cor: "from-amber-500 to-amber-700", items: ["Crescimento", "Coalizão", "Relatórios"], badge: "Estratégico" },
              { icon: "🏙️", nome: "Prefeito", cor: "from-emerald-500 to-emerald-700", items: ["Gestão Territorial", "Bairros", "Expansão Local"], badge: "Executivo" },
              { icon: "🎯", nome: "Vereador", cor: "from-amber-600 to-amber-800", items: ["Base Regional", "Comunidade", "Penetração Local"], badge: "Regional" },
            ].map((role, i) => (
              <div key={i} className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center hover:border-white/[0.12] transition-all group">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${role.cor} flex items-center justify-center text-xl mx-auto mb-3`}>
                  {role.icon}
                </div>
                <p className="text-white font-semibold mb-1">{role.nome}</p>
                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/[0.06] mb-3">{role.badge}</span>
                <div className="space-y-1">
                  {role.items.map((item, j) => (
                    <p key={j} className="text-white/40 text-xs">{item}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Operação e Gestão */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="text-xs text-white/30 font-medium tracking-wider uppercase">Operação e Gestão</span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: "🏛️", nome: "Assessor", cor: "from-purple-500 to-purple-700", items: ["Equipe", "Metas", "Aprovações"], badge: "Gestão" },
              { icon: "🎯", nome: "Coordenador", cor: "from-blue-500 to-blue-700", items: ["Supervisão", "Produtividade", "Time"], badge: "Supervisão" },
              { icon: "⚡", nome: "Colaborador", cor: "from-emerald-500 to-emerald-700", items: ["Cadastro", "Meta", "Campo"], badge: "Operação" },
            ].map((role, i) => (
              <div key={i} className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center hover:border-white/[0.12] transition-all group">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${role.cor} flex items-center justify-center text-xl mx-auto mb-3`}>
                  {role.icon}
                </div>
                <p className="text-white font-semibold mb-1">{role.nome}</p>
                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/[0.06] mb-3">{role.badge}</span>
                <div className="space-y-1">
                  {role.items.map((item, j) => (
                    <p key={j} className="text-white/40 text-xs">{item}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-[10px] text-white/20 mt-6">Dados simulados da plataforma real • Eleitores 2026</p>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="py-20 md:py-28 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Como Funciona</h2>
            <p className="text-white/50 max-w-xl mx-auto">Da criação do gabinete à inteligência estratégica — em quatro passos simples.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {passos.map((passo, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all group">
                <span className="text-3xl font-bold text-rose-500/30 group-hover:text-rose-400/60 transition-colors">{passo.num}</span>
                <h3 className="text-white font-semibold text-lg mt-3 mb-2">{passo.titulo}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{passo.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DIFERENCIAIS */}
      <section id="diferenciais" className="py-20 md:py-28 px-4 md:px-8 bg-white/[0.01] border-y border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Diferenciais da Plataforma</h2>
            <p className="text-white/50 max-w-xl mx-auto">Funcionalidades projetadas para cada nível da hierarquia política.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {diferenciais.map((d, i) => {
              const Icon = d.icon;
              return (
                <div key={i} className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-rose-500/20 hover:bg-rose-500/[0.02] transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center mb-4 group-hover:bg-rose-500/20 transition-colors">
                    <Icon size={20} className="text-rose-400" />
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">{d.titulo}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{d.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* DASHBOARDS POR ROLE */}
      <section className="py-20 md:py-28 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Experiência por Perfil</h2>
            <p className="text-white/50 max-w-xl mx-auto">Cada usuário enxerga exatamente o que precisa para sua função — nem mais, nem menos.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {roles.map((role, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all group">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${role.cor} flex items-center justify-center text-xl mb-4`}>
                  {role.icon}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-white font-semibold text-lg">{role.papel}</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/[0.06]">{role.destaque}</span>
                </div>
                <ul className="space-y-2">
                  {role.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-white/50">
                      <Check size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PANORAMA DA COALIZÃO */}
      <section id="coalizao" className="py-20 md:py-28 px-4 md:px-8 bg-white/[0.01] border-y border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium mb-6">
                <Map size={12} /> Visão Estratégica
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Panorama da Coalizão</h2>
              <p className="text-white/50 text-lg leading-relaxed mb-6">
                Deputados e assessores principais acompanham o crescimento de todos os gabinetes aliados em uma visão consolidada — sem acessar dados operacionais.
              </p>
              <ul className="space-y-3">
                {["Crescimento agregado dos aliados", "Ranking de produtividade por gabinete", "Métricas estratégicas sem acesso operacional", "Inteligência territorial da coalizão"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-white/60">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6 md:p-8 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-xs">🌐</div>
                <span className="text-white font-semibold text-sm">Panorama da Coalizão</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {["Aliados", "Eleitores", "Média", "Hoje"].map((label, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/[0.02] text-center">
                    <p className="text-lg font-bold text-white">{["3", "37", "12.3", "+5"][i]}</p>
                    <p className="text-xs text-white/40">{label}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {[
                  { nome: "João Santos", cargo: "Prefeito", eleitores: "15", status: "🟢" },
                  { nome: "Marcos Silva", cargo: "Dep. Estadual", eleitores: "10", status: "🟢" },
                  { nome: "Lucas Oliveira", cargo: "Vereador", eleitores: "12", status: "🟡" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] text-sm">
                    <div className="flex items-center gap-2">
                      <span>{item.status}</span>
                      <div>
                        <p className="text-white/80 font-medium">{item.nome}</p>
                        <p className="text-white/30 text-xs">{item.cargo}</p>
                      </div>
                    </div>
                    <span className="text-white/60 text-xs">{item.eleitores} eleitores</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RELATÓRIOS EXECUTIVOS */}
      <section id="relatorios" className="py-20 md:py-28 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="p-6 md:p-8 rounded-2xl bg-white rounded-lg shadow-xl max-w-md mx-auto">
                <div className="h-2 w-full rounded-full mb-4" style={{ background: "linear-gradient(90deg, #CC2936, #8B1A24)" }} />
                <p className="text-gray-800 font-bold text-lg mb-1">RELATÓRIO EXECUTIVO</p>
                <p className="text-gray-400 text-xs mb-4">PT • Carlos Mendes</p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {["Total", "Fortes", "Médios"].map((label, i) => (
                    <div key={i} className="p-2 rounded bg-gray-50 text-center">
                      <p className="text-gray-800 font-bold text-sm">{["12", "7", "3"][i]}</p>
                      <p className="text-gray-400 text-[10px]">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {["Recife — 5 eleitores (42%)", "Olinda — 3 eleitores (25%)", "Jaboatão — 2 eleitores (17%)"].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-6">
                <FileSpreadsheet size={12} /> PDF Premium
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Relatórios Executivos</h2>
              <p className="text-white/50 text-lg leading-relaxed mb-6">
                PDF de 1 página com a identidade visual do partido, indicadores estratégicos, penetração por cidade e ranking de colaboradores. Pronto para apresentar.
              </p>
              <ul className="space-y-3">
                {["Identidade visual do partido", "Indicadores de crescimento", "Penetração territorial", "Top colaboradores"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-white/60">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* MOBILE */}
      <section className="py-20 md:py-28 px-4 md:px-8 bg-white/[0.01] border-y border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-6">
              <Smartphone size={12} /> Mobile
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Operação em Campo</h2>
            <p className="text-white/50 max-w-xl mx-auto">Colaboradores e coordenadores cadastram e acompanham tudo pelo celular.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { icon: Users, titulo: "Cadastro Rápido", desc: "Formulário otimizado com CEP automático e busca de candidatos" },
              { icon: Target, titulo: "Meta em Tempo Real", desc: "Progresso da meta pessoal visível a cada cadastro realizado" },
              { icon: Eye, titulo: "Supervisão Mobile", desc: "Coordenadores acompanham a equipe de qualquer lugar" },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center hover:border-emerald-500/20 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                    <Icon size={22} className="text-emerald-400" />
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">{item.titulo}</h3>
                  <p className="text-white/40 text-sm">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SUPORTE */}
      <section id="suporte" className="py-20 md:py-28 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6">
              <MessageSquare size={24} className="text-rose-400" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Fale Conosco</h2>
            <p className="text-white/50 mb-8 max-w-md mx-auto">
              Solicite uma demonstração personalizada para sua equipe ou tire dúvidas sobre a plataforma.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="mailto:contato@eleitores2026.com.br" className="flex items-center gap-2 px-5 py-3 bg-white/5 text-white rounded-xl border border-white/10 hover:bg-white/10 transition-all text-sm">
                <Mail size={16} /> contato@eleitores2026.com.br
              </a>
              <a href="https://wa.me/5581999999999" target="_blank" className="flex items-center gap-2 px-5 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 hover:bg-emerald-500/30 transition-all text-sm font-medium">
                <MessageSquare size={16} /> WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 md:py-28 px-4 md:px-8 bg-gradient-to-b from-transparent to-rose-500/5 border-t border-white/[0.04]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
            Transforme sua operação política em uma<br />
            <span className="bg-gradient-to-r from-rose-400 to-rose-600 bg-clip-text text-transparent">central estratégica inteligente</span>
          </h2>
          <p className="text-white/50 text-lg mb-10 max-w-lg mx-auto">
            Coalizão, métricas, equipe e relatórios em um só lugar.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={() => scrollTo("suporte")} className="px-6 py-3 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 hover:bg-rose-500/30 transition-all font-medium flex items-center gap-2">
              Solicitar Demonstração <ChevronRight size={16} />
            </button>
            <button onClick={() => router.push("/login")} className="px-6 py-3 bg-white/5 text-white rounded-xl border border-white/10 hover:bg-white/10 transition-all flex items-center gap-2">
              Entrar na Plataforma
            </button>
          </div>
        </div>
      </section>

      {/* RODAPÉ */}
      <footer className="border-t border-white/[0.06] py-12 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center">
                <Shield size={14} className="text-white" />
              </div>
              <span className="text-white font-bold">Eleitores 2026</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-white/30">
              <button onClick={() => router.push("/login")} className="hover:text-white/60 transition-colors">Entrar</button>
              <button onClick={() => scrollTo("suporte")} className="hover:text-white/60 transition-colors">Suporte</button>
              <span>Termos</span>
              <span>Privacidade</span>
            </div>
            <p className="text-xs text-white/20">© 2026 Eleitores 2026. Plataforma de Gestão Política.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
