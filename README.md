# Moongrove (dev)

**Moongrove — Evolution Match Puzzle · v1.0.0** · Elchin Jabbarli

Türkçe özet: Bu repo oyunun **dev kısmıdır** (TypeScript + CSS kaynak kodu ve derleme araçları).
`npm run build` çıktısı `dist/` klasörüne yazılır; `npm run deploy` bu çıktıyı yanbardaki
public oyun reposuna (`../moongrove`) kopyalar. Public repoda token/API anahtarı yoktur.

## Yapı

```
src/        TypeScript kaynak (motor, seviye üreteci, sanat, ses, UI, reklam/IAP adaptörleri)
site/       Statik site iskeleti (index.html, privacy, robots, .nojekyll)
tools/      build / verify / serve / deploy + ikon üreteci
dist/       Derleme çıktısı (git'e girmez; deploy edilen içerik)
```

## Komutlar

```bash
npm install
npm run build     # tsc tip kontrolü + esbuild bundle → dist/
npm run verify    # 1000 seviyenin eğrisini ve tam temizlenebilirliği doğrular
npm run serve     # http://localhost:8080 (dist/)
npm run deploy    # dist/ → ../moongrove (public repo)
python3 tools/icons.py   # ikonları yeniden üret (dist/icons)
```

## Versiyon politikası

Tek kaynak `src/version.ts` → `VERSION = '1.0.0'`. Build, `package.json` ve
`manifest.webmanifest` ile eşleşmeyi zorunlu kılar; uyuşmazlıkta derleme durur.
Repo etiketi, README ve oyun içi "About" aynı sürümü kullanır.

## iOS / App Store (Capacitor)

1. `npm i @capacitor/core @capacitor/cli @capacitor/ios`
2. `npx cap init Moongrove com.elchinjabbarli.moongrove --web-dir dist`
3. `npx cap add ios && npx cap sync && npx cap open ios`
4. Reklamlar: `src/config.ts` içindeki `ADMOB_*` alanlarını doldur,
   `@capacitor-community/admob` kur, tekrar `npm run build && npx cap sync`.
   ID'ler boş kaldıkça reklamlar devre dışıdır — web sürümüne asla sızmaz.
5. Satın alımlar: ürünler `src/config.ts` → `PRODUCTS` içinde
   (`com.elchinjabbarli.moongrove.*`). App Store Connect'te aynı ID'leri oluştur;
   RevenueCat veya capacitor-purchase eklentisini kur, adaptör otomatik köprüler.
6. ATT/reklam tercihi ekranı oyuna gömülüdür (yalnızca reklam aktifken görünür).

Görseller tamamen prosedüreldir (kod ile çizilir); harici font, ses veya görsel dosyası yoktur.
