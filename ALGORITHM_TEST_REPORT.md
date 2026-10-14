# Algoritma Test Raporu (kesif testi)

Dal: stage-3-wear-tracking. Yontem: gecici vitest dosyalariyla gercek `filterItems` + `generateOutfitCombinations` calistirildi (hepsi silindi). Kaynak/test dosyalarina dokunulmadi. `now` sabit: 2026-10-14. Esikler varsayilan (cold 15, heat 25) aksi belirtilmedikce.

Taranan matris: 25 parcalik ogrenci dolabi x 8 sicaklik (-5,5,12,17,22,28,35,null) x 6 durum ("" + 5 occasion) x 6 stil (stilsiz + 5) = 288 kosu. Ek dolaplar: 12 parca minimal kapsul, 22 parca maximalist, 12 parca sporty, 2 ust+1 alt minik dolap, bozuk veri dolabi, 120/300/600 parca performans dolaplari.

## Ozet: ilk 5 bulgu

1. **(Orta-Kritik) Performans kareli buyuyor**: 120 parca (42 ust x 30 alt) ~0.26 s, 300 parca ~3.0 s, 600 parca ~22 s. Ana is parcacigini bloke eder; 300 parcada UI gozle gorulur donar.
2. **(Orta) Occasion etiketi "avantaj" saglamiyor**: etiketsiz parca her occasion'da gecer ve etiketli parcayla esit puanlanir. Formal'de en iyi oneri `black tee + jeans + denim jacket + boots` (93) iken, Formal etiketli `dress shirt + wool trousers` (88) onun gerisinde. Stil de occasion'dan bagimsiz: Party+Sporty = Casual+Sporty ile ayni cikti.
3. **(Orta) Ara sicaklik bolgesinde (cold..heat) mevsim cezasi yok**: 16 C'de yaz-only `shorts + sunglasses`, 23-24 C'de kis-only `boots`, `wool trousers`, `scarf` ust sirada. Hepsi 0.7 (all-season ile ayni) puan aliyor.
4. **(Orta) Ayakkabi/dis giyim/aksesuar her zaman ekleniyor ve 10 onerinin hepsinde ayni**: Ogrenci dolabi top-10'unda her outfit'te `denim jacket + sneakers`; bu parcalar renk uyumunu bozsa bile "yok" secenegi yok (maximalist dolapta Minimal stil top-10'u tamamen `clash`, puan 57-64).
5. **(Orta) Sonuc, dolap sirasina bagli** (esitlik kirma = listedeki ilk): dolap ters cevrilince ayni stil/sicaklikta jacket `denim jacket` yerine `trench`, ayakkabi `sneakers` yerine `oxford` secildi, top-10 degisti. Ayrica bozuk tarihli `wornHistory` kaydi sessizce `co_occurrence` bonusu veriyor.

Calisan seyler (dogrulandi): 288 kosuda hicbir cikti mantik ihlali vermedi - sicak havada kis-only parca yok, soguk havada yaz-only yok, outerwear sicakta yok, dress+ust/alt cakismasi yok, ayni parca iki kez yok, zorunlu kategori eksigi yok, skor 0..100, max toplami her zaman 100, bilesen toplami = total, NaN yok, occasion ihlali yok. 5 stil gercekten farkli top-10 uretiyor (ogrenci: 6 varyantin 6'si farkli, ortalama ortusme 3-4/10). Ayni parca top-10'da en fazla 4'ten az kez (hicbir kosuda 5 tekrar yok). Cok kucuk dolap (2 ust+1 alt) 2 oneri veriyor, cokmuyor; sadece-elbise dolabi calisiyor; bos dolap `[]` donuyor.

---

## 1. Mantik ihlalleri

Bulunamadi (yukaridaki liste). Yan notlar:

- **[Dusuk] cold > heat (kullanici hatasi)**: cold=25, heat=15, 20 C -> `shorts + sandals + denim jacket` (ayni anda "sicak" ve "soguk"). `hot` once kontrol edildigi icin sicak parcalar secilir, ama outerwearMode "required" olur. Tekrar uretme: `{temperature:20, coldThreshold:25, heatThreshold:15}`. Oneri: ayarlarda `cold <= heat` dogrulamasi / otomatik duzeltme.
- **[Dusuk] Sinir degerleri**: 20 C'de (cold+5) hafif ceket var, 20.1 C'de yok - kasitli, tutarli. `temperature = NaN` outerwear'siz calisiyor (null gibi).
- **[Dusuk] Soguk + ceket yok**: `outerwearMissing=true` bayragi dogru set ediliyor (minik dolap 0 C, summer+winter etiketli parca 5 C). UI'in bunu gosterdiginden emin ol.
- **[Dusuk] Indoor**: hava filtresi kapali oldugu icin Indoor'da `scarf`/`sunglasses` aksesuar olarak oneriliyor (5 C Indoor: `white tee + jeans + sneakers + sunglasses`). Tasarim geregi ama garip gorunur.

## 2. Occasion x Stil (ogrenci dolabi, 20 C, ilk oneri)

| Occasion \ Stil | minimal | streetwear | girl-casual | sporty | maximalist |
|---|---|---|---|---|---|
| Casual | white tee+jeans+denim jacket+sneakers | grey hoodie+jeans+... | floral blouse+jeans (fitted) | white tee+jeans | floral blouse+green skirt (mixed) |
| Sport | black tee+jeans+jacket+sneakers | grey hoodie+jeans | striped shirt+green skirt | black tee+jeans | striped shirt+green skirt |
| Indoor | white tee+jeans+sneakers (ceket yok) | striped shirt+sweatpants | wool sweater+black jeans | white tee+jeans | striped shirt+green skirt |
| Party | black tee+jeans+jacket+**boots** | striped shirt+jeans | floral blouse+jeans | black tee+jeans | floral blouse+green skirt |
| Formal | black tee+jeans+jacket+**boots** | striped shirt+jeans | floral blouse+jeans | black tee+jeans | floral blouse+green skirt |

Gozlemler (dogrulandi):
- 25 hucrenin hicbiri bos degil (ogrenci dolabi). 10'ar sonuc.
- **Stil, occasion'i hic etkilemiyor**: Party/Formal/Sport/Casual altinda ayni stil ayni ucluyu veriyor (ornegin Sporty icin Party, Formal, Casual hep `black/white tee + jeans`). Formal+Streetwear = `striped shirt + jeans + denim jacket + boots` (89 yerine tisort/dress shirt cikmiyor); Formal+Sporty: dress shirt+jeans ya da black dress 92/90 - makul ama tesaduf.
- **Formal icin etiketsiz `black tee + jeans` 93 ile 1. sirada**, `dress shirt + wool trousers` (Formal-etiketli) 88. Etiketsiz = herkese uygun varsayiliyor. Orta.
- **Sport + Minimal/Maximalist**: Sport'ta tek tek parca etiketi `Sport` olan `grey hoodie, shorts, sweatpants` var ama top-1 `black tee + jeans + denim jacket` (jeans Sport etiketsiz). Spor icin kot sonucu sacma degil ama beklenmedik. Sport + Maximalist = `striped shirt + green skirt + denim jacket` (etek+gomlek spor icin tuhaf).
- **Sporty dolabi (12 parca, tum parcalar Sport/Casual/Indoor etiketli): Party ve Formal 5/20/30 C'de 0 sonuc; Indoor sadece 1 sonuc; Casual 2-4 sonuc.** Kullaniciya bos liste cikar, neden aciklanmaz. Orta (tekrar uret: sporty dolap, occasion Formal).
- Sicak/soguk: 5 C'de her hucre `winter coat + boots + scarf` (dogru). Indoor 5 C'de ceket yok (kasitli).

**Oneri**: (a) `occasion` secilince etiketi o occasion'u acikca iceren parcaya +bonus (ornegin +1.0 puan ya da secim skoruna +0.1), etiketsize degil; (b) kucuk bir `STYLE_OCCASION_FIT` ipucu tablosu: Sporty x Formal/Party, Maximalist x Sport/Formal, Streetwear x Formal icin 0.6-0.7 carpan ya da UI'da "bu stil bu duruma pek uymuyor" uyarisi; sert yasak degil (stil dokumaninda "stil asla yasaklamaz" kurali var); (c) bos sonuc durumunda "etiketlerin occasion X'i icermiyor, etiketsiz parcalari da dahil et" onerisi; (d) test: her stil x occasion icin etiketli parcanin etiketsize gore ustte cikmasi + bos sonuc mesaji.

## 3. Stil davranisi

- **Farkli top-10**: ogrenci dolabi 6 varyant (stilsiz + 5) -> 6 farkli liste (ortusme 1-8/10). Maximalist dolap: 6/6 farkli (ortusme ort. 3). Sporty dolap 5 C: 6 varyanttan sadece 4'u farkli (ortusme 6/10, dolap cok kucuk).
- **Minimal kapsul (12 notr parca) stilleri neredeyse ayirmiyor**: ortalama ortusme 8.7/10, min 8, 5 farkli liste. Hepsi notr oldugu icin renk/ton farki yok; sadece silhouette etkili. Beklenen davranis; tezde "notr dolapta stil farki azdir" notu dusulebilir.
- **Stil zayif dolabi surukleyebilir**: Maximalist dolapta Minimal stilinin top-10'u 10/10 `clash` (puan 57-64), cunku her outfit'e ayni sari ayakkabi + mor canta + mor ceket ekleniyor (bkz. Bulgu 4). Minimal'in sevmedigi (clash 0.2) bir outfit'i "en iyi" olarak sunuyor; en az renk iceren cift (ornegin `black+white`) outfit'ler ust siralara cikmiyor cunku o dolapta zaten yok. Yani stil kotu outfit'i *promote* etmiyor, ama mevcut en iyiyi de iyilestirmiyor (aksesuar eklemeyi birakamiyor).
- **Bilesen varyansi (ogrenci, 22 C, 50 kombinasyon)**: agirlik sapmasi weather sd 2.1 (aralik 28-34/40), renk sd 1.7-3.9, silhouette sd 0.9-3.4, history sd 0 (gecmis yoksa hepsi ayni). Yani hava durumu puani genis bir sabit taban saglar ama siralamayi domine etmez; en cok ayiran renk (Minimal) ve silhouette (Streetwear). Stil etkisiz kalmiyor. Gecmis (last_worn_date) yarisi yakin giyildiyse top-10'dan eleniyor (dogrulandi).
- **Esitlik kirma**: `selectDiverse` puan -> history -> color ile siralar (deterministik), ama `pickComplement`/`pickBest` esitlikte listedeki *ilk* parcayi secer. Ayni dolap ters siralaninca jacket/ayakkabi degisti ve top-10 farkli cikti (ornek: `denim jacket` vs `trench`, `sneakers` vs `oxford`). DB'den gelen sira (ornegin id) degisince ayni kullaniciya farkli oneri. Orta. Duzeltme: esitlikte `id` ya da `last_worn_date` (en eski) ile kir; ya da ikinci-seviye anahtar olarak parca adi.
- **Cesitlilik cezasi**: ayni ust/alt/dress hicbir kosuda 5 kez cikmadi; ama ceket/ayakkabi/aksesuar cezaya dahil degil (CORE_CATEGORIES) ve ogrenci dolabinda top-10'un 10'unda da ayni `denim jacket + sneakers + sunglasses` (stilsiz 2 aksesuar: scarf/sunglasses). Yani yan parcalarda cesitlilik yok. Orta.
- Klon (ayni renk) parcalar esit puan alip hepsi listeleniyor (3 ayni beyaz tisort -> 3 oneri); kabul edilebilir.

## 4. Veri saglamligi

Cokme yok, NaN yok (18 bozuk-veri outfit'i tarandi).
- **null/bos/`'red'` (isim) / `'#ff0000ff'` (8 hane) renk**: sessizce yok sayiliyor; rengi olmayan outfit renk puani 0.5 (notr, harmony null). `'red'` ve 8 haneli hex tek basina `neutral` harmony cikariyor (gercekte kirmizi) - Dusuk. `#f00` (3 hane) dogru isleniyor.
- **Bilinmeyen `fit` (`'tight'`, `'LOOSE'`)**: `null` kabul ediliyor, silhouette notr 0.6. Dusuk (buyuk harf `LOOSE` sessizce yok sayilir).
- **Bos/null `seasons`**: tum hava kosullarinda gecer (all-season gibi). **Buyuk harfli `'Summer'` veya Turkce `'yaz'`**: sicakta filtre disi kaliyor (`suitsWarm` false), soguk/sicak disinda gecer. Sicak havada (30 C) `ok top ('Summer')` outfit'te hic yok - sessiz kayip. Dusuk-Orta (DB degerleri sabitse sorun degil).
- **Kategori yazim hatasi** (`'Top'`, `'tops'`): sessizce yok sayiliyor (hic sonuc uretmiyor). Dusuk.
- **last_worn_date gelecekte (`2027-01-01`)**: freshness 0 (bugun giyilmis gibi). Orta-Dusuk. Oneri: `days < 0` -> never worn (0.8) ya da 1.0.
- **last_worn_date bozuk (`'garbage'`, `''`, `'14/10/2026'`, `'2026-10-14T10:00:00'`)**: 0.8 (hic giyilmemis). ISO zaman damgali deger bozuk sayiliyor (`T12:00:00` eklendigi icin). Dusuk (Supabase `date` kolonu 'YYYY-MM-DD' doner).
- **wornHistory'de bozuk tarih (`'garbage'` veya `''`) -> `co_occurrence` (h +0.3)**: **Hata.** `NaN < sixMonthsAgo` false, `NaN >= sevenDaysAgo` false olunca `foundInSixMonths = true` oluyor. Tekrar uret: `wornHistory:[{date:'garbage', outfits:{item_list:[top,bottom]}}]` -> `co_occurrence`. Beklenen: kayit atlanmali. Orta. Duzeltme: `if (Number.isNaN(entryTime)) continue;`.
- **Gelecek tarihli wornHistory (`2099-01-01`)**: `recent_repeat` (history 0). Dusuk.
- **`outfits: null`**: `none`, sorunsuz.
- **id=0 ve cift id**: id 0 sorunsuz. Cift id'li parcalar (a,b -> 0; c,d -> 5) wornHistory'de birbirinin yerine geciyor (a+c giyildi -> a|d, b|c, b|d de `recent_repeat`, 66 puan) ve cesitlilik cezasi birlesiyor. Dusuk (DB'de id benzersiz).

## 5. Performans

| Parca | Ust x Alt | Sure (gecmissiz) | 200 gecmis kaydi ile |
|---|---|---|---|
| 120 | 42 x 30 | 0.26 s | 0.38 s |
| 300 | 105 x 75 | 3.0 s | 3.6 s |
| 600 | 210 x 150 | 22 s | 26 s |

Gercekci bir 120 parcalik dolap (daha dengeli dagilimda) bunun altinda kalir. Sebep: her ust x alt cifti icin `pickComplement` ile tum ceket/ayakkabi/aksesuar adaylari icin renk analizi (hex ayristirma + HSL) tekrar tekrar yapiliyor, sonra tum kombinasyonlar uzerinde `selectDiverse` (limit x N). Oneri: `classifyColor` sonuclarini hex bazinda onbellekle; her ust/alt icin yan parca secimini kombinasyon basina degil renk-ozet basina yap; ya da once ust/alt ciftlerini hizli puanla, ilk ~200 cifte yan parca ekle (top-K budama); `selectDiverse`'u yalnizca ilk N'e uygula. Hedef: 300 parca < 300 ms.

## 6. Diger gozlemler

- **Elbise vs ust+alt adaleti**: stilsiz modda elbise ortalama 78.0 (hepsi esit, max 78), ust+alt ortalama 81.4 (max 88). Elbise icin desen puani sabit 0.75 ve `is_patterned` elbiseyi etkilemiyor (kod okumasi: stilsiz modda `isDress ? 0.75`), yani desenli/desensiz elbise ayni puan. Stilli modda fark kapaniyor (elbise ort. 71-82). Top-10'da elbise sayisi 2 (ogrenci dolabi, 22 C) - makul. Dusuk.
- **Desen cift sayimi / tutarsizligi**: stil secilmediginde desen yalnizca ust+alt'a bakar; stil secildiginde ayakkabi/aksesuar/ceket dahil tum parcalar sayilir. Desenli ayakkabi+canta: Minimal 3/10 (stilsiz 11/15, duz outfit Minimal 10/10); Maximalist'te 10/10 ama duz outfit 4/10. Yani stil acik/kapali iken ayni outfit farkli sayilir; yan parca deseni "2 desen" sayilip Minimal'i agir cezalandirabilir. Dusuk-Orta.
- **Weather puani dar aralik**: ara sicaklikta (cold..heat) yaz-only / kis-only 0.7, spring-fall 1.0 (bkz. Bulgu 3). Silhouette bilinmeyince 0.6 sabit - eksik fit etiketi olan parca ile etiketli parca arasinda sistematik bias yok ama etiketsiz parca hafifce one cikabilir (stil silhouette'i dusuk puanliyorsa).
- **Aksesuar**: `scarf` 20 C'de, `sunglasses` 16 C'de (yaz-only) secilebiliyor cunku aksesuar secimi `weatherWeight = 0` ile yalnizca renkle yapiliyor. Sicak/soguk bolgesinde filtre zaten eler; sadece ara bolgede gorulur. Dusuk-Orta (duzeltme: aksesuar icin weatherWeight 0.5).
- **Skor tabani**: `total >= 30` filtresi hicbir kosuda devreye girmedi (en dusuk gozlenen 57); fiilen olu kod.
- **Gecmis/tazelik**: tum parcalar dun giyildiyse siralama degismez (hepsi esit 0), outfit'ler yine de listeleniyor (iyi); gelecek tarihte ayni.

## Onerilen duzeltme sirasi

1. `checkCombinationHistory`: NaN tarihi atla (1 satir).
2. Esitlik kirmada `id` kullan (determinizm).
3. Performans: renk onbellegi + top-K budama.
4. Occasion etiketli parcaya bonus + bos sonuc mesaji; opsiyonel stil-occasion ipucu.
5. Ara bolgede mevsim cezasi (yaz-only/kis-only 0.7 -> ~0.4) ve aksesuar icin weatherWeight.
6. Yan parcalar (ceket/ayakkabi/aksesuar) icin "ekleme" opsiyonu ve ayri cesitlilik cezasi.
7. Ayarlarda `cold <= heat` dogrulamasi; gelecek last_worn_date -> yok say.
