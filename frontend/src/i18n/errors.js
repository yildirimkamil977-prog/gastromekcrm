// Localizes backend (Turkish) error messages to the active UI language.
// The backend returns Turkish `detail` strings; when the UI language is German
// we translate them here. For Turkish we return the original string unchanged.

const EXACT = {
  "E-posta veya şifre hatalı": "E-Mail oder Passwort ist falsch",
  "Geçersiz token tipi": "Ungültiger Token-Typ",
  "Token süresi doldu": "Sitzung abgelaufen. Bitte melden Sie sich erneut an.",
  "Geçersiz token": "Ungültiges Token",
  "Giriş yapılmamış": "Nicht angemeldet",
  "Kullanıcı bulunamadı": "Benutzer nicht gefunden",
  "Sadece yönetici erişebilir": "Nur Administratoren haben Zugriff",
  "Müşteri bulunamadı": "Kunde nicht gefunden",
  "Ürün bulunamadı": "Produkt nicht gefunden",
  "Teklif bulunamadı": "Angebot nicht gefunden",
  "Geçersiz durum": "Ungültiger Status",
  "Geçersiz PDF verisi": "Ungültige PDF-Daten",
  "Resend API anahtarı ayarlanmadı. Ayarlar'dan ekleyin.":
    "Resend API-Schlüssel ist nicht konfiguriert. Bitte in den Einstellungen hinzufügen.",
  "SMTP ayarları eksik": "SMTP-Einstellungen fehlen",
  "Desteklenmeyen e-posta sağlayıcı": "Nicht unterstützter E-Mail-Anbieter",
  "Paylaşım bulunamadı veya süresi doldu": "Freigabe nicht gefunden oder abgelaufen",
  "PDF çözümlenemedi": "PDF konnte nicht verarbeitet werden",
  "Dosya 5 MB'den büyük olamaz": "Die Datei darf nicht größer als 5 MB sein",
  "Geçersiz URL": "Ungültige URL",
  "URL bir görsel döndürmüyor": "Die URL liefert kein Bild zurück",
  "Bu e-posta ile kullanıcı zaten var": "Ein Benutzer mit dieser E-Mail existiert bereits",
  "Geçersiz rol": "Ungültige Rolle",
  "Güncellenecek alan yok": "Keine zu aktualisierenden Felder",
  "Kendinizi silemezsiniz": "Sie können sich nicht selbst löschen",
  "Beklenmedik bir hata oluştu. Lütfen tekrar deneyin.":
    "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
  "Bir hata oluştu": "Ein Fehler ist aufgetreten",
  "Resend domaininiz henüz doğrulanmamış. Şu an sadece kendi kayıtlı e-posta adresinize gönderebilirsiniz. Müşterilere gönderebilmek için resend.com/domains adresinden domaininizi doğrulayın ve Ayarlar > E-posta sekmesinden 'Gönderen E-posta'yı kendi domaininizden bir adres yapın.":
    "Ihre Resend-Domain ist noch nicht verifiziert. Derzeit können Sie nur an Ihre eigene registrierte E-Mail-Adresse senden. Um an Kunden zu senden, verifizieren Sie Ihre Domain unter resend.com/domains und stellen Sie unter Einstellungen > E-Mail die 'Absender-E-Mail' auf eine Adresse Ihrer eigenen Domain um.",
};

const NETWORK_DE = "Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung.";
const NETWORK_TR = "Ağ hatası. Lütfen bağlantınızı kontrol edin.";

const PATTERNS = [
  {
    re: /^Çok fazla başarısız giriş denemesi\. Lütfen (\d+) dakika sonra tekrar deneyin\.$/,
    de: (m) => `Zu viele fehlgeschlagene Anmeldeversuche. Bitte versuchen Sie es in ${m[1]} Minuten erneut.`,
  },
  {
    re: /^Bu müşterinin (\d+) adet teklifi var\. Silmek için onayınız gerekir\.$/,
    de: (m) => `Dieser Kunde hat ${m[1]} Angebot(e). Zum Löschen ist Ihre Bestätigung erforderlich.`,
  },
  {
    re: /^E-posta gönderilemedi: (.*)$/s,
    de: (m) => `E-Mail konnte nicht gesendet werden: ${m[1]}`,
  },
  {
    re: /^SMTP hatası: (.*)$/s,
    de: (m) => `SMTP-Fehler: ${m[1]}`,
  },
  {
    re: /^Görsel alınamadı: (.*)$/s,
    de: (m) => `Bild konnte nicht abgerufen werden: ${m[1]}`,
  },
  {
    re: /^Desteklenmeyen format\. İzinli: (.*)$/s,
    de: (m) => `Nicht unterstütztes Format. Erlaubt: ${m[1]}`,
  },
];

export function localizeError(detail, lang) {
  if (detail === "__network__") return lang === "de" ? NETWORK_DE : NETWORK_TR;
  if (lang !== "de" || !detail) return detail;
  if (EXACT[detail]) return EXACT[detail];
  for (const p of PATTERNS) {
    const m = detail.match(p.re);
    if (m) return p.de(m);
  }
  return detail;
}
