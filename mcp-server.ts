#!/usr/bin/env node

/**
 * MCP Server for Invoice OCR
 * This server exposes tools for Claude Desktop to extract data from invoice images
 */

// Load environment variables from .env file FIRST
// Use quiet mode to prevent any output to stdout/stderr (which would break JSON-RPC)
// Set environment variable to suppress dotenv output completely
process.env.DOTENV_CONFIG_QUIET = 'true';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { extractDataFromInvoicePath } from './lib/claude-ocr';
import { 
  loginMcpToDarwinbox, 
  checkMcpLoginStatus, 
  loadMcpSession 
} from './lib/mcp-session-manager';
import { navigateToExpenseForm } from './lib/navigate-to-expense-form';
import { fillExpenseForm, ExpenseFormData, submitExpenseForm, selectCategoryAndExpenseType } from './lib/fill-expense-form';
import { mapCategoryToReimbursement } from './lib/category-mapper';
import { readFile, readdir, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { logger } from './lib/logger';

// Claude Desktop uploads directory (fallback)
const CLAUDE_UPLOADS_DIR = '/mnt/user-data/uploads';
// Default Downloads directory for macOS
const DEFAULT_DOWNLOADS_DIR = '/Users/Pranav_1/Downloads';

/**
 * Find the most recently modified image file in Downloads folder
 * Useful for automatically detecting uploaded files
 */
async function findMostRecentImageInDownloads(): Promise<{ found: boolean; path: string; error?: string }> {
  // Try default Downloads directory first
  let downloadsDir = DEFAULT_DOWNLOADS_DIR;
  
  // Fallback to home directory Downloads if default doesn't exist
  if (!existsSync(downloadsDir)) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    if (homeDir) {
      downloadsDir = join(homeDir, 'Downloads');
    } else {
      return { found: false, path: '', error: 'Cannot determine Downloads directory' };
    }
  }
  
  if (!existsSync(downloadsDir)) {
    return { found: false, path: '', error: `Downloads folder not found: ${downloadsDir}` };
  }

  try {
    const files = await readdir(downloadsDir);
    const supportedFormats = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const imageFiles: Array<{ name: string; path: string; mtime: Date }> = [];

    for (const file of files) {
      const ext = file.toLowerCase().substring(file.lastIndexOf('.'));
      if (supportedFormats.includes(ext)) {
        const filePath = join(downloadsDir, file);
        try {
          const stats = await stat(filePath);
          if (stats.isFile()) {
            imageFiles.push({
              name: file,
              path: filePath,
              mtime: stats.mtime,
            });
          }
        } catch (error) {
          // Skip files we can't access
          continue;
        }
      }
    }

    if (imageFiles.length === 0) {
      return { found: false, path: '', error: 'No image files found in Downloads folder' };
    }

    // Sort by modification time (most recent first)
    imageFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    
    // Return the most recent file (modified in last 5 minutes)
    const mostRecent = imageFiles[0];
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    
    if (mostRecent.mtime.getTime() > fiveMinutesAgo) {
      return { found: true, path: mostRecent.path };
    } else {
      return {
        found: false,
        path: '',
        error: `Most recent image file (${mostRecent.name}) was modified more than 5 minutes ago. Please upload a file or provide the filename.`,
      };
    }
  } catch (error) {
    return {
      found: false,
      path: '',
      error: `Error reading Downloads folder: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Resolve file path with multiple fallback strategies
 * Tries: exact path, case-insensitive match, different possible locations
 * If only filename is provided, searches in Downloads folder first
 * If filePath is empty/null, tries to find most recent upload
 */
async function resolveFilePath(filePath?: string | null): Promise<{ found: boolean; path: string; error?: string }> {
  // If no filePath provided, try to find most recent upload
  if (!filePath || filePath.trim() === '') {
    logger.info('No file path provided, searching for most recent upload in Downloads...');
    return await findMostRecentImageInDownloads();
  }

  const trimmedPath = filePath.trim();
  // Try exact path first
  if (existsSync(trimmedPath)) {
    return { found: true, path: resolve(trimmedPath) };
  }

  // Try resolving as absolute path
  const absolutePath = resolve(trimmedPath);
  if (existsSync(absolutePath)) {
    return { found: true, path: absolutePath };
  }

  // Extract filename for searching
  const fileName = trimmedPath.split('/').pop() || trimmedPath.split('\\').pop() || trimmedPath;
  const fileNameLower = fileName.toLowerCase();
  const userHomeDir = process.env.HOME || process.env.USERPROFILE || '';

  // Try default Downloads directory first (/Users/Pranav_1/Downloads)
  let downloadsDir = DEFAULT_DOWNLOADS_DIR;
  if (existsSync(downloadsDir)) {
    try {
      const files = await readdir(downloadsDir);
      
      // Try exact match first
      for (const file of files) {
        if (file === fileName) {
          const foundPath = join(downloadsDir, file);
          if (existsSync(foundPath)) {
            return { found: true, path: foundPath };
          }
        }
      }
      
      // Try case-insensitive match
      for (const file of files) {
        if (file.toLowerCase() === fileNameLower) {
          const foundPath = join(downloadsDir, file);
          if (existsSync(foundPath)) {
            return { found: true, path: foundPath };
          }
        }
      }
    } catch (error) {
      // Directory read failed, continue
    }
  }

  // Fallback to home directory Downloads
  if (userHomeDir) {
    const homeDownloadsDir = join(userHomeDir, 'Downloads');
    if (existsSync(homeDownloadsDir) && homeDownloadsDir !== downloadsDir) {
      try {
        const files = await readdir(homeDownloadsDir);
        
        // Try exact match first
        for (const file of files) {
          if (file === fileName) {
            const foundPath = join(homeDownloadsDir, file);
            if (existsSync(foundPath)) {
              return { found: true, path: foundPath };
            }
          }
        }
        
        // Try case-insensitive match
        for (const file of files) {
          if (file.toLowerCase() === fileNameLower) {
            const foundPath = join(homeDownloadsDir, file);
            if (existsSync(foundPath)) {
              return { found: true, path: foundPath };
            }
          }
        }
      } catch (error) {
        // Directory read failed, continue
      }
    }
  }

  // Try case-insensitive matching in the uploads directory
  if (existsSync(CLAUDE_UPLOADS_DIR)) {
    try {
      const files = await readdir(CLAUDE_UPLOADS_DIR);
      
      // Find case-insensitive match
      for (const file of files) {
        if (file.toLowerCase() === fileNameLower) {
          const foundPath = join(CLAUDE_UPLOADS_DIR, file);
          if (existsSync(foundPath)) {
            return { found: true, path: foundPath };
          }
        }
      }
    } catch (error) {
      // Directory read failed, continue to other strategies
    }
  }

  // Try with just filename in uploads directory
  const uploadsPath = join(CLAUDE_UPLOADS_DIR, fileName);
  if (existsSync(uploadsPath)) {
    return { found: true, path: uploadsPath };
  }

  // Build helpful error message with available locations
  const errorLocations: string[] = [];
  
  // Check default Downloads folder first
  if (existsSync(DEFAULT_DOWNLOADS_DIR)) {
    try {
      const files = await readdir(DEFAULT_DOWNLOADS_DIR);
      const supportedFormats = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
      const imageFiles = files.filter(f => {
        const ext = f.toLowerCase().substring(f.lastIndexOf('.'));
        return supportedFormats.includes(ext);
      });
      if (imageFiles.length > 0) {
        errorLocations.push(`${DEFAULT_DOWNLOADS_DIR}: ${imageFiles.slice(0, 5).join(', ')}${imageFiles.length > 5 ? '...' : ''}`);
      }
    } catch (error) {
      // Ignore
    }
  }
  
  // Check home Downloads folder (if different)
  if (userHomeDir) {
    const homeDownloadsDir = join(userHomeDir, 'Downloads');
    if (existsSync(homeDownloadsDir) && homeDownloadsDir !== DEFAULT_DOWNLOADS_DIR) {
      try {
        const files = await readdir(homeDownloadsDir);
        const supportedFormats = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
        const imageFiles = files.filter(f => {
          const ext = f.toLowerCase().substring(f.lastIndexOf('.'));
          return supportedFormats.includes(ext);
        });
        if (imageFiles.length > 0) {
          errorLocations.push(`${homeDownloadsDir}: ${imageFiles.slice(0, 5).join(', ')}${imageFiles.length > 5 ? '...' : ''}`);
        }
      } catch (error) {
        // Ignore
      }
    }
  }

  // Check uploads directory
  if (existsSync(CLAUDE_UPLOADS_DIR)) {
    try {
      const files = await readdir(CLAUDE_UPLOADS_DIR);
      const supportedFormats = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
      const imageFiles = files.filter(f => {
        const ext = f.toLowerCase().substring(f.lastIndexOf('.'));
        return supportedFormats.includes(ext);
      });
      if (imageFiles.length > 0) {
        errorLocations.push(`${CLAUDE_UPLOADS_DIR}: ${imageFiles.slice(0, 5).join(', ')}${imageFiles.length > 5 ? '...' : ''}`);
      }
    } catch (error) {
      // Ignore
    }
  }

  const errorMsg = `File not found: ${trimmedPath}`;
  const locationsMsg = errorLocations.length > 0 
    ? `\nAvailable files:\n${errorLocations.join('\n')}`
    : `\nTip: Make sure the file path is correct. You can use absolute paths like /Users/YourName/Downloads/filename.png, or just the filename, or leave empty to auto-detect most recent upload`;

  return {
    found: false,
    path: trimmedPath,
    error: errorMsg + locationsMsg,
  };
}

// Load environment variables manually to avoid any module loading output
// MCP servers must only output JSON-RPC to stdout
import { readFileSync } from 'fs';

// Manually parse .env file if it exists (silent, no output)
try {
  const envPath = join(process.cwd(), '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '').trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
} catch (error) {
  // .env file doesn't exist or can't be read - that's fine, use env vars from config
}

const server = new Server(
  {
    name: 'invoice-ocr-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'extract_invoice_data',
        description: 'Extract structured data (date, amount, merchant, invoice number, description, category) from an invoice/receipt image file. IMPORTANT: Claude Desktop has built-in vision capabilities - you should read the invoice image directly using your vision to extract the data. This tool is provided for programmatic extraction if needed. Accepts filename (e.g., IMG_2317.PNG) or full path - system will find it in Downloads automatically',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Filename (e.g., IMG_2317.PNG) or full path to the invoice image file (PNG, JPEG, WEBP, or GIF). If just filename is provided, system will search in Downloads folder automatically.',
            },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'list_uploaded_invoices',
        description: 'List all invoice/receipt image files uploaded to Claude Desktop. Files are stored at /mnt/user-data/uploads/',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'login_darwinbox',
        description: 'Login to Darwinbox with persistent session. Session is saved and reused automatically. Only needs to be called once per day. If email is not provided, uses pranav.prodduturi@zeptonow.com as default.',
        inputSchema: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              description: 'Email address for Darwinbox login (defaults to pranav.prodduturi@zeptonow.com if not provided)',
            },
          },
        },
      },
      {
        name: 'check_login_status',
        description: 'Check if currently logged in to Darwinbox',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'submit_reimbursement',
        description: 'Submit a single reimbursement request to Darwinbox using extracted invoice data. This tool navigates to Darwinbox, creates a reimbursement, creates an expense, fills all form fields, uploads the invoice file, and submits it. Requires login first (use login_darwinbox). Use this when you have already read the invoice using your built-in vision and extracted all the details (date, amount, merchant, invoice number, description, category, expense type). Leave filePath empty to auto-detect most recent upload, or provide filename/path if needed.',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Expense date in YYYY-MM-DD format (extracted from invoice)',
            },
            amount: {
              type: 'number',
              description: 'Expense amount (extracted from invoice)',
            },
            merchant: {
              type: 'string',
              description: 'Merchant/vendor name (extracted from invoice - the business/company name, not addresses or locations)',
            },
            invoiceNumber: {
              type: 'string',
              description: 'Invoice number (optional, extracted from invoice)',
            },
            description: {
              type: 'string',
              description: 'Expense description (extracted from invoice - be specific, e.g., "Airport transfer to [location]", "Restaurant meal", "Local conveyance to [location]")',
            },
            category: {
              type: 'string',
              description: 'Expense category (extracted from invoice - e.g., Travel, Food, Accommodation, Office Supplies, Cafe, Miscellaneous, Other)',
            },
            filePath: {
              type: 'string',
              description: 'OPTIONAL: Filename (e.g., IMG_2317.PNG) or full path to invoice image file. If left empty, system will automatically find the most recently uploaded file in Downloads folder (modified in last 5 minutes).',
            },
          },
          required: ['date', 'amount', 'merchant', 'description', 'category'],
        },
      },
      {
        name: 'process_multiple_invoices',
        description: 'Process and submit multiple invoices to Darwinbox in a single browser session. This tool: 1) Lists all invoice files from /mnt/user-data/uploads/, 2) For each invoice, you (Claude) should read it using your built-in vision to extract data (date, amount, merchant, invoice number, description, category), 3) Logs into Darwinbox (reuses session if available), 4) Processes ALL invoices in one browser session - for each invoice: navigates to expense form, fills fields, uploads file, submits, then moves to next invoice, 5) Returns a summary of successful and failed submissions. IMPORTANT: You must read each invoice image using your vision capabilities to extract the data before calling this tool.',
        inputSchema: {
          type: 'object',
          properties: {
            invoiceData: {
              type: 'array',
              description: 'Array of invoice data objects. Each object should contain: { filePath: string (from /mnt/user-data/uploads/), date: string (YYYY-MM-DD), amount: number, merchant: string, invoiceNumber?: string, description: string, category: string }',
              items: {
                type: 'object',
                properties: {
                  filePath: { type: 'string' },
                  date: { type: 'string' },
                  amount: { type: 'number' },
                  merchant: { type: 'string' },
                  invoiceNumber: { type: 'string' },
                  description: { type: 'string' },
                  category: { type: 'string' },
                },
                required: ['filePath', 'date', 'amount', 'merchant', 'description', 'category'],
              },
            },
          },
          required: ['invoiceData'],
        },
      },
      {
        name: 'claim_reimbursement',
        description: 'Complete workflow to process and submit a single invoice reimbursement to Darwinbox. WORKFLOW: 1) Read the invoice image directly using your built-in vision (Claude Desktop can see uploaded images - no API needed), 2) Identify all relevant details: date, amount, merchant, invoice number, description, category, and expense type, 3) Leave filePath empty to auto-detect the most recently uploaded file in Downloads, or provide filename/path if needed, 4) This tool will then: check/login to Darwinbox, navigate to reimbursements → create reimbursement → create expense, fill the form with extracted data, upload the invoice file using the file path, and submit. For multiple invoices, use process_multiple_invoices instead.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'OPTIONAL: Filename (e.g., IMG_2317.PNG) or full path to the invoice/receipt image file (PNG, JPEG, WEBP, or GIF). If left empty, system will automatically find the most recently uploaded file in Downloads folder (modified in last 5 minutes).',
            },
          },
          required: [],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'extract_invoice_data') {
      const { filePath } = args as { filePath?: string };
      
      // Resolve file path with fallbacks (auto-detect if not provided)
      const resolved = await resolveFilePath(filePath);
      if (!resolved.found) {
        throw new Error(resolved.error || `File not found: ${filePath || 'auto-detect failed'}`);
      }

      const absolutePath = resolved.path;

      // Check if it's a supported image file
      const ext = absolutePath.toLowerCase().split('.').pop();
      const supportedFormats = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
      if (!ext || !supportedFormats.includes(ext)) {
        throw new Error(`Unsupported file format: ${ext}. Supported formats: ${supportedFormats.join(', ')}`);
      }

      logger.info(`Processing invoice: ${absolutePath}`);
      const extractedData = await extractDataFromInvoicePath(absolutePath);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(extractedData, null, 2),
          },
        ],
      };
    }

    if (name === 'list_uploaded_invoices') {
      const searchDir = CLAUDE_UPLOADS_DIR;
      
      if (!existsSync(searchDir)) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ 
                error: `Claude Desktop uploads directory not found: ${searchDir}`,
                message: 'Make sure files are uploaded to Claude Desktop first',
                files: []
              }, null, 2),
            },
          ],
        };
      }

      const files = await readdir(searchDir);
      const invoiceFiles: Array<{ name: string; path: string; size: number }> = [];
      
      const supportedFormats = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
      
      for (const file of files) {
        const filePath = join(searchDir, file);
        try {
        const stats = await stat(filePath);
        
        if (stats.isFile()) {
          const ext = file.toLowerCase().substring(file.lastIndexOf('.'));
          if (supportedFormats.includes(ext)) {
            invoiceFiles.push({
              name: file,
              path: filePath,
              size: stats.size,
            });
          }
          }
        } catch (error) {
          // Skip files that can't be accessed
          logger.info(`Error accessing file ${filePath}: ${error}`);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              directory: searchDir,
              count: invoiceFiles.length,
              files: invoiceFiles,
              message: invoiceFiles.length > 0 
                ? `Found ${invoiceFiles.length} invoice file(s). Use your vision to read each invoice and extract data, then use process_multiple_invoices to submit them all.`
                : 'No invoice files found. Upload invoice images to Claude Desktop first.',
            }, null, 2),
          },
        ],
      };
    }

    if (name === 'login_darwinbox') {
      const { email } = args as { email?: string };
      
      // Default email if not provided
      const loginEmail = email || 'pranav.prodduturi@zeptonow.com';

      logger.info(`Logging in to Darwinbox for: ${loginEmail}`);
      const result = await loginMcpToDarwinbox(loginEmail);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: result.success,
              message: result.message,
              sessionId: result.sessionId,
              note: result.success 
                ? 'Session saved. You can now submit reimbursements without logging in again.'
                : 'Browser window opened. Please complete login in the browser window.',
            }, null, 2),
          },
        ],
      };
    }

    if (name === 'check_login_status') {
      const session = await loadMcpSession();
      
      if (!session) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
              success: false,
              message: 'No session found. Please login first using login_darwinbox.',
            }, null, 2),
            },
          ],
        };
      }

      const status = await checkMcpLoginStatus(session);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: status.success,
              message: status.message,
              email: session.email,
            }, null, 2),
          },
        ],
      };
    }

    if (name === 'submit_reimbursement') {
      const { 
        date, 
        amount, 
        merchant, 
        invoiceNumber, 
        description, 
        category, 
        filePath 
      } = args as { 
        date: string; 
        amount: number; 
        merchant: string; 
        invoiceNumber?: string; 
        description: string; 
        category: string; 
        filePath?: string;
      };

      // Validate required fields
      if (!date || !amount || !merchant || !description || !category) {
        throw new Error('Missing required fields: date, amount, merchant, description, category');
      }

      // Resolve file path with fallbacks (auto-detect if not provided)
      const resolved = await resolveFilePath(filePath);
      if (!resolved.found) {
        throw new Error(resolved.error || `File not found: ${filePath || 'auto-detect failed'}`);
      }
      const resolvedFilePath = resolved.path;

      // Load or create session
      let session = await loadMcpSession();
      if (!session) {
        logger.info('No session found. Attempting to create new session...');
        // Try to create a new session with default email
        const loginResult = await loginMcpToDarwinbox('pranav.prodduturi@zeptonow.com');
        if (!loginResult.success) {
          throw new Error(`No session found and login failed: ${loginResult.message}. Please login first using login_darwinbox.`);
        }
        session = await loadMcpSession();
        if (!session) {
          throw new Error('Failed to create session. Please login first using login_darwinbox.');
        }
      }

      // Check login status
      const loginStatus = await checkMcpLoginStatus(session);
      if (!loginStatus.success) {
        logger.info(`Login check failed: ${loginStatus.message}. Attempting to re-login...`);
        // Try to re-login
        const loginResult = await loginMcpToDarwinbox(session.email);
        if (!loginResult.success) {
        throw new Error(`Not logged in: ${loginStatus.message}. Please login first using login_darwinbox.`);
        }
        // Reload session after login
        session = await loadMcpSession();
        if (!session) {
          throw new Error('Failed to reload session after login.');
        }
      }

      // Ensure browser context exists
      if (!session.browserContext) {
        logger.info('Browser context not initialized. Attempting to initialize...');
        // Try to get or create session which will initialize browser context
        const { getOrCreateMcpSession } = await import('./lib/mcp-session-manager');
        session = await getOrCreateMcpSession(session.email);
        if (!session.browserContext) {
          throw new Error('Browser context not initialized. Please login again using login_darwinbox.');
        }
      }

      // Map category to Darwinbox category and expense type
      const categoryMapping = mapCategoryToReimbursement(category, description, merchant);

      // Get page from browser context - ALWAYS reuse existing page, never create new one
      const pages = session.browserContext.pages();
      if (pages.length === 0) {
        throw new Error('No browser window available. Please ensure the browser is open and logged in.');
      }
      const page = pages[0]; // Always use the first (existing) page
      logger.info(`✓ Reusing existing browser page for automation`);

      // Navigate to expense form
      logger.info('Navigating to expense form...');
      const navResult = await navigateToExpenseForm(page);
      if (!navResult.success) {
        throw new Error(`Failed to navigate to expense form: ${navResult.message}`);
      }

      // Prepare form data
      const formData: ExpenseFormData = {
        date,
        amount,
        merchant,
        invoiceNumber: invoiceNumber || '',
        description,
        categoryValue: categoryMapping.categoryValue,
        expenseTypeValue: categoryMapping.expenseTypeValue,
        filePath: resolvedFilePath,
      };

      // Select category and expense type first
      logger.info('Selecting category and expense type...');
      const selectResult = await selectCategoryAndExpenseType(
        page,
        categoryMapping.categoryValue,
        categoryMapping.expenseTypeValue
      );
      if (!selectResult.success) {
        throw new Error(`Failed to select category/expense type: ${selectResult.message}`);
      }

      // Fill expense form
      logger.info('Filling expense form...');
      const fillResult = await fillExpenseForm(page, formData);
      
      if (!fillResult.success) {
        throw new Error(`Failed to fill form: ${fillResult.message}`);
      }

      // Submit the form
      logger.info('Submitting expense form...');
      const submitResult = await submitExpenseForm(page);
      
      if (!submitResult.success) {
        throw new Error(`Failed to submit form: ${submitResult.message}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Reimbursement submitted successfully',
              data: {
                date,
                amount,
                merchant,
                description,
                category: categoryMapping.categoryValue,
              },
            }, null, 2),
          },
        ],
      };
    }

    if (name === 'process_multiple_invoices') {
      const { invoiceData } = args as { 
        invoiceData: Array<{
          filePath: string;
          date: string;
          amount: number;
          merchant: string;
          invoiceNumber?: string;
          description: string;
          category: string;
        }>;
      };

      if (!invoiceData || !Array.isArray(invoiceData) || invoiceData.length === 0) {
        throw new Error('invoiceData array is required and must contain at least one invoice');
      }

      // Validate all invoices have required fields and resolve file paths
      const resolvedInvoices = [];
      for (const invoice of invoiceData) {
        if (!invoice.filePath || !invoice.date || !invoice.amount || !invoice.merchant || !invoice.description || !invoice.category) {
          throw new Error('Each invoice must have: filePath, date, amount, merchant, description, category');
        }
        
        // Resolve file path with fallbacks
        const resolved = await resolveFilePath(invoice.filePath);
        if (!resolved.found) {
          throw new Error(resolved.error || `Invoice file not found: ${invoice.filePath}`);
        }
        
        resolvedInvoices.push({
          ...invoice,
          filePath: resolved.path,
        });
      }

      // Load or create session
      let session = await loadMcpSession();
      if (!session) {
        logger.info('No session found. Attempting to create new session...');
        // Try to create a new session with default email
        const loginResult = await loginMcpToDarwinbox('pranav.prodduturi@zeptonow.com');
        if (!loginResult.success) {
          throw new Error(`No session found and login failed: ${loginResult.message}. Please login first using login_darwinbox.`);
        }
        session = await loadMcpSession();
        if (!session) {
          throw new Error('Failed to create session. Please login first using login_darwinbox.');
        }
      }

      // Check login status
      const loginStatus = await checkMcpLoginStatus(session);
      if (!loginStatus.success) {
        logger.info(`Login check failed: ${loginStatus.message}. Attempting to re-login...`);
        // Try to re-login
        const loginResult = await loginMcpToDarwinbox(session.email);
        if (!loginResult.success) {
          throw new Error(`Not logged in: ${loginStatus.message}. Please login first using login_darwinbox.`);
        }
        // Reload session after login
        session = await loadMcpSession();
        if (!session) {
          throw new Error('Failed to reload session after login.');
        }
      }

      // Ensure browser context exists
      if (!session.browserContext) {
        logger.info('Browser context not initialized. Attempting to initialize...');
        // Try to get or create session which will initialize browser context
        const { getOrCreateMcpSession } = await import('./lib/mcp-session-manager');
        session = await getOrCreateMcpSession(session.email);
        if (!session.browserContext) {
          throw new Error('Browser context not initialized. Please login again using login_darwinbox.');
        }
      }

      // Get page from browser context
      const pages = session.browserContext.pages();
      const page = pages[0] || await session.browserContext.newPage();

      const results: Array<{
        filePath: string;
        success: boolean;
        message: string;
        data?: any;
      }> = [];

      // Process each invoice in the same browser session
      for (let i = 0; i < resolvedInvoices.length; i++) {
        const invoice = resolvedInvoices[i];
        const invoiceNum = i + 1;
        const totalInvoices = invoiceData.length;

        logger.info(`\n=== Processing Invoice ${invoiceNum}/${totalInvoices}: ${invoice.filePath} ===`);

        try {
          // Map category to Darwinbox category and expense type
          const categoryMapping = mapCategoryToReimbursement(
            invoice.category,
            invoice.description,
            invoice.merchant
          );

          // Navigate to expense form (only for first invoice, or if we need to add another expense)
          if (i === 0) {
            logger.info('Navigating to expense form...');
            const navResult = await navigateToExpenseForm(page);
            if (!navResult.success) {
              throw new Error(`Failed to navigate to expense form: ${navResult.message}`);
            }
          } else {
            // For subsequent invoices, click "+ Create Expense" again
            logger.info('Adding another expense...');
            try {
              await page.waitForTimeout(2000);
              await page.click('a.add_expense_button');
              await page.waitForTimeout(3000);
              await page.click('a.add_expense_manual_ocr');
              await page.waitForTimeout(3000);
              await page.waitForSelector('#addExpenses', { timeout: 10000 });
            } catch (error) {
              // If that fails, try navigating to form again
              logger.info('Failed to add expense, navigating to form again...');
              const navResult = await navigateToExpenseForm(page);
              if (!navResult.success) {
                throw new Error(`Failed to navigate to expense form: ${navResult.message}`);
              }
            }
          }

          // Select category and expense type
          logger.info('Selecting category and expense type...');
          const selectResult = await selectCategoryAndExpenseType(
            page,
            categoryMapping.categoryValue,
            categoryMapping.expenseTypeValue
          );
          if (!selectResult.success) {
            throw new Error(`Failed to select category/expense type: ${selectResult.message}`);
          }

          // Prepare form data (filePath included - fillExpenseForm will upload it last)
          const formData: ExpenseFormData = {
            date: invoice.date,
            amount: invoice.amount,
            merchant: invoice.merchant,
            invoiceNumber: invoice.invoiceNumber || '',
            description: invoice.description,
            categoryValue: categoryMapping.categoryValue,
            expenseTypeValue: categoryMapping.expenseTypeValue,
            filePath: resolve(invoice.filePath), // Will be uploaded LAST after all fields are filled
          };

          // Fill expense form (this will: fill all fields first, then upload image last)
          logger.info('Filling expense form (fields first, then image upload last)...');
          const fillResult = await fillExpenseForm(page, formData);
          
          if (!fillResult.success) {
            throw new Error(`Failed to fill form: ${fillResult.message}`);
          }

          // Submit the form
          logger.info('Submitting expense form...');
          const submitResult = await submitExpenseForm(page);
          
          if (!submitResult.success) {
            throw new Error(`Failed to submit form: ${submitResult.message}`);
          }

          results.push({
            filePath: invoice.filePath,
            success: true,
            message: 'Reimbursement submitted successfully',
            data: {
              date: invoice.date,
              amount: invoice.amount,
              merchant: invoice.merchant,
              description: invoice.description,
              category: categoryMapping.categoryValue,
            },
          });

          logger.info(`✓ Invoice ${invoiceNum}/${totalInvoices} processed successfully`);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.info(`✗ Invoice ${invoiceNum}/${totalInvoices} failed: ${errorMessage}`);
          
          results.push({
            filePath: invoice.filePath,
            success: false,
            message: errorMessage,
          });
        }
      }

      // Generate summary
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: failed === 0,
              summary: {
                total: invoiceData.length,
                successful,
                failed,
              },
              results,
              message: failed === 0
                ? `All ${successful} invoice(s) processed successfully!`
                : `${successful} invoice(s) processed successfully, ${failed} failed. See results for details.`,
            }, null, 2),
          },
        ],
      };
    }

    if (name === 'claim_reimbursement') {
      const { filePath } = args as { filePath?: string };

      // Resolve file path with fallbacks (auto-detect if not provided)
      const resolved = await resolveFilePath(filePath);
      if (!resolved.found) {
        throw new Error(resolved.error || `File not found: ${filePath || 'auto-detect failed'}`);
      }

      const absolutePath = resolved.path;

      // Check if it's a supported image file
      const ext = absolutePath.toLowerCase().split('.').pop();
      const supportedFormats = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
      if (!ext || !supportedFormats.includes(ext)) {
        throw new Error(`Unsupported file format: ${ext}. Supported formats: ${supportedFormats.join(', ')}`);
      }

      logger.info(`Processing and claiming reimbursement for: ${absolutePath}`);

      // Step 1: Extract invoice data
      logger.info('Step 1: Extracting invoice data...');
      const extractedData = await extractDataFromInvoicePath(absolutePath);
      logger.info(`✓ Extracted: ${extractedData.merchant} - ${extractedData.amount}`);

      // Step 2: Check/load session
      logger.info('Step 2: Checking login status...');
      let session = await loadMcpSession();
      if (!session) {
        throw new Error('No session found. Please run the setup-mcp-login script first or use login_darwinbox tool.');
      }

      // Step 3: Verify login
      const loginStatus = await checkMcpLoginStatus(session);
      if (!loginStatus.success) {
        throw new Error(`Not logged in: ${loginStatus.message}. Please run the setup-mcp-login script or use login_darwinbox tool.`);
      }
      logger.info('✓ Logged in');

      // Step 4: Map category
      const categoryMapping = mapCategoryToReimbursement(
        extractedData.category || 'Other',
        extractedData.description,
        extractedData.merchant
      );

      // Step 5: Ensure browser context exists
      if (!session.browserContext) {
        logger.info('Browser context not initialized. Attempting to initialize...');
        // Try to get or create session which will initialize browser context
        const { getOrCreateMcpSession } = await import('./lib/mcp-session-manager');
        session = await getOrCreateMcpSession(session.email);
        if (!session.browserContext) {
          throw new Error('Browser context not initialized. Please login again using login_darwinbox.');
        }
      }

      // Step 6: Get page - ALWAYS reuse existing page, never create new one
      const pages = session.browserContext.pages();
      if (pages.length === 0) {
        throw new Error('No browser window available. Please ensure the browser is open and logged in.');
      }
      const page = pages[0]; // Always use the first (existing) page
      logger.info(`✓ Reusing existing browser page for automation`);

      // Step 7: Navigate to expense form
      logger.info('Step 3: Navigating to expense form...');
      const navResult = await navigateToExpenseForm(page);
      if (!navResult.success) {
        throw new Error(`Failed to navigate to expense form: ${navResult.message}`);
      }

      // Step 8: Select category and expense type
      logger.info('Step 4: Selecting category and expense type...');
      const selectResult = await selectCategoryAndExpenseType(
        page,
        categoryMapping.categoryValue,
        categoryMapping.expenseTypeValue
      );
      if (!selectResult.success) {
        throw new Error(`Failed to select category/expense type: ${selectResult.message}`);
      }

      // Step 9: Prepare form data
      const formData: ExpenseFormData = {
        date: extractedData.date,
        amount: extractedData.amount,
        merchant: extractedData.merchant,
        invoiceNumber: extractedData.invoiceNumber || '',
        description: extractedData.description,
        categoryValue: categoryMapping.categoryValue,
        expenseTypeValue: categoryMapping.expenseTypeValue,
        filePath: absolutePath,
      };

      // Step 10: Fill form
      logger.info('Step 5: Filling expense form...');
      const fillResult = await fillExpenseForm(page, formData);
      
      if (!fillResult.success) {
        throw new Error(`Failed to fill form: ${fillResult.message}`);
      }

      // Step 11: Submit form
      logger.info('Step 6: Submitting expense form...');
      const submitResult = await submitExpenseForm(page);
      
      if (!submitResult.success) {
        throw new Error(`Failed to submit form: ${submitResult.message}`);
      }

      logger.info('✓ Reimbursement claimed successfully!');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Reimbursement claimed successfully!',
              extractedData: {
                date: extractedData.date,
                amount: extractedData.amount,
                merchant: extractedData.merchant,
                invoiceNumber: extractedData.invoiceNumber,
                description: extractedData.description,
                category: extractedData.category,
              },
              submitted: true,
            }, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: errorMessage }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// List available resources (invoice files from Claude Desktop uploads)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const invoicesDir = CLAUDE_UPLOADS_DIR;
  const resources: Array<{ uri: string; name: string; description?: string; mimeType?: string }> = [];
  
  if (existsSync(invoicesDir)) {
    try {
      const files = await readdir(invoicesDir);
      const supportedFormats = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
      
      for (const file of files) {
        const filePath = join(invoicesDir, file);
        try {
        const stats = await stat(filePath);
        
        if (stats.isFile()) {
          const ext = file.toLowerCase().substring(file.lastIndexOf('.'));
          if (supportedFormats.includes(ext)) {
            resources.push({
              uri: `file://${filePath}`,
              name: file,
              description: `Invoice image file (${(stats.size / 1024).toFixed(2)} KB)`,
              mimeType: ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/gif',
            });
          }
          }
        } catch (error) {
          // Skip files that can't be accessed
          logger.info(`Error accessing file ${filePath}: ${error}`);
        }
      }
    } catch (error) {
      // Directory might not exist or be readable
      logger.info(`Error reading directory ${invoicesDir}: ${error}`);
    }
  }
  
  return { resources };
});

// Read resource (invoice file)
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  
  if (!uri.startsWith('file://')) {
    throw new Error('Only file:// URIs are supported');
  }
  
  const filePath = uri.replace('file://', '');
  
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  // For images, we'll return metadata and suggest using extract_invoice_data tool
  const stats = await stat(filePath);
  const fileName = filePath.split('/').pop() || filePath;
  
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          file: fileName,
          path: filePath,
          size: stats.size,
          message: 'Use the extract_invoice_data tool to process this invoice image',
        }, null, 2),
      },
    ],
  };
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Invoice OCR MCP server running on stdio');
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

main().catch((error) => {
  logger.error('Fatal error in MCP server:', error);
  // Don't exit immediately - let the error be logged
  // The process will exit naturally if needed
});

