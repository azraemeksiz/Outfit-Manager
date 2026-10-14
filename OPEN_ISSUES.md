# Açık Sorunlar ve Eksikler (denetim: 2026-10-14, branch stage-3-wear-tracking)

Yöntem: plan (`improvement_plan.md`, `TASKS.md`), `ALGORITHM_REVIEW.md`, `THESIS_GUIDE.md`, `SCHEDULE.md`, `SOURCES.md` okundu; kod satır satır kontrol edildi. `npx vitest run`: 5 dosya, 77 test geçti, 1 todo. `svelte-check`: 0 hata, 27 uyarı. Kod başka bir ajan tarafından eşzamanlı düzenleniyor; satır numaraları kayabilir. Doğrulanamayan maddeler "doğrulanmadı" diye işaretli. Hiçbir kaynak/atıf uydurulmadı.

Öncelik: **Kritik** = tezin değerlendirmesini veya canlı demoyu doğrudan etkiler; **Orta** = kalite/doğruluk; **Düşük** = kozmetik/ileride.

---

## 1. Planda var, yapılmadı

### Kritik

- **Aşama 5, ağırlıklar hâlâ 40/30/15/15, AHP yok.** `recommender.ts:234-237` (`w*40`, `c*30`, `p*15`, `h*15`). `src/lib/weights.ts` dosyası yok (`grep weights src` sadece başka dosyalarda geçen kelime). Formül hâlâ 4 kriter: Hava, Renk, Desen, Tazelik. Planın 6 kriterli formülünde (Hava, Renk, Siluet, Desen, Çeşitlilik, KişiselTercih) Siluet ve KişiselTercih kriteri kodda yok; Çeşitlilik ayrı kriter değil, sadece `selectDiverse` ceza mekanizması (`recommender.ts:338-373`). Kısmen yapıldı: yok denecek kadar. AHP anketi (kod dışı) da yapılmadı.
- **Aşama 5, "ekstra bonus yok" ihlal ediliyor.** `scoreColorAffinityBonus` (+0.12/eşleşme, max 0.3) `computeScore` içinde renk puanına ekleniyor (`recommender.ts:143-147, 214-216`). Ayrıca `co_occurrence` için `h + 0.3` ve `recent_repeat` için `h = 0` (`:227-231`) planın reddettiği "tekrar +0.3" bonusu. Plan bunların kaldırılmasını ve yerine Aşama 6'daki kişisel tercih kriterini koymayı istiyor.
- **Aşama 5, fit/length etiketi yok.** `types.ts` `Item` içinde `fit`/`length` alanı yok; `wardrobe/add` ve `wardrobe/edit` formlarında yok (grep: `fit|length|pattern_type` yalnızca renk/test dosyalarında alakasız geçiyor). Siluet puanı ve `styles.ts` içinde siluet eşleşmeleri yok (`StyleProfile` yalnızca `colorScores` içeriyor, `styles.ts:13-19`). Not: `thesis_planning.md` (eski) length'i hariç tutmuştu, TASKS v2 geri ekledi; çelişkide TASKS geçerli.
- **Aşama 5, stil tablosunda desen toleransı yok.** `scorePatternNorm` (`recommender.ts:135-141`) stilden bağımsız, sadece `patternAffinity`'ye bağlı. Stil tabloları sadece renk uyum tipini etkiliyor (kısmen yapıldı: stil seçici + 5 stil + renk tipi tabloları var, `styles.ts:21-52`, `suggest/+page.svelte:318-337`).
- **Aşama 6, geri bildirim tablosu ve öğrenme yok.** `supabase/migrations/` altında sadece `20261013_profiles_light_outerwear_pref.sql`. "Beğenmedim", "Başka göster" düğmesi yok (`suggest/+page.svelte`'de sadece Generate ve "Add to Calendar" var). `buildUserStyleProfile` (`recommender.ts:32-45`) hâlâ yürürlükte, plan bunu değiştirmeyi istiyor.
- **Aşama 7, onboarding yok.** Böyle bir route yok (`src/routes` altında yok). Stil "favori stiller" ayarı da yok (`settings/+page.svelte` yalnızca üç sıcaklık kaydırıcısı içeriyor; temel karar 9 "ayarlarda sadece favori stiller").
- **Aşama 8, Vercel deploy + demo hesap yok.** `svelte.config.js` adapter-auto, `package.json`'da `@sveltejs/adapter-vercel` yok; demo hesap/seed veri yok. THESIS_GUIDE §6: "çalışan uygulama gerekli: hakem başka bilgisayarda çalıştırabilmeli".
- **Aşama 8, README hâlâ `sv` şablonu.** `README.md` ilk satırı "# sv". Plan README'nin yeniden yazılmasını (AGPL notu dahil) istiyor.
- **Aşama 8, istatistik sayfası yok ve `SCHEDULE.md`'den çıkarılmadı.** `src/routes` altında stats/CSV/Excel yok; `SCHEDULE.md` "Statistics & Data Export" (CSV, Excel, en çok giyilen) satırı duruyor. Ya yapılmalı ya çıkarılmalı.
- **Aşama 1 ve 2 yapılmadı.**
  - Aşama 1: `@imgly/background-removal` deneyi `stage-1-bg-removal` branch'inde "yavaş, UI'yi kilitliyor" diye geri alınmış (commit 9c32943). `stage-1-upload-perf` branch'inde sıkıştırma + arka plan yükleme var (ea2d638), ama bu iki branch bu branch'te yok (`git log` ana hatta görünmüyor, merge edilmemiş). `wardrobe/add/+page.svelte:126-140` hâlâ ham dosyayı Cloudinary'ye yüklüyor, sıkıştırma/WebP yok, önizleme dışında arka plan yükleme durumu yok.
  - Aşama 2: `wardrobe/add:56-113` hâlâ 200x200 canvas, köşe tahmini ile arka plan çıkarma, 32'lik kuantizasyon, nötr (doygunluk < 0.2, beyaz/siyah) atma. Lab k-means yok, `colors: [{hex, share}]` yok (şu an `colors: string[]`, `types.ts:13`), düzenlenebilir yuvarlaklar sadece "seç" düzeyinde (ekle/sil yok), `pattern_type` yok (sadece `is_patterned: boolean`), "düz zemin" ipucu yok. Sonuç: siyah/beyaz/gri/bej parçalarda otomatik renk tespiti hâlâ boş kalır (ana renk varsayılan `#3b82f6` mavi kalır, `add:10`).
- **Aşama 4 kalanı:** occasion'da etiketsiz parça hâlâ her yere uygun (`recommender.ts:101-107`; "davranış konuşulacak" maddesi açık). Mevsim–sıcaklık, mont, aksesuar hava filtresi YAPILDI (`fitsWeather`, `outerwearMode`, testler 54-190).

### Orta

- **Aşama 3, "Bugün giydim" düğmesi yok.** `suggest/+page.svelte` ve `outfits/+page.svelte` içinde yok; sadece takvimden "Mark as Worn" var (`calendar:461-468`). Toplu "hepsini temiz yap" yok (`wardrobe/+page.svelte` yalnızca tek tek durum döngüsü, `:12, :50`).
- **Aşama 3, ileri tarihli kayıt onaysız giyilmiş sayılmamalı ama "Mark as Worn" gelecekteki bir tarih için de açılıyor.** `calendar:461` koşulu yalnızca `!is_worn`; tarih kontrolü yok (grep: `future/today` yok). Geleceğe ait bir kombin yanlışlıkla giyilmiş işaretlenip `last_worn_date` geleceğe yazılabilir. Plan "onaysız giyilmiş sayılmaz" diyor: `suggest` sadece `is_worn=true` çekiyor (`suggest:115`), bu kısım doğru; ama onay yolu sınırsız.
- **Aşama 3 yapılan kısımlar:** `confirmWorn` kaydın tarihini yazıyor ve geriye gitmiyor (`calendar:177-197`), `recent_repeat_date` kaldırıldı (grep sadece bir negatif test).
- **Aşama 5, ayakkabı/mont/aksesuar: kısmen.** Her üst-alt çifti için ayrı seçiliyor (`pickComplement`, `recommender.ts:264-270, 288-295`). Ama aksesuar için hava ağırlığı 0 (`:294`), tek aksesuar, alt türü yok.
- **Aşama 5, statement piece kuralı yok** (grep `statement` boş). Palet oranlı renk yok (oran verisi yok, bkz. Aşama 2).
- **Aşama 5, "Başka göster" yok, her öneride "kısa gerekçe" yok.** Puan dökümü var (`suggest:366-396`) ama gerekçe cümlesi yok.
- **Aşama 5, "Çeşitlilik: uzun süredir giyilmeyen öne çıkar" yapıldı** (`FRESHNESS_STEPS`, `recommender.ts:177-196`).
- **Aşama 9 UI yeniden tasarım:** başlanmadı (planlandığı gibi en sona).

### Kod dışı tez işleri (plandan)
- AHP formu/anketi ve tutarlılık oranı: yok. v1 vs v2 ölçümü: yok (bkz. bölüm 4). Related work tablosu: yok. Kullanıcı testi: yok.
- Not: `v1-baseline` tag'i VAR ve `a1fcb3b`'yi gösteriyor (hafızadaki "ertelendi" notu güncel değil).

---

## 2. ALGORITHM_REVIEW.md maddeleri: durum

Not: `ALGORITHM_REVIEW.md` branch'i `stage-4-hard-filters` için yazılmış; kod sonra değişti.

| Madde | Durum | Kanıt |
|---|---|---|
| **K1** Dış giyim heat eşiğinin altında hep ekleniyor | **Düzeltildi** | `outerwearMode` (`recommender.ts:59-67`), `fitsWeather` (`:74-84`), testler `recommender.test.ts:54-155` (24°C'de all-season mont yok, soğukta zorunlu, `outerwearMissing`). |
| **K2** Ayakkabı/mont/aksesuar bağlam-körü, beraberlikte son eleman | **Kısmen** | Düzeldi: her çift için renk uyumuyla seçim (`pickComplement`, `:264-295`), beraberlikte ilk eleman (deterministik, `:249-262`, ama "ilk" = DB sırası, anlamlı ikinci kriter yok). Açık: ılık havada kışlık bot / yazlık sandalet eşit (`scoreWeatherNorm` 0.7, `:131`) ve ayrım yok; tek aksesuar; etiketsiz ayakkabı occasion'a bakmıyor; "Generate" aynı girdi için aynı sonuç (rastgelelik/"Başka göster" yok). |
| **K3** En fazla 3 sonuç, aynı parça yasak | **Düzeltildi** (öneri açıklaması hariç) | `DEFAULT_RESULT_LIMIT = 10`, `REPEAT_PENALTY` ile yumuşak çeşitlilik (`:336-373`), ölü dedupe silindi, testler `:198-226`. Açık: sonuç sayısı az çıkarsa nedeni söylenmiyor (bkz. K5/D5). |
| **K4** Tazelik ters mantık, ölü alan | **Kısmen** | Düzeldi: monoton eğri (`:177-196`), `recent_repeat_date` kaldırıldı, `confirmWorn` kayıt tarihini yazıyor (`calendar:177-197`). Açık: planlı ama giyilmeyen (`is_worn=false`) kombin hiç sayılmıyor (`suggest:115`), kullanıcı kaydedip tekrar üretince aynı kombin yine çıkabilir; ayakkabı/aksesuar/dış giyim geçmişi cezalandırılmıyor (`coreItems`, `:208`); `recent_repeat` hâlâ yalnızca h=0 (puan düşüşü -15, hard filtre değil, `:227-228`); `checkCombinationHistory` doğrudan test edilmemiş (testlerde `co_occurrence/recent_repeat` grep sonucu yok); `calendar:187-199` döngüde sırayla `await`, hata kontrolü yok. |
| **K5** Sıcaklık bilinmiyor / manuel giriş yok | **Kısmen** | Düzeldi: manuel kaydırıcı (`suggest:255-279`). Açık: Generate düğmesi `weatherLoading` iken kapanmıyor (`suggest:339` sadece `loading`), hava gelince öneriler yenilenmiyor; sıcaklık null → dış giyim yok ve sıcaklık filtresi yok (`outerwearMode:60`); hâlâ tek saatlik `apparent_temperature[hour]` (`suggest:57-58`), gün min/max yok; boş sonuç mesajı hava nedenini söylemiyor (`suggest:348-349`, `it.todo` `recommender.test.ts:340`). Saat dilimi indeksi: doğrulanmadı. |
| **O1** Occasion etiketsiz = her yere uygun | **Açık** | `recommender.ts:101-107` ve `wardrobe/add:12` (`occasions = []`). Eşleşme ödüllendirilmiyor. |
| **O2** Mevsim etiketi varsayılan boş | **Açık (kısmen hafiflemiş)** | `wardrobe/add:11` hâlâ `seasons = []`; filtre artık tüm kategorilerde çalışıyor ama etiketsiz parça hâlâ geçiyor (`:92`). |
| **O3** Elbise yolu / Indoor tutarsızlığı | **Kısmen** | Düzeldi: `outerwearMode` Indoor'da `none` (`:60`), test `recommender.test.ts:142-155`. Açık: elbise için desen sabit 0.75 (`:218`), elbise puanı üst+alt ile adil karşılaştırılamıyor; elbiseye hırka/üst katman yok (gelecek çalışma sayılabilir). |
| **O4** Ağırlık/eşik sorunları | **Açık** | Hava skoru tüm parçaların ortalaması (`:210-212`); `total >= 30` eşiği (`:298, :321`); hava etiketsizde 0.7 (`:114`), null/Indoor 0.5. Ağırlıklar AHP'siz (bkz. bölüm 1). |
| **O5** Renk: nötrler, çoklu renk | **Düzeltildi** (modelde) | Tek model `colorHarmony.ts` (nötr/vurgu/monokrom/analog/zıt/karışık/çatışan, lacivert/bej/kahve/kot nötr: `:82-88`), parça başına 3 renk (`:153-170`). Açık: açık-koyu kontrastı yok, palet oranı yok. Eski test (siyah+beyaz) artık geçiyor (`recommender.test.ts:318`). |
| **O6** Ayakkabı renk skoru gri hue | **Düzeltildi** | Ayrı ayakkabı renk fonksiyonu kalktı (grep `scoreShoeColorNorm` boş); ayakkabı da `scoreOutfitColor` ile. |
| **O7** Aksesuar renk (gümüş ölü, dairesel ortalama) | **Düzeltildi** (renk tarafı) | Altın/gümüş mantığı kaldırıldı, aksesuar aynı model. Açık: aksesuar alt türü yok. |
| **O8** Desen skoru | **Açık** | `scorePatternNorm` değişmedi (`:135-141`); bir desenli + bir düz her zaman 1.0; minimum örneklem eşiği yok (`buildUserStyleProfile:34`, 1 kayıt yeter). |
| **O9** Renk afinitesi tam hex eşitliği | **Açık** | `:143-147`, `:38` (birebir `selected_color` karşılaştırması); "Your palette" rozeti (`suggest:387`) aynı sorunu taşıyor. |
| **O10** Mild aralıkta gevşek mevsim filtresi | **Kısmen** | Sıcak/soğukta tüm kategoriler filtreleniyor (`:88-98`); mild'de ve eşik çevresinde tampon yok, hâlâ gevşek. |
| **O11** cold > heat tanımsız | **Açık** | `settings:` soğuk kaydırıcı -10..20, sıcak 15..40 (örtüşür, `:120-124, :144-148`), doğrulama yok; `fitsWeather` önce `hot`'a bakıyor (`:96`); `outerwearMode` `Math.min(..., heatThreshold)` yalnızca açık sınırı kırpıyor. |
| **D1** Performans | **Kısmen** | Dedupe silindi; ama T×B çift için `pickComplement` içinde `scoreOutfitColor` çok kez çağrılıyor (`:288-295`) ve `selectDiverse` O(n²·limit); ölçülmedi, doğrulanmadı. |
| **D2** Eski `wardrobe/new` büyük harfli değerler | **Açık** | `wardrobe/new/+page.svelte:14-16` hâlâ `'Top'`, `'Autumn'` yazıyor; sayfaya link yok (`grep wardrobe/new src` sadece kendi dosyası). Silinmeli. Eski DB kayıtları: doğrulanmadı. |
| **D3** Geçersiz hex | **Düzeltildi** | `parseHex` 3/6 hane doğruluyor, geçersizi yok sayıyor (`colorHarmony.ts:47-53`). |
| **D4** `id` falsy / boş kategori | **Düzeltildi** (id), **açık** (boş kategori sessizce yok sayılıyor, `:277-282`). |
| **D5** Boş sonuç nedeni, test boşlukları | **Kısmen** | Çok test eklendi (77). Açık: `checkCombinationHistory`, cold>heat, `it.todo` (boş sonuç açıklaması), UI testi hiç yok. |

---

## 3. Yeni bulunan sorunlar

### Kritik

1. **Migration uygulanmazsa Ayarlar/Öneri bozulur.** `settings/+page.svelte:20, 43` ve `suggest/+page.svelte:94` `profiles.light_outerwear_max_pref` kolonunu seçiyor/yazıyor. Kolon yoksa (örn. demo/yeni Supabase projesi) `save` hata verir (`Error: ...`) ve `suggest`'te profil sorgusu hata döner, `profile` null kalır ve eşikler sessizce varsayılana düşer (hata gösterilmez). Migration yalnızca elle SQL Editor ile uygulanıyor (`supabase/migrations/20261013_*.sql`); canlı Supabase'de uygulandığı kodda doğrulanamaz ("doğrulanmadı"). Ayrıca şemanın tamamı (items, outfits, calendar_entries, profiles, RLS politikaları) repoda yok; sadece bu tek migration var. Demo/kurulum ve tezin "Database Design" bölümü için tam şema SQL'i + RLS gerekli.
2. **RLS ve güvenlik doğrulaması repoda yok.** SCHEDULE "RLS enforcement" ve "RLS security verification" diyor; RLS politikası veya testi yok, `edit/[id]` gibi sayfalar `user_id` filtresiz `id` ile sorguluyor olabilir (doğrulanmadı, RLS'e güveniyor olabilir). Tez/savunmada sorulacak konu.
3. **Fotoğraf yükleme hatası olursa tüm ekleme iptal; arka plan yükleme yok, sıkıştırma yok.** `wardrobe/add:126-140, 155-166`. Aşama 1'in perf branch'i (`stage-1-upload-perf`) merge edilmemiş; mobil fotoğraf (birkaç MB) doğrudan yüklenir.
4. **`.env` ve anahtarlar:** `.env` `.gitignore`'da (`git check-ignore .env` .env döndürdü), ama `VITE_CLOUDINARY_UPLOAD_PRESET` istemciye gömülü; unsigned preset kötüye kullanım riski (kota). Doğrulanmadı: preset kısıtları.

### Orta

5. **Hata yönetimi eksik (Aşama 8).** Kontrolsüz Supabase çağrıları: `calendar:95, 97, 110, 187-199` (hata yok sayılıyor, kısmi yazma mümkün); `wardrobe/+page.svelte:36, 45, 56` hata olunca sessiz; `suggest:92-121` sorgu hataları hiç gösterilmiyor. Boş durum mesajları yetersiz (örn. gardırop boşken Generate'in "ne yapmalı" bilgisi yok).
6. **Arayüz dili İngilizce, kullanıcı Türkçe.** Tüm sayfalar İngilizce (`suggest`, `settings`, `calendar`, `wardrobe/add`; `app.html:2` `lang="en"`). Tez İngilizce olacağı için bilinçli olabilir; ama kararın yazılı olması gerek ("doğrulanmadı", kullanıcı tercihi). Ayrıca `suggest/+page.svelte:175` tarih `en-US`.
7. **`suggest` sayfasında stil/occasion seçimi kalıcı değil, favori stil yok** (temel karar 9: ayarlarda favori stiller). Eksik.
8. **`harmonyLabels`, `scoreBadgeColor` içinde tutarsız renk:** `suggest:128` `bg-blue-50 text-pink-500` (mavi arka plan + pembe yazı) muhtemelen tema değişiminden kalma hata.
9. **Erişilebilirlik uyarıları (27 svelte-check uyarısı).** Modal `role="dialog"` ama `tabindex` ve klavye olayı yok: `calendar:373, 475`, `suggest:442`. Etiketsiz form `<label>`ları: `wardrobe/add:201, 224, 230, 242, 257, 273, 299`, `edit/[id]` (6), `new` (5). İkon düğmeleri `aria-label`siz: `wardrobe/+page.svelte:130`, `wardrobe/add:285` (self-closing `<button />` uyarısı da var). Klavyeyle kullanım, bu hâliyle zor; tezde kısa bir sınırlılık notu veya düzeltme.
10. **`suggest` ve `calendar` kodunda `any`:** `calendar:145, 160-164, 170`; Aşama 0'ın "any yerine tipler" hedefi calendar için tamamlanmamış.
11. **Çalışan olmayan/yanıltıcı UI:** "Your Style Profile" "Bold & Patterned / Clean & Minimal" yalnızca desen oranından türüyor (`suggest:287-289`), planın "stil" kavramıyla karışabilir; öğrenme kriteri Aşama 6'da yeniden yazılacak.
12. **Sınır durumları:** `suggest` yalnızca `status='Clean'` çekiyor (`:106`), kirli parça kombinde varsa takvimde uyarı var, öneri sayfasında yok. Hava `timezone=auto` + tarayıcı saati (`:57`) uyumsuz olabilir (doğrulanmadı).
13. **Test boşlukları:** `wardrobe/add`, `calendar`, ayarlar ve Supabase etkileşimleri için hiç test yok; recommender dışında kalan her şey elle test. Tez "Tests" bölümünde bu sınır belirtilmeli.

### Düşük

14. **Takip edilmeyen dosya:** `src/lib/scratch_styles.test.ts` (git status: `??`). Muhtemelen geçici; commit'e girmeden silinmeli veya gerçek teste dönüştürülmeli (bu denetimde dosyaya dokunulmadı).
15. **Ölü kod/dosya:** `wardrobe/new/+page.svelte` (D2); `src/lib/index.ts` 1 satır; `types.ts` `ItemStatus = 'Clean' | 'Dirty'` ama uygulama `Laundry`/`Drying` de kullanıyor (`wardrobe/+page.svelte:12`).
16. **`static/manifest.json` var, `app.html:5` theme-color `#2D60FF` (mavi) ama tema pembe `#ec4899` (`+layout.svelte`)**; tutarsız. PWA ikonları/service worker: doğrulanmadı.
17. **Lisans/atıf:** Aşama 1 (`@imgly`, AGPL) uygulanırsa README + tez notu zorunlu; şimdilik yok. Bağımlılıkta kullanılmıyor. Cloudinary ücretsiz kota sınırı belgelenmemiş.
18. **Hafıza/doküman çelişkisi:** `thesis_planning.md` (eski) fit için "sadece 2 seçenek, length yok" derken `TASKS.md` v2 3 seçenek + length istiyor. Karar kayıt altına alınmalı (kullanıcı dosyası).

---

## 4. Tez için eksikler (THESIS_GUIDE değerlendirme ölçütleri)

### Kritik

1. **Kriter 5 (0-15, en büyük kalem): "önce/sonra ölçümleri" yok.** `v1-baseline` tag'i var (`a1fcb3b`) ama v1'de koşturulabilir senaryo seti ve sonuç tablosu yok. Yapılması gereken: aynı senaryo testlerini (siyah+beyaz 69<78 vb.) v1 ve güncel kod için çalıştırıp tablo üretmek (kod/komut: tag'i ayrı klasöre checkout edip testleri koşmak; `recommender.ts` v1'de yok, algoritma `suggest/+page.svelte` içinde, adaptasyon gerek).
2. **Kriter 1 ve 5: AHP yok.** 6 kriter, 15 karşılaştırma, 3-5 kişi, tutarlılık oranı, `weights.ts`: hiçbiri yapılmadı. Şu anki 40/30/15/15 gerekçesiz (savunma: "tasarım gerekçesi" notu yazılabilir ama plan AHP diyor).
3. **Kullanıcı testi yok.** Planlanan test (kombin çiftlerinde tercih vs algoritma sıralaması) için ne soru formu, ne kombin çifti üreten araç, ne de katılımcı verisi var. Stil tabloları "başlangıç hipotezi" (`styles.ts:7-9`, `SOURCES.md §3-4`); doğrulama olmadan tezde iddia edilemez.
4. **Çalışan, deploy edilmiş uygulama yok** (Vercel + demo hesap; THESIS_GUIDE §5 kriter 5 ve §6). Demo için seed gardırop (fotoğraflar telifsiz) da yok.
5. **Kaynaklar doğrulanmadı.** `SOURCES.md` kendisi "hiçbiri tam metin okunarak doğrulanmadı" diyor; Crossref ile teyit edilen yalnızca Cohen-Or 2006, Deng 2010, Kiapour 2014. **Saaty (AHP), Itten baskısı, Matsuda künyesi hâlâ doğrulanmadı veya listelenmemiş** (Matsuda satırı bilerek boş). Stile özgü hakemli kaynak bulunamadı (Girl casual: hiç kaynak yok). Tez referans listesi için kullanılmadan önce kaynağın kendisinden kontrol edilmeli.

### Orta

6. **Related work tablosu yok** (Whering, Acloset, Stylebook, Indyx, Cladwell); ML'e karşı kural tabanlı tartışması (Han 2017, Vasileva 2018, Burke, Felfernig: THESIS_GUIDE §2'de "kaynaklar doğrulanacak") yazılmadı; hiçbiri `SOURCES.md`'de yok.
7. **"Phases, experiences, problems" bölümü için `KNOWN_ISSUES.md` yok** (THESIS_GUIDE §2 bu dosyaya atıf yapıyor; kökte yok). Karar günlüğü (neden SvelteKit/Supabase/Cloudinary/Open-Meteo, reddedilen alternatifler) yazılı değil; sadece hafıza dosyalarında dağınık. `imgly` deneyi gibi başarısız denemeler (commit 9c32943) tez için değerli, kayıt altına alınmalı.
8. **Test kanıtı:** 77 test var ama çıktı/rapor dosyası yok; tezde "Tests" bölümü için ekran görüntüsü/tablo ve "bilinçli başarısız → geçen" geçmişi (Aşama 0'daki 3 başarısız test) git geçmişinden derlenmeli. Kapsam ölçümü (`vitest --coverage`) yapılmadı, `@vitest/coverage-*` bağımlılığı yok.
9. **Formüller ve şekiller:** THESIS_GUIDE §3 denklem düzenleyici ve numaralı şekil ister; puan formülü, renk uyum tipi akış şeması, mimari şema henüz çizilmedi. Formül kod ile tutarlı olmalı: kod hâlâ 4 kriter (bölüm 1), tezde yazılacak 6 kriterli formül kodla uyuşmuyor, bu fark kapanmadan yazılırsa yanlış olur.
10. **Güncel sürüm uyumsuzluğu riski:** `SCHEDULE.md` ("ColorThief", "Cloudinary AI background removal", "HSL color harmony scoring", "behavioral history weighting") gerçeklikten sapmış (ColorThief yok, Cloudinary arka plan silme kullanılmıyor, HSL uyumu artık harmoni tipi). Tezin "Specification" bölümünde eski planın güncellenmesi veya sapmaların gerekçelendirilmesi gerekir.

### Düşük / idari (THESIS_GUIDE §1 ve §7)

11. Kapak, başlık sayfası, görev tanımı (Iványi imzası), imzalı beyan (`declaration-2025.docx`), içindekiler, Summary, References, Appendix: hiçbiri yok (kod dışı). Açık sorular listesi (§7: ön savunma tarihi, sayfa aralığı, basılı nüsha/fotoğraf, görev tanımını kimin dolduracağı) cevaplanmamış.
12. Danışman onayı: `thesis_planning.md` 2026-09-22'de mesaj atıldı, onay durumu kayıtlı değil (doğrulanmadı).
13. Kaynak kodun teslimi: repo özel mi/herkese açık mı, Neptun'a link mi: belirsiz (doğrulanmadı).
14. Dil ve biçim kuralları (Times New Roman 12, 1,5 satır, kenar boşlukları, kaynakça sırası) tez yazım aşamasına ait; şimdilik iş yok.

---

## Başlangıç için önerilen sıra (bilgi amaçlı, onaysız aşamaya dokunulmaz)
1. Migration'ı canlı Supabase'de doğrula ve tam şema + RLS SQL'ini repoya ekle (bölüm 3-1, 3-2).
2. Aşama 5'in eksik çekirdeği: ekstra bonusları kaldır, `weights.ts` oluştur, `scorePatternNorm`'ı stile bağla (bölüm 1).
3. v1 vs güncel ölçüm tablosunu üret (bölüm 4-1) ve AHP anketini başlat (4-2).
4. Vercel deploy + demo hesap + README (bölüm 1, 4-4).
5. Boş sonuç nedeni, hata yönetimi, `wardrobe/new` silme, erişilebilirlik uyarıları.
