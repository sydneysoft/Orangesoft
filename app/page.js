import "./globals.css";
import CookieBanner from "./CookieBanner";

const portfolio = [
  {
    name: "Blueprint",
    tag: "Artificial Intelligence • Research",
    description:
      "Orangesoft’s proprietary artificial intelligence model focused on research, reasoning, experimentation, multilingual interaction, and the exploration of new AI capabilities.",
    status: "Research project",
    href: "/blueprint",
    cta: "Open Blueprint →",
  },
  {
    name: "StoryLingo",
    tag: "Language Learning • Reading",
    description:
      "A multilingual reading and language-learning platform built around stories, interactive reading, vocabulary practice, writing exercises, pronunciation, and audio.",
    status: "Product",
    href: "https://storylingo.uk",
    cta: "Visit StoryLingo →",
    external: true,
  },
  {
    name: "Orangesoft OS",
    tag: "Operating Systems • Computing",
    description:
      "An operating system under development as part of Orangesoft’s research into advanced computing systems and general-purpose computing.",
    status: "In development",
  },
];

const researchAreas = [
  "Artificial intelligence research",
  "AI models & reasoning systems",
  "Advanced computing systems",
  "Operating systems research",
];

function OrangeSoftLogo() {
  return <img className="logo" src="/orangesoft-logo.svg" alt="Orangesoft" />;
}

export default function Home() {
  return (
    <main className="v1BlockUi">
      <CookieBanner />

      <header className="nav shell pixelFrame">
        <a className="brand" href="#top" aria-label="Orangesoft home">
          <OrangeSoftLogo />
        </a>
        <nav>
          <a href="#portfolio">Portfolio</a>
          <a href="#research">Research</a>
          <a href="#about">About</a>
          <a href="/blueprint">Blueprint</a>
        </nav>
        <a className="navCta pixelButton" href="#contact">Contact</a>
      </header>

      <section id="top" className="hero shell">
        <div className="eyebrow pixelLabel">ORANGESOFT LTD • LONDON • UNITED KINGDOM</div>
        <h1>Researching the future of <span>intelligence and computing.</span></h1>
        <p className="heroCopy">
          Orangesoft is a British technology research company headquartered in London,
          focused on artificial intelligence and advanced computing. It researches and
          develops artificial intelligence technologies, computing systems, and its own
          operating system.
        </p>
        <div className="heroActions">
          <a className="primary pixelButton" href="#portfolio">Explore portfolio</a>
          <a className="secondary pixelButton" href="/blueprint">Open Blueprint</a>
        </div>
        <div className="heroPanel pixelFrame">
          <div><small>Company</small><strong>ORANGESOFT LTD</strong></div>
          <div><small>Focus</small><strong>AI • ADVANCED COMPUTING • OS RESEARCH</strong></div>
          <div><small>Headquarters</small><strong>LONDON, UNITED KINGDOM</strong></div>
        </div>
      </section>

      <section id="portfolio" className="section shell sectionWhite pixelSection">
        <div className="sectionHead">
          <div><div className="eyebrow pixelLabel">PORTFOLIO</div><h2>Research and products.</h2></div>
          <p>Orangesoft develops experimental technologies and independent products across artificial intelligence, computing, and digital learning.</p>
        </div>
        <div className="productGrid">
          {portfolio.map((item, i) => (
            <article className={`productCard pixelFrame ${i === 0 ? "featured" : ""}`} key={item.name}>
              <div className="productTop"><span>{item.tag}</span><span className="status">{item.status}</span></div>
              <div><h3>{item.name}</h3><p>{item.description}</p></div>
              {item.href ? (
                <a href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noreferrer" : undefined}>{item.cta}</a>
              ) : (
                <span className="muted">Research & development</span>
              )}
            </article>
          ))}
        </div>
      </section>

      <section id="blueprint" className="spotlight">
        <div className="shell spotlightInner">
          <div>
            <div className="eyebrow pixelLabel">AI RESEARCH PROJECT</div>
            <h2>Blueprint</h2>
            <p>
              Blueprint is Orangesoft’s proprietary artificial intelligence model and research environment,
              focused on reasoning, experimentation, multilingual interaction, and exploring new AI capabilities.
            </p>
            <div className="chips"><span>AI Research</span><span>Reasoning</span><span>Multilingual</span><span>Experimentation</span><span>Models</span></div>
            <p><a href="/blueprint">Open Blueprint →</a></p>
          </div>
          <div className="bookMock pixelFrame">
            <div className="bookLabel">AN ORANGESOFT RESEARCH PROJECT</div>
            <div className="bookTitle">BLUE<br/>PRINT</div>
            <div className="bookSub">RESEARCH • REASON • EXPERIMENT</div>
          </div>
        </div>
      </section>

      <section id="research" className="section shell sectionWhite pixelSection">
        <div className="sectionHead">
          <div><div className="eyebrow pixelLabel">RESEARCH</div><h2>What Orangesoft explores.</h2></div>
          <p>Research focused on foundational technologies for intelligent systems and general-purpose computing.</p>
        </div>
        <div className="services pixelFrame">
          {researchAreas.map((area, i) => <div className="service" key={area}><span>0{i + 1}</span><h3>{area}</h3></div>)}
        </div>
      </section>

      <section id="about" className="section shell about pixelFrame">
        <div><div className="eyebrow pixelLabel">ABOUT</div><h2>Artificial intelligence and advanced computing.</h2></div>
        <div className="aboutCopy">
          <p>
            Orangesoft is a British technology research company headquartered in London, focused on artificial intelligence and advanced computing. It researches and develops artificial intelligence technologies, computing systems, and its own operating system, with the aim of advancing new approaches to intelligent and general-purpose computing.
          </p>
          <p>
            Its portfolio includes Blueprint, Orangesoft’s proprietary AI research model; StoryLingo, a multilingual reading and language-learning platform; and Orangesoft OS, an operating system currently under development.
          </p>
        </div>
      </section>

      <section id="contact" className="contact shell pixelFrame">
        <div><div className="eyebrow pixelLabel">CONTACT</div><h2>Research what comes next.</h2><p>For research, product, and collaboration enquiries, contact Orangesoft.</p></div>
        <a className="contactButton pixelButton" href="mailto:hello@orangesoft.uk">hello@orangesoft.uk</a>
      </section>

      <footer className="footer shell pixelFrame">
        <div className="brand"><OrangeSoftLogo /></div>
        <p>© 2026 ORANGESOFT LTD. All rights reserved.</p>
      </footer>
    </main>
  );
}
