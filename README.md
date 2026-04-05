# Çalışma Takip

Kişisel çalışma / YDS / kitap / yatırım takibi — tarayıcıda çalışır; isteğe bağlı sunucu ile telefon ve bilgisayar arasında senkron.

## Canlı adres

**Uygulamayı buradan açabilirsiniz:** [https://calisma-takip.onrender.com/](https://calisma-takip.onrender.com/)

## Notlar

- İnternet senkronu ve hesap için **Ayarlar** ve **Giriş** sayfalarına bakın.
- Bu proje **Cursor** ile geliştirilmiştir.
- **Render ücretsiz** planda dosya sistemi kalıcı değildir; sunucu uyandığında veya yeniden deploy edildiğinde SQLite veritabanı (hesaplar) sıfırlanabilir. O zaman aynı adreste **Kayıt ol** ile hesabı yeniden oluşturmanız gerekir. Kalıcı veri için Render’da **Disk** (ücretli) + ortam değişkeni `CALISMA_DATA_DIR` veya harici veritabanı gerekir.

## Yerel çalıştırma

Sunucu (SQLite API + statik dosyalar):

```bash
cd server
npm install
npm start
```

Tarayıcıda `http://localhost:3000` (veya konsolda yazılan adresler).

## Lisans

Özel kullanım; gerektiğinde kendi lisansınızı ekleyin.
