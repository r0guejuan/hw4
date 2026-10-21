import { Link } from 'react-router-dom'

export default function About() {
  return (
    <div className="container page page--narrow">
      <p className="eyebrow">About Us</p>
      <h1>
        Made for the people who make <span className="accent">Yale</span> home.
      </h1>

      <p className="lede">
        Campus Customs started with a simple idea: school gear should feel as good as the memories you make in it.
        We design and stock officially licensed Yale apparel for students, alumni, families, and anyone who
        bleeds a little blue.
      </p>

      <section className="about-block">
        <h2>What we make</h2>
        <p>
          Our shelves cover the pieces you reach for every day: heavyweight hoodies, crewnecks, quarter-zips, tees, and
          jackets. Some carry the big block letters everyone recognizes. Others are quieter: a left-chest logo for
          your varsity team, or the crest of your residential college.
        </p>
      </section>

      <section className="about-block">
        <h2>Who we make it for</h2>
        <p>
          First-years finding their footing. Seniors counting down to Commencement. Grad and professional students
          who live in the library. Parents and grandparents who want to show up to The Game in style. If Yale is part
          of your story, there's something here for you.
        </p>
      </section>

      <section className="about-block">
        <h2>How we do business</h2>
        <p>
          We keep it straightforward. The price you see is the price you pay, and the stock you see is what's
          actually on our shelves, down to the size. Our merch assistant reads from the same inventory, so when it
          tells you a medium is in stock, it is.
        </p>
      </section>

      <div className="about-cta">
        <Link to="/products" className="btn btn--primary">
          Browse the collection
        </Link>
        <Link to="/create-account" className="btn btn--ghost">
          Create an account
        </Link>
      </div>
    </div>
  )
}
