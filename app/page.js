import "./globals.css";
import CookieBanner from "./CookieBanner";

const portfolio = [
  {
    name: "Blueprint",
    tag: "Programming Language • Development",
    description:
      "Orangesoft’s own programming language, designed around a different way of expressing commands, logic, and software instructions.",
    status: "In development",
    href: "/blueprint",
    cta: "Open Blueprint →",
  },
  {
    name: "StoryLingo",
    tag: "Language Learning • Reading",
    description:
      "A multilingual reading platform where stories become an interactive way to read, explore vocabulary, and practise languages.",
    status: "Product",
    href: "https://storylingo.uk",
    cta: "Visit StoryLingo →",
    external: true,
  },
  {
    name: "Orangesoft OS",
    tag: "Operating Systems • Computing",
    description:
      "An operating system built by Orangesoft, exploring our own approach to the desktop and computing environment.",
    status: "In development",
  },
];

const developmentAreas = [
  "Operating systems",
  "Programming languages",
  "Computing systems",
  "Digital products",
];

function OrangeSoftLogo() {
  return <img className="logo" src="/orangesoft-logo.svg" alt="Orangesoft" />;
}

export default function Home() {
  return (
    <main className="v1BlockUi">
      <CookieBanner />

      <header className="nav shell pixelFrame">
        <a className="brand" href="#top" aria-label="Orangesoft home"><OrangeSoftLogo /></a>
        <nav><a href="#portfolio">Portfolio</a><a href="#research">Development</a><a href="#about">About</a><a href="/blueprint">Blueprint</a></nav>
        <a className="navCta pixelButton" href="#contact">Contact</a>
      </header>

      <section id="top" className="hero shell">
        <div className="eyebrow pixelLabel">ORANGESOFT LTD • LONDON • UNITED KINGDOM</div>
        <h1>Building across <span>software and computing.</span></h1>
        <p className="heroCopy">Orangesoft develops technology across software, computing and digital products. Our current work includes an operating system, our own programming language, and a multilingual reading platform.</p>
        <div className="heroActions"><a className="primary pixelButton" href="#portfolio">Explore projects</a><a className="secondary pixelButton" href="/blueprint">Open Blueprint</a></div>
        <div className="heroPanel pixelFrame">
          <div><small>Company</small><strong>ORANGESOFT LTD</strong></div>
          <div><small>Projects</small><strong>OS • BLUEPRINT • STORYLINGO</strong></div>
          <div><small>Headquarters</small><strong>LONDON, UNITED KINGDOM</strong></div>
        </div>
      </section>

      <section id="portfolio" className="section shell sectionWhite pixelSection">
        <div className="sectionHead"><div><div className="eyebrow pixelLabel">PORTFOLIO</div><h2>What we’re building.</h2></div><p>Independent projects across operating systems, programming, computing and digital products.</p></div>
        <div className="productGrid">{portfolio.map((item, i) => (<article className={`productCard pixelFrame ${i === 0 ? "featured" : ""}`} key={item.name}><div className="productTop"><span>{item.tag}</span><span className="status">{item.status}</span></div><div><h3>{item.name}</h3><p>{item.description}</p></div>{item.href ? (<a href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noreferrer" : undefined}>{item.cta}</a>) : (<span className="muted">In development</span>)}</article>))}</div>
      </section>

      <section id="blueprint" className="spotlight"><div className="shell spotlightInner"><div><div className="eyebrow pixelLabel">PROGRAMMING LANGUAGE</div><h2>Blueprint</h2><p>Blueprint is Orangesoft’s own programming language, designed around a different way of expressing commands, logic and software instructions.</p><div className="chips"><span>Programming</span><span>Commands</span><span>Logic</span><span>Software</span><span>Language</span></div><p><a href="/blueprint">Open Blueprint →</a></p></div><div className="bookMock pixelFrame"><div className="bookLabel">AN ORANGESOFT PROJECT</div><div className="bookTitle">BLUE<br/>PRINT</div><div className="bookSub">PROGRAM • BUILD • CREATE</div></div></div></section>

      <section id="research" className="section shell sectionWhite pixelSection"><div className="sectionHead"><div><div className="eyebrow pixelLabel">DEVELOPMENT</div><h2>What Orangesoft works on.</h2></div><p>Technology development across software, computing systems and digital products.</p></div><div className="services pixelFrame">{developmentAreas.map((area, i) => <div className="service" key={area}><span>0{i + 1}</span><h3>{area}</h3></div>)}</div></section>

      <section id="about" className="section shell about pixelFrame"><div><div className="eyebrow pixelLabel">ABOUT</div><h2>Software, computing and digital products.</h2></div><div className="aboutCopy"><p>Orangesoft is a British technology company headquartered in London. We develop technology across software, computing and digital products.</p><p>Our current projects include Orangesoft OS, our operating system; Blueprint, our own programming language; and StoryLingo, our multilingual reading and language-learning platform.</p></div></section>

      <section id="contact" className="contact shell pixelFrame"><div><div className="eyebrow pixelLabel">CONTACT</div><h2>Follow what we’re building.</h2><p>For product, technology and collaboration enquiries, contact Orangesoft.</p></div><a className="contactButton pixelButton" href="mailto:hello@orangesoft.uk">hello@orangesoft.uk</a></section>
      <footer className="footer shell pixelFrame"><div className="brand"><OrangeSoftLogo /></div><p>© 2026 ORANGESOFT LTD. All rights reserved.</p></footer>
    </main>
  );
}
