import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Pencil, X, Save, PackagePlus, Trash2, AlertTriangle } from 'lucide-react';
import api from '../services/api.js';
import SiteHeader from '../components/SiteHeader.jsx';

const money = value => `৳${Number(value || 0).toLocaleString('bn-BD', { maximumFractionDigits: 2 })}`;

export default function ProductManager() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState('');
  const [edit, setEdit] = useState({});
  const [stockChanges, setStockChanges] = useState({});
  const [stockNotes, setStockNotes] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(false);
  const [image, setImage] = useState({ imageUrl: '', imagePublicId: '' });
  const [newProduct, setNewProduct] = useState({ name: '', nameBn: '', category: '', price: '', unit: 'kg', onHand: '' });

  const load = async () => {
    try {
      const [inventory, categoryResponse] = await Promise.all([api.get('/inventory'), api.get('/categories')]);
      setProducts(inventory.data.data);
      setCategories(categoryResponse.data.data);
      setNewProduct(current => ({ ...current, category: current.category || categoryResponse.data.data[0]?._id || '' }));
    } catch (e) {
      setError(e.response?.data?.message || 'পণ্যের তালিকা লোড করা যায়নি।');
    }
  };

  useEffect(() => { load(); }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return products;
    return products.filter(product => [product.name, product.nameBn, product.category?.name, product.category?.nameBn]
      .some(value => value?.toLocaleLowerCase().includes(query)));
  }, [products, search]);

  const startEdit = product => {
    setEditingId(product._id);
    setEdit({ name: product.name, nameBn: product.nameBn || '', category: product.category?._id || product.category, price: product.price, unit: product.unit });
    setError('');
    setMessage('');
  };

  const saveEdit = async event => {
    event.preventDefault();
    const product = products.find(item => item._id === editingId);
    if (!product) return;
    setBusyId(editingId);
    setError('');
    setMessage('');
    try {
      await api.put(`/products/${product._id}`, {
        ...edit,
        price: Number(edit.price),
        onHand: product.onHand,
        description: product.description || '',
        imageUrl: product.imageUrl || '',
        imagePublicId: product.imagePublicId || ''
      });
      setMessage('পণ্যের তথ্য ও দাম আপডেট হয়েছে।');
      setEditingId('');
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'পণ্যের তথ্য আপডেট করা যায়নি।');
    } finally {
      setBusyId('');
    }
  };

  const adjustStock = async product => {
    const delta = Number(stockChanges[product._id]);
    if (!Number.isFinite(delta) || delta === 0) return;
    setBusyId(product._id);
    setError('');
    setMessage('');
    try {
      await api.post('/inventory/adjustments', {
        productId: product._id,
        delta,
        note: stockNotes[product._id]?.trim() || 'দোকানের মজুদ হালনাগাদ'
      });
      setMessage(`${product.nameBn || product.name} পণ্যের মজুদ আপডেট হয়েছে।`);
      setStockChanges(current => ({ ...current, [product._id]: '' }));
      setStockNotes(current => ({ ...current, [product._id]: '' }));
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'মজুদ আপডেট করা যায়নি।');
    } finally {
      setBusyId('');
    }
  };

  const createProduct = async event => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.post('/products', { ...newProduct, ...image, price: Number(newProduct.price), onHand: Number(newProduct.onHand), description: '' });
      setMessage('নতুন পণ্য যোগ হয়েছে।');
      setNewProduct(current => ({ ...current, name: '', nameBn: '', price: '', onHand: '' }));
      setImage({ imageUrl: '', imagePublicId: '' });
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'পণ্য যোগ করা যায়নি।');
    }
  };

  const createCategory = async event => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/categories', { name: newCategory });
      setCategories(current => [...current, data.data]);
      setNewProduct(current => ({ ...current, category: data.data._id }));
      setNewCategory('');
      setMessage('ক্যাটাগরি যোগ হয়েছে।');
    } catch (e) {
      setError(e.response?.data?.message || 'ক্যাটাগরি যোগ করা যায়নি।');
    }
  };

  const removeCategory = async () => {
    if (!categoryToDelete || deletingCategory) return;
    setDeletingCategory(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.delete(`/categories/${categoryToDelete._id}`);
      setMessage(`“${categoryToDelete.nameBn || categoryToDelete.name}” category ও এর ${data.data.deactivatedProductCount}টি product active list থেকে সরানো হয়েছে।`);
      setCategoryToDelete(null);
      if (editingId && products.find(product => product._id === editingId)?.category?._id === categoryToDelete._id) setEditingId('');
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'ক্যাটাগরি মুছে ফেলা যায়নি।');
    } finally {
      setDeletingCategory(false);
    }
  };

  const uploadImage = async file => {
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    try {
      const { data } = await api.post('/products/image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImage(data.data);
      setMessage('পণ্যের ছবি আপলোড হয়েছে।');
    } catch (e) {
      setError(e.response?.data?.message || 'ছবি আপলোড করা যায়নি।');
    }
  };

  const deactivate = async product => {
    if (!window.confirm(`“${product.nameBn || product.name}” তালিকা থেকে সরাবেন?`)) return;
    setError('');
    setMessage('');
    try {
      await api.delete(`/products/${product._id}`);
      setMessage('পণ্যটি তালিকা থেকে সরানো হয়েছে।');
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'পণ্যটি সরানো যায়নি।');
    }
  };

  return <><SiteHeader/><main className="mx-auto min-h-screen max-w-6xl bg-stone-50 px-5 py-8">
    <Link to="/owner" className="text-sm text-brand-700">← ড্যাশবোর্ড</Link>
    <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-3xl font-bold">পণ্য ও মজুদ</h1><p className="mt-1 text-stone-500">পণ্য খুঁজুন, দাম সম্পাদনা করুন এবং মজুদ বাড়ান বা কমান।</p></div>
      <span className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-800">মোট {products.length}টি পণ্য</span>
    </div>
    {(message || error) && <p role="status" className={`mt-4 rounded-lg p-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-800'}`}>{error || message}</p>}

    <section className="mt-5 rounded-xl border bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold">ক্যাটাগরি ব্যবস্থাপনা</h2><p className="mt-1 text-sm text-stone-500">ক্যাটাগরি সরালে এর সব active product-ও দোকান থেকে সরবে।</p></div><span className="text-sm text-stone-500">{categories.length}টি category</span></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map(category => {
          const count = products.filter(product => (product.category?._id || product.category) === category._id).length;
          return <div key={category._id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-stone-50 p-3">
            <div className="min-w-0"><b className="block truncate">{category.nameBn || category.name}</b><small className="block truncate text-stone-500">{category.name} · {count}টি active product</small></div>
            <button type="button" onClick={() => setCategoryToDelete({ ...category, activeProductCount: count })} className="inline-flex flex-none items-center gap-1 rounded-lg border border-red-100 bg-white px-2.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"><Trash2 size={14}/>সরান</button>
          </div>;
        })}
        {!categories.length && <p className="text-sm text-stone-500">কোনো active category নেই।</p>}
      </div>
      <form onSubmit={createCategory} className="mt-4 flex flex-wrap gap-2 border-t pt-4">
        <input className="field max-w-sm flex-1" required placeholder="নতুন ক্যাটাগরির নাম" value={newCategory} onChange={e => setNewCategory(e.target.value)}/>
        <button className="rounded-lg border px-4 py-2">ক্যাটাগরি যোগ</button>
      </form>
    </section>

    <form onSubmit={createProduct} className="mt-5 grid gap-3 rounded-xl border bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
      <h2 className="flex items-center gap-2 font-bold sm:col-span-2 lg:col-span-3"><PackagePlus size={18}/> নতুন পণ্য যোগ করুন</h2>
      <input className="field" required placeholder="পণ্যের নাম" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}/>
      <input className="field" placeholder="বাংলা নাম (ঐচ্ছিক)" value={newProduct.nameBn} onChange={e => setNewProduct({ ...newProduct, nameBn: e.target.value })}/>
      <select className="field" required value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}>{categories.map(category => <option key={category._id} value={category._id}>{category.nameBn || category.name}</option>)}</select>
      <input className="field" type="number" min="0" step=".01" required placeholder="দাম" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}/>
      <input className="field" required placeholder="একক (যেমন kg, piece)" value={newProduct.unit} onChange={e => setNewProduct({ ...newProduct, unit: e.target.value })}/>
      <input className="field" type="number" min="0" step=".001" required placeholder="প্রাথমিক মজুদ" value={newProduct.onHand} onChange={e => setNewProduct({ ...newProduct, onHand: e.target.value })}/>
      <input className="field" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => uploadImage(e.target.files?.[0])}/>
      {image.imageUrl && <img className="h-14 w-14 rounded object-cover" src={image.imageUrl} alt="পণ্যের preview"/>}
      <button className="rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white sm:col-span-2 lg:col-span-3">পণ্য যোগ করুন</button>
    </form>

    <label className="mt-6 flex h-12 max-w-2xl items-center gap-3 rounded-xl border bg-white px-4 text-stone-400 shadow-sm focus-within:border-brand-500">
      <Search size={19}/><input className="min-w-0 flex-1 border-0 bg-transparent text-sm text-stone-800 outline-none" type="search" placeholder="নাম বা ক্যাটাগরি দিয়ে পণ্য খুঁজুন" value={search} onChange={e => setSearch(e.target.value)}/>
      {search && <button type="button" onClick={() => setSearch('')} aria-label="Search clear" className="rounded-md px-2 py-1 text-sm text-stone-500">মুছুন</button>}
    </label>
    <p className="mt-3 text-sm text-stone-500">{search ? `খুঁজে পাওয়া গেছে ${filteredProducts.length}টি পণ্য` : 'পণ্যের তালিকা'} · {filteredProducts.length}টি</p>

    <div className="mt-3 space-y-3">
      {filteredProducts.map(product => <article key={product._id} className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><strong className="text-lg">{product.nameBn || product.name}</strong>{product.nameBn && <small className="ml-2 text-stone-500">{product.name}</small>}
            <p className="mt-1 text-sm text-stone-600">{money(product.price)} / {product.unit} · হাতে {product.onHand} · সংরক্ষিত {product.reserved} · বিক্রিযোগ্য {product.available}</p>
            <small className="text-stone-400">{product.category?.nameBn || product.category?.name || 'ক্যাটাগরি নেই'}</small>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => editingId === product._id ? setEditingId('') : startEdit(product)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm text-brand-800"><Pencil size={15}/>{editingId === product._id ? 'বন্ধ করুন' : 'সম্পাদনা'}</button>
            <button type="button" onClick={() => deactivate(product)} className="rounded-lg px-3 py-2 text-sm text-red-700">তালিকা থেকে সরান</button>
          </div>
        </div>

        {editingId === product._id && <form onSubmit={saveEdit} className="mt-4 grid gap-3 rounded-lg bg-stone-50 p-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1 text-sm">পণ্যের নাম<input className="field" required value={edit.name || ''} onChange={e => setEdit({ ...edit, name: e.target.value })}/></label>
          <label className="grid gap-1 text-sm">বাংলা নাম<input className="field" value={edit.nameBn || ''} onChange={e => setEdit({ ...edit, nameBn: e.target.value })}/></label>
          <label className="grid gap-1 text-sm">ক্যাটাগরি<select className="field" required value={edit.category || ''} onChange={e => setEdit({ ...edit, category: e.target.value })}>{categories.map(category => <option key={category._id} value={category._id}>{category.nameBn || category.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm">দাম<input className="field" type="number" min="0" step=".01" required value={edit.price ?? ''} onChange={e => setEdit({ ...edit, price: e.target.value })}/></label>
          <label className="grid gap-1 text-sm">একক<input className="field" required value={edit.unit || ''} onChange={e => setEdit({ ...edit, unit: e.target.value })}/></label>
          <div className="flex items-end gap-2"><button disabled={busyId === product._id} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-white disabled:opacity-60"><Save size={16}/>পরিবর্তন সংরক্ষণ</button><button type="button" onClick={() => setEditingId('')} className="grid h-11 w-11 place-items-center rounded-lg border bg-white" aria-label="Close edit"><X size={17}/></button></div>
        </form>}

        <div className="mt-3 grid gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-[150px_1fr_auto]">
          <label className="grid gap-1 text-xs text-stone-500">মজুদ পরিবর্তন<input className="field" type="number" step=".001" placeholder="যেমন +5 বা -2" value={stockChanges[product._id] ?? ''} onChange={e => setStockChanges({ ...stockChanges, [product._id]: e.target.value })}/></label>
          <label className="grid gap-1 text-xs text-stone-500">কারণ (ঐচ্ছিক)<input className="field" placeholder="যেমন নতুন মাল এসেছে" value={stockNotes[product._id] || ''} onChange={e => setStockNotes({ ...stockNotes, [product._id]: e.target.value })}/></label>
          <button type="button" onClick={() => adjustStock(product)} disabled={busyId === product._id || !Number(stockChanges[product._id])} className="self-end rounded-lg border px-4 py-3 text-sm font-semibold disabled:opacity-50">মজুদ আপডেট</button>
        </div>
      </article>)}
      {!filteredProducts.length && <div className="rounded-xl border border-dashed bg-white px-4 py-12 text-center text-stone-500">{search ? 'এই নামে কোনো পণ্য পাওয়া যায়নি।' : 'এখনো কোনো পণ্য যোগ করা হয়নি।'}</div>}
    </div>
    {categoryToDelete && <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-stone-950/50 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !deletingCategory) setCategoryToDelete(null); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="delete-category-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-red-700"><AlertTriangle size={21}/></span>
        <h2 id="delete-category-title" className="mt-4 text-xl font-bold">ক্যাটাগরি ও product সরাবেন?</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600"><b>{categoryToDelete.nameBn || categoryToDelete.name}</b> category এবং এর <b>{categoryToDelete.activeProductCount}</b>টি active product customer-এর shop ও inventory list থেকে inactive হবে। পুরোনো sale ও stock history থাকবে।</p>
        <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={deletingCategory} onClick={() => setCategoryToDelete(null)} className="rounded-lg border px-4 py-2 text-sm">না, ফিরে যান</button><button type="button" disabled={deletingCategory} onClick={removeCategory} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Trash2 size={15}/>{deletingCategory ? 'সরানো হচ্ছে…' : 'হ্যাঁ, সব সরান'}</button></div>
      </section>
    </div>}
  </main></>;
}
