// IndexedDB service for ParseFlow vault
const DB_NAME = 'parseflow_vault';
const DB_VERSION = 1;

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
}

export interface Document {
  id: string;
  user_id: string;
  filename: string;
  category: string;
  confidence: number;
  extraction: Record<string, string>;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
  thumbnail: string;
  source: string;
  processingTime: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('docs')) {
        const docStore = db.createObjectStore('docs', { keyPath: 'id' });
        docStore.createIndex('user_id', 'user_id', { unique: false });
      }
    };
  });
}

async function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

export async function getAllUsers(): Promise<User[]> {
  const store = await getStore('users');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addUser(user: User): Promise<void> {
  const store = await getStore('users', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(user);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const users = await getAllUsers();
  return users.find(u => u.email === email);
}

export async function getDocsByUser(userId: string): Promise<Document[]> {
  const store = await getStore('docs');
  const index = store.index('user_id');
  return new Promise((resolve, reject) => {
    const request = index.getAll(userId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addDoc(doc: Document): Promise<void> {
  const store = await getStore('docs', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(doc);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteDoc(docId: string): Promise<void> {
  const store = await getStore('docs', 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(docId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function seedDemoData(): Promise<void> {
  const existingUser = await getUserByEmail('test@test.com');
  if (existingUser) return;

  const demoUser: User = {
    id: 'demo-user-001',
    name: 'Test User',
    email: 'test@test.com',
    password: 'password123',
  };
  await addUser(demoUser);

  const demoDocs: Document[] = [
    { id: 'd1', user_id: demoUser.id, filename: 'Aadhaar_Card_Front.jpg', category: 'Identity', confidence: 94, extraction: { 'Name': 'Rahul Sharma', 'UID': '1234-5678-9012', 'DOB': '15/08/1990', 'Address': '42 MG Road, Bangalore' }, timestamp: new Date(Date.now() - 4*3600000).toISOString(), status: 'success', thumbnail: '🪪', source: 'AI', processingTime: 1247 },
    { id: 'd2', user_id: demoUser.id, filename: 'PAN_Card.pdf', category: 'Identity', confidence: 96, extraction: { 'Name': 'Rahul Sharma', 'PAN': 'ABCDE1234F', 'DOB': '15/08/1990', 'Father': 'Suresh Sharma' }, timestamp: new Date(Date.now() - 8*3600000).toISOString(), status: 'success', thumbnail: '🪪', source: 'AI', processingTime: 980 },
    { id: 'd3', user_id: demoUser.id, filename: 'Passport_Scan.jpg', category: 'Identity', confidence: 91, extraction: { 'Name': 'Rahul Sharma', 'Passport No': 'J8765432', 'Nationality': 'Indian', 'Expiry': '2032-04-15' }, timestamp: new Date(Date.now() - 24*3600000).toISOString(), status: 'success', thumbnail: '🪪', source: 'AI', processingTime: 1430 },
    { id: 'd4', user_id: demoUser.id, filename: 'Invoice_March_2026.pdf', category: 'Financial', confidence: 97, extraction: { 'Invoice No': 'INV-2026-0847', 'Date': '2026-03-15', 'Vendor': 'Acme Solutions', 'Amount': '₹42,500', 'GST': '₹7,650', 'Total': '₹50,150' }, timestamp: new Date(Date.now() - 2*3600000).toISOString(), status: 'success', thumbnail: '💰', source: 'AI', processingTime: 856 },
    { id: 'd5', user_id: demoUser.id, filename: 'Bank_Statement_Q1.pdf', category: 'Financial', confidence: 88, extraction: { 'Bank': 'HDFC Bank', 'Account': 'XXXX4521', 'Period': 'Jan-Mar 2026', 'Balance': '₹2,34,500' }, timestamp: new Date(Date.now() - 48*3600000).toISOString(), status: 'success', thumbnail: '💰', source: 'OCR+LLM', processingTime: 2100 },
    { id: 'd6', user_id: demoUser.id, filename: 'Salary_Slip_Feb.pdf', category: 'Financial', confidence: 92, extraction: { 'Employee': 'Rahul Sharma', 'Month': 'February 2026', 'Gross': '₹1,20,000', 'Net': '₹98,400' }, timestamp: new Date(Date.now() - 72*3600000).toISOString(), status: 'success', thumbnail: '💰', source: 'AI', processingTime: 1050 },
    { id: 'd7', user_id: demoUser.id, filename: 'Rental_Agreement.pdf', category: 'Legal', confidence: 72, extraction: { 'Landlord': 'Priya Patel', 'Tenant': 'Rahul Sharma', 'Rent': '₹25,000/month', 'Duration': '11 months' }, timestamp: new Date(Date.now() - 96*3600000).toISOString(), status: 'warning', thumbnail: '⚖', source: 'OCR+LLM', processingTime: 3200 },
    { id: 'd8', user_id: demoUser.id, filename: 'NDA_TechCorp.pdf', category: 'Legal', confidence: 68, extraction: { 'Parties': 'Rahul Sharma, TechCorp', 'Date': '2026-01-10', 'Duration': '2 years' }, timestamp: new Date(Date.now() - 120*3600000).toISOString(), status: 'warning', thumbnail: '⚖', source: 'OCR+LLM', processingTime: 2800 },
    { id: 'd9', user_id: demoUser.id, filename: 'GST_Registration.pdf', category: 'Compliance', confidence: 89, extraction: { 'GSTIN': '29ABCDE1234F1Z5', 'Legal Name': 'Rahul Sharma', 'State': 'Karnataka' }, timestamp: new Date(Date.now() - 168*3600000).toISOString(), status: 'success', thumbnail: '📋', source: 'AI', processingTime: 1100 },
    { id: 'd10', user_id: demoUser.id, filename: 'Form_16_FY25.pdf', category: 'Tax', confidence: 95, extraction: { 'Employer': 'TechCorp India', 'PAN': 'ABCDE1234F', 'Total Income': '₹14,40,000', 'Tax Paid': '₹2,16,000' }, timestamp: new Date(Date.now() - 240*3600000).toISOString(), status: 'success', thumbnail: '💼', source: 'AI', processingTime: 920 },
    { id: 'd11', user_id: demoUser.id, filename: 'ITR_Acknowledgment.pdf', category: 'Tax', confidence: 90, extraction: { 'AY': '2025-26', 'PAN': 'ABCDE1234F', 'Filed': '2025-07-28', 'Status': 'Verified' }, timestamp: new Date(Date.now() - 360*3600000).toISOString(), status: 'success', thumbnail: '💼', source: 'AI', processingTime: 780 },
    { id: 'd12', user_id: demoUser.id, filename: 'Receipt_Blurry.png', category: 'Business', confidence: 32, extraction: { 'Note': 'Low quality scan, partial extraction' }, timestamp: new Date(Date.now() - 480*3600000).toISOString(), status: 'error', thumbnail: '🏢', source: 'OCR+LLM', processingTime: 4500 },
  ];

  for (const doc of demoDocs) {
    await addDoc(doc);
  }
}
