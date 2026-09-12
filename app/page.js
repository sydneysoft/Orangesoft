import "./globals.css";

const products = [
  {
    name: "StoryLingo",
    tag: "Language Learning • Reading",
    description:
      "A multilingual reading and language-learning platform built around stories, vocabulary practice, grammar, pronunciation, audiobooks and interactive learning.",
    status: "Featured product",
    href: "https://storylingo.uk",
  },
  {
    name: "More products",
    tag: "Coming next",
    description:
      "OrangeSoft is building a portfolio of practical digital products across education, publishing, automation and AI.",
    status: "In development",
  },
];

const services = [
  "Web & app development",
  "AI-powered product development",
  "Automation & internal tools",
  "Digital publishing platforms",
];

function OrangeSoftLogo() {
  return <img className="logo" src="/orangesoft-logo.svg" alt="OrangeSoft" />;
}

export default function Home() {
  return (
    <main>
      <div className="band bandBlack">
        <header className="nav shell">
          <a className="brand" href="#top" aria-label="OrangeSoft home">
            <OrangeSoftLogo />
          </a>
          <nav>
            <a href="#products">Products</a>
            <a href="#services">Services</a>
            <a href="#about">About</a>
            <a href="https://storylingo.uk" target="_blank" rel="noreferrer">StoryLingo</a>
          </nav>
          <a className="navCta" href="#contact">Contact</a>
        </header>

        <section id="top" className="hero shell">
          <div className="eyebrow">ORANGESOFT LTD • UNITED KINGDOM</div>
          <h1>Software that turns ideas into <span>real products.</span></h1>
          <p className="heroCopy">
            OrangeSoft is a UK software company building digital products, AI-powered
            experiences and modern web applications.
          </p>
          <div className="heroActions">
            <a className="primary" href="#products">Explore products</a>
            <a className="secondary" href="https://storylingo.uk" target="_blank" rel="noreferrer">Visit StoryLingo</a>
          </div>
          <div className="heroPanel">
            <div><small>Company</small><strong>ORANGESOFT LTD</strong></div>
            <div><small>Focus</small><strong>Software • AI • Digital Products</strong></div>
            <div><small>Website</small><strong>orangesoft.uk</strong></div>
          </div>
        </section>
      </div>

      <div className="band bandRed">
        <section id="products" className="section shell">
          <div className="sectionHead">
            <div><div className="eyebrow">PRODUCTS</div><h2>Built by OrangeSoft.</h2></div>
            <p>Independent products with their own identity, backed by one software company.</p>
          </div>
          <div className="productGrid">
            {products.map((product, i) => (
              <article className={`productCard ${i === 0 ? "featured" : ""}`} key={product.name}>
                <div className="productTop"><span>{product.tag}</span><span className="status">{product.status}</span></div>
                <div><h3>{product.name}</h3><p>{product.description}</p></div>
                {product.href ? <a href={product.href} target="_blank" rel="noreferrer">Visit StoryLingo →</a> : <span className="muted">Portfolio expanding</span>}
              </article>
            ))}
          </div>
        </section>
      </div>

      <section id="storylingo" className="band bandOrange spotlight">
        <div className="shell spotlightInner">
          <div>
            <div className="eyebrow">FEATURED PRODUCT</div>
            <h2>StoryLingo</h2>
            <p>A multilingual reading platform designed to make language learning feel like reading a real story—not completing a textbook exercise.</p>
            <div className="chips"><span>Multilingual</span><span>Reading</span><span>Vocabulary</span><span>Practice</span><span>Audio</span></div>
            <p><a href="https://storylingo.uk" target="_blank" rel="noreferrer">storylingo.uk →</a></p>
          </div>
          <div className="bookMock">
            <div className="bookLabel">AN ORANGESOFT PRODUCT</div>
            <div className="bookTitle">STORY<br/>LINGO</div>
            <div className="bookSub">READ • LEARN • EXPLORE</div>
          </div>
        </div>
      </section>

      <div className="band bandBlack lowerBlack">
        <section id="services" className="section shell">
          <div className="sectionHead">
            <div><div className="eyebrow">CAPABILITIES</div><h2>What OrangeSoft builds.</h2></div>
            <p>Product-first development with a focus on useful, maintainable software.</p>
          </div>
          <div className="services">
            {services.map((service, i) => <div className="service" key={service}><span>0{i + 1}</span><h3>{service}</h3></div>)}
          </div>
        </section>

        <section id="about" className="section shell about">
          <div><div className="eyebrow">ABOUT</div><h2>One company. Multiple products.</h2></div>
          <div className="aboutCopy">
            <p>OrangeSoft Ltd is the parent company behind a growing portfolio of software and digital products. Each product can have its own brand and audience while sharing the same technical and business foundation.</p>
            <p>StoryLingo is one of those products, focused on multilingual reading and language learning.</p>
          </div>
        </section>

        <section id="contact" className="contact shell">
          <div><div className="eyebrow">CONTACT</div><h2>Build something useful.</h2><p>OrangeSoft is building its product portfolio and online presence.</p></div>
          <a className="contactButton" href="mailto:hello@orangesoft.uk">hello@orangesoft.uk</a>
        </section>

        <footer className="footer shell">
          <div className="brand"><OrangeSoftLogo /></div>
          <p>© 2026 ORANGESOFT LTD. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
}
