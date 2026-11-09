import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserRound, Phone, Plus, Minus, Trash2, ShoppingCart, Banknote, Wallet, CheckCircle2, LoaderCircle } from 'lucide-react';
import api from '../services/api.js';
import SiteHeader from '../components/SiteHeader.jsx';

const money = value => `৳${Number(value || 0).toLocaleString('bn-BD', { maximumFractionDigits: 2 })}`;

export default function OwnerDirectSale() {
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [paymentChoice, setPaymentChoice] = useState('CASH');
  const [busy, setBusy] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/inventory')
      .then(({ data }) => { if (active) setProducts(data.data); })
      .catch(e => { if (active) setError(e.response?.data?.message || 'পণ্যের তালিকা লোড হয়নি।'); })
      .finally(() => { if (active) setLoadingProducts(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const query = customerSearch.trim();
    if (!query || customer) { setCustomers([]); setCustomerLoading(false); return undefined; }
    setCustomers([]);
    setCustomerLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api.get('/owner/customers', { params: { q: query, activeOnly: true }, signal: controller.signal })
        .then(({ data }) => setCustomers(data.data.filter(item => item.isActive !== false)))
        .catch(e => { if (e.name !== 'CanceledError' && e.name !== 'AbortError') setError(e.response?.data?.message || 'ক্রেতা খোঁজা যায়নি।'); })
        .finally(() => { if (!controller.signal.aborted) setCustomerLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [customerSearch, customer]);

  const visibleProducts = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase();
    return products.filter(product => !query || [product.name, product.nameBn, product.category?.name, product.category?.nameBn]
      .some(value => value?.toLocaleLowerCase().includes(query)));
  }, [products, productSearch]);
  const total = cart.reduce((sum, row) => sum + row.quantity * Number(row.product.effectivePrice ?? row.product.price), 0);

  const addProduct = product => {
    setError('');
    const row = cart.find(item => item.product._id === product._id);
    const nextQuantity = (row?.quantity || 0) + 1;
    if (nextQuantity > product.available) { setError(`${product.nameBn || product.name} পণ্যের পর্যাপ্ত মজুদ নেই।`); return; }
    setCart(current => row
      ? current.map(item => item.product._id === product._id ? { ...item, quantity: nextQuantity } : item)
      : [...current, { product, quantity: 1 }]);
  };

  const changeQuantity = (productId, quantity) => {
    const row = cart.find(item => item.product._id === productId);
    if (!row) return;
    if (quantity <= 0) {
      setCart(current => current.filter(item => item.product._id !== productId));
    } else if (quantity <= row.product.available) {
      setCart(current => current.map(item => item.product._id === productId ? { ...item, quantity } : item));
    } else {
      setError(`মজুদে আছে ${row.product.available} ${row.product.unit}।`);
    }
  };

  const finishSale = async event => {
    event.preventDefault();
    if (!customer) { setError('আগে নিবন্ধিত একজন ক্রেতা বেছে নিন।'); return; }
    if (!cart.length) { setError('বিলে অন্তত একটি পণ্য যোগ করুন।'); return; }
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const customerName = customer.name;
      const { data } = await api.post('/sales/direct', {
        customerId: customer._id,
        items: cart.map(row => ({ product: row.product._id, quantity: row.quantity })),
        paidAmount: paymentChoice === 'CASH' ? Number(total.toFixed(2)) : 0,
        paymentMethod: 'CASH',
        approveDue: paymentChoice === 'DUE',
        note: ''
      });
      setSuccess(`${customerName}-এর বিক্রি সম্পন্ন · বিল ${data.data.saleNumber} · ${paymentChoice === 'CASH' ? 'নগদ পরিশোধ' : 'বাকি খাতায় যোগ হয়েছে'} · ${money(data.data.total)}`);
      setCustomer(null);
      setCustomerSearch('');
      setCustomers([]);
      setProductSearch('');
      setCart([]);
      setPaymentChoice('CASH');
    } catch (e) {
      setError(e.response?.data?.message || 'বিক্রি রেকর্ড করা যায়নি।');
    } finally {
      setBusy(false);
    }
  };

  return <><SiteHeader/><main className="mx-auto min-h-screen max-w-7xl bg-stone-50 px-4 py-6 sm:px-6 sm:py-8">
    <Link to="/owner" className="text-sm text-brand-700">← ড্যাশবোর্ড</Link>
    <div className="mt-3"><span className="text-sm font-semibold text-brand-700">কাউন্টারে বিক্রি</span><h1 className="text-3xl font-bold">সরাসরি বিক্রি</h1><p className="mt-1 text-stone-500">নিবন্ধিত ক্রেতা নির্বাচন করে তার নামে বিক্রির হিসাব রাখুন।</p></div>
    {success && <div role="status" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"><span className="flex items-center gap-2"><CheckCircle2 size={18}/>{success}</span><span className="font-semibold">পরের ক্রেতার জন্য প্রস্তুত</span></div>}
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

    <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
      <section className="min-w-0 space-y-5">
        <div className="rounded-xl border bg-white p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-bold"><UserRound size={18}/>১. নিবন্ধিত ক্রেতা বেছে নিন</h2>
          {customer ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand-50 p-3">
            <div><b>{customer.name}</b><p className="mt-1 flex items-center gap-1 text-sm text-stone-600"><Phone size={14}/>{customer.phone} <span className="ml-2">বর্তমান বাকি {money(customer.dueBalance)}</span></p></div>
            <button type="button" onClick={() => { setCustomer(null); setCustomerSearch(''); setCart([]); setError(''); }} className="rounded-lg border bg-white px-3 py-2 text-sm">ক্রেতা বদলান</button>
          </div> : <div className="relative mt-3">
            <label className="flex min-h-12 items-center gap-3 rounded-lg border px-3 text-stone-400 focus-within:border-brand-500"><Search size={18}/><input className="min-w-0 flex-1 border-0 bg-transparent outline-none" placeholder="নাম বা ফোন নম্বর লিখে খুঁজুন" value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); setError(''); setSuccess(''); }}/></label>
            {!!customerSearch.trim() && <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border bg-white shadow-sm">{customerLoading ? <p className="p-3 text-sm text-stone-500">ক্রেতা খোঁজা হচ্ছে…</p> : customers.length ? customers.map(item => <button key={item._id} type="button" onClick={() => { setCustomer(item); setCustomerSearch(''); setCustomers([]); setError(''); }} className="flex w-full items-center justify-between gap-3 border-b p-3 text-left last:border-0 hover:bg-brand-50"><span><b>{item.name}</b><small className="mt-1 block text-stone-500">{item.phone}</small></span><span className="text-right text-sm">বাকি<br/><b>{money(item.dueBalance)}</b></span></button>) : <p className="p-3 text-sm text-stone-500">কোনো নিবন্ধিত ক্রেতা মেলেনি।</p>}</div>}
          </div>}
        </div>

        <div className="rounded-xl border bg-white p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-bold"><Search size={18}/>২. পণ্য খুঁজে বিলে যোগ করুন</h2>
          <label className="mt-3 flex min-h-11 items-center gap-2 rounded-lg border px-3 text-stone-400 focus-within:border-brand-500"><Search size={17}/><input className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" placeholder="পণ্যের নাম বা category খুঁজুন" value={productSearch} onChange={e => setProductSearch(e.target.value)}/></label>
          <div className="mt-3 max-h-[430px] space-y-2 overflow-y-auto pr-1">
            {loadingProducts && <p className="p-4 text-center text-sm text-stone-500">পণ্য লোড হচ্ছে…</p>}
            {!loadingProducts && visibleProducts.map(product => <div key={product._id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0"><b className="block truncate">{product.nameBn || product.name}</b><small className="block truncate text-stone-500">{product.nameBn ? `${product.name} · ` : ''}{money(product.effectivePrice ?? product.price)} / {product.unit} · মজুদ {product.available}</small></div>
              <button type="button" disabled={product.available <= 0 || !customer} onClick={() => addProduct(product)} aria-label={`${product.name} বিলে যোগ করুন`} className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-brand-700 text-white disabled:bg-stone-300"><Plus size={18}/></button>
            </div>)}
            {!loadingProducts && !visibleProducts.length && <p className="p-5 text-center text-sm text-stone-500">এই নামে পণ্য পাওয়া যায়নি।</p>}
            {!customer && !loadingProducts && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">পণ্য বিলে যোগ করতে আগে ক্রেতা নির্বাচন করুন।</p>}
          </div>
        </div>
      </section>

      <form onSubmit={finishSale} className="rounded-xl border bg-white p-4 sm:sticky sm:top-24 sm:p-5">
        <h2 className="flex items-center gap-2 font-bold"><ShoppingCart size={18}/>৩. বিল ও পেমেন্ট</h2>
        {customer && <p className="mt-2 text-sm text-stone-500">ক্রেতা: <b className="text-stone-800">{customer.name}</b></p>}
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
          {cart.map(row => <div key={row.product._id} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2"><b className="min-w-0 flex-1">{row.product.nameBn || row.product.name}</b><button type="button" onClick={() => changeQuantity(row.product._id, 0)} aria-label="পণ্য সরান" className="text-red-500"><Trash2 size={16}/></button></div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><small className="text-stone-500">{money(row.product.effectivePrice ?? row.product.price)} × {row.quantity} {row.product.unit}</small><b>{money(row.quantity * Number(row.product.effectivePrice ?? row.product.price))}</b></div>
            <div className="mt-2 flex items-center gap-2"><button type="button" onClick={() => changeQuantity(row.product._id, row.quantity - 1)} className="grid h-8 w-8 place-items-center rounded-md border" aria-label="পরিমাণ কমান"><Minus size={14}/></button><input aria-label={`${row.product.name} quantity`} className="w-20 rounded-md border p-1.5 text-center" type="number" min=".001" step=".001" max={row.product.available} value={row.quantity} onChange={e => changeQuantity(row.product._id, Number(e.target.value))}/><button type="button" onClick={() => changeQuantity(row.product._id, row.quantity + 1)} className="grid h-8 w-8 place-items-center rounded-md border" aria-label="পরিমাণ বাড়ান"><Plus size={14}/></button><span className="text-xs text-stone-500">{row.product.unit}</span></div>
          </div>)}
          {!cart.length && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-stone-400">এখনো কোনো পণ্য বিলে যোগ হয়নি।</p>}
        </div>
        <div className="mt-4 flex items-center justify-between border-t pt-4"><span className="font-semibold">মোট বিল</span><strong className="text-xl text-brand-800">{money(total)}</strong></div>

        <fieldset className="mt-4 grid grid-cols-2 gap-2 border-0 p-0">
          <legend className="mb-2 text-sm font-semibold">৪. পেমেন্টের ধরন বেছে নিন</legend>
          <button type="button" aria-pressed={paymentChoice === 'CASH'} onClick={() => setPaymentChoice('CASH')} className={`flex min-h-14 items-center justify-center gap-2 rounded-lg border p-2 text-sm font-semibold ${paymentChoice === 'CASH' ? 'border-brand-500 bg-brand-50 text-brand-800' : 'bg-white text-stone-600'}`}><Banknote size={17}/>নগদ পরিশোধ</button>
          <button type="button" aria-pressed={paymentChoice === 'DUE'} onClick={() => setPaymentChoice('DUE')} className={`flex min-h-14 items-center justify-center gap-2 rounded-lg border p-2 text-sm font-semibold ${paymentChoice === 'DUE' ? 'border-amber-400 bg-amber-50 text-amber-800' : 'bg-white text-stone-600'}`}><Wallet size={17}/>বাকি রাখুন</button>
        </fieldset>
        <p className="mt-3 rounded-lg bg-stone-50 p-3 text-sm text-stone-600">{paymentChoice === 'CASH' ? `নগদে ${money(total)} পরিশোধিত হিসেবে customer-এর purchase history-তে থাকবে।` : `${money(total)} customer-এর বাকি খাতায় যোগ হবে।`}</p>
        <button type="submit" disabled={busy || !customer || !cart.length} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? <><LoaderCircle size={17} className="animate-spin"/>বিক্রি সংরক্ষণ হচ্ছে…</> : <><CheckCircle2 size={17}/>বিক্রি নিশ্চিত করুন</>}</button>
      </form>
    </div>
  </main></>;
}
