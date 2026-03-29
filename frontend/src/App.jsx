import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Package, FileText, Plus, Moon, Sun, 
  Search, Trash2, Download, CheckCircle, ChevronLeft,
  X, ShoppingCart, Pencil, Save, Eye, Banknote
} from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import api from './api/api';
import { useTheme } from './context/ThemeContext';
import { generatePDF, generateExcel, parseItem, generateReceiptPDF } from './utils/exports';

const App = () => {
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState('dashboard'); // dashboard, inventory, invoices
  const [clients, setClients] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  
  // Payment State
  const [payments, setPayments] = useState([]);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [paymentForm, setPaymentForm] = useState({ client_id: '', amount: '', date: new Date().toISOString().split('T')[0], notes: '' });

  // Initialize data
  useEffect(() => {
    fetchClients();
    fetchCategories();
    fetchInventory();
    fetchInvoices();
    fetchPayments();
  }, []);

  const fetchClients = () => api.get('/clients').then(res => setClients(res.data));
  const fetchCategories = () => api.get('/categories').then(res => setCategories(res.data));
  const fetchInventory = () => api.get('/inventory').then(res => setInventory(res.data));
  const fetchInvoices = () => api.get('/invoices').then(res => setInvoices(res.data));
  const fetchPayments = () => api.get('/payments').then(res => setPayments(res.data));

  // --- Dashboard Logic ---
  const handleClientClick = (client) => {
    setSelectedClient(client);
    setInvoiceItems([]);
    setView('invoice-builder');
  };

  // --- Inventory Price Editing ---
  const [editingItem, setEditingItem] = useState(null);
  const [editPrice, setEditPrice] = useState(0);

  const handleUpdatePrice = (item) => {
    api.put(`/inventory/${item.id}/price`, { price: Number(editPrice) })
      .then(() => {
        toast.success(`Price updated for ${item.name}`);
        setEditingItem(null);
        fetchInventory();
      })
      .catch(() => toast.error('Failed to update price'));
  };

  // --- Invoice Builder Logic ---
  const addToInvoice = (item) => {
    setInvoiceItems(prev => {
      const existing = prev.find(i => i.item_id === item.id);
      if (existing) {
        return prev.map(i => i.item_id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        item_id: item.id,
        item_name: item.name,
        item_code: item.code,
        quantity: 1,
        unit_price: item.price
      }];
    });
    toast.success(`${item.name} added`);
  };

  const removeFromInvoice = (itemId) => {
    setInvoiceItems(prev => prev.filter(i => i.item_id !== itemId));
  };

  const updateQuantity = (itemId, qty) => {
    if (qty === '') {
      setInvoiceItems(prev => prev.map(i => i.item_id === itemId ? { ...i, quantity: '' } : i));
      return;
    }
    const num = Number(qty);
    if (num < 1) return;
    setInvoiceItems(prev => prev.map(i => i.item_id === itemId ? { ...i, quantity: num } : i));
  };

  const invoiceTotal = useMemo(() => {
    return invoiceItems.reduce((acc, item) => acc + (item.unit_price * (Number(item.quantity) || 0)), 0);
  }, [invoiceItems]);

  const submitInvoice = async () => {
    const validItems = invoiceItems
      .map(i => ({ ...i, quantity: Number(i.quantity) || 0 }))
      .filter(i => i.quantity > 0);

    if (!selectedClient || validItems.length === 0) {
      return toast.error('Please select valid items for the invoice');
    }
    setIsLoading(true);
    try {
      const res = await api.post('/invoices', {
        client_id: selectedClient.id,
        items: validItems,
        date: new Date().toISOString().split('T')[0]
      });
      toast.success('Invoice generated successfully!');
      setInvoices([res.data, ...invoices]);
      setView('dashboard');
      
      // Attempt auto-export but don't fail the whole process if it crashes
      try {
        generatePDF(res.data);
      } catch (pdfErr) {
        console.error('Auto-PDF failed:', pdfErr);
        toast.error('Invoice saved, but PDF preview failed. You can export it manually from the Invoices tab.');
      }
    } catch (err) {
      console.error('Invoice Submission Error:', err);
      toast.error('Failed to create invoice in database.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Payment Submission Logic ---
  const submitPayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.client_id || !paymentForm.amount || !paymentForm.date) {
      return toast.error('Please fill required fields (Client, Amount, Date)');
    }
    try {
      setIsLoading(true);
      const res = await api.post('/payments', paymentForm);
      toast.success('Payment recorded successfully!');
      setPayments([res.data, ...payments]);
      setPaymentForm({ client_id: '', amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
      try {
        generateReceiptPDF(res.data);
      } catch (pdfErr) {
        toast.error('Payment saved, but PDF export failed.');
      }
    } catch (err) {
      toast.error('Failed to save payment.');
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered inventory
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           item.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'ALL' || item.category_name === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [inventory, searchQuery, activeCategory]);

  return (
    <div className="app-container">
      <Toaster position="top-right" />
      
      {/* Navigation Bar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div onClick={() => setView('dashboard')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'var(--primary)', color: 'white', padding: '0.5rem', borderRadius: '0.5rem' }}>
            <Package size={24} />
          </div>
          <h2 style={{ margin: 0 }}>Jannat <span style={{ color: 'var(--primary)' }}>Uniforms</span></h2>
        </div>

        <nav style={{ display: 'flex', gap: '1rem' }}>
          <button className={`btn ${view === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('dashboard')}>
            <Users size={18} /> Dashboard
          </button>
          <button className={`btn ${view === 'inventory' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('inventory')}>
            <Package size={18} /> Inventory
          </button>
          <button className={`btn ${view === 'invoices' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('invoices')}>
            <FileText size={18} /> Invoices
          </button>
          <button className={`btn ${view === 'payments' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('payments')}>
            <Banknote size={18} /> Payments
          </button>
          <button className="btn btn-ghost" onClick={toggleTheme} style={{ padding: '0.5rem' }}>
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </nav>
      </header>

      {/* View: Dashboard (Client Cards) */}
      {view === 'dashboard' && (
        <section>
          <h1>Client Dashboard</h1>
          <p style={{ color: 'var(--text-main)', opacity: 0.7, marginBottom: '2rem' }}>Select a client to start creating an invoice.</p>
          <div className="client-grid">
            {clients.map(client => (
              <div key={client.id} className="card" onClick={() => handleClientClick(client)} style={{ cursor: 'pointer', borderLeft: '4px solid var(--primary)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span className="badge badge-blue">{client.code}</span>
                  <h3 style={{ margin: 0 }}>{client.name}</h3>
                  <button className="btn btn-primary" style={{ marginTop: '1rem', width: 'fit-content' }}>
                    Create Invoice <ChevronLeft size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* View: Invoice Builder */}
      {view === 'invoice-builder' && (
        <section>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem' }}>
            <button className="btn btn-ghost" onClick={() => setView('dashboard')}><ChevronLeft size={18} /> Back</button>
            <h1 style={{ margin: 0 }}>Invoice for {selectedClient?.name}</h1>
          </div>

          <div className="invoice-split">
            {/* Item Selection UI */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} size={18} />
                  <input 
                    type="text" 
                    placeholder="Search by name or code..." 
                    style={{ paddingLeft: '2.5rem' }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <select style={{ width: '200px' }} value={activeCategory} onChange={(e) => setActiveCategory(e.target.value)}>
                  <option value="ALL">All Categories</option>
                  {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                </select>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Item Name</th>
                      <th>Price</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map(item => (
                      <tr key={item.id}>
                        <td><code>{item.code}</code></td>
                        <td>{item.name}</td>
                        <td>Rs. {item.price}</td>
                        <td>
                          <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => addToInvoice(item)}>
                            <Plus size={16} /> Add
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Invoice Summary UI */}
            <div className="card" style={{ border: '2px solid var(--primary)', position: 'sticky', top: '1rem' }}>
              <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <ShoppingCart size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> Invoice Items
              </h3>
              
              <div style={{ minHeight: '300px', maxHeight: '500px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                {invoiceItems.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '3rem' }}>No items added yet.</p>
                ) : (
                  invoiceItems.map(item => (
                    <div key={item.item_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.item_code}</div>
                        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input 
                            type="number" 
                            value={item.quantity} 
                            onChange={(e) => updateQuantity(item.item_id, e.target.value)}
                            style={{ width: '60px', padding: '0.25rem' }} 
                          />
                          <span style={{ fontSize: '0.875rem' }}>x Rs. {item.unit_price}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <button className="btn" style={{ color: 'var(--danger)', padding: 0 }} onClick={() => removeFromInvoice(item.item_id)}>
                          <X size={16} />
                        </button>
                        <div style={{ fontWeight: 700 }}>Rs. {(item.quantity * item.unit_price).toFixed(2)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>
                  <span>Grand Total:</span>
                  <span style={{ color: 'var(--primary)' }}>Rs. {invoiceTotal.toFixed(2)}</span>
                </div>
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}
                  onClick={submitInvoice}
                  disabled={isLoading}
                >
                  {isLoading ? 'Generating...' : 'Finalize & Generate Invoice'}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* View: Invoice Viewer */}
      {view === 'invoice-view' && viewingInvoice && (
        <section>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem' }}>
            <button className="btn btn-ghost" onClick={() => setView('invoices')}><ChevronLeft size={18} /> Back</button>
            <h1 style={{ margin: 0 }}>Invoice Details: {viewingInvoice.invoice_number}</h1>
          </div>
          
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--border-color)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ color: 'var(--primary)', margin: 0 }}>JANNAT UNIFORMS</h2>
                <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Premium Garments & School Uniforms</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 'bold' }}>INVOICE: {viewingInvoice.invoice_number}</div>
                <div>DATE: {viewingInvoice.date}</div>
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <div style={{ color: '#64748b', fontWeight: 'bold', fontSize: '0.875rem', marginBottom: '0.5rem' }}>BILL TO:</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{viewingInvoice.client_name}</div>
            </div>

            <div className="table-container" style={{ marginBottom: '2rem', border: '1px solid var(--border-color)' }}>
              <table style={{ margin: 0 }}>
                <thead>
                  <tr style={{ background: 'var(--primary)', color: 'white' }}>
                    <th style={{ color: 'white' }}>Item Name</th>
                    <th style={{ color: 'white' }}>Code</th>
                    <th style={{ color: 'white', textAlign: 'center' }}>Size</th>
                    <th style={{ color: 'white', textAlign: 'center' }}>Qty</th>
                    <th style={{ color: 'white', textAlign: 'right' }}>Price</th>
                    <th style={{ color: 'white', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingInvoice.items.map((item, idx) => {
                    const { cleanName, size } = parseItem(item.item_name);
                    return (
                      <tr key={idx}>
                        <td>{cleanName}</td>
                        <td><code>{item.item_code}</code></td>
                        <td style={{ textAlign: 'center' }}>{size}</td>
                        <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right' }}>Rs. {item.unit_price.toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>Rs. {item.total.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '2px solid var(--border-color)', fontSize: '1.25rem', fontWeight: 'bold' }}>
              <div>GRAND TOTAL: &nbsp;&nbsp;&nbsp; Rs. {viewingInvoice.grand_total.toFixed(2)}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '3rem' }}>
              <button className="btn btn-primary" onClick={() => {
                try { generatePDF(viewingInvoice); } catch(e) { toast.error('PDF Export failed'); }
              }}>
                <Download size={18} /> Download PDF
              </button>
              <button className="btn btn-ghost" onClick={() => {
                try { generateExcel(viewingInvoice); } catch(e) { toast.error('XLSX Export failed'); }
              }}>
                <Download size={18} /> Download Excel
              </button>
            </div>
          </div>
        </section>
      )}

      {/* View: Inventory Management */}
      {view === 'inventory' && (
        <section>
          <h1>Inventory Management</h1>
          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Item Name</th>
                    <th>Code</th>
                    <th>Price</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map(item => (
                    <tr key={item.id}>
                      <td><span className="badge badge-blue">{item.category_name}</span></td>
                      <td>{item.name}</td>
                      <td><code>{item.code}</code></td>
                      <td>
                        {editingItem === item.id ? (
                          <input 
                            type="number" 
                            value={editPrice} 
                            onChange={(e) => setEditPrice(e.target.value)}
                            style={{ width: '100px' }}
                          />
                        ) : (
                          `Rs. ${item.price}`
                        )}
                      </td>
                      <td>
                        {editingItem === item.id ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleUpdatePrice(item)}>
                              <Save size={16} />
                            </button>
                            <button className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setEditingItem(null)}>
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <button className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem' }} onClick={() => {
                            setEditingItem(item.id);
                            setEditPrice(item.price);
                          }}>
                            <Pencil size={16} /> Edit Price
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* View: Invoices */}
      {view === 'invoices' && (
        <section>
          <h1>Invoice History</h1>
          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Client</th>
                    <th>Date</th>
                    <th>Total Ammount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id}>
                      <td><strong>{inv.invoice_number}</strong></td>
                      <td>{inv.client_name}</td>
                      <td>{inv.date}</td>
                      <td>Rs. {inv.grand_total.toFixed(2)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', color: 'var(--primary)' }} onClick={() => {
                            setViewingInvoice(inv);
                            setView('invoice-view');
                          }}>
                            <Eye size={16} /> View
                          </button>
                          <button className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem' }} onClick={() => {
                            try { generatePDF(inv); } catch(e) { toast.error('PDF Export failed'); }
                          }}>
                            <Download size={16} /> PDF
                          </button>
                          <button className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem' }} onClick={() => {
                            try { generateExcel(inv); } catch(e) { toast.error('XLSX Export failed'); }
                          }}>
                            <Download size={16} /> XLSX
                          </button>
                          <button className="btn btn-ghost" style={{ color: 'var(--danger)', padding: '0.25rem 0.5rem' }} onClick={() => {
                            if(window.confirm('Delete this invoice?')) {
                              api.delete(`/invoices/${inv.id}`).then(() => {
                                toast.success('Invoice deleted');
                                fetchInvoices();
                              });
                            }
                          }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* View: Payments */}
      {view === 'payments' && (
        <section>
          <h1>Client Payments & Receipts</h1>
          
          <div className="invoice-split" style={{ alignItems: 'flex-start' }}>
            {/* Record Payment Form */}
            <div className="card" style={{ flex: '1', position: 'sticky', top: '1rem' }}>
              <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>Record New Payment</h3>
              <form onSubmit={submitPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Select Client *</label>
                  <select 
                    style={{ width: '100%', padding: '0.75rem' }} 
                    value={paymentForm.client_id} 
                    onChange={e => setPaymentForm({...paymentForm, client_id: e.target.value})}
                    required
                  >
                    <option value="">-- Choose Client --</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Amount Received (Rs.) *</label>
                  <input 
                    type="number" 
                    style={{ width: '100%', padding: '0.75rem' }} 
                    min="1"
                    value={paymentForm.amount} 
                    onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Payment Date *</label>
                  <input 
                    type="date" 
                    style={{ width: '100%', padding: '0.75rem' }} 
                    value={paymentForm.date} 
                    onChange={e => setPaymentForm({...paymentForm, date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Notes / Remarks (Optional)</label>
                  <textarea 
                    style={{ width: '100%', padding: '0.75rem', height: '80px', fontFamily: 'inherit' }} 
                    value={paymentForm.notes} 
                    onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '1rem' }} disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save Payment & Generate Receipt'}
                </button>
              </form>
            </div>

            {/* Payment History */}
            <div className="card" style={{ flex: '2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>Payment History</h3>
                <select 
                  style={{ width: '250px' }} 
                  value={paymentFilter} 
                  onChange={e => setPaymentFilter(e.target.value)}
                >
                  <option value="ALL">All Clients</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {(() => {
                const filteredPayments = paymentFilter === 'ALL' 
                  ? payments 
                  : payments.filter(p => p.client_id === Number(paymentFilter));
                const totalAmount = filteredPayments.reduce((acc, p) => acc + Number(p.amount), 0);

                return (
                  <>
                    <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)' }}>
                      <strong style={{ fontSize: '1.1rem' }}>Total Received:</strong>
                      <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)' }}>Rs. {totalAmount.toFixed(2)}</span>
                    </div>

                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Receipt No.</th>
                            <th>Date</th>
                            <th>Client</th>
                            <th>Amount</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPayments.map(p => (
                            <tr key={p.id}>
                              <td><strong>{p.receipt_number}</strong></td>
                              <td>{p.date}</td>
                              <td>{p.client_name}</td>
                              <td style={{ fontWeight: 'bold' }}>Rs. {p.amount.toFixed(2)}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', color: 'var(--primary)' }} onClick={() => {
                                    setViewingReceipt(p);
                                    setView('receipt-view');
                                  }}>
                                    <Eye size={16} /> View
                                  </button>
                                  <button className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem' }} onClick={() => {
                                    try { generateReceiptPDF(p); } catch(e) { toast.error('PDF Export failed'); }
                                  }}>
                                    <Download size={16} /> Print
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {filteredPayments.length === 0 && (
                            <tr><td colSpan="5" style={{ textAlign: 'center', color: '#64748b' }}>No payments found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </section>
      )}

      {/* View: Receipt Viewer */}
      {view === 'receipt-view' && viewingReceipt && (
        <section>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem' }}>
            <button className="btn btn-ghost" onClick={() => setView('payments')}><ChevronLeft size={18} /> Back to Payments</button>
            <h1 style={{ margin: 0 }}>Receipt Details: {viewingReceipt.receipt_number}</h1>
          </div>
          
          <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--border-color)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ color: 'var(--primary)', margin: 0 }}>JANNAT UNIFORMS</h2>
                <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Premium Garments & School Uniforms</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 'bold' }}>RECEIPT: {viewingReceipt.receipt_number}</div>
                <div>DATE: {viewingReceipt.date}</div>
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <div style={{ color: '#64748b', fontWeight: 'bold', fontSize: '0.875rem', marginBottom: '0.5rem' }}>RECEIVED FROM:</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{viewingReceipt.client_name}</div>
              <div style={{ color: '#64748b', marginTop: '0.25rem' }}>Client Code: {viewingReceipt.client_code}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5rem', background: 'var(--bg-main)', borderRadius: '0.5rem', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>Amount Received:</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>Rs. {viewingReceipt.amount.toFixed(2)}</span>
            </div>
            
            <div style={{ marginBottom: '3rem' }}>
              <div style={{ color: '#64748b', fontWeight: 'bold', fontSize: '0.875rem', marginBottom: '0.5rem' }}>NOTES / REMARKS:</div>
              <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '0.5rem', minHeight: '60px' }}>
                {viewingReceipt.notes || '-'}
              </div>
            </div>

            <div style={{ textAlign: 'center', color: '#64748b', marginBottom: '2rem' }}>
              Thank you for your business.
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', borderTop: '2px solid var(--border-color)', paddingTop: '2rem' }}>
              <button className="btn btn-primary" onClick={() => {
                try { generateReceiptPDF(viewingReceipt); } catch(e) { toast.error('PDF Export failed'); }
              }}>
                <Download size={18} /> Download Exact PDF
              </button>
            </div>
          </div>
        </section>
      )}

    </div>
  );
};

export default App;
