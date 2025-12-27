'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import categoriesData from '@/lib/reimbursement-categories.json';

interface Category {
  value: string;
  title: string;
  expenseTypes: Array<{
    value: string;
    title: string;
  }>;
}

interface InvoiceData {
  file: File;
  id: string;
  filePath?: string;
  fileName?: string;
  extracted?: {
    date: string;
    amount: number;
    merchant: string;
    invoiceNumber?: string;
    description: string;
    categoryMapping?: {
      categoryValue: string;
      categoryTitle: string;
      expenseTypeValue: string;
      expenseTypeTitle: string;
    };
  };
  status: 'pending' | 'processing' | 'ready' | 'submitted' | 'error';
  error?: string;
}

const categories = categoriesData as Category[];

export default function BatchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [processingAll, setProcessingAll] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  
  // Form fields for selected invoice
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [categoryValue, setCategoryValue] = useState('a66f40962b1f55');
  const [expenseTypeValue, setExpenseTypeValue] = useState('a64aea39add3ea');
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string>('');
  const [submitProgress, setSubmitProgress] = useState(0);
  const [submitProgressMessage, setSubmitProgressMessage] = useState('');

  useEffect(() => {
    // Load invoices from API using invoice IDs from URL params
    const invoicesParam = searchParams.get('invoices');
    if (invoicesParam) {
      const loadInvoices = async () => {
        try {
          const invoiceIds = JSON.parse(decodeURIComponent(invoicesParam));
          
          // Fetch invoice metadata from API
          const loadedInvoices: InvoiceData[] = await Promise.all(
            invoiceIds.map(async (id: string) => {
              try {
                const response = await fetch(`/api/batch-upload?invoiceId=${id}`);
                const data = await response.json();
                
                if (data.success && data.invoice) {
                  // Create a File object from the stored file path
                  // We'll need to fetch the file when processing
                  return {
                    id: data.invoice.id,
                    file: new File([], data.invoice.fileName, { type: data.invoice.fileType }),
                    status: data.invoice.status,
                    filePath: data.invoice.filePath,
                    fileName: data.invoice.fileName,
                  } as any;
                }
                return null;
              } catch (e) {
                console.error(`Failed to load invoice ${id}:`, e);
                return null;
              }
            })
          );
          
          setInvoices(loadedInvoices.filter(Boolean));
        } catch (e) {
          console.error('Failed to load invoices:', e);
        }
      };
      
      loadInvoices();
    }
  }, [searchParams]);

  const processInvoice = async (invoice: InvoiceData) => {
    const updatedInvoices = invoices.map(inv => 
      inv.id === invoice.id ? { ...inv, status: 'processing' as const } : inv
    );
    setInvoices(updatedInvoices);

    try {
      // Get the file from the server
      const fileResponse = await fetch(`/api/batch-upload?invoiceId=${invoice.id}`);
      const fileData = await fileResponse.json();
      
      if (!fileData.success) {
        throw new Error('Failed to retrieve invoice file');
      }

      // Create FormData with the file
      const formData = new FormData();
      // We need to fetch the actual file content
      const filePath = (invoice as any).filePath || fileData.invoice.filePath;
      const fileName = (invoice as any).fileName || fileData.invoice.fileName;
      
      // Fetch file from server and create File object
      const fileBlob = await fetch(`/api/batch-file?invoiceId=${invoice.id}`).then(r => r.blob());
      const file = new File([fileBlob], fileName, { type: fileData.invoice.fileType });
      
      formData.append('file', file);

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.data) {
        const updated = invoices.map(inv =>
          inv.id === invoice.id
            ? { ...inv, extracted: data.data, status: 'ready' as const, file: file }
            : inv
        );
        setInvoices(updated);
      } else {
        const updated = invoices.map(inv =>
          inv.id === invoice.id
            ? { ...inv, status: 'error' as const, error: data.error || 'Failed to process' }
            : inv
        );
        setInvoices(updated);
      }
    } catch (error) {
      const updated = invoices.map(inv =>
        inv.id === invoice.id
          ? { ...inv, status: 'error' as const, error: error instanceof Error ? error.message : 'Unknown error' }
          : inv
      );
      setInvoices(updated);
    }
  };

  const processAllInvoices = async () => {
    setProcessingAll(true);
    for (const invoice of invoices) {
      if (invoice.status === 'pending') {
        await processInvoice(invoice);
        // Small delay between processing
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    setProcessingAll(false);
  };

  const handleCreateExpense = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice || !invoice.extracted) return;

    setSelectedInvoice(invoiceId);
    setDate(invoice.extracted.date || '');
    setAmount(invoice.extracted.amount?.toString() || '');
    setMerchant(invoice.extracted.merchant || '');
    setInvoiceNumber(invoice.extracted.invoiceNumber || '');
    setDescription(invoice.extracted.description || '');
    
    if (invoice.extracted.categoryMapping) {
      setCategoryValue(invoice.extracted.categoryMapping.categoryValue);
      setExpenseTypeValue(invoice.extracted.categoryMapping.expenseTypeValue);
    }
  };

  const handleSubmit = async () => {
    if (!sessionId || !selectedInvoice) {
      alert('Session ID or invoice not found');
      return;
    }

    const invoice = invoices.find(inv => inv.id === selectedInvoice);
    if (!invoice || !invoice.file) {
      alert('Invoice file not found');
      return;
    }

    setSubmitting(true);
    setSubmitStatus('Submitting...');
    setSubmitProgress(0);
    setSubmitProgressMessage('Starting...');

    // Generate taskId on frontend
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      const formData = new FormData();
      formData.append('sessionId', sessionId);
      formData.append('taskId', taskId);
      formData.append('file', invoice.file);
      formData.append('date', date);
      formData.append('amount', amount);
      formData.append('merchant', merchant);
      formData.append('invoiceNumber', invoiceNumber);
      formData.append('description', description);
      formData.append('categoryValue', categoryValue);
      formData.append('expenseTypeValue', expenseTypeValue);

      // Start polling for progress immediately
      const taskProgressInterval = setInterval(async () => {
        try {
          const progressResponse = await fetch(`/api/submit-progress?taskId=${taskId}`);
          if (progressResponse.ok) {
            const progressData = await progressResponse.json();
            if (progressData.progress !== undefined) {
              setSubmitProgress(progressData.progress);
              setSubmitProgressMessage(progressData.message || '');
              if (progressData.progress >= 100) {
                clearInterval(taskProgressInterval);
                setSubmitting(false);
              }
            }
          }
        } catch (e) {
          // Ignore progress fetch errors
        }
      }, 300); // Poll every 300ms

      // Start the submit request (non-blocking)
      const submitPromise = fetch('/api/submit', {
        method: 'POST',
        body: formData,
      });

      const response = await submitPromise;
      const data = await response.json();

      // Wait a bit for final progress update
      await new Promise(resolve => setTimeout(resolve, 500));
      clearInterval(taskProgressInterval);

      if (data.success) {
        setSubmitProgress(100);
        setSubmitProgressMessage('Completed!');
        setSubmitStatus(`✅ Success! ${data.message}`);
        // Mark invoice as submitted
        const updated = invoices.map(inv =>
          inv.id === selectedInvoice
            ? { ...inv, status: 'submitted' as const }
            : inv
        );
        setInvoices(updated);
        setSelectedInvoice(null);
        setSubmitting(false);
      } else {
        setSubmitStatus(`❌ Error: ${data.error || data.message}`);
        setSubmitting(false);
      }
    } catch (error) {
      setSubmitStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSubmitting(false);
    }
  };

  const getExpenseTypesForCategory = (categoryVal: string) => {
    const category = categories.find(cat => cat.value === categoryVal);
    return category?.expenseTypes || [];
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-4">Batch Processing</h1>
          <p className="text-red-600">Session ID is required. Please login first.</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Batch Invoice Processing</h1>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Back to Upload
            </button>
          </div>
          
          {invoices.length === 0 ? (
            <p className="text-gray-600">No invoices to process. Please upload invoices first.</p>
          ) : (
            <>
              <div className="mb-4">
                <button
                  onClick={processAllInvoices}
                  disabled={processingAll}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {processingAll ? 'Processing...' : 'Process All Invoices'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className={`border rounded-lg p-4 ${
                      invoice.status === 'ready' ? 'border-green-500' :
                      invoice.status === 'error' ? 'border-red-500' :
                      invoice.status === 'submitted' ? 'border-blue-500' :
                      'border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{invoice.file.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded ${
                        invoice.status === 'ready' ? 'bg-green-100 text-green-800' :
                        invoice.status === 'error' ? 'bg-red-100 text-red-800' :
                        invoice.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                        invoice.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {invoice.status}
                      </span>
                    </div>
                    
                    {invoice.status === 'pending' && (
                      <button
                        onClick={() => processInvoice(invoice)}
                        className="mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Process
                      </button>
                    )}
                    
                    {invoice.status === 'ready' && (
                      <button
                        onClick={() => handleCreateExpense(invoice.id)}
                        className="mt-2 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        + Create Expense
                      </button>
                    )}
                    
                    {invoice.status === 'error' && (
                      <p className="text-sm text-red-600 mt-2">{invoice.error}</p>
                    )}
                    
                    {invoice.extracted && (
                      <div className="mt-2 text-sm text-gray-600">
                        <p>Merchant: {invoice.extracted.merchant}</p>
                        <p>Amount: {invoice.extracted.amount}</p>
                        <p>Date: {invoice.extracted.date}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Expense Form Modal */}
        {selectedInvoice && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Create Expense</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Expense Date * (YYYY-MM-DD)</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Amount *</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Merchant *</label>
                <input
                  type="text"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Invoice Number</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={categoryValue}
                  onChange={(e) => {
                    setCategoryValue(e.target.value);
                    const newCategory = categories.find(cat => cat.value === e.target.value);
                    if (newCategory && newCategory.expenseTypes.length > 0) {
                      setExpenseTypeValue(newCategory.expenseTypes[0].value);
                    }
                  }}
                  className="w-full px-4 py-2 border rounded-md"
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Expense Type</label>
                <select
                  value={expenseTypeValue}
                  onChange={(e) => setExpenseTypeValue(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md"
                >
                  {getExpenseTypesForCategory(categoryValue).map((expType) => (
                    <option key={expType.value} value={expType.value}>
                      {expType.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 relative overflow-hidden"
                >
                  <span className="relative z-10">
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span>{submitProgressMessage || 'Submitting...'}</span>
                        <span className="text-sm">({submitProgress}%)</span>
                      </span>
                    ) : (
                      'Submit to Darwinbox'
                    )}
                  </span>
                  {submitting && (
                    <div
                      className="absolute inset-0 bg-purple-700 transition-all duration-300 ease-out"
                      style={{ width: `${submitProgress}%` }}
                    />
                  )}
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>

              {submitStatus && (
                <p className="text-sm text-gray-600">{submitStatus}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

