'use client';

import { useState, useEffect, useRef } from 'react';
import categoriesData from '@/lib/reimbursement-categories.json';

interface Category {
  value: string;
  title: string;
  expenseTypes: Array<{
    value: string;
    title: string;
  }>;
}

const categories = categoriesData as Category[];

export default function Home() {
  const [email, setEmail] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loginStatus, setLoginStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  // Load sessionId from localStorage after hydration (client-side only)
  // But don't set login status - user must validate login explicitly
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSessionId = localStorage.getItem('darwinbox_sessionId');
      if (savedSessionId) {
        setSessionId(savedSessionId);
        // Don't set loginStatus - user must click "Check Login Status" to validate
        // This prevents showing "logged in" when browser is not actually open
      }
    }
  }, []);

  // Cleanup progress polling interval on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);
  
  // Form fields
  const [files, setFiles] = useState<File[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [categoryValue, setCategoryValue] = useState('a66f40962b1f55'); // Business Travel Expense
  const [expenseTypeValue, setExpenseTypeValue] = useState('a64aea39add3ea'); // Airport Transfer
  const [submitStatus, setSubmitStatus] = useState<string>('');
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [submitProgressMessage, setSubmitProgressMessage] = useState('');
  const [submittedSuccessfully, setSubmittedSuccessfully] = useState(false);
  
  // Multiple invoices state
  interface InvoiceData {
    id: string;
    file: File;
    date: string;
    amount: string;
    merchant: string;
    invoiceNumber: string;
    description: string;
    categoryValue: string;
    expenseTypeValue: string;
    extracted?: any;
    status?: 'pending' | 'processing' | 'ready' | 'error';
  }
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [processingInvoices, setProcessingInvoices] = useState(false);
  
  // Store progress polling interval to clean up on unmount
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogin = async () => {
    if (!email) {
      alert('Please enter your email');
      return;
    }

    setLoading(true);
    setLoginStatus('Initializing login...');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setSessionId(data.sessionId);
        // Save to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('darwinbox_sessionId', data.sessionId);
        }
        setLoginStatus('✅ Logged in! Session created.');
      } else {
        setSessionId(data.sessionId);
        // Save to localStorage even if not logged in yet
        if (typeof window !== 'undefined') {
          localStorage.setItem('darwinbox_sessionId', data.sessionId);
        }
        setLoginStatus('⚠️ Browser opened. Please login to Darwinbox in the browser window, then click "Check Login Status"');
      }
    } catch (error) {
      setLoginStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const checkLoginStatus = async () => {
    if (!sessionId) {
      alert('Please login first');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/login?sessionId=${sessionId}`);
      const data = await response.json();

      if (data.loggedIn && data.browserOpen) {
        setLoginStatus('✅ Logged in and ready!');
        // Ensure sessionId is saved
        if (sessionId && typeof window !== 'undefined') {
          localStorage.setItem('darwinbox_sessionId', sessionId);
        }
      } else if (data.loggedIn && !data.browserOpen) {
        setLoginStatus('⚠️ Session found but browser is not open. Please click Login to open browser.');
      } else {
        setLoginStatus('⚠️ Not logged in yet. Please login in the browser window.');
      }
    } catch (error) {
      setLoginStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMultipleFiles = async (uploadedFiles: FileList | null) => {
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    const fileArray = Array.from(uploadedFiles);
    setFiles(fileArray);
    
    // If multiple files, process all with OCR and show cards
    if (fileArray.length > 1) {
      if (!sessionId) {
        setOcrStatus('Please login first before uploading multiple files');
        return;
      }

      setUploading(true);
      setProcessingInvoices(true);
      setOcrStatus(`Processing ${fileArray.length} invoices...`);

      // Initialize invoice data array
      const invoiceDataArray: InvoiceData[] = fileArray.map((file, index) => ({
        id: `invoice_${Date.now()}_${index}`,
        file,
        date: '',
        amount: '',
        merchant: '',
        invoiceNumber: '',
        description: '',
        categoryValue: 'a66f40962b1f55',
        expenseTypeValue: 'a64aea39add3ea',
        status: 'processing',
      }));

      setInvoices(invoiceDataArray);

      // Process each file with OCR
      try {
        const processedInvoices = await Promise.all(
          fileArray.map(async (file, index) => {
            try {
              const formData = new FormData();
              formData.append('file', file);

              const response = await fetch('/api/ocr', {
                method: 'POST',
                body: formData,
              });

              const data = await response.json();

              if (data.success && data.data) {
                const extracted = data.data;
                return {
                  ...invoiceDataArray[index],
                  date: extracted.date || '',
                  amount: extracted.amount?.toString() || '',
                  merchant: extracted.merchant || '',
                  invoiceNumber: extracted.invoiceNumber || '',
                  description: extracted.description || '',
                  categoryValue: extracted.categoryMapping?.categoryValue || 'a66f40962b1f55',
                  expenseTypeValue: extracted.categoryMapping?.expenseTypeValue || 'a64aea39add3ea',
                  extracted: data.data,
                  status: 'ready' as const,
                };
              } else {
                return {
                  ...invoiceDataArray[index],
                  status: 'error' as const,
                };
              }
            } catch (error) {
              return {
                ...invoiceDataArray[index],
                status: 'error' as const,
              };
            }
          })
        );

        setInvoices(processedInvoices);
        setOcrStatus(`✅ ${processedInvoices.filter(inv => inv.status === 'ready').length} invoices processed successfully!`);
        setShowForm(true);
      } catch (error) {
        setOcrStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setUploading(false);
        setProcessingInvoices(false);
      }
      return;
    }
    
    // Single file - process normally
    handleFileUpload(fileArray[0]);
  };

  const handleFileUpload = async (uploadedFile: File) => {
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setLoading(true);
    setOcrStatus('Analyzing receipt with Claude OCR...');

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.data) {
        const extracted = data.data;
        
        // Pre-fill form fields
        setDate(extracted.date || '');
        setAmount(extracted.amount?.toString() || '');
        setMerchant(extracted.merchant || '');
        setInvoiceNumber(extracted.invoiceNumber || '');
        setDescription(extracted.description || '');
        
        // Auto-select category and expense type if mapping is available
        if (extracted.categoryMapping) {
          setCategoryValue(extracted.categoryMapping.categoryValue);
          setExpenseTypeValue(extracted.categoryMapping.expenseTypeValue);
        }
        
        setOcrStatus('✅ Receipt analyzed successfully! Form pre-filled.');
        setShowForm(true);
      } else {
        setOcrStatus(`❌ Error: ${data.error || 'Failed to analyze receipt'}`);
      }
    } catch (error) {
      setOcrStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Try to get sessionId from localStorage if not in state
    let currentSessionId = sessionId;
    if (!currentSessionId && typeof window !== 'undefined') {
      currentSessionId = localStorage.getItem('darwinbox_sessionId');
      if (currentSessionId) {
        setSessionId(currentSessionId);
      }
    }
    
    if (!currentSessionId) {
      alert('Please login first');
      return;
    }

    // Validate that browser is actually open before allowing submit
    try {
      const statusResponse = await fetch(`/api/login?sessionId=${currentSessionId}`);
      const statusData = await statusResponse.json();
      
      if (!statusData.loggedIn || !statusData.browserOpen) {
        alert('Browser is not open or you are not logged in. Please click "Login" to open the browser and login first.');
        return;
      }
    } catch (error) {
      alert('Failed to validate login status. Please try logging in again.');
      return;
    }

    // If multiple invoices, submit all
    if (invoices.length > 1) {
      const readyInvoices = invoices.filter(inv => inv.status === 'ready');
      if (readyInvoices.length === 0) {
        alert('No invoices ready to submit');
        return;
      }

      setLoading(true);
      setSubmitStatus(`Submitting ${readyInvoices.length} expenses...`);
      setSubmitProgress(0);
      setSubmitProgressMessage('Starting...');

      const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      try {
        // Prepare invoices data (without files - files sent separately)
        const invoicesData = readyInvoices.map((inv) => ({
          date: inv.date,
          amount: inv.amount,
          merchant: inv.merchant,
          invoiceNumber: inv.invoiceNumber,
          description: inv.description,
          categoryValue: inv.categoryValue,
          expenseTypeValue: inv.expenseTypeValue,
        }));

        // Create FormData with invoices JSON
        const formData = new FormData();
        formData.append('sessionId', currentSessionId);
        formData.append('taskId', taskId);
        formData.append('invoices', JSON.stringify(invoicesData));

        // Append files separately (File objects can't be serialized in JSON)
        readyInvoices.forEach((inv, index) => {
          formData.append(`file_${index}`, inv.file);
        });

        // Clear any existing interval
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }

        // Start polling for progress
        progressIntervalRef.current = setInterval(async () => {
          try {
            const progressResponse = await fetch(`/api/submit-progress?taskId=${taskId}`);
            if (progressResponse.ok) {
              const progressData = await progressResponse.json();
              if (progressData.progress !== undefined) {
                setSubmitProgress(progressData.progress);
                setSubmitProgressMessage(progressData.message || '');
                if (progressData.progress >= 100) {
                  if (progressIntervalRef.current) {
                    clearInterval(progressIntervalRef.current);
                    progressIntervalRef.current = null;
                  }
                  setLoading(false);
                }
              }
            }
          } catch (e) {
            // Ignore progress fetch errors
          }
        }, 300);

        const response = await fetch('/api/bulk-submit', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server error: ${response.status} ${response.statusText}. ${errorText}`);
        }

        const responseText = await response.text();
        if (!responseText) {
          throw new Error('Empty response from server');
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }

        if (data.success) {
          setSubmitProgress(100);
          setSubmitProgressMessage('Completed!');
          setSubmitStatus(`✅ Success! ${data.message}`);
          setSubmittedSuccessfully(true);
          setLoading(false);
        } else {
          setSubmitStatus(`❌ Error: ${data.error || data.message}`);
          setLoading(false);
        }
      } catch (error) {
        // Clear interval on error
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setSubmitStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setLoading(false);
      }
      return;
    }

    // Single invoice submission (existing flow)
    if (!file || !date || !amount || !merchant || !description) {
      alert('Please fill all required fields (file, date, amount, merchant, description)');
      return;
    }

    setLoading(true);
    setSubmitStatus('Submitting...');
    setSubmitProgress(0);
    setSubmitProgressMessage('Starting...');

    // Generate taskId on frontend
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      const formData = new FormData();
      formData.append('sessionId', currentSessionId);
      formData.append('taskId', taskId);
      formData.append('file', file);
      formData.append('date', date);
      formData.append('amount', amount);
      formData.append('merchant', merchant);
      formData.append('invoiceNumber', invoiceNumber);
      formData.append('description', description);
      formData.append('categoryValue', categoryValue);
      formData.append('expenseTypeValue', expenseTypeValue);

      // Clear any existing interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      // Start polling for progress immediately
      progressIntervalRef.current = setInterval(async () => {
        try {
          const progressResponse = await fetch(`/api/submit-progress?taskId=${taskId}`);
          if (progressResponse.ok) {
            const progressData = await progressResponse.json();
            if (progressData.progress !== undefined) {
              setSubmitProgress(progressData.progress);
              setSubmitProgressMessage(progressData.message || '');
              if (progressData.progress >= 100) {
                if (progressIntervalRef.current) {
                  clearInterval(progressIntervalRef.current);
                  progressIntervalRef.current = null;
                }
                setLoading(false);
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
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const responseText = await response.text();
      if (!responseText) {
        throw new Error('Empty response from server');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`);
      }

      // Wait a bit for final progress update
      await new Promise(resolve => setTimeout(resolve, 500));
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      if (data.success) {
        setSubmitProgress(100);
        setSubmitProgressMessage('Completed!');
        setSubmitStatus(`✅ Success! ${data.message}`);
        setSubmittedSuccessfully(true); // Mark as successfully submitted
        setLoading(false);
      } else {
        setSubmitStatus(`❌ Error: ${data.error || data.message}`);
        setLoading(false);
      }
    } catch (error) {
      // Clear interval on error
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setSubmitStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoading(false);
    }
  };

  // Get available expense types for selected category
  const getExpenseTypesForCategory = (categoryVal: string) => {
    const category = categories.find(cat => cat.value === categoryVal);
    return category?.expenseTypes || [];
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6">Darwinbox Reimbursement Test</h1>

        {/* Login Section */}
        <div className="mb-8 border-b pb-6">
          <h2 className="text-xl font-semibold mb-4">Step 1: Login</h2>
          <div className="space-y-4">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-md"
            />
            <div className="flex gap-2">
              <button
                onClick={handleLogin}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Login
              </button>
              {sessionId && (
                <button
                  onClick={checkLoginStatus}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  Check Login Status
                </button>
              )}
            </div>
            {loginStatus && (
              <p className="text-sm text-gray-600">{loginStatus}</p>
            )}
            {loginStatus === '✅ Logged in and ready!' && sessionId && (
              <p className="text-xs text-gray-500">Session ID: {sessionId}</p>
            )}
          </div>
        </div>

        {/* File Upload Section */}
        {sessionId && !showForm && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Step 2: Upload Receipt/Invoice</h2>
            <p className="text-sm text-gray-600 mb-4">
              Upload one or multiple receipts/invoices. We'll automatically extract the information and pre-fill the form for you.
              <br />
              <span className="text-xs text-gray-500">Supported formats: JPG, PNG, WebP, GIF, PDF</span>
            </p>

            <div>
              <label className="block text-sm font-medium mb-1">Invoice/Receipt File(s) *</label>
              <input
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={(e) => {
                  const uploadedFiles = e.target.files;
                  if (uploadedFiles && uploadedFiles.length > 0) {
                    handleMultipleFiles(uploadedFiles);
                  }
                }}
                className="w-full px-4 py-2 border rounded-md"
                disabled={loading || uploading}
              />
              <p className="text-xs text-gray-500 mt-1">
                {files.length > 0 && `${files.length} file(s) selected`}
                {files.length === 0 && 'Select one or multiple files (hold Ctrl/Cmd to select multiple)'}
              </p>
            </div>

            {ocrStatus && (
              <div className={`p-3 rounded-md ${
                ocrStatus.includes('✅') ? 'bg-green-50 text-green-800' : 
                ocrStatus.includes('❌') ? 'bg-red-50 text-red-800' : 
                'bg-blue-50 text-blue-800'
              }`}>
                <p className="text-sm">{ocrStatus}</p>
              </div>
            )}
            
            {uploading && (
              <div className="p-3 rounded-md bg-blue-50 text-blue-800">
                <p className="text-sm">Preparing batch processing page...</p>
              </div>
            )}
          </div>
        )}

        {/* Form Section */}
        {sessionId && showForm && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">Step 3: Review and Submit</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {invoices.length > 1 
                    ? `Review ${invoices.length} invoices below. You can edit any field before submitting.`
                    : 'Review the pre-filled information below. You can edit any field before submitting.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowForm(false);
                  setFile(null);
                  setInvoices([]);
                  setDate('');
                  setAmount('');
                  setMerchant('');
                  setInvoiceNumber('');
                  setDescription('');
                  setOcrStatus('');
                  setSubmittedSuccessfully(false);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
              >
                Upload New File
              </button>
            </div>

            {/* Multiple Invoices Cards View */}
            {invoices.length > 1 && (
              <div className="space-y-4 mb-6">
                {invoices.map((invoice, index) => (
                  <div key={invoice.id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-lg">Invoice {index + 1}: {invoice.merchant || invoice.file.name}</h3>
                      {invoice.status === 'error' && (
                        <span className="text-red-600 text-sm">❌ Processing failed</span>
                      )}
                      {invoice.status === 'ready' && (
                        <span className="text-green-600 text-sm">✅ Ready</span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium mb-1 text-gray-600">Date</label>
                        <input
                          type="date"
                          value={invoice.date}
                          onChange={(e) => {
                            const updated = [...invoices];
                            updated[index].date = e.target.value;
                            setInvoices(updated);
                          }}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-gray-600">Amount</label>
                        <input
                          type="number"
                          value={invoice.amount}
                          onChange={(e) => {
                            const updated = [...invoices];
                            updated[index].amount = e.target.value;
                            setInvoices(updated);
                          }}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium mb-1 text-gray-600">Merchant</label>
                        <input
                          type="text"
                          value={invoice.merchant}
                          onChange={(e) => {
                            const updated = [...invoices];
                            updated[index].merchant = e.target.value;
                            setInvoices(updated);
                          }}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium mb-1 text-gray-600">Invoice Number</label>
                        <input
                          type="text"
                          value={invoice.invoiceNumber}
                          onChange={(e) => {
                            const updated = [...invoices];
                            updated[index].invoiceNumber = e.target.value;
                            setInvoices(updated);
                          }}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium mb-1 text-gray-600">Description</label>
                        <textarea
                          value={invoice.description}
                          onChange={(e) => {
                            const updated = [...invoices];
                            updated[index].description = e.target.value;
                            setInvoices(updated);
                          }}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                          rows={2}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-gray-600">Category</label>
                        <select
                          value={invoice.categoryValue}
                          onChange={(e) => {
                            const updated = [...invoices];
                            updated[index].categoryValue = e.target.value;
                            const newCategory = categories.find(cat => cat.value === e.target.value);
                            if (newCategory && newCategory.expenseTypes.length > 0) {
                              updated[index].expenseTypeValue = newCategory.expenseTypes[0].value;
                            }
                            setInvoices(updated);
                          }}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        >
                          {categories.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-gray-600">Expense Type</label>
                        <select
                          value={invoice.expenseTypeValue}
                          onChange={(e) => {
                            const updated = [...invoices];
                            updated[index].expenseTypeValue = e.target.value;
                            setInvoices(updated);
                          }}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        >
                          {getExpenseTypesForCategory(invoice.categoryValue).map((expType) => (
                            <option key={expType.value} value={expType.value}>
                              {expType.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">File: {invoice.file.name}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Submit Button for Multiple Invoices */}
            {invoices.length > 1 && (
              <div className="mt-6">
                {submittedSuccessfully ? (
                  <div className="w-full">
                    <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-md mb-3">
                      <p className="text-green-800 font-medium text-center">
                        ✅ All expenses submitted successfully to Darwinbox!
                      </p>
                      <p className="text-green-600 text-sm text-center mt-1">
                        {invoices.filter(inv => inv.status === 'ready').length} expenses have been processed and saved.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSubmittedSuccessfully(false);
                        setSubmitStatus('');
                        setSubmitProgress(0);
                        setSubmitProgressMessage('');
                        setInvoices([]);
                        setFile(null);
                        setDate('');
                        setAmount('');
                        setMerchant('');
                        setInvoiceNumber('');
                        setDescription('');
                        setShowForm(false);
                        setOcrStatus('');
                      }}
                      className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    >
                      Upload New Invoices
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={loading || invoices.filter(inv => inv.status === 'ready').length === 0}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 relative overflow-hidden"
                  >
                    <span className="relative z-10">
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span>{submitProgressMessage || 'Submitting...'}</span>
                          <span className="text-sm">({submitProgress}%)</span>
                        </span>
                      ) : (
                        `Submit All ${invoices.filter(inv => inv.status === 'ready').length} Expenses`
                      )}
                    </span>
                    {loading && (
                      <div
                        className="absolute inset-0 bg-purple-700 transition-all duration-300 ease-out"
                        style={{ width: `${submitProgress}%` }}
                      />
                    )}
                  </button>
                )}
                {submitStatus && (
                  <p className="text-sm text-gray-600 mt-2">{submitStatus}</p>
                )}
              </div>
            )}

            {/* Single Invoice Form (existing) */}
            {invoices.length <= 1 && (
              <>
            <div>
              <label className="block text-sm font-medium mb-1">Invoice File *</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const uploadedFile = e.target.files?.[0];
                  if (uploadedFile) {
                    handleFileUpload(uploadedFile);
                  }
                }}
                className="w-full px-4 py-2 border rounded-md"
                disabled={loading}
              />
              {file && (
                <p className="text-xs text-gray-500 mt-1">Current file: {file.name}</p>
              )}
            </div>

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
                placeholder="1500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-2 border rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Merchant *</label>
              <input
                type="text"
                placeholder="Uber"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="w-full px-4 py-2 border rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Invoice Number</label>
              <input
                type="text"
                placeholder="INV-001"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-4 py-2 border rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description *</label>
              <textarea
                placeholder="Airport transfer from office to airport"
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
                  // Reset expense type when category changes
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

            {submittedSuccessfully ? (
              <div className="w-full">
                <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-md mb-3">
                  <p className="text-green-800 font-medium text-center">
                    ✅ Expense submitted successfully to Darwinbox!
                  </p>
                  <p className="text-green-600 text-sm text-center mt-1">
                    Your expense has been processed and saved.
                  </p>
                </div>
                <button
                  onClick={() => {
                    // Reset form for new submission
                    setSubmittedSuccessfully(false);
                    setSubmitStatus('');
                    setSubmitProgress(0);
                    setSubmitProgressMessage('');
                    setFile(null);
                    setDate('');
                    setAmount('');
                    setMerchant('');
                    setInvoiceNumber('');
                    setDescription('');
                    setShowForm(false);
                    setOcrStatus('');
                  }}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  Upload New Invoice
                </button>
              </div>
            ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 relative overflow-hidden"
              >
                <span className="relative z-10">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span>{submitProgressMessage || 'Submitting...'}</span>
                      <span className="text-sm">({submitProgress}%)</span>
                    </span>
                  ) : (
                    'Submit to Darwinbox'
                  )}
                </span>
                {loading && (
                  <div
                    className="absolute inset-0 bg-purple-700 transition-all duration-300 ease-out"
                    style={{ width: `${submitProgress}%` }}
                  />
                )}
            </button>
            )}

            {submitStatus && (
              <p className="text-sm text-gray-600">{submitStatus}</p>
            )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
