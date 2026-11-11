import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Flame } from 'lucide-react';
import api from '../services/api.js';

const palettes = [
  { bg: '#eef5e8', accent: '#2e6941', orb: '#d5e9c2' },
  { bg: '#f6f0e3', accent: '#8c672c', orb: '#ead9b4' },
  { bg: '#eaf3f1', accent: '#2c6c68', orb: '#cbe5df' },
  { bg: '#f4edf2', accent: '#80556f', orb: '#e8d3e1' }
];

export default function HomeCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/storefront/featured-categories')
      .then(({ data }) => setCategories(data.data))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  if (!loading && !categories.length) return null;

  return <section className="home-categories mx-auto max-w-7xl px-5 py-12 sm:px-8 md:py-16">
    <div className="section-heading"><div><span className="section-kicker">দোকানের জনপ্রিয় বিভাগ</span><h2>কী লাগবে আজ?</h2><p className="mt-1 text-sm text-stone-500">গত ৩০ দিনের বিক্রি ও category-তে থাকা পণ্যের ভিত্তিতে</p></div><Link to="/shop" className="text-link">সব পণ্য দেখুন <ArrowRight size={16}/></Link></div>
    <div className="home-category-grid mt-6">
      {loading ? Array.from({ length: 4 }, (_, i) => <div key={i} className="home-category-skeleton" aria-hidden="true"/>) : categories.map((category, index) => {
        const palette = palettes[index % palettes.length];
        return <Link key={category._id} to={`/shop?category=${category._id}`} className="home-category-card" style={{ '--category-bg': palette.bg, '--category-accent': palette.accent, '--category-orb': palette.orb }}>
          <span className="home-category-meta"><span className="home-category-rank">০{index + 1}</span>{category.salesTotal > 0 && <span className="home-category-popular"><Flame size={13}/> জনপ্রিয়</span>}</span>
          <span className="home-category-title">{category.nameBn || category.name}</span>
          <span className="home-category-bottom"><small>{category.productCount.toLocaleString('bn-BD')}টি পণ্য</small><span className="home-category-arrow"><ArrowRight size={17}/></span></span>
          <span className="home-category-orb" aria-hidden="true"/>
          <span className="home-category-lines" aria-hidden="true"/>
        </Link>;
      })}
    </div>
  </section>;
}
