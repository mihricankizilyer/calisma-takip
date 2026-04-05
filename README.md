# Çalışma Takip

Kişisel çalışma / YDS / kitap / yatırım takibi — tarayıcıda çalışır; isteğe bağlı sunucu ile telefon ve bilgisayar arasında senkron.

## Canlı adres

**Uygulamayı buradan açabilirsiniz:** [https://calisma-takip.onrender.com/](https://calisma-takip.onrender.com/)

## Notlar

- İnternet senkronu ve hesap için **Ayarlar** ve **Giriş** sayfalarına bakın.
- **Ayarlar → Günlük otomatik yedek:** seçilen saatte (varsayılan 23:58) tarayıcı açıkken tüm veriyi JSON olarak indirir; sekme kapalıysa o gün tetiklenmez.
- Bu proje **Cursor** ile geliştirilmiştir.
- **Kalıcı veri (önerilen):** [Neon](https://neon.tech) veya benzeri **bulut PostgreSQL** ücretsiz katmanı (ör. proje başına ~0,5 GB; çok proje açarak toplam alan artırılabilir). Sunucuda ortam değişkeni **`DATABASE_URL`** bu bağlantıyı gösterir; tablolar ilk çalıştırmada oluşur. **Render**’da Environment → `DATABASE_URL` = Neon’daki *Connection string* (gizli tutun). `DATABASE_URL` **yoksa** sunucu yereldeki **SQLite** dosyasını kullanır (Render ücretsiz diskte bu dosya sıfırlanabilir).

## Yerel çalıştırma

Sunucu (SQLite veya `DATABASE_URL` ile PostgreSQL + statik dosyalar):

```bash
cd server
npm install
npm start
```

Tarayıcıda `http://localhost:3000` (veya konsolda yazılan adresler).

## Lisans

Özel kullanım; gerektiğinde kendi lisansınızı ekleyin.
