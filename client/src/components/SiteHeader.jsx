import { Link, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Heart, LogOut, Package, Settings, ShieldCheck, ShoppingBasket, UserRound, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function SiteHeader() {
  const { user, logout } = useAuth();
  const { count, favorites } = useCart();
  const [logoUnavailable, setLogoUnavailable] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef(null);
  const location = useLocation();
  useEffect(() => setProfileOpen(false), [location.pathname]);
  useEffect(() => {
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setProfileOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  return <header className="site-header"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6"><Link to="/" className="brand-lockup" aria-label="Osman Store হোম"><span className="brand-logo-frame">{logoUnavailable?<span className="brand-mark"><ShoppingBasket size={20}/></span>:<img src="/osman-store-logo.png" alt="Osman Store" className="brand-logo" onError={()=>setLogoUnavailable(true)}/>}</span><small>আপনার পাড়ার বিশ্বস্ত দোকান</small></Link><nav className="flex items-center gap-0.5 sm:gap-1"><Link className="nav-link" to="/shop">বাজার</Link>{user?.role==='CUSTOMER'&&<Link className="nav-link wishlist-nav" to="/shop?saved=1" aria-label="পছন্দের পণ্য"><Heart size={16}/><span className="hidden lg:inline">পছন্দ</span>{favorites.length>0&&<span className="cart-count">{favorites.length}</span>}</Link>}<Link className="nav-link" to="/cart"><ShoppingBasket className="sm:hidden" size={16}/><span className="hidden sm:inline">ঝুড়ি</span><span className="cart-count">{count}</span></Link>{user ? <div className="profile-menu" ref={menuRef}><button className="profile-trigger" type="button" aria-expanded={profileOpen} onClick={()=>setProfileOpen(!profileOpen)}><span className="profile-avatar">{user.name?.trim()?.[0]||<UserRound size={17}/>}</span><span className="profile-trigger-copy"><b>{user.name?.split(' ')[0]||'আমার প্রোফাইল'}</b><small>{user.role==='OWNER'?'দোকান মালিক':'আমার অ্যাকাউন্ট'}</small></span><ChevronDown size={15} className={profileOpen?'chevron-open':''}/></button>{profileOpen&&<div className="profile-dropdown"><div className="profile-dropdown-head"><b>{user.name}</b><small>{user.phone}</small></div>{user.role==='OWNER'?<><Link to="/owner"><ShieldCheck/>ড্যাশবোর্ড</Link><Link to="/owner/customers"><UserRound/>ক্রেতা</Link><Link to="/owner/settings"><Settings/>দোকানের সেটিংস</Link></>:<><Link to="/account"><UserRound/>প্রোফাইল ও ঠিকানা</Link><Link to="/orders"><Package/>আমার অর্ডার</Link><Link to="/purchases"><ShoppingBasket/>ক্রয়ের ইতিহাস</Link><Link to="/due"><Wallet/>বাকি খাতা</Link><Link to="/shop?saved=1"><Heart/>পছন্দের পণ্য{favorites.length>0&&<span className="menu-count">{favorites.length}</span>}</Link></>}<Link to="/change-password"><ShieldCheck/>পাসওয়ার্ড পরিবর্তন</Link><button onClick={logout}><LogOut/>লগ আউট</button></div>}</div> : <Link to="/login" className="nav-cta">প্রবেশ করুন <ArrowRight size={15}/></Link>}</nav></div></header>;
}
