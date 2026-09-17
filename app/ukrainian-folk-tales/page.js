import "./page.css";

export const metadata = {
  title: "Ukrainian Folk Tales by J Mijail | OrangeSoft",
  description: "Explore 13 Ukrainian folk tales adapted by J Mijail, with links to StoryLingo and the Amazon eBook.",
  alternates: { canonical: "https://www.orangesoft.uk/ukrainian-folk-tales" },
};

const stories = [
  ["01", "The Turnip", "Ріпка"],
  ["02", "The Mitten", "Рукавичка"],
  ["03", "The Straw Bull", "Солом’яний бичок"],
  ["04", "Goat-Dereza", "Коза-Дереза"],
  ["05", "Pan Kotskyi", "Пан Коцький"],
  ["06", "Ivasyk-Telesyk", "Івасик-Телесик"],
  ["07", "Kotyhoroshko", "Котигорошко"],
  ["08", "The Lame Duck", "Кривенька качечка"],
  ["09", "Sirko", "Сірко"],
  ["10", "The Fox and Me", "Лисичка та я"],
  ["11", "The Cat and the Rooster", "Котик і Півник"],
  ["12", "Oh", "Ох"],
  ["13", "The Flying Ship", "Летючий корабель"],
];

export default function UkrainianFolkTalesPage() {
  return (
    <main className="uftPage">
      <a className="uftBack" href="/">← ORANGESOFT</a>
      <p className="uftKicker">GRAPHIC NOVEL COLLECTION · VOLUME I</p>
      <h1>Ukrainian Folk Tales</h1>
      <h2>Українські народні казки</h2>
      <p className="uftIntro">A bilingual illustrated collection of 13 Ukrainian folk tales adapted by J Mijail. Read the collection through StoryLingo or find the eBook edition on Amazon.</p>

      <div className="uftActions">
        <a className="uftBtn" href="https://storylingo.uk/folk-tales/collection" target="_blank" rel="noopener noreferrer">READ ON STORYLINGO.UK ↗</a>
        <a className="uftBtn uftAlt" href="https://www.amazon.com/dp/B0H48CGNCZ" target="_blank" rel="noopener noreferrer">BUY THE EBOOK ON AMAZON ↗</a>
      </div>

      <section className="uftGrid" aria-label="Ukrainian Folk Tales collection">
        {stories.map(([n, en, uk]) => (
          <article className="uftCard" key={n}>
            <span>{n}</span>
            <b>{en}</b>
            <small>{uk}</small>
          </article>
        ))}
      </section>

      <footer className="uftFooter">
        <span>Adapted by J Mijail · Ukrainian Folk Tales · Volume I</span>
        <span><a href="/">OrangeSoft</a> · <a href="https://storylingo.uk" target="_blank" rel="noopener noreferrer">StoryLingo</a></span>
      </footer>
    </main>
  );
}
