"""Pydantic models for Gastromek CRM"""
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone
import uuid


def uid() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ===== User =====
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = "sales"  # "admin" | "sales"


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None


class UserOut(UserBase):
    id: str
    created_at: str


# ===== Customer =====
class CustomerBase(BaseModel):
    company_name: str
    tax_number: Optional[str] = ""
    tax_office: Optional[str] = ""
    contact_person: Optional[str] = ""
    phone: Optional[str] = ""
    whatsapp: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    city: Optional[str] = ""
    notes: Optional[str] = ""


class CustomerCreate(CustomerBase):
    pass


class CustomerOut(CustomerBase):
    id: str
    created_at: str
    updated_at: str


# ===== Product =====
class ProductOut(BaseModel):
    id: str  # feed g:id
    code: str  # extracted product code or gtin
    title: str
    description: str
    link: str
    image: str
    additional_images: List[str] = []
    price: float
    currency: str = "TRY"
    brand: Optional[str] = ""
    product_type: Optional[str] = ""
    gtin: Optional[str] = ""
    synced_at: str


# ===== Quote =====
class QuoteItem(BaseModel):
    product_id: Optional[str] = None
    code: str = ""
    title: str
    description: Optional[str] = ""
    image: Optional[str] = ""
    quantity: float = 1
    unit_price: float = 0
    discount_percent: float = 0  # per-line discount (not used by global; kept for flexibility)
    features: List[str] = []  # optional bullet specs/technical features shown on the quote


class QuoteBase(BaseModel):
    customer_id: str
    currency: str = "TRY"
    vat_rate: float = 0.0
    discount_rate: float = 0.0  # applied on subtotal (which already includes VAT per user spec)
    valid_until: str  # ISO date
    notes: Optional[str] = ""
    items: List[QuoteItem] = []
    status: str = "taslak"  # taslak | gonderildi | kabul | red | suresi_doldu


class QuoteCreate(QuoteBase):
    pass


class QuoteUpdate(BaseModel):
    customer_id: Optional[str] = None
    currency: Optional[str] = None
    vat_rate: Optional[float] = None
    discount_rate: Optional[float] = None
    valid_until: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[List[QuoteItem]] = None
    status: Optional[str] = None


class QuoteOut(QuoteBase):
    id: str
    quote_no: str
    issue_date: str
    created_at: str
    updated_at: str
    created_by: Optional[str] = None
    revision_of: Optional[str] = None  # parent quote id
    revision_number: int = 0
    # computed snapshots (not required)
    subtotal: float = 0
    vat_amount: float = 0
    total_with_vat: float = 0
    discount_amount: float = 0
    grand_total: float = 0


# ===== Settings =====
class BankAccount(BaseModel):
    name: str = ""
    account_holder: str = ""
    iban: str = ""
    currency: str = "TRY"


class CompanySettings(BaseModel):
    company_name: str = "Gastromek GmbH"
    tagline: str = "Industrielle Küchenausstattung"
    logo_url: str = "https://customer-assets.emergentagent.com/job_7f4dcb13-bb80-4983-8764-b667de5bb352/artifacts/k8zjh8tf_gastromek-logo.png"
    website: str = "www.gastromek.de"
    phone: str = "+49 163 9830039"
    email: str = "info@gastromek.de"
    address: str = "Hörderstr. 288, 58454 Witten"
    tax_office: str = ""
    tax_number: str = ""
    bank_name: str = ""
    bank_iban: str = ""
    bank_account_holder: str = ""
    # Up to 3 bank accounts for PDF footer
    banks: List[BankAccount] = []
    # Authorized person (used for PDF signature)
    authorized_person_name: str = ""
    # Social media
    social_instagram: str = ""
    social_facebook: str = ""
    social_twitter: str = ""
    social_linkedin: str = ""
    social_youtube: str = ""
    social_tiktok: str = ""
    # Email provider
    email_provider: str = "resend"  # resend | smtp
    resend_api_key: str = ""
    resend_from_email: str = "onboarding@resend.dev"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_use_tls: bool = True
    # Email signature (HTML) appended to every quote email body
    email_signature_html: str = ""
    # Default quote defaults
    default_vat_rate: float = 0.0
    default_validity_days: int = 30
    default_quote_notes: str = ""
    # Accounting page access — roles allowed to view it (admin always can)
    accounting_visible_roles: List[str] = ["admin", "sales", "muhasebe"]
    # Projects page access — roles allowed to view it (admin always can)
    projects_visible_roles: List[str] = ["admin", "sales", "muhasebe"]


# ===== Auth =====
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ===== Email Send =====
class SendQuoteEmailRequest(BaseModel):
    recipient_email: EmailStr
    subject: Optional[str] = None
    message: Optional[str] = None
    pdf_base64: str  # base64-encoded PDF generated on client


# ===== Accounting / Transactions =====
INCOME_CATEGORIES = ["proje", "magaza_satisi", "diger"]
EXPENSE_CATEGORIES = [
    "kira", "personel_maasi", "muhasebe", "konaklama", "ulasim",
    "fatura", "yazilim", "yemek", "yakit", "diger",
]


class TransactionBase(BaseModel):
    kind: str  # "income" | "expense"
    category: str
    amount: float  # in EUR
    description: Optional[str] = ""
    date: str  # ISO date YYYY-MM-DD
    owner_id: Optional[str] = None  # person the entry belongs to (defaults to creator)


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    kind: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    date: Optional[str] = None
    owner_id: Optional[str] = None


# ===== Projects =====
class ProjectCreate(BaseModel):
    customer_id: str
    name: str
    info: Optional[str] = ""
    amount: float = 0
    currency: str = "EUR"


class ProjectUpdate(BaseModel):
    customer_id: Optional[str] = None
    name: Optional[str] = None
    info: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None


class ProjectIncomeCreate(BaseModel):
    amount: float
    currency: str = "EUR"
    date: str
    note: Optional[str] = ""


class ProjectIncomeUpdate(BaseModel):
    amount: Optional[float] = None
    currency: Optional[str] = None
    date: Optional[str] = None
    note: Optional[str] = None


class ProjectPaymentCreate(BaseModel):
    amount: float
    currency: str = "EUR"
    date: str
    note: Optional[str] = ""
    receipts: List[str] = []


class ProjectExpenseCreate(BaseModel):
    name: str
    total_debt: float = 0
    currency: str = "EUR"
    note: Optional[str] = ""
    initial_payment: Optional[ProjectPaymentCreate] = None


class ProjectExpenseUpdate(BaseModel):
    name: Optional[str] = None
    total_debt: Optional[float] = None
    currency: Optional[str] = None
    note: Optional[str] = None
