import "./globals.css";

const products = [
  {
    name: "Orange Chronicles",
    tag: "Language Learning • Reading",
    description:
      "A multilingual reading and language-learning experience built around stories, vocabulary practice, and immersive reading.",
    status: "Featured product",
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

export default function Home() {
  return (
    <main>
      <header className="nav shell">
        <a className="brand" href="#top" aria-label="OrangeSoft home">
          <span className="mark">O</span>
          <span>OrangeSoft</span>
        </a>
        <nav>
          <a href="#products">Products</a>
          <a href="#services">Services</a>
          <a href="#about">About</a>
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
          <a className="secondary" href="#services">What we build</a>
        </div>
        <div className="heroPanel">
          <div><small>Company</small><strong>ORANGESOFT LTD</strong></div>
          <div><small>Focus</small><strong>Software • AI • Digital Products</strong></div>
          <div><small>Website</small><strong>orangesoft.uk</strong></div>
        </div>
      </section>

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
              {i === 0 ? <a href="#chronicles">View product →</a> : <span className="muted">Portfolio expanding</span>}
            </article>
          ))}
        </div>
      </section>

      <section id="chronicles" className="spotlight">
        <div className="shell spotlightInner">
          <div>
            <div className="eyebrow light">FEATURED PRODUCT</div>
            <h2>Orange Chronicles</h2>
            <p>A multilingual reading platform designed to make language learning feel like reading a real story—not completing a textbook exercise.</p>
            <div className="chips"><span>Multilingual</span><span>Reading</span><span>Vocabulary</span><span>Practice</span></div>
          </div>
          <div className="bookMock">
            <div className="bookLabel">AN ORANGESOFT PRODUCT</div>
            <div className="bookTitle">ORANGE<br/>CHRONICLES</div>
            <div className="bookSub">READ • LEARN • EXPLORE</div>
          </div>
        </div>
      </section>

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
          <p>That structure lets OrangeSoft launch new ideas without forcing every product to look or feel the same.</p>
        </div>
      </section>

      <section id="contact" className="contact shell">
        <div><div className="eyebrow light">CONTACT</div><h2>Build something useful.</h2><p>OrangeSoft is building its product portfolio and online presence.</p></div>
        <a className="contactButton" href="mailto:hello@orangesoft.uk">hello@orangesoft.uk</a>
      </section>

      <footer className="footer shell">
        <div className="brand"><span className="mark">O</span><span>OrangeSoft</span></div>
        <p>© 2026 ORANGESOFT LTD. All rights reserved.</p>
      </footer>
    </main>
  );
}
