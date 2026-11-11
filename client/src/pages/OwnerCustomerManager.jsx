import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Trash2, AlertTriangle, UserRound, Phone, MapPin, ShoppingBag, Wallet, CreditCard, X } from 'lucide-react';
import api from '../services/api.js';
import SiteHeader from '../components/SiteHeader.jsx';

const money = value => `৳${Number(value || 0).toLocaleString('bn-BD', { maximumFractionDigits: 2 })}`;
const date = value => value ? new Date(value).toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const pendingStatuses = new Set(['NEW', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP']);

export default function OwnerCustomerManager() {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [removing, setRemoving] = useState(false);

  const loadCustomers = async (search = query) => {
    setLoadingList(true);
    try {
      const { data } = await api.get('/owner/customers', { params: { q: search } });
      setCustomers(data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'ক্রেতার তালিকা লোড হয়নি।');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { loadCustomers(query); }, [query]);

  const openCustomer = async (id, confirm = false) => {
    setError('');
    setMessage('');
    setLoadingDetail(true);
    try {
      const { data } = await api.get(`/owner/customers/${id}`);
      setDetail(data.data);
      setConfirmingRemoval(confirm);
    } catch (e) {
      setError(e.response?.data?.message || 'ক্রেতার তথ্য লোড হয়নি।');
    } finally {
      setLoadingDetail(false);
    }
  };

  const totals = useMemo(() => {
    if (!detail) return { sales: 0, saleAmount: 0, payments: 0, paymentAmount: 0, orders: 0, pendingOrders: 0 };
    return {
      sales: detail.summary?.salesCount ?? detail.sales.length,
      saleAmount: detail.summary?.salesTotal ?? detail.sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
      payments: detail.summary?.paymentsCount ?? detail.payments.length,
      paymentAmount: detail.summary?.paymentsTotal ?? detail.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      orders: detail.summary?.ordersCount ?? detail.orders.length,
      pendingOrders: detail.summary?.pendingOrdersCount ?? detail.orders.filter(order => pendingStatuses.has(order.status)).length
    };
  }, [detail]);

  const removeCustomer = async () => {
    if (!detail || removing || Number(detail.customer.dueBalance || 0) > 0 || totals.pendingOrders > 0) return;
    setRemoving(true);
    setError('');
    try {
      await api.delete(`/owner/customers/${detail.customer._id}`);
      setCustomers(current => current.filter(customer => customer._id !== detail.customer._id));
      setMessage(`${detail.customer.name}-এর account সরানো হয়েছে। আগের হিসাব সংরক্ষিত আছে।`);
      setDetail(null);
      setConfirmingRemoval(false);
    } catch (e) {
      setError(e.response?.data?.message || 'Account সরানো যায়নি।');
    } finally {
      setRemoving(false);
    }
  };

  const blocked = Boolean(detail && (Number(detail.customer.dueBalance || 0) > 0 || totals.pendingOrders > 0));

  return <><SiteHeader/><main className="mx-auto min-h-screen max-w-7xl bg-stone-50 px-4 py-6 sm:px-6 sm:py-8">
    <Link to="/owner" className="text-sm text-brand-700">← ড্যাশবোর্ড</Link>
    <h1 className="mt-3 text-3xl font-bold">ক্রেতা ব্যবস্থাপনা</h1>
    <p className="mt-1 text-stone-500">নিবন্ধিত customer-এর তথ্য ও account পরিচালনা করুন।</p>
    {message && <p role="status" className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-800">{message}</p>}
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

    <label className="mt-5 flex h-12 max-w-xl items-center gap-3 rounded-xl border bg-white px-4 text-stone-400 shadow-sm focus-within:border-brand-500"><Search size={18}/><input className="min-w-0 flex-1 border-0 bg-transparent text-sm text-stone-800 outline-none" placeholder="নাম বা phone number দিয়ে খুঁজুন" value={query} onChange={e => setQuery(e.target.value)}/></label>
    <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(300px,.8fr)_minmax(0,1.2fr)]">
      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-stone-600">ক্রেতার তালিকা · {customers.length} জন</h2>
        {loadingList && <p className="rounded-xl border bg-white p-5 text-sm text-stone-500">তালিকা লোড হচ্ছে…</p>}
        {!loadingList && customers.map(customer => <article key={customer._id} className={`flex items-center gap-2 rounded-xl border bg-white p-3 ${detail?.customer._id === customer._id ? 'border-brand-400 ring-1 ring-brand-100' : ''}`}>
          <button type="button" onClick={() => openCustomer(customer._id)} className="min-w-0 flex-1 p-1 text-left"><b className="block truncate">{customer.name}</b><small className="mt-1 block truncate text-stone-500">{customer.phone} · বাকি {money(customer.dueBalance)}</small></button>
          <button type="button" onClick={() => openCustomer(customer._id, true)} aria-label={`${customer.name} account সরান`} className="grid h-10 w-10 flex-none place-items-center rounded-lg text-red-600 hover:bg-red-50"><Trash2 size={17}/></button>
        </article>)}
        {!loadingList && !customers.length && <div className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-stone-500">কোনো active customer পাওয়া যায়নি।</div>}
      </section>

      <section className="min-w-0">
        {loadingDetail && <div className="rounded-xl border bg-white p-8 text-center text-stone-500">তথ্য লোড হচ্ছে…</div>}
        {!loadingDetail && detail && <div className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-xs font-semibold uppercase tracking-wide text-brand-700">Customer profile</span><h2 className="mt-1 text-2xl font-bold">{detail.customer.name}</h2></div><button type="button" onClick={() => { setDetail(null); setConfirmingRemoval(false); }} className="grid h-9 w-9 place-items-center rounded-lg border text-stone-500" aria-label="Details বন্ধ করুন"><X size={17}/></button></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <p className="flex min-w-0 items-center gap-2 rounded-lg bg-stone-50 p-3 text-sm"><Phone size={16} className="flex-none text-stone-400"/><span className="truncate">{detail.customer.phone}</span></p>
            <p className="flex min-w-0 items-center gap-2 rounded-lg bg-stone-50 p-3 text-sm"><UserRound size={16} className="flex-none text-stone-400"/><span className="truncate">{detail.customer.email || 'Email দেওয়া হয়নি'}</span></p>
            <p className="flex min-w-0 items-center gap-2 rounded-lg bg-stone-50 p-3 text-sm sm:col-span-2"><MapPin size={16} className="flex-none text-stone-400"/><span className="break-words">{detail.customer.address || 'ঠিকানা দেওয়া হয়নি'}</span></p>
          </div>
          <p className="mt-2 text-xs text-stone-500">নিবন্ধনের তারিখ: {date(detail.customer.createdAt)}</p>

          <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
            <div className="rounded-lg bg-amber-50 p-3"><Wallet size={16} className="text-amber-700"/><small className="mt-2 block text-stone-500">বর্তমান বাকি</small><b>{money(detail.customer.dueBalance)}</b></div>
            <div className="rounded-lg bg-brand-50 p-3"><ShoppingBag size={16} className="text-brand-700"/><small className="mt-2 block text-stone-500">ক্রয় · মোট</small><b>{totals.sales}টি · {money(totals.saleAmount)}</b></div>
            <div className="rounded-lg bg-sky-50 p-3"><CreditCard size={16} className="text-sky-700"/><small className="mt-2 block text-stone-500">পেমেন্ট · মোট</small><b>{totals.payments}টি · {money(totals.paymentAmount)}</b></div>
            <div className="rounded-lg bg-stone-100 p-3"><ShoppingBag size={16} className="text-stone-600"/><small className="mt-2 block text-stone-500">Online order</small><b>{totals.orders}টি</b></div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div><h3 className="font-semibold">সাম্প্রতিক ক্রয়</h3><div className="mt-2 max-h-40 space-y-2 overflow-y-auto">{detail.sales.slice(0, 6).map(sale => <div key={sale._id} className="flex justify-between gap-2 border-b pb-2 text-sm"><span>{sale.saleNumber} · {date(sale.createdAt)}</span><b>{money(sale.total)}</b></div>)}{!detail.sales.length && <p className="text-sm text-stone-500">কোনো purchase history নেই।</p>}</div></div>
            <div><h3 className="font-semibold">বাকি ও payment history</h3><div className="mt-2 max-h-40 space-y-2 overflow-y-auto">{detail.ledger.slice(0, 6).map(row => <div key={row._id} className="flex justify-between gap-2 border-b pb-2 text-sm"><span className="min-w-0 truncate">{row.type} · {row.note}</span><b className="flex-none">{money(row.amount)}</b></div>)}{!detail.ledger.length && <p className="text-sm text-stone-500">কোনো ledger history নেই।</p>}</div></div>
          </div>
          {totals.pendingOrders > 0 && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">এই customer-এর {totals.pendingOrders}টি pending online order আছে। Account সরানোর আগে সেগুলো complete বা cancel করুন।</p>}
          {Number(detail.customer.dueBalance || 0) > 0 && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">বর্তমান বাকি {money(detail.customer.dueBalance)}। Account সরানোর আগে বাকি মিটিয়ে নিন।</p>}
          <button type="button" onClick={() => setConfirmingRemoval(true)} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"><Trash2 size={16}/>Customer account সরান</button>
        </div>}
        {!loadingDetail && !detail && <div className="grid min-h-64 place-items-center rounded-xl border border-dashed bg-white p-8 text-center text-stone-500">বিস্তারিত দেখতে তালিকা থেকে একজন customer নির্বাচন করুন।</div>}
      </section>
    </div>

    {confirmingRemoval && detail && <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-stone-950/55 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !removing) setConfirmingRemoval(false); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="remove-customer-title" className="my-auto w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-red-700"><AlertTriangle size={21}/></span>
        <h2 id="remove-customer-title" className="mt-4 text-xl font-bold">Customer account সরাবেন?</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">এই account deactive হবে, তাই customer আর login করতে পারবে না। নাম, phone, email ও address মুছে account customer list থেকে সরানো হবে। পরে একই phone number দিয়ে নতুন করে registration করা যাবে। পুরোনো sale ও ledger history হিসাবের জন্য থাকবে।</p>
        <div className="mt-4 grid gap-2 rounded-xl border bg-stone-50 p-4 text-sm sm:grid-cols-2">
          <p><span className="text-stone-500">নাম:</span> <b>{detail.customer.name}</b></p>
          <p><span className="text-stone-500">Phone:</span> <b>{detail.customer.phone}</b></p>
          <p className="break-words"><span className="text-stone-500">Email:</span> <b>{detail.customer.email || 'নেই'}</b></p>
          <p className="break-words sm:col-span-2"><span className="text-stone-500">ঠিকানা:</span> <b>{detail.customer.address || 'নেই'}</b></p>
          <p><span className="text-stone-500">বর্তমান বাকি:</span> <b>{money(detail.customer.dueBalance)}</b></p>
          <p><span className="text-stone-500">Purchase history:</span> <b>{totals.sales}টি · {money(totals.saleAmount)}</b></p>
          <p><span className="text-stone-500">Payment history:</span> <b>{totals.payments}টি · {money(totals.paymentAmount)}</b></p>
          <p><span className="text-stone-500">Online order:</span> <b>{totals.orders}টি · pending {totals.pendingOrders}টি</b></p>
        </div>
        {blocked && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">এখন account সরানো যাবে না। আগে বাকি মেটান এবং pending order complete/cancel করুন।</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" disabled={removing} onClick={() => setConfirmingRemoval(false)} className="rounded-lg border px-4 py-2.5 text-sm">না, ফিরে যান</button><button type="button" disabled={removing || blocked} onClick={removeCustomer} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Trash2 size={15}/>{removing ? 'Account সরানো হচ্ছে…' : 'হ্যাঁ, account সরান'}</button></div>
      </section>
    </div>}
  </main></>;
}
